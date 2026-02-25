import JSZip from 'jszip';
import { useVNStore } from './store';
import { parseGameYaml } from './parser';
import type { CharacterSlot, GameData } from './types';

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
const MAX_CHAPTERS = 100;
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

type SaveProgress = {
  chapterIndex: number;
  sceneId: string;
  actionIndex: number;
};

type PreparedChapter = {
  name: string;
  game: GameData;
  baseUrl: string;
  assetOverrides: Record<string, string>;
};

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

function getSpeakerName(_game: GameData, id?: string) {
  if (!id) {
    return undefined;
  }
  return id;
}

function saveProgress(sceneId: string, actionIndex: number) {
  const payload: SaveProgress = {
    chapterIndex: activeChapterIndex,
    sceneId,
    actionIndex,
  };
  localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
}

function loadProgress(): SaveProgress | undefined {
  const raw = localStorage.getItem(AUTOSAVE_KEY);
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<SaveProgress> & { sceneId?: string; actionIndex?: number };
    if (typeof parsed.sceneId !== 'string' || typeof parsed.actionIndex !== 'number') {
      return undefined;
    }
    return {
      chapterIndex: typeof parsed.chapterIndex === 'number' ? parsed.chapterIndex : 0,
      sceneId: parsed.sceneId,
      actionIndex: parsed.actionIndex,
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
  useVNStore.getState().setDialog({ speaker: undefined, fullText: '', visibleText: '', typing: false });
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

async function preloadChapterAssets(chapter: PreparedChapter, chapterLabel: string) {
  const paths = collectAssetPaths(chapter.game);
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

function restorePresentationToCursor(chapter: PreparedChapter, resume: SaveProgress) {
  const game = chapter.game;
  const sceneOrder = game.script.map((entry) => entry.scene);
  if (sceneOrder.length === 0) {
    return;
  }

  let sceneId = sceneOrder[0];
  let actionIndex = 0;
  let guard = 0;
  let musicUrl: string | undefined;

  const setBg = useVNStore.getState().setBackground;
  const setFg = useVNStore.getState().setForegroundBg;
  const setChar = useVNStore.getState().setCharacter;
  const setMusic = useVNStore.getState().setMusic;

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
      setFg(undefined);
      actionIndex += 1;
      continue;
    }
    if ('bgFront' in action) {
      setFg(resolveAsset(chapter.baseUrl, game.assets.backgrounds[action.bgFront]));
      actionIndex += 1;
      continue;
    }
    if ('clearBgFront' in action) {
      setFg(undefined);
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
    if ('goto' in action) {
      sceneId = action.goto;
      actionIndex = 0;
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

  activeChapterIndex = chapterIndex;
  useVNStore.getState().setChapterMeta(chapterIndex + 1, preparedChapters.length);
  const chapterLabel = `Chapter ${chapterIndex + 1}/${preparedChapters.length}`;

  useVNStore.getState().setChapterLoading(true, 0, `${chapterLabel} loading...`);
  await preloadChapterAssets(chapter, chapterLabel);
  useVNStore.getState().setChapterLoading(false, 1, `${chapterLabel} loaded`);

  useVNStore.getState().setGame(chapter.game, chapter.baseUrl, chapter.assetOverrides);

  if (resume && resume.chapterIndex === chapterIndex && chapter.game.scenes[resume.sceneId]) {
    restorePresentationToCursor(chapter, resume);
    useVNStore.getState().setCursor(resume.sceneId, resume.actionIndex);
  }

  runToNextPause();
}

async function startPreparedChapters(chapters: PreparedChapter[]) {
  preparedChapters = chapters;
  useVNStore.getState().setChapterMeta(1, chapters.length);

  const save = loadProgress();
  if (save && save.chapterIndex >= 0 && save.chapterIndex < chapters.length && chapters[save.chapterIndex].game.scenes[save.sceneId]) {
    await startChapter(save.chapterIndex, save);
    return;
  }

  await startChapter(0);
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

    useVNStore.getState().setFinished(true);
    useVNStore.getState().setWaitingInput(false);
    return;
  }

  if ('bg' in action) {
    const path = game.assets.backgrounds[action.bg];
    useVNStore.getState().setBackground(resolveAsset(state.baseUrl, path));
    useVNStore.getState().setForegroundBg(undefined);
    incrementCursor();
    runToNextPause(loopGuard + 1);
    return;
  }

  if ('bgFront' in action) {
    const path = game.assets.backgrounds[action.bgFront];
    useVNStore.getState().setForegroundBg(resolveAsset(state.baseUrl, path));
    incrementCursor();
    runToNextPause(loopGuard + 1);
    return;
  }

  if ('clearBgFront' in action) {
    useVNStore.getState().setForegroundBg(undefined);
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
    setCursor(action.goto, 0);
    runToNextPause(loopGuard + 1);
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

  if ('say' in action) {
    const parsed = parseInlineSpeed(action.say.text);
    const textSpeed = parsed.speed ?? game.settings.textSpeed;
    useVNStore.getState().setWaitingInput(true);
    useVNStore.getState().setDialog({
      speaker: getSpeakerName(game, action.say.char),
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

function parseChapterFromYaml(raw: string, name: string, baseUrl: string, assetOverrides: Record<string, string>): PreparedChapter {
  const result = parseGameYaml(raw);
  if (!result.data) {
    throw new Error(`${name}: ${result.error?.message ?? 'YAML parse error'}`);
  }
  const game = materializeGameAssets(result.data, baseUrl, assetOverrides);
  return {
    name,
    game,
    baseUrl,
    assetOverrides,
  };
}

function materializeGameAssets(game: GameData, baseUrl: string, assetOverrides: Record<string, string>): GameData {
  const cloned = structuredClone(game);
  for (const [key, value] of Object.entries(cloned.assets.backgrounds)) {
    cloned.assets.backgrounds[key] = resolveAssetWithOverrides(baseUrl, value, assetOverrides);
  }
  for (const charDef of Object.values(cloned.assets.characters)) {
    charDef.base = resolveAssetWithOverrides(baseUrl, charDef.base, assetOverrides);
    if (charDef.emotions) {
      for (const [emoKey, emoPath] of Object.entries(charDef.emotions)) {
        charDef.emotions[emoKey] = resolveAssetWithOverrides(baseUrl, emoPath, assetOverrides);
      }
    }
  }
  for (const [key, value] of Object.entries(cloned.assets.music)) {
    cloned.assets.music[key] = resolveAssetWithOverrides(baseUrl, value, assetOverrides);
  }
  for (const [key, value] of Object.entries(cloned.assets.sfx)) {
    cloned.assets.sfx[key] = resolveAssetWithOverrides(baseUrl, value, assetOverrides);
  }
  return cloned;
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

  if (missing.length > 0) {
    throw new Error(`ZIP asset mapping failed. Missing: ${missing.slice(0, 8).join(', ')}`);
  }

  return cloned;
}

export async function loadGameFromUrl(url: string) {
  resetSession();

  try {
    const absolute = new URL(url, window.location.origin);
    const baseUrl = url.endsWith('.yaml') || url.endsWith('.yml') ? new URL('.', absolute).toString() : absolute.toString();
    const chapters: PreparedChapter[] = [];

    const zeroUrl = new URL('0.yaml', baseUrl).toString();
    const oneUrl = new URL('1.yaml', baseUrl).toString();
    const zeroText = await fetchYamlIfExists(zeroUrl);

    if (zeroText !== undefined) {
      chapters.push(parseChapterFromYaml(zeroText, '0.yaml', new URL('.', zeroUrl).toString(), {}));
      for (let chapterNo = 1; chapterNo < MAX_CHAPTERS; chapterNo += 1) {
        const chapterUrl = new URL(`${chapterNo}.yaml`, baseUrl).toString();
        const chapterText = await fetchYamlIfExists(chapterUrl);
        if (chapterText === undefined) {
          break;
        }
        chapters.push(parseChapterFromYaml(chapterText, `${chapterNo}.yaml`, new URL('.', chapterUrl).toString(), {}));
      }
    } else {
      const oneText = await fetchYamlIfExists(oneUrl);
      if (oneText !== undefined) {
        chapters.push(parseChapterFromYaml(oneText, '1.yaml', new URL('.', oneUrl).toString(), {}));
        for (let chapterNo = 2; chapterNo < MAX_CHAPTERS; chapterNo += 1) {
          const chapterUrl = new URL(`${chapterNo}.yaml`, baseUrl).toString();
          const chapterText = await fetchYamlIfExists(chapterUrl);
          if (chapterText === undefined) {
            break;
          }
          chapters.push(parseChapterFromYaml(chapterText, `${chapterNo}.yaml`, new URL('.', chapterUrl).toString(), {}));
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
        chapters.push(parseChapterFromYaml(fallbackText, absolute.pathname.split('/').pop() ?? 'chapter.yaml', new URL('.', absolute).toString(), {}));
      } else {
        useVNStore.getState().setError({
          message: 'Numbered chapter YAML not found. Add 0.yaml or 1.yaml.',
        });
        return;
      }
    }

    await startPreparedChapters(chapters);
  } catch (error) {
    useVNStore.getState().setChapterLoading(false, 0);
    useVNStore.getState().setError({ message: error instanceof Error ? error.message : 'Failed to load game' });
  }
}

export async function loadGameFromZip(file: File) {
  resetSession();

  try {
    const zip = await JSZip.loadAsync(file);
    const files = Object.values(zip.files).filter((entry) => !entry.dir);
    const yamlFiles = files.filter((entry) => /\.ya?ml$/i.test(entry.name));

    if (yamlFiles.length === 0) {
      useVNStore.getState().setError({ message: 'ZIP 안에서 .yaml 또는 .yml 파일을 찾지 못했습니다.' });
      return;
    }

    const numbered = yamlFiles
      .map((entry) => {
        const match = entry.name.match(/(?:^|\/)(\d+)\.ya?ml$/i);
        return match ? { entry, order: Number(match[1]) } : null;
      })
      .filter((v): v is { entry: (typeof yamlFiles)[number]; order: number } => v !== null)
      .sort((a, b) => a.order - b.order);

    const selectedYaml =
      numbered.length > 0
        ? numbered.map((item) => item.entry)
        : [
            yamlFiles.find((entry) => /(^|\/)sample\.ya?ml$/i.test(entry.name)) ??
              [...yamlFiles].sort((a, b) => a.name.localeCompare(b.name))[0],
          ];

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

    const chapters: PreparedChapter[] = [];
    for (const yamlEntry of selectedYaml) {
      const yamlDir = yamlEntry.name.includes('/') ? yamlEntry.name.slice(0, yamlEntry.name.lastIndexOf('/') + 1) : '';
      const raw = await yamlEntry.async('text');
      const parsed = parseGameYaml(raw);
      if (!parsed.data) {
        throw new Error(`${yamlEntry.name}: ${parsed.error?.message ?? 'YAML parse error'}`);
      }
      const materialized = materializeGameAssetsFromZip(parsed.data, yamlDir, zipUrlByKey);
      chapters.push({
        name: yamlEntry.name,
        game: materialized,
        baseUrl: window.location.href,
        assetOverrides: blobMap,
      });
    }

    await startPreparedChapters(chapters);
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
    if (state.dialog.typing && state.game.settings.clickToInstant) {
      if (typeTimer) {
        window.clearInterval(typeTimer);
        typeTimer = undefined;
      }
      useVNStore.getState().setDialog({ typing: false, visibleText: state.dialog.fullText });
      return;
    }
    useVNStore.getState().setWaitingInput(false);
    useVNStore.getState().setDialog({ speaker: undefined, fullText: '', visibleText: '', typing: false });
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
  useVNStore.getState().setWaitingInput(false);
  useVNStore.getState().setDialog({ speaker: undefined, fullText: '', visibleText: '', typing: false });
  await startChapter(0);
}
