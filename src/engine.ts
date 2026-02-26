import JSZip from 'jszip';
import { useVNStore } from './store';
import {
  parseBaseYaml,
  parseChapterYaml,
  parseConfigYaml,
  resolveChapterGame,
  type ParsedBaseYaml,
  type ParsedChapterYaml,
  type ParsedConfigYaml,
} from './parser';
import type {
  CharacterSlot,
  ConditionNode,
  GameData,
  InputRoute,
  Position,
  RouteHistoryEntry,
  RouteVarValue,
  StateAddMap,
  StateSetMap,
  StickerEnterEffect,
  StickerEnterOptions,
  StickerLeaveEffect,
  StickerLeaveOptions,
  StickerLength,
  StickerSlot,
} from './types';

type YouTubePlayer = {
  playVideo?: () => void;
  pauseVideo?: () => void;
  stopVideo?: () => void;
  loadVideoById?: (videoId: string) => void;
  setVolume?: (volume: number) => void;
};

type YouTubeGlobal = {
  Player: new (element: string | HTMLElement, options: Record<string, unknown>) => YouTubePlayer;
  PlayerState?: {
    PLAYING: number;
  };
};

declare global {
  interface Window {
    YT?: YouTubeGlobal;
    onYouTubeIframeAPIReady?: (() => void) | undefined;
  }
}

const AUTOSAVE_KEY = 'vn-engine-autosave';
const MAX_CHAPTERS = 101;
const MIN_CHAPTER_LOADING_MS = 600;
const CHAPTER_LOADED_HOLD_MS = 200;
const YOUTUBE_IFRAME_API_URL = 'https://www.youtube.com/iframe_api';
const YOUTUBE_PLAYER_HOST_ID = 'vn-youtube-player-host';
const DEFAULT_VIDEO_HOLD_TO_SKIP_MS = 800;
const EFFECT_DURATIONS: Record<string, number> = {
  shake: 280,
  flash: 350,
  zoom: 420,
  blur: 420,
  darken: 500,
  pulse: 500,
  tilt: 320,
};
const DEFAULT_STICKER_ENTER_EFFECT: StickerEnterEffect = 'fadeIn';
const DEFAULT_STICKER_ENTER_DURATION = 280;
const DEFAULT_STICKER_ENTER_EASING = 'ease';
const DEFAULT_STICKER_ENTER_DELAY = 0;
const DEFAULT_STICKER_LEAVE_EFFECT: StickerLeaveEffect = 'none';
const DEFAULT_STICKER_LEAVE_DURATION = 220;
const DEFAULT_STICKER_LEAVE_EASING = 'ease';
const DEFAULT_STICKER_LEAVE_DELAY = 0;

type SaveProgress = {
  chapterIndex: number;
  chapterPath?: string;
  sceneId: string;
  actionIndex: number;
  routeVars: Record<string, RouteVarValue>;
  routeHistory: RouteHistoryEntry[];
  resolvedEndingId?: string;
};

type PreparedChapter = {
  pathKey: string;
  name: string;
  baseUrl: string;
  assetOverrides: Record<string, string>;
  loadGame: () => Promise<GameData>;
  game?: GameData;
  gamePromise?: Promise<GameData>;
};

type RuntimeMode = 'url' | 'zip' | undefined;

let waitTimer: number | undefined;
let typeTimer: number | undefined;
let effectTimer: number | undefined;
let bgmAudio: HTMLAudioElement | undefined;
let bgmNeedsUnlock = false;
let bgmCurrentKind: 'audio' | 'youtube' | undefined;
let bgmCurrentKey: string | undefined;
let youtubeApiPromise: Promise<YouTubeGlobal> | undefined;
let youtubePlayer: YouTubePlayer | undefined;
let preparedChapters: PreparedChapter[] = [];
let activeChapterIndex = 0;
let objectUrls: string[] = [];
let stickerRenderKeySeed = 0;
const clearStickerTimers = new Map<string, number>();
let runtimeMode: RuntimeMode;
let urlGameRootBase = '';
let zipYamlByPathKey = new Map<string, JSZip.JSZipObject>();
let zipBlobAssetMap: Record<string, string> = {};
let zipAssetUrlByKey = new Map<string, string>();
let yamlTextCache = new Map<string, Promise<string | undefined>>();
let yamlExistenceCache = new Map<string, Promise<boolean>>();
let parsedConfigCache: ParsedConfigYaml | undefined;
let parsedConfigPromise: Promise<ParsedConfigYaml> | undefined;
let parsedBaseCache = new Map<string, Promise<ParsedBaseYaml | undefined>>();
let parsedChapterCache = new Map<string, Promise<ParsedChapterYaml>>();
let resolvedChapterGameCache = new Map<string, Promise<GameData>>();

async function waitNextFrame(): Promise<void> {
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

async function waitMs(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }
  await new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function ensureChapterGame(chapter: PreparedChapter): Promise<GameData> {
  if (chapter.game) {
    return chapter.game;
  }
  if (chapter.gamePromise) {
    return chapter.gamePromise;
  }

  chapter.gamePromise = chapter
    .loadGame()
    .then((game) => {
      chapter.game = game;
      return game;
    })
    .catch((error) => {
      chapter.gamePromise = undefined;
      throw error;
    });

  return chapter.gamePromise;
}

function clearTimers() {
  if (waitTimer) {
    window.clearTimeout(waitTimer);
    waitTimer = undefined;
  }
  if (typeTimer) {
    window.clearInterval(typeTimer);
    typeTimer = undefined;
  }
  if (effectTimer) {
    window.clearTimeout(effectTimer);
    effectTimer = undefined;
  }
  for (const timer of clearStickerTimers.values()) {
    window.clearTimeout(timer);
  }
  clearStickerTimers.clear();
}

function clearObjectUrls() {
  for (const url of objectUrls) {
    URL.revokeObjectURL(url);
  }
  objectUrls = [];
}

function extractYouTubeVideoId(url: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }

  const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
  const isYouTubeHost = host === 'youtu.be' || host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com');
  if (!isYouTubeHost) {
    return undefined;
  }

  if (host === 'youtu.be') {
    const shortId = parsed.pathname.split('/').filter(Boolean)[0];
    return shortId || undefined;
  }

  if (parsed.pathname === '/watch') {
    const watchId = parsed.searchParams.get('v') ?? undefined;
    return watchId || undefined;
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length >= 2 && ['embed', 'shorts', 'live'].includes(segments[0])) {
    return segments[1] || undefined;
  }

  return undefined;
}

function ensureYouTubePlayerHost(): HTMLElement {
  let host = document.getElementById(YOUTUBE_PLAYER_HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = YOUTUBE_PLAYER_HOST_ID;
    host.style.position = 'fixed';
    host.style.left = '-10000px';
    host.style.top = '-10000px';
    host.style.width = '1px';
    host.style.height = '1px';
    host.style.opacity = '0';
    host.style.pointerEvents = 'none';
    document.body.appendChild(host);
  }
  return host;
}

async function loadYouTubeApi(): Promise<YouTubeGlobal> {
  if (window.YT?.Player) {
    return window.YT;
  }
  if (youtubeApiPromise) {
    return youtubeApiPromise;
  }

  youtubeApiPromise = new Promise<YouTubeGlobal>((resolve, reject) => {
    const previousHandler = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousHandler?.();
      if (!window.YT?.Player) {
        reject(new Error('YouTube API loaded without Player'));
        return;
      }
      resolve(window.YT);
    };

    const existing = document.querySelector(`script[src="${YOUTUBE_IFRAME_API_URL}"]`);
    if (existing) {
      return;
    }

    const script = document.createElement('script');
    script.src = YOUTUBE_IFRAME_API_URL;
    script.async = true;
    script.onerror = () => reject(new Error('Failed to load YouTube iframe API'));
    document.head.appendChild(script);
  }).catch((error) => {
    youtubeApiPromise = undefined;
    throw error;
  });

  return youtubeApiPromise;
}

function stopAudioBgm() {
  if (!bgmAudio) {
    return;
  }
  bgmAudio.pause();
  bgmAudio = undefined;
}

function stopYouTubeBgm() {
  youtubePlayer?.stopVideo?.();
}

async function playYouTubeMusic(videoId: string) {
  bgmNeedsUnlock = true;
  try {
    const YT = await loadYouTubeApi();
    const host = ensureYouTubePlayerHost();
    const onReady = () => {
      if (bgmCurrentKind !== 'youtube' || bgmCurrentKey !== videoId) {
        return;
      }
      youtubePlayer?.setVolume?.(60);
      youtubePlayer?.playVideo?.();
    };
    const onStateChange = (event: { data: number }) => {
      const playingState = window.YT?.PlayerState?.PLAYING;
      if (typeof playingState === 'number' && event.data === playingState) {
        bgmNeedsUnlock = false;
      }
    };
    const onError = () => {
      bgmNeedsUnlock = true;
    };

    if (!youtubePlayer) {
      youtubePlayer = new YT.Player(host, {
        width: '1',
        height: '1',
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          loop: 1,
          playlist: videoId,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady,
          onStateChange,
          onError,
          onAutoplayBlocked: onError,
        },
      });
      return;
    }

    youtubePlayer.loadVideoById?.(videoId);
    youtubePlayer.setVolume?.(60);
    youtubePlayer.playVideo?.();
  } catch {
    bgmNeedsUnlock = true;
  }
}

function resetSession() {
  clearTimers();
  clearObjectUrls();
  preparedChapters = [];
  activeChapterIndex = 0;
  runtimeMode = undefined;
  urlGameRootBase = '';
  zipYamlByPathKey = new Map<string, JSZip.JSZipObject>();
  zipBlobAssetMap = {};
  zipAssetUrlByKey = new Map<string, string>();
  yamlTextCache = new Map<string, Promise<string | undefined>>();
  yamlExistenceCache = new Map<string, Promise<boolean>>();
  parsedConfigCache = undefined;
  parsedConfigPromise = undefined;
  parsedBaseCache = new Map<string, Promise<ParsedBaseYaml | undefined>>();
  parsedChapterCache = new Map<string, Promise<ParsedChapterYaml>>();
  resolvedChapterGameCache = new Map<string, Promise<GameData>>();
  useVNStore.getState().setChapterMeta(0, 0);
  useVNStore.getState().setChapterLoading(false, 0);
  useVNStore.getState().setError(undefined);
  useVNStore.getState().resetPresentation();
  useVNStore.getState().clearVideoCutscene();
  bgmNeedsUnlock = false;
  playMusic(undefined);
}

function resolveAssetWithOverrides(baseUrl: string, path: string, overrides: Record<string, string>): string {
  const normalized = normalizeAssetKey(path);
  const normalizedLower = normalized.toLowerCase();
  if (overrides[path]) {
    return overrides[path];
  }
  if (overrides[normalized]) {
    return overrides[normalized];
  }
  if (overrides[normalizedLower]) {
    return overrides[normalizedLower];
  }
  if (/^(blob:|data:|https?:)/i.test(path)) {
    return path;
  }
  try {
    return new URL(path, baseUrl).toString();
  } catch {
    return path;
  }
}

function resolveAsset(baseUrl: string, path: string): string {
  return resolveAssetWithOverrides(baseUrl, path, useVNStore.getState().assetOverrides);
}

function isJsonAsset(path: string): boolean {
  return /\.json$/i.test(path);
}

function buildCharacterSlot(baseUrl: string, id: string, basePath: string, emotion?: string): CharacterSlot {
  const source = resolveAsset(baseUrl, basePath);
  if (isJsonAsset(basePath) || isJsonAsset(source)) {
    return {
      id,
      kind: 'live2d',
      source,
      emotion,
    };
  }
  return {
    id,
    kind: 'image',
    source,
    emotion,
  };
}

function toCssLength(value: StickerLength | undefined, fallback: string): string {
  if (typeof value === 'number') {
    return `${value}%`;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  return fallback;
}

function toCssSize(value: StickerLength | undefined): string | undefined {
  if (typeof value === 'number') {
    return `${value}%`;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

function clampOpacity(value: number | undefined): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 1;
  }
  return Math.max(0, Math.min(1, value));
}

function clampStickerTiming(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }
  return Math.max(0, Math.min(5000, Math.floor(value)));
}

function normalizeStickerEnter(
  enter: StickerEnterEffect | StickerEnterOptions | undefined,
): Pick<StickerSlot, 'enterEffect' | 'enterDuration' | 'enterEasing' | 'enterDelay'> {
  if (!enter) {
    return {
      enterEffect: DEFAULT_STICKER_ENTER_EFFECT,
      enterDuration: DEFAULT_STICKER_ENTER_DURATION,
      enterEasing: DEFAULT_STICKER_ENTER_EASING,
      enterDelay: DEFAULT_STICKER_ENTER_DELAY,
    };
  }

  if (typeof enter === 'string') {
    return {
      enterEffect: enter,
      enterDuration: DEFAULT_STICKER_ENTER_DURATION,
      enterEasing: DEFAULT_STICKER_ENTER_EASING,
      enterDelay: DEFAULT_STICKER_ENTER_DELAY,
    };
  }

  const easing = typeof enter.easing === 'string' && enter.easing.trim().length > 0 ? enter.easing.trim() : DEFAULT_STICKER_ENTER_EASING;
  return {
    enterEffect: enter.effect ?? DEFAULT_STICKER_ENTER_EFFECT,
    enterDuration: clampStickerTiming(enter.duration, DEFAULT_STICKER_ENTER_DURATION),
    enterEasing: easing,
    enterDelay: clampStickerTiming(enter.delay, DEFAULT_STICKER_ENTER_DELAY),
  };
}

function normalizeStickerLeave(
  leave: StickerLeaveEffect | StickerLeaveOptions | undefined,
): Pick<StickerSlot, 'leaveEffect' | 'leaveDuration' | 'leaveEasing' | 'leaveDelay'> {
  if (!leave) {
    return {
      leaveEffect: DEFAULT_STICKER_LEAVE_EFFECT,
      leaveDuration: DEFAULT_STICKER_LEAVE_DURATION,
      leaveEasing: DEFAULT_STICKER_LEAVE_EASING,
      leaveDelay: DEFAULT_STICKER_LEAVE_DELAY,
    };
  }

  if (typeof leave === 'string') {
    return {
      leaveEffect: leave,
      leaveDuration: DEFAULT_STICKER_LEAVE_DURATION,
      leaveEasing: DEFAULT_STICKER_LEAVE_EASING,
      leaveDelay: DEFAULT_STICKER_LEAVE_DELAY,
    };
  }

  const easing = typeof leave.easing === 'string' && leave.easing.trim().length > 0 ? leave.easing.trim() : DEFAULT_STICKER_LEAVE_EASING;
  return {
    leaveEffect: leave.effect ?? DEFAULT_STICKER_LEAVE_EFFECT,
    leaveDuration: clampStickerTiming(leave.duration, DEFAULT_STICKER_LEAVE_DURATION),
    leaveEasing: easing,
    leaveDelay: clampStickerTiming(leave.delay, DEFAULT_STICKER_LEAVE_DELAY),
  };
}

function buildStickerSlot(
  baseUrl: string,
  id: string,
  imagePath: string,
  placement: {
    x?: StickerLength;
    y?: StickerLength;
    width?: StickerLength;
    height?: StickerLength;
    anchorX?: StickerSlot['anchorX'];
    anchorY?: StickerSlot['anchorY'];
    rotate?: number;
    opacity?: number;
    zIndex?: number;
    enter?: StickerEnterEffect | StickerEnterOptions;
  },
): StickerSlot {
  const enter = normalizeStickerEnter(placement.enter);
  const leave = normalizeStickerLeave(undefined);
  return {
    id,
    source: resolveAsset(baseUrl, imagePath),
    x: toCssLength(placement.x, '50%'),
    y: toCssLength(placement.y, '50%'),
    width: toCssSize(placement.width),
    height: toCssSize(placement.height),
    anchorX: placement.anchorX ?? 'center',
    anchorY: placement.anchorY ?? 'center',
    rotate: typeof placement.rotate === 'number' ? placement.rotate : 0,
    opacity: clampOpacity(placement.opacity),
    zIndex: typeof placement.zIndex === 'number' ? placement.zIndex : 0,
    enterEffect: enter.enterEffect,
    enterDuration: enter.enterDuration,
    enterEasing: enter.enterEasing,
    enterDelay: enter.enterDelay,
    leaveEffect: leave.leaveEffect,
    leaveDuration: leave.leaveDuration,
    leaveEasing: leave.leaveEasing,
    leaveDelay: leave.leaveDelay,
    leaving: false,
    renderKey: ++stickerRenderKeySeed,
  };
}

function parseClearStickerTarget(target: string | { id: string; leave?: StickerLeaveEffect | StickerLeaveOptions }): {
  id: string;
  leave?: StickerLeaveEffect | StickerLeaveOptions;
} {
  if (typeof target === 'string') {
    return { id: target };
  }
  return { id: target.id, leave: target.leave };
}

function cancelStickerClearTimer(id: string) {
  const timer = clearStickerTimers.get(id);
  if (typeof timer === 'number') {
    window.clearTimeout(timer);
    clearStickerTimers.delete(id);
  }
}

function clearStickerWithLeave(id: string, leave?: StickerLeaveEffect | StickerLeaveOptions): void {
  if (id === 'all') {
    const stickerIds = Object.keys(useVNStore.getState().stickers);
    for (const stickerId of stickerIds) {
      clearStickerWithLeave(stickerId, leave);
    }
    return;
  }

  cancelStickerClearTimer(id);
  const sticker = useVNStore.getState().stickers[id];
  if (!sticker) {
    return;
  }
  const normalizedLeave = normalizeStickerLeave(leave);
  if (normalizedLeave.leaveEffect === 'none') {
    useVNStore.getState().clearSticker(id);
    return;
  }

  useVNStore.getState().setSticker({
    ...sticker,
    ...normalizedLeave,
    leaving: true,
    renderKey: ++stickerRenderKeySeed,
  });

  const totalMs = Math.max(0, normalizedLeave.leaveDelay + normalizedLeave.leaveDuration);
  const timer = window.setTimeout(() => {
    clearStickerTimers.delete(id);
    useVNStore.getState().clearSticker(id);
  }, totalMs);
  clearStickerTimers.set(id, timer);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function rewriteLive2DModelJson(raw: string, resolveRef: (relativePath: string) => string | undefined): string | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!isRecord(parsed)) {
    return undefined;
  }

  const fileRefs = parsed.FileReferences;
  if (!isRecord(fileRefs)) {
    return undefined;
  }

  let changed = false;
  const resolveString = (value: unknown): string | undefined => {
    if (typeof value !== 'string' || /^(blob:|data:|https?:)/i.test(value)) {
      return undefined;
    }
    return resolveRef(value);
  };
  const rewriteStringField = (container: Record<string, unknown>, key: string) => {
    const next = resolveString(container[key]);
    if (next && next !== container[key]) {
      container[key] = next;
      changed = true;
    }
  };

  rewriteStringField(fileRefs, 'Moc');
  rewriteStringField(fileRefs, 'Physics');
  rewriteStringField(fileRefs, 'Pose');
  rewriteStringField(fileRefs, 'UserData');
  rewriteStringField(fileRefs, 'DisplayInfo');

  const textures = fileRefs.Textures;
  if (Array.isArray(textures)) {
    const rewrittenTextures = textures.map((entry) => resolveString(entry) ?? entry);
    fileRefs.Textures = rewrittenTextures;
    if (textures.some((entry, idx) => rewrittenTextures[idx] !== entry)) {
      changed = true;
    }
  }

  const expressions = fileRefs.Expressions;
  if (Array.isArray(expressions)) {
    for (const expression of expressions) {
      if (!isRecord(expression)) {
        continue;
      }
      rewriteStringField(expression, 'File');
    }
  }

  const motions = fileRefs.Motions;
  if (isRecord(motions)) {
    for (const motionGroup of Object.values(motions)) {
      if (!Array.isArray(motionGroup)) {
        continue;
      }
      for (const motion of motionGroup) {
        if (!isRecord(motion)) {
          continue;
        }
        rewriteStringField(motion, 'File');
        rewriteStringField(motion, 'Sound');
      }
    }
  }

  return changed ? JSON.stringify(parsed) : undefined;
}

function parseInlineSpeed(text: string): { speed?: number; text: string } {
  const match = text.match(/<speed=(\d+)>([\s\S]*?)<\/speed>/i);
  if (!match) {
    return { text };
  }
  return {
    speed: Number(match[1]),
    text: text.replace(/<speed=\d+>([\s\S]*?)<\/speed>/gi, '$1'),
  };
}

function parseCharacterRef(raw?: string): { id?: string; emotion?: string } {
  if (!raw) {
    return {};
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }
  const [id, emotion] = trimmed.split('.', 2);
  if (!id) {
    return {};
  }
  return { id, emotion };
}

function resolveSayPresentation(char?: string, withChars?: string[]): {
  speakerId?: string;
  speakerName?: string;
  visibleCharacterIds: string[];
  emotionRefs: Array<{ id: string; emotion?: string }>;
} {
  const speaker = parseCharacterRef(char);
  if (!speaker.id) {
    return {
      speakerId: undefined,
      speakerName: undefined,
      visibleCharacterIds: [],
      emotionRefs: [],
    };
  }

  const withRefs = (withChars ?? [])
    .map((raw) => parseCharacterRef(raw))
    .filter((ref): ref is { id: string; emotion?: string } => Boolean(ref.id));
  const visibleCharacterIds = [speaker.id];
  const visibleSet = new Set(visibleCharacterIds);
  for (const ref of withRefs) {
    if (visibleSet.has(ref.id)) {
      continue;
    }
    visibleSet.add(ref.id);
    visibleCharacterIds.push(ref.id);
  }

  return {
    speakerId: speaker.id,
    speakerName: speaker.id,
    visibleCharacterIds,
    emotionRefs: [{ id: speaker.id, emotion: speaker.emotion }, ...withRefs],
  };
}

function syncCharacterEmotions(
  game: GameData,
  baseUrl: string,
  refs: Array<{ id: string; emotion?: string }>,
) {
  const emotionById = new Map<string, string>();
  for (const ref of refs) {
    if (!ref.emotion) {
      continue;
    }
    emotionById.set(ref.id, ref.emotion);
  }
  if (emotionById.size === 0) {
    return;
  }

  const state = useVNStore.getState();
  const positions: Position[] = ['left', 'center', 'right'];
  for (const position of positions) {
    const slot = state.characters[position];
    if (!slot) {
      continue;
    }
    const emotion = emotionById.get(slot.id);
    if (!emotion) {
      continue;
    }
    const charDef = game.assets.characters[slot.id];
    if (!charDef) {
      continue;
    }
    const assetPath = charDef.emotions?.[emotion] ?? charDef.base;
    useVNStore.getState().setCharacter(position, buildCharacterSlot(baseUrl, slot.id, assetPath, emotion));
  }
}

function saveProgress(sceneId: string, actionIndex: number) {
  const state = useVNStore.getState();
  const payload: SaveProgress = {
    chapterIndex: activeChapterIndex,
    chapterPath: getCurrentChapterPathKey(),
    sceneId,
    actionIndex,
    routeVars: state.routeVars,
    routeHistory: state.routeHistory,
    resolvedEndingId: state.resolvedEndingId,
  };
  localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
}

function loadProgress(): SaveProgress | undefined {
  const raw = localStorage.getItem(AUTOSAVE_KEY);
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<SaveProgress> & {
      sceneId?: string;
      actionIndex?: number;
      chapterPath?: unknown;
      routeVars?: unknown;
      routeHistory?: unknown;
      resolvedEndingId?: unknown;
    };
    if (typeof parsed.sceneId !== 'string' || typeof parsed.actionIndex !== 'number') {
      return undefined;
    }
    const routeVars: Record<string, RouteVarValue> = {};
    if (parsed.routeVars && typeof parsed.routeVars === 'object' && !Array.isArray(parsed.routeVars)) {
      for (const [key, value] of Object.entries(parsed.routeVars as Record<string, unknown>)) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          routeVars[key] = value;
        }
      }
    }
    const routeHistory = Array.isArray(parsed.routeHistory)
      ? (parsed.routeHistory.filter((entry): entry is RouteHistoryEntry => {
          if (!entry || typeof entry !== 'object') {
            return false;
          }
          const value = entry as Partial<RouteHistoryEntry>;
          return (
            (value.kind === 'choice' || value.kind === 'input') &&
            typeof value.key === 'string' &&
            typeof value.value === 'string' &&
            typeof value.sceneId === 'string' &&
            typeof value.actionIndex === 'number'
          );
        }) as RouteHistoryEntry[])
      : [];
    return {
      chapterIndex: typeof parsed.chapterIndex === 'number' ? parsed.chapterIndex : 0,
      chapterPath:
        typeof parsed.chapterPath === 'string'
          ? normalizeGotoChapterTarget(parsed.chapterPath) ?? normalizeChapterPathKey(parsed.chapterPath)
          : undefined,
      sceneId: parsed.sceneId,
      actionIndex: parsed.actionIndex,
      routeVars,
      routeHistory,
      resolvedEndingId: typeof parsed.resolvedEndingId === 'string' ? parsed.resolvedEndingId : undefined,
    };
  } catch {
    return undefined;
  }
}

function playMusic(url?: string) {
  if (!url) {
    stopAudioBgm();
    stopYouTubeBgm();
    bgmCurrentKind = undefined;
    bgmCurrentKey = undefined;
    bgmNeedsUnlock = false;
    return;
  }

  const youtubeVideoId = extractYouTubeVideoId(url);
  if (youtubeVideoId) {
    stopAudioBgm();
    if (bgmCurrentKind === 'youtube' && bgmCurrentKey === youtubeVideoId) {
      if (bgmNeedsUnlock) {
        youtubePlayer?.playVideo?.();
      }
      return;
    }
    bgmCurrentKind = 'youtube';
    bgmCurrentKey = youtubeVideoId;
    void playYouTubeMusic(youtubeVideoId);
    return;
  }

  stopYouTubeBgm();
  if (bgmCurrentKind === 'audio' && bgmCurrentKey === url && bgmAudio) {
    if (bgmNeedsUnlock || bgmAudio.paused) {
      void bgmAudio.play().then(() => {
        bgmNeedsUnlock = false;
      }).catch(() => {
        bgmNeedsUnlock = true;
      });
    }
    return;
  }
  stopAudioBgm();
  bgmAudio = new Audio(url);
  bgmAudio.loop = true;
  bgmAudio.volume = 0.6;
  bgmCurrentKind = 'audio';
  bgmCurrentKey = url;
  void bgmAudio.play().then(() => {
    bgmNeedsUnlock = false;
  }).catch(() => {
    bgmNeedsUnlock = true;
  });
}

function playSound(url: string) {
  const audio = new Audio(url);
  audio.volume = 0.8;
  void audio.play().catch(() => undefined);
}

export function unlockAudioFromGesture() {
  if (!bgmCurrentKind) {
    return;
  }
  if (bgmCurrentKind === 'youtube') {
    youtubePlayer?.playVideo?.();
    return;
  }
  if (!bgmAudio) {
    return;
  }
  if (!bgmNeedsUnlock && !bgmAudio.paused) {
    return;
  }
  void bgmAudio.play().then(() => {
    bgmNeedsUnlock = false;
  }).catch(() => {
    bgmNeedsUnlock = true;
  });
}

function incrementCursor() {
  const state = useVNStore.getState();
  useVNStore.getState().setCursor(state.currentSceneId, state.actionIndex + 1);
  if (state.game?.settings.autoSave) {
    saveProgress(state.currentSceneId, state.actionIndex + 1);
  }
}

function setCursor(sceneId: string, actionIndex: number) {
  useVNStore.getState().setCursor(sceneId, actionIndex);
  if (useVNStore.getState().game?.settings.autoSave) {
    saveProgress(sceneId, actionIndex);
  }
}

function typeDialog(text: string, speed: number, onDone: () => void) {
  if (text.length === 0) {
    useVNStore.getState().setDialog({ typing: false, visibleText: '' });
    onDone();
    return;
  }
  const cps = Math.max(1, speed);
  let idx = 0;
  useVNStore.getState().setDialog({ typing: true, visibleText: '' });
  typeTimer = window.setInterval(() => {
    idx += 1;
    useVNStore.getState().setDialog({ visibleText: text.slice(0, idx) });
    if (idx >= text.length) {
      if (typeTimer) {
        window.clearInterval(typeTimer);
        typeTimer = undefined;
      }
      useVNStore.getState().setDialog({ typing: false, visibleText: text });
      onDone();
    }
  }, Math.max(16, Math.floor(1000 / cps)));
}

function normalizeInputAnswer(value: string): string {
  return value.trim();
}

function getInputErrorMessage(errors: string[], attemptCount: number): string {
  const lastIdx = errors.length - 1;
  if (lastIdx < 0) {
    return '정답이 아닙니다.';
  }
  const idx = Math.max(0, Math.min(attemptCount - 1, lastIdx));
  return errors[idx];
}

function applySetToVars(target: Record<string, RouteVarValue>, setMap?: StateSetMap): void {
  if (!setMap) {
    return;
  }
  for (const [key, value] of Object.entries(setMap)) {
    target[key] = value;
  }
}

function applyAddToVars(target: Record<string, RouteVarValue>, addMap?: StateAddMap): void {
  if (!addMap) {
    return;
  }
  for (const [key, delta] of Object.entries(addMap)) {
    const current = target[key];
    if (typeof current !== 'number') {
      continue;
    }
    target[key] = current + delta;
  }
}

function applyStateSet(setMap?: StateSetMap): void {
  if (!setMap) {
    return;
  }
  useVNStore.getState().patchRouteVars(setMap);
}

function applyStateAdd(addMap?: StateAddMap): void {
  if (!addMap) {
    return;
  }
  useVNStore.getState().addRouteVars(addMap);
}

function compareConditionLeaf(
  left: RouteVarValue,
  op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in',
  right: RouteVarValue | RouteVarValue[],
): boolean {
  switch (op) {
    case 'eq':
      return !Array.isArray(right) && left === right;
    case 'ne':
      return !Array.isArray(right) && left !== right;
    case 'gt':
      return typeof left === 'number' && !Array.isArray(right) && typeof right === 'number' && left > right;
    case 'gte':
      return typeof left === 'number' && !Array.isArray(right) && typeof right === 'number' && left >= right;
    case 'lt':
      return typeof left === 'number' && !Array.isArray(right) && typeof right === 'number' && left < right;
    case 'lte':
      return typeof left === 'number' && !Array.isArray(right) && typeof right === 'number' && left <= right;
    case 'in':
      return Array.isArray(right) && right.includes(left);
    default:
      return false;
  }
}

function evaluateCondition(condition: ConditionNode, vars: Record<string, RouteVarValue>): boolean {
  if ('all' in condition) {
    return condition.all.every((entry) => evaluateCondition(entry, vars));
  }
  if ('any' in condition) {
    return condition.any.some((entry) => evaluateCondition(entry, vars));
  }
  if ('not' in condition) {
    return !evaluateCondition(condition.not, vars);
  }
  const left = vars[condition.var];
  return compareConditionLeaf(left, condition.op, condition.value);
}

function resolveAutoEndingId(game: GameData, vars: Record<string, RouteVarValue>): string | undefined {
  const endingRules = game.endingRules ?? [];
  for (const rule of endingRules) {
    if (!evaluateCondition(rule.when, vars)) {
      continue;
    }
    if (game.endings?.[rule.ending]) {
      return rule.ending;
    }
  }

  if (game.defaultEnding && game.endings?.[game.defaultEnding]) {
    return game.defaultEnding;
  }

  return undefined;
}

function finishStory(endingId?: string): void {
  useVNStore.getState().setResolvedEndingId(endingId);
  useVNStore.getState().setFinished(true);
  useVNStore.getState().setWaitingInput(false);
  useVNStore.getState().clearInputGate();
  useVNStore.getState().clearChoiceGate();
  useVNStore.getState().setDialog({ speaker: undefined, speakerId: undefined, fullText: '', visibleText: '', typing: false });
  const state = useVNStore.getState();
  if (state.game?.settings.autoSave) {
    saveProgress(state.currentSceneId, state.actionIndex);
  }
}

function mergeRouteVarsWithDefaults(
  defaults: Record<string, RouteVarValue> | undefined,
  current: Record<string, RouteVarValue>,
  override?: Record<string, RouteVarValue>,
): Record<string, RouteVarValue> {
  return {
    ...(defaults ?? {}),
    ...current,
    ...(override ?? {}),
  };
}

function collectAssetPaths(game: GameData): string[] {
  const paths = new Set<string>();
  Object.values(game.assets.backgrounds).forEach((path) => paths.add(path));
  for (const character of Object.values(game.assets.characters)) {
    paths.add(character.base);
    Object.values(character.emotions ?? {}).forEach((path) => paths.add(path));
  }
  Object.values(game.assets.music).forEach((path) => paths.add(path));
  Object.values(game.assets.sfx).forEach((path) => paths.add(path));
  for (const scene of Object.values(game.scenes)) {
    for (const action of scene.actions) {
      if ('video' in action && !extractYouTubeVideoId(action.video.src)) {
        paths.add(action.video.src);
      }
    }
  }
  return [...paths];
}

function normalizeAssetKey(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/^(\.\/|\/)+/, '');
  try {
    return decodeURIComponent(normalized);
  } catch {
    return normalized;
  }
}

function collapsePathDots(path: string): string {
  const normalized = normalizeAssetKey(path);
  const parts = normalized.split('/');
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') {
      continue;
    }
    if (part === '..') {
      if (stack.length > 0) {
        stack.pop();
      }
      continue;
    }
    stack.push(part);
  }
  return stack.join('/');
}

function normalizeChapterPathKey(rawPath: string): string {
  const normalized = collapsePathDots(rawPath.replace(/^(\.\/|\/)+/, ''));
  return `./${normalized}`;
}

function chapterPathKeyToFilePath(pathKey: string): string {
  return pathKey.replace(/^(\.\/|\/)+/, '');
}

function parseNumberedChapterPath(pathKey: string): { dir: string; number: number } | undefined {
  const filePath = chapterPathKeyToFilePath(pathKey);
  const match = filePath.match(/^(.*\/)?(\d+)\.ya?ml$/i);
  if (!match) {
    return undefined;
  }
  return {
    dir: match[1] ?? '',
    number: Number(match[2]),
  };
}

function getCurrentChapterPathKey(): string | undefined {
  return preparedChapters[activeChapterIndex]?.pathKey;
}

function normalizeGotoChapterTarget(rawTarget: string): string | undefined {
  const trimmed = rawTarget.trim();
  if (!trimmed.startsWith('./') && !trimmed.startsWith('/')) {
    return undefined;
  }
  const normalizedSlashes = trimmed.replace(/\\/g, '/');
  const withoutPrefix = normalizedSlashes.replace(/^(\.\/|\/)+/, '');
  if (!withoutPrefix) {
    return undefined;
  }
  if (withoutPrefix.split('/').some((segment) => segment === '..')) {
    return undefined;
  }
  const withExt = /\.(ya?ml)$/i.test(withoutPrefix) ? withoutPrefix : `${withoutPrefix}.yaml`;
  return normalizeChapterPathKey(withExt);
}

function buildNumberedChapterCandidatePaths(dir: string, number: number): string[] {
  return [`${dir}${number}.yaml`, `${dir}${number}.yml`];
}

function setAssetOverride(overrides: Record<string, string>, path: string, url: string) {
  overrides[path] = url;
  const normalized = normalizeAssetKey(path);
  const normalizedLower = normalized.toLowerCase();
  overrides[normalized] = url;
  overrides[`./${normalized}`] = url;
  overrides[`/${normalized}`] = url;
  overrides[normalizedLower] = url;
  overrides[`./${normalizedLower}`] = url;
  overrides[`/${normalizedLower}`] = url;
}

function isImageAsset(path: string): boolean {
  return /\.(png|jpe?g|webp|gif|svg)$/i.test(path);
}

function detectMimeType(path: string): string | undefined {
  const lower = path.toLowerCase();
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'text/yaml';
  return undefined;
}

function startVideoCutscene(src: string, holdToSkipMs?: number) {
  const resolvedSrc = resolveAsset(useVNStore.getState().baseUrl, src);
  const youtubeId = extractYouTubeVideoId(src) ?? extractYouTubeVideoId(resolvedSrc);
  useVNStore.getState().setBusy(true);
  useVNStore.getState().setWaitingInput(false);
  useVNStore.getState().clearInputGate();
  useVNStore.getState().clearChoiceGate();
  useVNStore.getState().setDialog({ speaker: undefined, speakerId: undefined, fullText: '', visibleText: '', typing: false });
  useVNStore.getState().setVideoCutscene({
    active: true,
    src: resolvedSrc,
    youtubeId,
    holdToSkipMs:
      typeof holdToSkipMs === 'number'
        ? Math.max(300, Math.min(5000, Math.floor(holdToSkipMs)))
        : DEFAULT_VIDEO_HOLD_TO_SKIP_MS,
    guideVisible: false,
    skipProgress: 0,
  });
}

function finishVideoCutscene() {
  const state = useVNStore.getState();
  if (!state.videoCutscene.active) {
    return;
  }
  useVNStore.getState().clearVideoCutscene();
  useVNStore.getState().setBusy(false);
  incrementCursor();
  runToNextPause();
}

export function revealVideoSkipGuide() {
  const state = useVNStore.getState();
  if (!state.videoCutscene.active) {
    return;
  }
  useVNStore.getState().setVideoCutscene({ guideVisible: true });
}

export function updateVideoSkipProgress(progress: number) {
  const state = useVNStore.getState();
  if (!state.videoCutscene.active) {
    return;
  }
  useVNStore.getState().setVideoCutscene({ skipProgress: Math.max(0, Math.min(1, progress)) });
}

export function resetVideoSkipProgress() {
  const state = useVNStore.getState();
  if (!state.videoCutscene.active) {
    return;
  }
  useVNStore.getState().setVideoCutscene({ skipProgress: 0 });
}

export function skipVideoCutscene() {
  finishVideoCutscene();
}

export function completeVideoCutscene() {
  finishVideoCutscene();
}

async function warmImageDecodeUrl(url: string) {
  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to decode preloaded image'));
    img.src = url;
    if (typeof img.decode === 'function') {
      void img.decode().then(resolve).catch(reject);
    }
  });
}

async function preloadChapterAssets(chapter: PreparedChapter, game: GameData, chapterLabel: string) {
  const paths = collectAssetPaths(game);
  if (paths.length === 0) {
    useVNStore.getState().setChapterLoading(true, 1, `${chapterLabel} loading...`);
    return;
  }

  for (let idx = 0; idx < paths.length; idx += 1) {
    const path = paths[idx];
    const normalized = normalizeAssetKey(path);
    const existing =
      chapter.assetOverrides[path] ??
      chapter.assetOverrides[normalized] ??
      chapter.assetOverrides[`./${normalized}`] ??
      chapter.assetOverrides[`/${normalized}`];
    let resolvedUrl: string | undefined;

    if (/^(blob:|data:)/i.test(path)) {
      resolvedUrl = path;
    } else if (existing && /^(blob:|data:)/i.test(existing)) {
      resolvedUrl = existing;
    } else {
      const sourceUrl = resolveAssetWithOverrides(chapter.baseUrl, path, chapter.assetOverrides);
      if (/^(blob:|data:|https?:)/i.test(sourceUrl)) {
        resolvedUrl = sourceUrl;
      } else if (isJsonAsset(path)) {
        const response = await fetch(sourceUrl, { cache: 'force-cache' });
        if (!response.ok) {
          throw new Error(`Failed to preload asset: ${path}`);
        }
        resolvedUrl = sourceUrl;
      } else {
        const response = await fetch(sourceUrl, { cache: 'force-cache' });
        if (!response.ok) {
          throw new Error(`Failed to preload asset: ${path}`);
        }
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        objectUrls.push(blobUrl);
        setAssetOverride(chapter.assetOverrides, path, blobUrl);
        resolvedUrl = blobUrl;
      }
    }

    if (resolvedUrl && isImageAsset(path)) {
      try {
        await warmImageDecodeUrl(resolvedUrl);
      } catch {
        // Keep execution flowing even if a specific image decode fails.
      }
    }

    useVNStore.getState().setChapterLoading(true, (idx + 1) / paths.length, `${chapterLabel} loading...`);
  }
}

function restorePresentationToCursor(chapter: PreparedChapter, game: GameData, resume: SaveProgress) {
  const sceneOrder = game.script.map((entry) => entry.scene);
  if (sceneOrder.length === 0) {
    return;
  }

  let sceneId = sceneOrder[0];
  let actionIndex = 0;
  let guard = 0;
  let musicUrl: string | undefined;

  const setBg = useVNStore.getState().setBackground;
  const setSticker = useVNStore.getState().setSticker;
  const clearSticker = useVNStore.getState().clearSticker;
  const clearAllStickers = useVNStore.getState().clearAllStickers;
  const setChar = useVNStore.getState().setCharacter;
  const setMusic = useVNStore.getState().setMusic;
  const setVisibleCharacters = useVNStore.getState().setVisibleCharacters;
  const promoteSpeaker = useVNStore.getState().promoteSpeaker;
  const restoreVars = mergeRouteVarsWithDefaults(game.state?.defaults, {});
  const historyByCursor = new Map<string, RouteHistoryEntry>();
  for (const entry of resume.routeHistory) {
    const key = `${entry.sceneId}:${entry.actionIndex}`;
    historyByCursor.set(key, entry);
  }

  while (guard < 20000) {
    guard += 1;
    if (sceneId === resume.sceneId && actionIndex === resume.actionIndex) {
      break;
    }

    const scene = game.scenes[sceneId];
    if (!scene) {
      break;
    }
    const action = scene.actions[actionIndex];
    if (!action) {
      const orderIdx = sceneOrder.indexOf(sceneId);
      const nextScene = sceneOrder[orderIdx + 1];
      if (!nextScene) {
        break;
      }
      sceneId = nextScene;
      actionIndex = 0;
      continue;
    }

    if ('bg' in action) {
      setBg(resolveAsset(chapter.baseUrl, game.assets.backgrounds[action.bg]));
      actionIndex += 1;
      continue;
    }
    if ('sticker' in action) {
      const path = game.assets.backgrounds[action.sticker.image];
      cancelStickerClearTimer(action.sticker.id);
      setSticker(buildStickerSlot(chapter.baseUrl, action.sticker.id, path, action.sticker));
      actionIndex += 1;
      continue;
    }
    if ('clearSticker' in action) {
      const target = parseClearStickerTarget(action.clearSticker);
      if (target.id === 'all') {
        clearAllStickers();
      } else {
        clearSticker(target.id);
      }
      actionIndex += 1;
      continue;
    }
    if ('char' in action) {
      const charDef = game.assets.characters[action.char.id];
      const assetPath = action.char.emotion ? charDef.emotions?.[action.char.emotion] ?? charDef.base : charDef.base;
      setChar(action.char.position, buildCharacterSlot(chapter.baseUrl, action.char.id, assetPath, action.char.emotion));
      actionIndex += 1;
      continue;
    }
    if ('music' in action) {
      musicUrl = resolveAsset(chapter.baseUrl, game.assets.music[action.music]);
      actionIndex += 1;
      continue;
    }
    if ('set' in action) {
      applySetToVars(restoreVars, action.set);
      actionIndex += 1;
      continue;
    }
    if ('add' in action) {
      applyAddToVars(restoreVars, action.add);
      actionIndex += 1;
      continue;
    }
    if ('choice' in action) {
      const history = historyByCursor.get(`${sceneId}:${actionIndex}`);
      if (history?.kind === 'choice') {
        const selected = action.choice.options.find((option) => option.text === history.value);
        if (selected) {
          applySetToVars(restoreVars, selected.set);
          applyAddToVars(restoreVars, selected.add);
          if (selected.goto) {
            const chapterTarget = normalizeGotoChapterTarget(selected.goto);
            if (chapterTarget) {
              break;
            }
            sceneId = selected.goto;
            actionIndex = 0;
            continue;
          }
        }
      }
      actionIndex += 1;
      continue;
    }
    if ('branch' in action) {
      const matched = action.branch.cases.find((branchCase) => evaluateCondition(branchCase.when, restoreVars));
      if (matched) {
        const chapterTarget = normalizeGotoChapterTarget(matched.goto);
        if (chapterTarget) {
          break;
        }
        sceneId = matched.goto;
        actionIndex = 0;
        continue;
      }
      if (action.branch.default) {
        const chapterTarget = normalizeGotoChapterTarget(action.branch.default);
        if (chapterTarget) {
          break;
        }
        sceneId = action.branch.default;
        actionIndex = 0;
        continue;
      }
      actionIndex += 1;
      continue;
    }
    if ('input' in action) {
      const history = historyByCursor.get(`${sceneId}:${actionIndex}`);
      if (history?.kind === 'input') {
        if (action.input.saveAs) {
          restoreVars[action.input.saveAs] = history.value;
        }
        const matchedRoute = action.input.routes.find(
          (route) => normalizeInputAnswer(route.equals) === normalizeInputAnswer(history.value),
        );
        if (matchedRoute) {
          applySetToVars(restoreVars, matchedRoute.set);
          applyAddToVars(restoreVars, matchedRoute.add);
          if (matchedRoute.goto) {
            const chapterTarget = normalizeGotoChapterTarget(matchedRoute.goto);
            if (chapterTarget) {
              break;
            }
            sceneId = matchedRoute.goto;
            actionIndex = 0;
            continue;
          }
        }
      }
      actionIndex += 1;
      continue;
    }
    if ('goto' in action) {
      const chapterTarget = normalizeGotoChapterTarget(action.goto);
      if (chapterTarget) {
        break;
      }
      sceneId = action.goto;
      actionIndex = 0;
      continue;
    }
    if ('say' in action) {
      const presentation = resolveSayPresentation(action.say.char, action.say.with);
      promoteSpeaker(presentation.speakerId);
      setVisibleCharacters(presentation.visibleCharacterIds);
      syncCharacterEmotions(game, chapter.baseUrl, presentation.emotionRefs);
      actionIndex += 1;
      continue;
    }

    actionIndex += 1;
  }

  setMusic(musicUrl);
  playMusic(musicUrl);
}

async function startChapter(chapterIndex: number, resume?: SaveProgress) {
  const chapter = preparedChapters[chapterIndex];
  if (!chapter) {
    useVNStore.getState().setError({ message: `Chapter not found: ${chapterIndex}` });
    return;
  }

  try {
    activeChapterIndex = chapterIndex;
    useVNStore.getState().setChapterMeta(chapterIndex + 1, preparedChapters.length);
    const chapterLabel = 'Chapter';
    const loadStartedAt = performance.now();
    useVNStore.getState().setChapterLoading(true, 0, `${chapterLabel} loading...`);
    const game = await ensureChapterGame(chapter);
    await preloadChapterAssets(chapter, game, chapterLabel);
    const elapsed = performance.now() - loadStartedAt;
    await waitMs(MIN_CHAPTER_LOADING_MS - elapsed);
    useVNStore.getState().setChapterLoading(true, 1, `${chapterLabel} loaded`);
    await waitNextFrame();
    await waitMs(CHAPTER_LOADED_HOLD_MS);
    useVNStore.getState().setChapterLoading(false, 1, `${chapterLabel} loaded`);

    useVNStore.getState().setGame(game, chapter.baseUrl, chapter.assetOverrides);
    const defaults = game.state?.defaults;
    const currentRouteVars = useVNStore.getState().routeVars;

    const currentPathKey = chapter.pathKey;
    const canResumeHere =
      !!resume &&
      !!game.scenes[resume.sceneId] &&
      ((!!resume.chapterPath && normalizeChapterPathKey(resume.chapterPath) === currentPathKey) ||
        (!resume.chapterPath && resume.chapterIndex === chapterIndex));

    if (resume && canResumeHere) {
      useVNStore.getState().setRouteVars(mergeRouteVarsWithDefaults(defaults, currentRouteVars, resume.routeVars));
      useVNStore.getState().clearRouteHistory();
      for (const entry of resume.routeHistory) {
        useVNStore.getState().pushRouteHistory(entry);
      }
      useVNStore.getState().setResolvedEndingId(resume.resolvedEndingId);
      restorePresentationToCursor(chapter, game, resume);
      useVNStore.getState().setCursor(resume.sceneId, resume.actionIndex);
    } else {
      useVNStore.getState().setRouteVars(mergeRouteVarsWithDefaults(defaults, currentRouteVars));
    }

    const nextChapter = preparedChapters[chapterIndex + 1];
    if (nextChapter) {
      void ensureChapterGame(nextChapter).catch(() => undefined);
    }

    runToNextPause();
  } catch (error) {
    useVNStore.getState().setChapterLoading(false, 0);
    useVNStore.getState().setError({ message: error instanceof Error ? error.message : 'Failed to start chapter' });
  }
}

async function startPreparedChapters(chapters: PreparedChapter[], startIndex = 0, resume?: SaveProgress) {
  preparedChapters = chapters;
  useVNStore.getState().setChapterMeta(Math.min(startIndex + 1, chapters.length), chapters.length);

  if (resume && startIndex >= 0 && startIndex < chapters.length) {
    await startChapter(startIndex, resume);
    return;
  }

  await startChapter(Math.max(0, Math.min(startIndex, chapters.length - 1)));
}

async function resolveUrlChapterPath(dir: string, number: number, preferredExt: 'yaml' | 'yml' = 'yaml'): Promise<string | undefined> {
  if (!urlGameRootBase) {
    return undefined;
  }
  const orderedExts: Array<'yaml' | 'yml'> = preferredExt === 'yml' ? ['yml', 'yaml'] : ['yaml', 'yml'];
  for (const ext of orderedExts) {
    const filePath = `${dir}${number}.${ext}`;
    if (await hasYamlByPathKey(filePath)) {
      return filePath;
    }
  }
  return undefined;
}

async function resolveSequenceFromChapterPath(
  pathKey: string,
): Promise<{ chapters: PreparedChapter[]; startIndex: number } | undefined> {
  const normalizedKey = normalizeChapterPathKey(pathKey);
  const numbered = parseNumberedChapterPath(normalizedKey);

  if (runtimeMode === 'url') {
    if (!urlGameRootBase) {
      return undefined;
    }

    if (!numbered) {
      const filePath = chapterPathKeyToFilePath(normalizedKey);
      if (!(await hasYamlByPathKey(filePath))) {
        return undefined;
      }
      return {
        chapters: [createUrlChapter(new URL(filePath, urlGameRootBase).toString(), filePath, normalizeChapterPathKey(filePath))],
        startIndex: 0,
      };
    }

    const preferredExt = /\.yml$/i.test(normalizedKey) ? 'yml' : 'yaml';
    const chapters: PreparedChapter[] = [];
    for (let current = numbered.number; current < MAX_CHAPTERS; current += 1) {
      const filePath = await resolveUrlChapterPath(numbered.dir, current, preferredExt);
      if (!filePath) {
        break;
      }
      const chapterUrl = new URL(filePath, urlGameRootBase).toString();
      chapters.push(createUrlChapter(chapterUrl, filePath, normalizeChapterPathKey(filePath)));
    }
    if (chapters.length === 0) {
      return undefined;
    }
    return { chapters, startIndex: 0 };
  }

  if (runtimeMode === 'zip') {
    if (!numbered) {
      const chapterEntry = zipYamlByPathKey.get(normalizedKey);
      if (!chapterEntry) {
        return undefined;
      }
      return {
        chapters: [createZipChapter(normalizedKey, chapterEntry)],
        startIndex: 0,
      };
    }

    const chapters: PreparedChapter[] = [];
    for (let current = numbered.number; current < MAX_CHAPTERS; current += 1) {
      const candidates = buildNumberedChapterCandidatePaths(numbered.dir, current);
      const foundPath = candidates.map((candidate) => normalizeChapterPathKey(candidate)).find((key) => zipYamlByPathKey.has(key));
      if (!foundPath) {
        break;
      }
      const chapterEntry = zipYamlByPathKey.get(foundPath);
      if (!chapterEntry) {
        break;
      }
      chapters.push(createZipChapter(foundPath, chapterEntry));
    }
    if (chapters.length === 0) {
      return undefined;
    }
    return { chapters, startIndex: 0 };
  }

  return undefined;
}

async function jumpToChapterPath(pathKey: string): Promise<void> {
  const resolved = await resolveSequenceFromChapterPath(pathKey);
  if (!resolved) {
    useVNStore.getState().setError({ message: `Chapter not found for goto target: ${pathKey}` });
    return;
  }

  useVNStore.getState().clearInputGate();
  useVNStore.getState().clearChoiceGate();
  useVNStore.getState().setWaitingInput(false);
  useVNStore.getState().setDialog({ speaker: undefined, speakerId: undefined, fullText: '', visibleText: '', typing: false });
  await startPreparedChapters(resolved.chapters, resolved.startIndex);
}

function runToNextPause(loopGuard = 0) {
  if (loopGuard > 1000) {
    useVNStore.getState().setError({ message: 'Infinite loop detected in script execution' });
    return;
  }

  const state = useVNStore.getState();
  const game = state.game;
  if (!game) {
    return;
  }

  const scene = game.scenes[state.currentSceneId];
  if (!scene) {
    useVNStore.getState().setError({ message: `Scene not found: ${state.currentSceneId}` });
    return;
  }

  const action = scene.actions[state.actionIndex];
  if (!action) {
    const sceneOrder = game.script.map((entry) => entry.scene);
    const idx = sceneOrder.indexOf(state.currentSceneId);
    const nextScene = sceneOrder[idx + 1];
    if (nextScene) {
      setCursor(nextScene, 0);
      runToNextPause(loopGuard + 1);
      return;
    }

    const nextChapterIndex = activeChapterIndex + 1;
    if (nextChapterIndex < preparedChapters.length) {
      void startChapter(nextChapterIndex);
      return;
    }

    finishStory(resolveAutoEndingId(game, state.routeVars));
    return;
  }

  if ('bg' in action) {
    const path = game.assets.backgrounds[action.bg];
    useVNStore.getState().setBackground(resolveAsset(state.baseUrl, path));
    incrementCursor();
    runToNextPause(loopGuard + 1);
    return;
  }

  if ('sticker' in action) {
    const path = game.assets.backgrounds[action.sticker.image];
    cancelStickerClearTimer(action.sticker.id);
    useVNStore.getState().setSticker(buildStickerSlot(state.baseUrl, action.sticker.id, path, action.sticker));
    incrementCursor();
    runToNextPause(loopGuard + 1);
    return;
  }

  if ('clearSticker' in action) {
    const target = parseClearStickerTarget(action.clearSticker);
    if (target.id === 'all' && !target.leave) {
      for (const id of Object.keys(useVNStore.getState().stickers)) {
        cancelStickerClearTimer(id);
      }
      useVNStore.getState().clearAllStickers();
    } else {
      clearStickerWithLeave(target.id, target.leave);
    }
    incrementCursor();
    runToNextPause(loopGuard + 1);
    return;
  }

  if ('music' in action) {
    const path = game.assets.music[action.music];
    const url = resolveAsset(state.baseUrl, path);
    useVNStore.getState().setMusic(url);
    playMusic(url);
    incrementCursor();
    runToNextPause(loopGuard + 1);
    return;
  }

  if ('sound' in action) {
    const path = game.assets.sfx[action.sound];
    playSound(resolveAsset(state.baseUrl, path));
    incrementCursor();
    runToNextPause(loopGuard + 1);
    return;
  }

  if ('char' in action) {
    const charDef = game.assets.characters[action.char.id];
    const assetPath = action.char.emotion
      ? charDef.emotions?.[action.char.emotion] ?? charDef.base
      : charDef.base;
    useVNStore
      .getState()
      .setCharacter(action.char.position, buildCharacterSlot(state.baseUrl, action.char.id, assetPath, action.char.emotion));
    incrementCursor();
    runToNextPause(loopGuard + 1);
    return;
  }

  if ('effect' in action) {
    useVNStore.getState().setEffect(action.effect);
    const duration = EFFECT_DURATIONS[action.effect] ?? 350;
    effectTimer = window.setTimeout(() => useVNStore.getState().setEffect(undefined), duration);
    incrementCursor();
    runToNextPause(loopGuard + 1);
    return;
  }

  if ('goto' in action) {
    const chapterTarget = normalizeGotoChapterTarget(action.goto);
    if (chapterTarget) {
      void jumpToChapterPath(chapterTarget);
      return;
    }
    setCursor(action.goto, 0);
    runToNextPause(loopGuard + 1);
    return;
  }

  if ('set' in action) {
    applyStateSet(action.set);
    incrementCursor();
    runToNextPause(loopGuard + 1);
    return;
  }

  if ('add' in action) {
    applyStateAdd(action.add);
    incrementCursor();
    runToNextPause(loopGuard + 1);
    return;
  }

  if ('choice' in action) {
    useVNStore.getState().setWaitingInput(true);
    useVNStore.getState().clearInputGate();
    useVNStore.getState().setChoiceGate({
      active: true,
      key: action.choice.key ?? `${state.currentSceneId}:${state.actionIndex}`,
      prompt: action.choice.prompt,
      options: action.choice.options,
    });
    useVNStore.getState().setDialog({
      speaker: undefined,
      speakerId: undefined,
      fullText: action.choice.prompt,
      visibleText: action.choice.prompt,
      typing: false,
    });
    return;
  }

  if ('branch' in action) {
    const matchedCase = action.branch.cases.find((branchCase) => evaluateCondition(branchCase.when, state.routeVars));
    if (matchedCase) {
      const chapterTarget = normalizeGotoChapterTarget(matchedCase.goto);
      if (chapterTarget) {
        void jumpToChapterPath(chapterTarget);
      } else {
        setCursor(matchedCase.goto, 0);
        runToNextPause(loopGuard + 1);
      }
      return;
    }
    if (action.branch.default) {
      const chapterTarget = normalizeGotoChapterTarget(action.branch.default);
      if (chapterTarget) {
        void jumpToChapterPath(chapterTarget);
      } else {
        setCursor(action.branch.default, 0);
        runToNextPause(loopGuard + 1);
      }
      return;
    }
    incrementCursor();
    runToNextPause(loopGuard + 1);
    return;
  }

  if ('ending' in action) {
    finishStory(action.ending);
    return;
  }

  if ('wait' in action) {
    useVNStore.getState().setBusy(true);
    waitTimer = window.setTimeout(() => {
      useVNStore.getState().setBusy(false);
      incrementCursor();
      runToNextPause(loopGuard + 1);
    }, action.wait);
    return;
  }

  if ('video' in action) {
    startVideoCutscene(action.video.src, action.video.holdToSkipMs);
    return;
  }

  if ('input' in action) {
    useVNStore.getState().setWaitingInput(true);
    useVNStore.getState().clearChoiceGate();
    useVNStore.getState().setInputGate({
      active: true,
      prompt: action.input.prompt,
      correct: action.input.correct,
      errors: action.input.errors,
      attemptCount: 0,
      saveAs: action.input.saveAs,
      routes: action.input.routes,
    });
    useVNStore.getState().setDialog({
      speaker: undefined,
      speakerId: undefined,
      fullText: action.input.prompt,
      visibleText: action.input.prompt,
      typing: false,
    });
    return;
  }

  if ('say' in action) {
    const parsed = parseInlineSpeed(action.say.text);
    const textSpeed = parsed.speed ?? game.settings.textSpeed;
    const presentation = resolveSayPresentation(action.say.char, action.say.with);
    useVNStore.getState().clearInputGate();
    useVNStore.getState().clearChoiceGate();
    useVNStore.getState().promoteSpeaker(presentation.speakerId);
    useVNStore.getState().setVisibleCharacters(presentation.visibleCharacterIds);
    syncCharacterEmotions(game, state.baseUrl, presentation.emotionRefs);
    useVNStore.getState().setWaitingInput(true);
    useVNStore.getState().setDialog({
      speaker: presentation.speakerName,
      speakerId: presentation.speakerId,
      fullText: parsed.text,
      visibleText: '',
      typing: true,
    });
    typeDialog(parsed.text, textSpeed, () => undefined);
    return;
  }
}

async function fetchYamlIfExists(url: string): Promise<string | undefined> {
  const response = await fetch(url);
  if (!response.ok) {
    return undefined;
  }
  const text = await response.text();
  const contentType = response.headers.get('content-type') ?? '';
  const normalized = text.trimStart().toLowerCase();
  if (
    contentType.includes('text/html') ||
    normalized.startsWith('<!doctype html') ||
    normalized.startsWith('<html')
  ) {
    return undefined;
  }
  return text;
}

async function hasYamlFileAtUrl(url: string): Promise<boolean> {
  try {
    const head = await fetch(url, { method: 'HEAD' });
    if (head.ok) {
      const contentType = (head.headers.get('content-type') ?? '').toLowerCase();
      return !contentType.includes('text/html');
    }
    if (head.status !== 405 && head.status !== 501) {
      return false;
    }
  } catch {
    // Some hosts block HEAD while GET is allowed.
  }

  const fallback = await fetchYamlIfExists(url);
  return fallback !== undefined;
}

function getYamlFileUrlForPathKey(pathKey: string): string {
  if (!urlGameRootBase) {
    throw new Error('Game root URL is not initialized.');
  }
  return new URL(chapterPathKeyToFilePath(pathKey), urlGameRootBase).toString();
}

async function loadYamlTextByPathKey(pathKey: string): Promise<string | undefined> {
  const normalizedPathKey = normalizeChapterPathKey(pathKey);
  const cached = yamlTextCache.get(normalizedPathKey);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    if (runtimeMode === 'url') {
      if (!urlGameRootBase) {
        return undefined;
      }
      return fetchYamlIfExists(getYamlFileUrlForPathKey(normalizedPathKey));
    }
    if (runtimeMode === 'zip') {
      const entry = zipYamlByPathKey.get(normalizedPathKey);
      if (!entry) {
        return undefined;
      }
      return entry.async('text');
    }
    return undefined;
  })();
  yamlTextCache.set(normalizedPathKey, promise);
  return promise;
}

async function hasYamlByPathKey(pathKey: string): Promise<boolean> {
  const normalizedPathKey = normalizeChapterPathKey(pathKey);
  const cachedText = yamlTextCache.get(normalizedPathKey);
  if (cachedText) {
    return (await cachedText) !== undefined;
  }

  const cached = yamlExistenceCache.get(normalizedPathKey);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    if (runtimeMode === 'url') {
      if (!urlGameRootBase) {
        return false;
      }
      return hasYamlFileAtUrl(getYamlFileUrlForPathKey(normalizedPathKey));
    }
    if (runtimeMode === 'zip') {
      return zipYamlByPathKey.has(normalizedPathKey);
    }
    return false;
  })();
  yamlExistenceCache.set(normalizedPathKey, promise);
  return promise;
}

async function loadParsedConfigDocument(): Promise<ParsedConfigYaml> {
  if (parsedConfigCache) {
    return parsedConfigCache;
  }
  if (parsedConfigPromise) {
    return parsedConfigPromise;
  }

  parsedConfigPromise = (async () => {
    const configPathKey = normalizeChapterPathKey('config.yaml');
    const raw = await loadYamlTextByPathKey(configPathKey);
    if (raw === undefined) {
      throw new Error('config.yaml not found at game root.');
    }
    const parsed = parseConfigYaml(raw, chapterPathKeyToFilePath(configPathKey));
    if (!parsed.data) {
      throw new Error(parsed.error?.message ?? 'Failed to parse config.yaml');
    }
    parsedConfigCache = parsed.data;
    return parsed.data;
  })();

  try {
    return await parsedConfigPromise;
  } finally {
    parsedConfigPromise = undefined;
  }
}

async function loadParsedBaseDocument(pathKey: string): Promise<ParsedBaseYaml | undefined> {
  const normalizedPathKey = normalizeChapterPathKey(pathKey);
  const cached = parsedBaseCache.get(normalizedPathKey);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const exists = await hasYamlByPathKey(normalizedPathKey);
    if (!exists) {
      return undefined;
    }
    const raw = await loadYamlTextByPathKey(normalizedPathKey);
    if (raw === undefined) {
      return undefined;
    }
    const parsed = parseBaseYaml(raw, chapterPathKeyToFilePath(normalizedPathKey));
    if (!parsed.data) {
      throw new Error(parsed.error?.message ?? `Failed to parse base layer: ${chapterPathKeyToFilePath(normalizedPathKey)}`);
    }
    return parsed.data;
  })();

  parsedBaseCache.set(normalizedPathKey, promise);
  return promise;
}

async function loadParsedChapterDocument(pathKey: string): Promise<ParsedChapterYaml> {
  const normalizedPathKey = normalizeChapterPathKey(pathKey);
  const cached = parsedChapterCache.get(normalizedPathKey);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const raw = await loadYamlTextByPathKey(normalizedPathKey);
    if (raw === undefined) {
      throw new Error(`Failed to load yaml: ${chapterPathKeyToFilePath(normalizedPathKey)}`);
    }
    const parsed = parseChapterYaml(raw, chapterPathKeyToFilePath(normalizedPathKey));
    if (!parsed.data) {
      throw new Error(parsed.error?.message ?? `Failed to parse chapter yaml: ${chapterPathKeyToFilePath(normalizedPathKey)}`);
    }
    return parsed.data;
  })();

  parsedChapterCache.set(normalizedPathKey, promise);
  return promise;
}

function getBaseLayerPathKeys(chapterPathKey: string): string[] {
  const normalizedPathKey = normalizeChapterPathKey(chapterPathKey);
  const filePath = chapterPathKeyToFilePath(normalizedPathKey);
  const directory = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : '';
  const segments = directory.length > 0 ? directory.split('/').filter((segment) => segment.length > 0) : [];
  const paths = [normalizeChapterPathKey('base.yaml')];
  let current = '';
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    paths.push(normalizeChapterPathKey(`${current}/base.yaml`));
  }
  return [...new Set(paths)];
}

async function loadResolvedChapterGame(pathKey: string): Promise<GameData> {
  const normalizedPathKey = normalizeChapterPathKey(pathKey);
  const cached = resolvedChapterGameCache.get(normalizedPathKey);
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const config = await loadParsedConfigDocument();
    const chapter = await loadParsedChapterDocument(normalizedPathKey);
    const basePathKeys = getBaseLayerPathKeys(normalizedPathKey);
    const bases: ParsedBaseYaml[] = [];
    for (const basePathKey of basePathKeys) {
      const baseLayer = await loadParsedBaseDocument(basePathKey);
      if (baseLayer) {
        bases.push(baseLayer);
      }
    }

    const resolved = resolveChapterGame({
      config,
      bases,
      chapter,
    });
    if (!resolved.data) {
      throw new Error(resolved.error?.message ?? `Failed to resolve chapter: ${chapterPathKeyToFilePath(normalizedPathKey)}`);
    }

    if (runtimeMode === 'zip') {
      return materializeGameAssetsFromZip(resolved.data, '', zipAssetUrlByKey);
    }
    return resolved.data;
  })();

  resolvedChapterGameCache.set(normalizedPathKey, promise);
  return promise;
}

function createUrlChapter(_url: string, name: string, pathKey: string): PreparedChapter {
  const assetOverrides: Record<string, string> = {};
  return {
    pathKey,
    name,
    baseUrl: urlGameRootBase,
    assetOverrides,
    loadGame: async () => loadResolvedChapterGame(pathKey),
  };
}

function createInMemoryChapter(raw: string, name: string, pathKey: string): PreparedChapter {
  const normalizedPathKey = normalizeChapterPathKey(pathKey);
  yamlTextCache.set(normalizedPathKey, Promise.resolve(raw));
  return {
    pathKey: normalizedPathKey,
    name,
    baseUrl: urlGameRootBase,
    assetOverrides: {},
    loadGame: async () => loadResolvedChapterGame(normalizedPathKey),
  };
}

function resolveZipAssetUrl(
  assetPath: string,
  yamlDir: string,
  zipUrlByKey: Map<string, string>,
): string | undefined {
  const normalized = collapsePathDots(assetPath);
  const normalizedLower = normalized.toLowerCase();
  const withYamlDir = collapsePathDots(`${yamlDir}${normalized}`).toLowerCase();

  const candidates = [
    normalizedLower,
    withYamlDir,
    collapsePathDots(`./${normalized}`).toLowerCase(),
    collapsePathDots(`/${normalized}`).toLowerCase(),
  ];

  for (const key of candidates) {
    const found = zipUrlByKey.get(key);
    if (found) {
      return found;
    }
  }

  for (const [key, value] of zipUrlByKey.entries()) {
    if (key.endsWith(`/${normalizedLower}`) || key === normalizedLower) {
      return value;
    }
  }

  return undefined;
}

async function rewriteLive2DJsonEntriesInZip(
  files: JSZip.JSZipObject[],
  blobMap: Record<string, string>,
  zipUrlByKey: Map<string, string>,
) {
  const jsonEntries = files.filter((entry) => isJsonAsset(entry.name));
  for (const entry of jsonEntries) {
    const normalizedName = normalizeAssetKey(entry.name);
    const modelDir = normalizedName.includes('/') ? normalizedName.slice(0, normalizedName.lastIndexOf('/') + 1) : '';
    const rawJson = await entry.async('text');
    const rewritten = rewriteLive2DModelJson(rawJson, (relativePath) =>
      resolveZipAssetUrl(relativePath, modelDir, zipUrlByKey),
    );
    if (!rewritten) {
      continue;
    }
    const blob = new Blob([rewritten], { type: 'application/json' });
    const blobUrl = URL.createObjectURL(blob);
    objectUrls.push(blobUrl);
    setAssetOverride(blobMap, entry.name, blobUrl);
    zipUrlByKey.set(normalizedName.toLowerCase(), blobUrl);
  }
}

function materializeGameAssetsFromZip(game: GameData, yamlDir: string, zipUrlByKey: Map<string, string>): GameData {
  const cloned = structuredClone(game);
  const missing: string[] = [];

  const replace = (path: string): string => {
    const url = resolveZipAssetUrl(path, yamlDir, zipUrlByKey);
    if (!url) {
      missing.push(path);
      return path;
    }
    return url;
  };

  for (const [key, value] of Object.entries(cloned.assets.backgrounds)) {
    cloned.assets.backgrounds[key] = replace(value);
  }
  for (const charDef of Object.values(cloned.assets.characters)) {
    charDef.base = replace(charDef.base);
    if (charDef.emotions) {
      for (const [emoKey, emoPath] of Object.entries(charDef.emotions)) {
        charDef.emotions[emoKey] = replace(emoPath);
      }
    }
  }
  for (const [key, value] of Object.entries(cloned.assets.music)) {
    cloned.assets.music[key] = replace(value);
  }
  for (const [key, value] of Object.entries(cloned.assets.sfx)) {
    cloned.assets.sfx[key] = replace(value);
  }
  for (const scene of Object.values(cloned.scenes)) {
    for (const action of scene.actions) {
      if ('video' in action) {
        const src = action.video.src;
        if (!extractYouTubeVideoId(src)) {
          action.video.src = replace(src);
        }
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(`ZIP asset mapping failed. Missing: ${missing.slice(0, 8).join(', ')}`);
  }

  return cloned;
}

function createZipChapter(pathKey: string, yamlEntry: JSZip.JSZipObject): PreparedChapter {
  return {
    pathKey,
    name: yamlEntry.name,
    baseUrl: window.location.href,
    assetOverrides: zipBlobAssetMap,
    loadGame: async () => loadResolvedChapterGame(pathKey),
  };
}

export async function loadGameFromUrl(url: string) {
  resetSession();

  try {
    const absolute = new URL(url, window.location.origin);
    const baseUrl = url.endsWith('.yaml') || url.endsWith('.yml') ? new URL('.', absolute).toString() : absolute.toString();
    runtimeMode = 'url';
    urlGameRootBase = baseUrl;

    const hasConfig = await hasYamlByPathKey('config.yaml');
    if (!hasConfig) {
      useVNStore.getState().setError({ message: 'config.yaml not found at game root.' });
      return;
    }

    const chapters: PreparedChapter[] = [];

    const zeroUrl = new URL('0.yaml', baseUrl).toString();
    const oneUrl = new URL('1.yaml', baseUrl).toString();
    const hasZero = await hasYamlByPathKey('0.yaml');

    if (hasZero) {
      chapters.push(createUrlChapter(zeroUrl, '0.yaml', normalizeChapterPathKey('0.yaml')));
      for (let chapterNo = 1; chapterNo < MAX_CHAPTERS; chapterNo += 1) {
        const chapterUrl = new URL(`${chapterNo}.yaml`, baseUrl).toString();
        const exists = await hasYamlByPathKey(`${chapterNo}.yaml`);
        if (!exists) {
          break;
        }
        chapters.push(createUrlChapter(chapterUrl, `${chapterNo}.yaml`, normalizeChapterPathKey(`${chapterNo}.yaml`)));
      }
    } else {
      const hasOne = await hasYamlByPathKey('1.yaml');
      if (hasOne) {
        chapters.push(createUrlChapter(oneUrl, '1.yaml', normalizeChapterPathKey('1.yaml')));
        for (let chapterNo = 2; chapterNo < MAX_CHAPTERS; chapterNo += 1) {
          const chapterUrl = new URL(`${chapterNo}.yaml`, baseUrl).toString();
          const exists = await hasYamlByPathKey(`${chapterNo}.yaml`);
          if (!exists) {
            break;
          }
          chapters.push(createUrlChapter(chapterUrl, `${chapterNo}.yaml`, normalizeChapterPathKey(`${chapterNo}.yaml`)));
        }
      }
    }

    if (chapters.length === 0) {
      if (url.endsWith('.yaml') || url.endsWith('.yml')) {
        const fallbackText = await fetchYamlIfExists(absolute.toString());
        if (fallbackText === undefined) {
          useVNStore.getState().setError({ message: `Failed to load yaml: ${absolute.toString()}` });
          return;
        }
        chapters.push(
          createInMemoryChapter(
            fallbackText,
            absolute.pathname.split('/').pop() ?? 'chapter.yaml',
            normalizeChapterPathKey(absolute.pathname.split('/').pop() ?? 'chapter.yaml'),
          ),
        );
      } else {
        useVNStore.getState().setError({
          message: 'Numbered chapter YAML not found. Add 0.yaml or 1.yaml.',
        });
        return;
      }
    }

    const save = loadProgress();
    if (save?.chapterPath) {
      const resumeSequence = await resolveSequenceFromChapterPath(save.chapterPath);
      if (resumeSequence) {
        await startPreparedChapters(resumeSequence.chapters, resumeSequence.startIndex, save);
        return;
      }
    }

    if (save && !save.chapterPath && save.chapterIndex >= 0 && save.chapterIndex < chapters.length) {
      await startPreparedChapters(chapters, save.chapterIndex, save);
      return;
    }

    useVNStore.getState().clearRouteHistory();
    useVNStore.getState().setResolvedEndingId(undefined);
    await startPreparedChapters(chapters, 0);
  } catch (error) {
    useVNStore.getState().setChapterLoading(false, 0);
    useVNStore.getState().setError({ message: error instanceof Error ? error.message : 'Failed to load game' });
  }
}

export async function loadGameFromZip(file: File) {
  resetSession();

  try {
    runtimeMode = 'zip';
    const zip = await JSZip.loadAsync(file);
    const files = Object.values(zip.files).filter((entry) => !entry.dir);
    const yamlFiles = files.filter((entry) => /\.ya?ml$/i.test(entry.name));
    const chapterCandidateYamlFiles = yamlFiles.filter((entry) => !/(^|\/)(config|base)\.ya?ml$/i.test(entry.name));

    if (yamlFiles.length === 0) {
      useVNStore.getState().setError({ message: 'ZIP 안에서 .yaml 또는 .yml 파일을 찾지 못했습니다.' });
      return;
    }

    zipYamlByPathKey = new Map<string, JSZip.JSZipObject>();
    for (const entry of yamlFiles) {
      zipYamlByPathKey.set(normalizeChapterPathKey(entry.name), entry);
    }

    const hasConfig = await hasYamlByPathKey('config.yaml');
    if (!hasConfig) {
      useVNStore.getState().setError({ message: 'config.yaml not found at game root.' });
      return;
    }

    const numbered = chapterCandidateYamlFiles
      .map((entry) => {
        const match = entry.name.match(/^(\d+)\.ya?ml$/i);
        return match ? { entry, order: Number(match[1]) } : null;
      })
      .filter((v): v is { entry: (typeof yamlFiles)[number]; order: number } => v !== null)
      .sort((a, b) => a.order - b.order);

    const selectedYaml =
      numbered.length > 0
        ? numbered.map((item) => item.entry)
        : [
            chapterCandidateYamlFiles.find((entry) => /(^|\/)sample\.ya?ml$/i.test(entry.name)) ??
              [...chapterCandidateYamlFiles].sort((a, b) => a.name.localeCompare(b.name))[0],
          ];

    if (selectedYaml.length === 0 || !selectedYaml[0]) {
      useVNStore.getState().setError({ message: '실행 가능한 챕터 YAML(예: 0.yaml, 1.yaml, sample.yaml)을 찾지 못했습니다.' });
      return;
    }

    const blobMap: Record<string, string> = {};
    const zipUrlByKey = new Map<string, string>();
    for (const entry of files) {
      const bytes = await entry.async('arraybuffer');
      const mimeType = detectMimeType(entry.name);
      const blob = mimeType ? new Blob([bytes], { type: mimeType }) : new Blob([bytes]);
      const blobUrl = URL.createObjectURL(blob);
      objectUrls.push(blobUrl);
      setAssetOverride(blobMap, entry.name, blobUrl);
      zipUrlByKey.set(normalizeAssetKey(entry.name).toLowerCase(), blobUrl);
    }
    await rewriteLive2DJsonEntriesInZip(files, blobMap, zipUrlByKey);
    zipBlobAssetMap = blobMap;
    zipAssetUrlByKey = zipUrlByKey;

    const chapters: PreparedChapter[] = [];
    for (const yamlEntry of selectedYaml) {
      const pathKey = normalizeChapterPathKey(yamlEntry.name);
      chapters.push(createZipChapter(pathKey, yamlEntry));
    }

    const save = loadProgress();
    if (save?.chapterPath) {
      const resumeSequence = await resolveSequenceFromChapterPath(save.chapterPath);
      if (resumeSequence) {
        await startPreparedChapters(resumeSequence.chapters, resumeSequence.startIndex, save);
        return;
      }
    }
    if (save && !save.chapterPath && save.chapterIndex >= 0 && save.chapterIndex < chapters.length) {
      await startPreparedChapters(chapters, save.chapterIndex, save);
      return;
    }

    useVNStore.getState().clearRouteHistory();
    useVNStore.getState().setResolvedEndingId(undefined);
    await startPreparedChapters(chapters, 0);
  } catch (error) {
    useVNStore.getState().setChapterLoading(false, 0);
    useVNStore.getState().setError({
      message: error instanceof Error ? error.message : 'ZIP 처리 중 오류가 발생했습니다.',
    });
  }
}

export function handleAdvance() {
  const state = useVNStore.getState();
  if (!state.game || state.isFinished || state.chapterLoading) {
    return;
  }
  if (state.videoCutscene.active) {
    revealVideoSkipGuide();
    return;
  }
  if (state.busy) {
    return;
  }

  if (state.waitingInput) {
    if (state.inputGate.active || state.choiceGate.active) {
      return;
    }
    if (state.dialog.typing && state.game.settings.clickToInstant) {
      if (typeTimer) {
        window.clearInterval(typeTimer);
        typeTimer = undefined;
      }
      useVNStore.getState().setDialog({ typing: false, visibleText: state.dialog.fullText });
      return;
    }
    useVNStore.getState().setWaitingInput(false);
    useVNStore.getState().clearInputGate();
    useVNStore.getState().setDialog({ speaker: undefined, speakerId: undefined, fullText: '', visibleText: '', typing: false });
    incrementCursor();
    runToNextPause();
    return;
  }

  runToNextPause();
}

export async function restartFromBeginning() {
  if (preparedChapters.length === 0) {
    return;
  }
  localStorage.removeItem(AUTOSAVE_KEY);
  clearTimers();
  useVNStore.getState().clearVideoCutscene();
  useVNStore.getState().setFinished(false);
  useVNStore.getState().setWaitingInput(false);
  useVNStore.getState().clearInputGate();
  useVNStore.getState().clearChoiceGate();
  useVNStore.getState().setDialog({ speaker: undefined, speakerId: undefined, fullText: '', visibleText: '', typing: false });
  useVNStore.getState().setRouteVars({});
  useVNStore.getState().clearRouteHistory();
  useVNStore.getState().setResolvedEndingId(undefined);
  await startChapter(0);
}

function completeInputSuccess(answer: string, matchedRoute?: InputRoute) {
  const state = useVNStore.getState();
  const historyKey = state.inputGate.saveAs ?? `${state.currentSceneId}:${state.actionIndex}`;
  if (state.inputGate.saveAs) {
    useVNStore.getState().patchRouteVars({ [state.inputGate.saveAs]: answer });
  }
  useVNStore.getState().pushRouteHistory({
    kind: 'input',
    key: historyKey,
    value: answer,
    sceneId: state.currentSceneId,
    actionIndex: state.actionIndex,
  });
  applyStateSet(matchedRoute?.set);
  applyStateAdd(matchedRoute?.add);
  useVNStore.getState().setWaitingInput(false);
  useVNStore.getState().clearInputGate();
  useVNStore.getState().clearChoiceGate();
  useVNStore.getState().setDialog({ speaker: undefined, speakerId: undefined, fullText: '', visibleText: '', typing: false });
  if (matchedRoute?.goto) {
    const chapterTarget = normalizeGotoChapterTarget(matchedRoute.goto);
    if (chapterTarget) {
      void jumpToChapterPath(chapterTarget);
      return;
    }
    setCursor(matchedRoute.goto, 0);
  } else {
    incrementCursor();
  }
  runToNextPause();
}

export function submitChoiceOption(optionIndex: number) {
  const state = useVNStore.getState();
  if (!state.game || !state.waitingInput || !state.choiceGate.active) {
    return;
  }

  const selected = state.choiceGate.options[optionIndex];
  if (!selected) {
    return;
  }

  useVNStore.getState().pushRouteHistory({
    kind: 'choice',
    key: state.choiceGate.key,
    value: selected.text,
    sceneId: state.currentSceneId,
    actionIndex: state.actionIndex,
  });
  applyStateSet(selected.set);
  applyStateAdd(selected.add);
  useVNStore.getState().setWaitingInput(false);
  useVNStore.getState().clearInputGate();
  useVNStore.getState().clearChoiceGate();
  useVNStore.getState().setDialog({ speaker: undefined, speakerId: undefined, fullText: '', visibleText: '', typing: false });
  if (selected.goto) {
    const chapterTarget = normalizeGotoChapterTarget(selected.goto);
    if (chapterTarget) {
      void jumpToChapterPath(chapterTarget);
      return;
    }
    setCursor(selected.goto, 0);
  } else {
    incrementCursor();
  }
  runToNextPause();
}

export function submitInputAnswer(rawAnswer: string) {
  const state = useVNStore.getState();
  if (!state.game || !state.waitingInput || !state.inputGate.active) {
    return;
  }

  const typed = normalizeInputAnswer(rawAnswer);
  const matchedRoute = state.inputGate.routes.find((route) => normalizeInputAnswer(route.equals) === typed);
  if (matchedRoute) {
    completeInputSuccess(typed, matchedRoute);
    return;
  }

  const expected = normalizeInputAnswer(state.inputGate.correct);
  if (typed === expected) {
    completeInputSuccess(typed);
    return;
  }

  const nextAttempt = state.inputGate.attemptCount + 1;
  const message = getInputErrorMessage(state.inputGate.errors, nextAttempt);
  useVNStore.getState().setInputGate({ attemptCount: nextAttempt });
  useVNStore.getState().setDialog({
    speaker: undefined,
    speakerId: undefined,
    fullText: message,
    visibleText: message,
    typing: false,
  });
}
