import {
  ChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
  lazy,
  memo,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { useShallow } from 'zustand/react/shallow';
import thirdPartyNoticesUrl from '../THIRD_PARTY_NOTICES.md?url';
import suiteLicenseUrl from '../assets/licenses/fonts/LICENSE?url';
import easyCl2dLicenseUrl from '../assets/licenses/live2d/easy-cl2d-LICENSE.live2d.md?url';
import easyCl2dNoticeUrl from '../assets/licenses/live2d/easy-cl2d-NOTICE.md?url';
import live2dRedistributableFilesUrl from '../assets/licenses/live2d/RedistributableFiles.txt?url';
import { BackgroundTransition } from './BackgroundTransition';
import { BACKGROUND_CROSSFADE_DURATION_MS } from './assetTransition';
import {
  CATCH_UP_TEMPO_RELEASE_MS,
  isRapidManualAdvance,
  isQueuedManualAdvanceFresh,
  resolveAdaptiveExitFadeDuration,
  resolveAdaptiveLayoutSettleDuration,
  resolveAdaptiveMotionEasing,
  resolveAdaptiveMotionTiming,
  type PlaybackMotionTempo,
} from './advanceMotion';
import {
  completeVideoCutscene,
  exportSaveBackup,
  getAutoSaveEnabled,
  getBgmEnabled,
  getChoiceRecoverySummary,
  getInventoryUiSettings,
  getPlayerExperienceSettings,
  getSaveSlotSummaries,
  handleAdvance,
  importSaveBackup,
  loadChoiceRecovery,
  loadSaveSlot,
  loadUrlStartScreenPreview,
  loadGameFromUrl,
  loadGameFromZip,
  loadZipStartScreenPreview,
  restartFromBeginning,
  restartCurrentChapter,
  resetVideoSkipProgress,
  revealVideoSkipGuide,
  setBgmEnabled,
  setAutoSaveEnabled,
  setInventoryUiSettings,
  setPlayerAutoPlayPaused,
  setPlayerExperienceSettings,
  skipVideoCutscene,
  stopActiveBgm,
  submitInputAnswer,
  submitChoiceOption,
  saveCurrentProgress,
  unlockAudioFromGesture,
  updateVideoSkipProgress,
} from './engine';
import type {
  AutoPlayDelay,
  ChoiceRecoverySummary,
  PlayerEffectLevel,
  PlayerExperienceSettings,
  SaveSlotKind,
  SaveSlotSummary,
  TextSpeedRate,
} from './engine';
import {
  buildImageCharacterRenderKey,
  resolveCharacterFacingScale,
  resolveCharacterFocusPresentation,
  resolveMobileCharacterStageAnchor,
  resolveCharacterStagePlacement,
  resolveCharacterStageLayout,
  resolveCharacterStageSpacing,
} from './characterLayout';
import {
  buildLauncherDemoSharePath,
  clearLauncherDemoSharePath,
  normalizeLauncherDemoLocationPath,
  parseLauncherDemoHash,
  parseLauncherDemoQuery,
  resolveInitialCarouselGameId,
  wrapCarouselIndex,
} from './launcherCarousel';
import {
  parseGameIdFromPath,
  resolveInitialBootPresentation,
  shouldShowGameRouteBoot,
  type BootMode,
} from './bootPresentation';
import {
  buildLauncherShowcaseStyle,
  normalizeLauncherShowcase,
  type LauncherShowcase,
} from './launcherPresentation';
import { buildLive2DLoadKey } from './live2dLoadTracker';
import {
  GAME_SHELL_LOCK_CLASS,
  shouldPreventGameShellOverscroll,
} from './mobileAppShell';
import {
  doesStickerOverlapRects,
  fitStickerWithinFrameAvoidingRects,
  haveStickerObstacleRectsSettled,
  shouldRelayoutStickerForStageResize,
  type StickerFit,
  type StickerLayoutRect,
  type StickerStageSize,
} from './stickerLayout';
import {
  CHARACTER_EXIT_FADE_DURATION_MS,
  resolveStageCameraFocusTargetId,
  resolveStageCameraPresentation,
  resolveStageCameraTransitionTiming,
} from './stageCamera';
import { useVNStore } from './store';
import { splitLastGrapheme } from './typing';
import type {
  AuthorMetaObject,
  CharacterSlot,
  GameSeoMeta,
  LegalNotice,
  Position,
  StartButtonPosition,
  StickerSlot,
  UiTemplateId,
} from './types';
import type { InventorySortPreference, InventoryViewPreference } from './engine';
import type { CSSProperties, SyntheticEvent } from 'react';

const Live2DCharacter = lazy(() =>
  import('./Live2DCharacter').then((module) => ({ default: module.Live2DCharacter })),
);

const MOTION_LAYER_RELEASE_BUFFER_MS = 64;

function useTransientMotionWindow(motionKey: string, durationMs: number): boolean {
  const previousMotionKeyRef = useRef(motionKey);
  const releaseTimerRef = useRef<number | null>(null);
  const motionActiveRef = useRef(false);
  const [motionActive, setMotionActive] = useState(false);

  useLayoutEffect(() => {
    const changed = previousMotionKeyRef.current !== motionKey;
    previousMotionKeyRef.current = motionKey;
    if (releaseTimerRef.current !== null) {
      window.clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || durationMs <= 0) {
      motionActiveRef.current = false;
      setMotionActive((current) => (current ? false : current));
      return;
    }

    if (changed) {
      // Layout effects flush before paint. Promoting here gives the compositor the
      // old painted frame and the new transform in the same transition boundary.
      motionActiveRef.current = true;
      setMotionActive(true);
    } else if (!motionActiveRef.current) {
      return;
    }

    // If a motion lifetime is recalculated before release, keep the compositor
    // class mounted and move only its cleanup deadline.
    releaseTimerRef.current = window.setTimeout(() => {
      releaseTimerRef.current = null;
      motionActiveRef.current = false;
      setMotionActive(false);
    }, Math.ceil(durationMs) + MOTION_LAYER_RELEASE_BUFFER_MS);

    return () => {
      if (releaseTimerRef.current !== null) {
        window.clearTimeout(releaseTimerRef.current);
        releaseTimerRef.current = null;
      }
    };
  }, [durationMs, motionKey]);

  return motionActive;
}

function useManualAdvanceTempo() {
  const [motionTempo, setMotionTempo] = useState<PlaybackMotionTempo>('normal');
  const lastAdvanceAtRef = useRef<number>();
  const releaseTimerRef = useRef<number | null>(null);

  const clearReleaseTimer = useCallback(() => {
    if (releaseTimerRef.current !== null) {
      window.clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }
  }, []);

  const sustainCatchUp = useCallback(() => {
    clearReleaseTimer();
    setMotionTempo('catch-up');
    releaseTimerRef.current = window.setTimeout(() => {
      releaseTimerRef.current = null;
      setMotionTempo('normal');
    }, CATCH_UP_TEMPO_RELEASE_MS);
  }, [clearReleaseTimer]);

  const registerManualAdvance = useCallback((): PlaybackMotionTempo => {
    const currentAdvanceAt = performance.now();
    const rapid = isRapidManualAdvance(lastAdvanceAtRef.current, currentAdvanceAt);
    lastAdvanceAtRef.current = currentAdvanceAt;
    if (rapid) {
      sustainCatchUp();
      return 'catch-up';
    }
    clearReleaseTimer();
    setMotionTempo('normal');
    return 'normal';
  }, [clearReleaseTimer, sustainCatchUp]);

  const resetManualAdvanceTempo = useCallback(() => {
    clearReleaseTimer();
    lastAdvanceAtRef.current = undefined;
    setMotionTempo('normal');
  }, [clearReleaseTimer]);

  useEffect(() => () => clearReleaseTimer(), [clearReleaseTimer]);

  return {
    motionTempo,
    registerManualAdvance,
    sustainCatchUp,
    resetManualAdvanceTempo,
  };
}

function useLatchedMotionTempo(
  motionKey: string,
  motionTempo: PlaybackMotionTempo,
): PlaybackMotionTempo {
  const [latchedMotion, setLatchedMotion] = useState(() => ({
    key: motionKey,
    tempo: motionTempo,
  }));
  const effectiveMotionTempo = latchedMotion.key === motionKey
    ? latchedMotion.tempo
    : motionTempo;

  useLayoutEffect(() => {
    setLatchedMotion((current) => (
      current.key === motionKey
        ? current
        : { key: motionKey, tempo: motionTempo }
    ));
  }, [motionKey, motionTempo]);

  return effectiveMotionTempo;
}

const DialogueText = memo(function DialogueText() {
  const {
    visibleText,
    typing,
    channel,
    delivery,
    typingIntensity,
    typingPulse,
  } = useVNStore(useShallow((state) => ({
    visibleText: state.dialog.visibleText,
    typing: state.dialog.typing,
    channel: state.dialog.channel,
    delivery: state.dialog.delivery,
    typingIntensity: state.dialog.typingIntensity,
    typingPulse: state.dialog.typingPulse,
  })));
  const visibleDialogue = splitLastGrapheme(visibleText);
  const className = [
    'text',
    `channel-${channel}`,
    `delivery-${delivery}`,
    typing ? 'is-typing' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      style={{ '--typing-intensity': typingIntensity } as CSSProperties}
    >
      {typing ? (
        <>
          {visibleDialogue.head}
          <span key={typingPulse} className="typing-glyph">
            {visibleDialogue.tail}
          </span>
        </>
      ) : (
        visibleText
      )}
    </div>
  );
});

type GameListSeoEntry = {
  title?: string;
  description?: string;
  keywords: string[];
  image?: string;
  imageAlt?: string;
};

type GameListManifestSeo = {
  title?: string;
  description?: string;
  keywords: string[];
  gameTitles: string[];
  gameCount?: number;
};

type GameListManifestEntry = {
  id: string;
  name: string;
  path: string;
  author?: string;
  version?: string;
  summary?: string;
  thumbnail?: string;
  tags: string[];
  showcase?: LauncherShowcase;
  legalNotices: LegalNotice[];
  chapterCount?: number;
  seo?: GameListSeoEntry;
};

type GameListManifest = {
  schemaVersion?: number;
  generatedAt?: string;
  games: GameListManifestEntry[];
  seo?: GameListManifestSeo;
};

type StartGateState =
  | {
    kind: 'url';
    gameUrl: string;
    sessionKey: string;
    uiTemplate: UiTemplateId;
    gameTitle: string;
    seo?: GameSeoMeta;
    imageUrl?: string;
    imagePosition?: string;
    mobileImagePosition?: string;
    musicUrl?: string;
    startButtonText: string;
    buttonPosition: StartButtonPosition;
    showTitle: boolean;
    titleColor?: string;
    showLoadButton: boolean;
    legalNotices: LegalNotice[];
  }
  | {
    kind: 'zip';
    file: File;
    uiTemplate: UiTemplateId;
    gameTitle: string;
    seo?: GameSeoMeta;
    imageUrl?: string;
    imagePosition?: string;
    mobileImagePosition?: string;
    musicUrl?: string;
    previewBlobUrl?: string;
    previewMusicBlobUrl?: string;
    startButtonText: string;
    buttonPosition: StartButtonPosition;
    showTitle: boolean;
    titleColor?: string;
    showLoadButton: false;
    legalNotices: LegalNotice[];
  };

const ENDING_PROGRESS_STORAGE_PREFIX = 'vn-ending-progress:';
const START_GATE_SESSION_PREFIX = 'vn-start-gate-session:';
const ALL_TAG_FILTER = '__all';
const DEFAULT_VISIBLE_LAUNCHER_TAGS = 8;
const LAUNCHER_CAROUSEL_OPTIONS = {
  align: 'start',
  containScroll: false,
  dragFree: false,
  duration: 20,
  loop: true,
  skipSnaps: false,
} as const;

function haveSameCharacterIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id) => right.includes(id));
}

function isCharacterOnlyExit(
  currentIds: readonly string[],
  nextIds: readonly string[],
): boolean {
  return nextIds.length < currentIds.length && nextIds.every((id) => currentIds.includes(id));
}
const DEFAULT_LAUNCHER_SUMMARY = '이 게임은 launcher.yaml 요약이 아직 등록되지 않았습니다.';
const DEFAULT_START_BUTTON_TEXT = '시작하기';
const DEFAULT_LOAD_BUTTON_TEXT = '이어하기';
const DEFAULT_SEO_TITLE = '야븐엔진 (YAVN) | Type your story. Play your novel.';
const DEFAULT_SEO_DESCRIPTION =
  '야븐엔진(YAVN)은 비주얼노벨 게임과 대사게임을 웹에서 빠르게 제작하는 엔진입니다. YAML + ZIP 업로드, YouTube 영상/음악 에셋, 중간 이벤트 씬 전환, Live2D 캐릭터 연출까지 지원합니다.';
const DEFAULT_SEO_KEYWORDS = [
  '야븐엔진',
  '야븐 엔진',
  '야븐',
  'YAVN',
  '비주얼노벨 게임',
  '대사게임',
  'YAML 게임엔진',
  'typing novel engine',
  'visual novel engine',
  'dialogue game',
  'YouTube 게임 에셋',
  '유튜브 영상 씬',
  '유튜브 배경음악',
  'Live2D 엔진',
  'Live2D 비주얼노벨',
];
const DEFAULT_SEO_IMAGE = 'https://yavn.vercel.app/favicon.svg';
const DEFAULT_SEO_IMAGE_ALT = 'YAVN (야븐) 로고';
// React 18 forwards the standards-based lowercase attribute without warning.
const HIGH_PRIORITY_IMAGE_PROPS = { fetchpriority: 'high' } as const;
const DEFAULT_CANONICAL_URL = 'https://yavn.vercel.app/';
const DYNAMIC_JSON_LD_SCRIPT_ID = 'yavn-dynamic-jsonld';
const INVENTORY_DEFAULT_CATEGORY = '기타';
const INVENTORY_CATEGORY_ALL = '';

const POSITION_TIEBREAKER: Record<Position, number> = {
  center: 0,
  left: 1,
  right: 2,
};

type CreditContactLine = {
  label?: string;
  value: string;
  href?: string;
};

type InventoryCatalogEntry = {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  owned: boolean;
  category: string;
  order: number;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function formatSaveTimestamp(value?: string): string {
  if (!value) {
    return '이전 버전 저장';
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return '저장 시각 미상';
  }
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatSaveSlotMeta(
  slot?: Pick<SaveSlotSummary, 'exists' | 'savedAt' | 'chapterIndex'>,
): string {
  if (!slot?.exists) {
    return '저장 없음';
  }
  return `${formatSaveTimestamp(slot.savedAt)} · CH.${(slot.chapterIndex ?? 0) + 1}`;
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const tags: string[] = [];
  for (const rawTag of value) {
    const normalized = normalizeText(rawTag);
    if (!normalized || tags.includes(normalized)) {
      continue;
    }
    tags.push(normalized);
  }
  return tags;
}

function normalizeLegalNotices(value: unknown): LegalNotice[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const notices: LegalNotice[] = [];
  const ids = new Set<string>();
  for (const rawNotice of value) {
    if (!isObjectRecord(rawNotice) || notices.length >= 12) {
      continue;
    }
    const id = normalizeText(rawNotice.id)?.slice(0, 64);
    const title = normalizeText(rawNotice.title)?.slice(0, 120);
    const noticeText = normalizeText(rawNotice.text)?.slice(0, 2000);
    if (!id || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id) || !title || !noticeText || ids.has(id)) {
      continue;
    }

    const links: NonNullable<LegalNotice['links']> = [];
    if (Array.isArray(rawNotice.links)) {
      for (const rawLink of rawNotice.links) {
        if (!isObjectRecord(rawLink) || links.length >= 8) {
          continue;
        }
        const label = normalizeText(rawLink.label)?.slice(0, 80);
        const href = normalizeText(rawLink.href)?.slice(0, 2048);
        if (!label || !href || !/^https?:\/\//i.test(href)) {
          continue;
        }
        try {
          new URL(href);
        } catch {
          continue;
        }
        links.push({ label, href });
      }
    }

    ids.add(id);
    notices.push({
      id,
      title,
      text: noticeText,
      ...(normalizeText(rawNotice.copyright)
        ? { copyright: normalizeText(rawNotice.copyright)?.slice(0, 240) }
        : {}),
      ...(links.length > 0 ? { links } : {}),
    });
  }
  return notices;
}

function mergeUniqueTextList(...values: string[][]): string[] {
  const merged: string[] = [];
  for (const value of values) {
    for (const entry of value) {
      if (!entry || merged.includes(entry)) {
        continue;
      }
      merged.push(entry);
    }
  }
  return merged;
}

function isMobilePointerEnvironment(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const hasCoarsePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  return hasCoarsePointer || mobileUserAgent;
}

function waitForStartGateLaunchTransition(): Promise<void> {
  if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return Promise.resolve();
  }
  return new Promise((resolve) => window.setTimeout(resolve, 220));
}

function normalizeGameListSeoEntry(value: unknown, fallbackTitle?: string): GameListSeoEntry | undefined {
  if (!isObjectRecord(value)) {
    return fallbackTitle
      ? {
          title: fallbackTitle,
          keywords: [],
        }
      : undefined;
  }

  const keywords = normalizeTags(value.keywords);
  return {
    title: normalizeText(value.title) ?? fallbackTitle,
    description: normalizeText(value.description),
    keywords,
    image: normalizeText(value.image),
    imageAlt: normalizeText(value.imageAlt),
  };
}

function normalizeGameListManifestSeo(value: unknown): GameListManifestSeo | undefined {
  if (!isObjectRecord(value)) {
    return undefined;
  }

  return {
    title: normalizeText(value.title),
    description: normalizeText(value.description),
    keywords: normalizeTags(value.keywords),
    gameTitles: normalizeTags(value.gameTitles),
    gameCount: normalizeChapterCount(value.gameCount),
  };
}

function setMetaTagByName(name: string, content: string): void {
  const element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (element) {
    element.setAttribute('content', content);
  }
}

function setMetaTagByProperty(property: string, content: string): void {
  const element = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (element) {
    element.setAttribute('content', content);
  }
}

function setCanonicalUrl(url: string): void {
  const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (canonical) {
    canonical.setAttribute('href', url);
  }
}

function setDynamicJsonLd(value?: Record<string, unknown>): void {
  const existing = document.getElementById(DYNAMIC_JSON_LD_SCRIPT_ID);
  if (!value) {
    existing?.remove();
    return;
  }

  const script =
    existing instanceof HTMLScriptElement
      ? existing
      : (() => {
          const created = document.createElement('script');
          created.type = 'application/ld+json';
          created.id = DYNAMIC_JSON_LD_SCRIPT_ID;
          document.head.appendChild(created);
          return created;
        })();

  script.text = JSON.stringify(value);
}

function resolveAbsoluteSeoUrl(rawPath: string | undefined, baseUrl: string = window.location.origin): string | undefined {
  if (!rawPath) {
    return undefined;
  }
  try {
    return new URL(rawPath, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function applySeoMetadata(input: {
  title: string;
  description: string;
  keywords: string[];
  canonicalUrl: string;
  imageUrl: string;
  imageAlt: string;
  jsonLd?: Record<string, unknown>;
}): void {
  document.title = input.title;
  setMetaTagByName('description', input.description);
  setMetaTagByName('keywords', input.keywords.join(', '));
  setMetaTagByProperty('og:title', input.title);
  setMetaTagByProperty('og:description', input.description);
  setMetaTagByProperty('og:url', input.canonicalUrl);
  setMetaTagByProperty('og:image', input.imageUrl);
  setMetaTagByProperty('og:image:alt', input.imageAlt);
  setMetaTagByName('twitter:title', input.title);
  setMetaTagByName('twitter:description', input.description);
  setMetaTagByName('twitter:image', input.imageUrl);
  setMetaTagByName('twitter:image:alt', input.imageAlt);
  setCanonicalUrl(input.canonicalUrl);
  setDynamicJsonLd(input.jsonLd);
}

function resolveStartGateSessionKey(gameId: string): string {
  return `${START_GATE_SESSION_PREFIX}${gameId}`;
}

function hasStartGateSessionFlag(sessionKey: string): boolean {
  try {
    return sessionStorage.getItem(sessionKey) === '1';
  } catch {
    return false;
  }
}

function markStartGateSession(sessionKey: string): void {
  try {
    sessionStorage.setItem(sessionKey, '1');
  } catch {
    // Ignore sessionStorage failures and continue.
  }
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to the temporary textarea path below.
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
}

function buildGameSourceUrl(repositoryUrl: string, gameId: string): string {
  return `${repositoryUrl}/tree/main/public/game-list/${encodeURIComponent(gameId)}`;
}

function normalizeAssetLookupKey(path: string): string {
  return path.replace(/\\/g, '/').replace(/^(\.\/|\/)+/, '');
}

function resolveRuntimeAssetUrl(
  assetPath: string | undefined,
  baseUrl: string | undefined,
  assetOverrides: Record<string, string>,
): string | undefined {
  if (!assetPath) {
    return undefined;
  }
  if (/^root:\//i.test(assetPath)) {
    return new URL(assetPath.slice('root:'.length), window.location.origin).toString();
  }
  if (/^(blob:|data:|https?:|[a-z][a-z0-9+.-]*:)/i.test(assetPath)) {
    return assetPath;
  }
  const normalized = normalizeAssetLookupKey(assetPath);
  const normalizedLower = normalized.toLowerCase();
  const override =
    assetOverrides[assetPath] ??
    assetOverrides[normalized] ??
    assetOverrides[`./${normalized}`] ??
    assetOverrides[`/${normalized}`] ??
    assetOverrides[normalizedLower] ??
    assetOverrides[`./${normalizedLower}`] ??
    assetOverrides[`/${normalizedLower}`];
  if (override) {
    return override;
  }
  try {
    return new URL(assetPath, baseUrl ?? window.location.origin).toString();
  } catch {
    return assetPath;
  }
}

function resolveStartGateAssetUrl(assetPath: string | undefined, baseUrl: string): string | undefined {
  if (!assetPath) {
    return undefined;
  }
  if (/^root:\//i.test(assetPath)) {
    return new URL(assetPath.slice('root:'.length), window.location.origin).toString();
  }
  try {
    return new URL(assetPath, baseUrl).toString();
  } catch {
    return assetPath;
  }
}

function normalizeChapterCount(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }
  const normalized = Math.max(0, Math.floor(value));
  return normalized;
}

function normalizeGameListEntry(value: unknown, index: number): GameListManifestEntry | undefined {
  if (!isObjectRecord(value)) {
    return undefined;
  }
  const rawPath = normalizeText(value.path);
  const rawId = normalizeText(value.id);
  const id = rawId ?? (rawPath ? parseGameIdFromPath(rawPath) : undefined) ?? `game-${index + 1}`;
  const path = rawPath ?? `/game-list/${encodeURIComponent(id)}/`;
  const name = normalizeText(value.name) ?? id;
  const seo = normalizeGameListSeoEntry(value.seo, name);
  return {
    id,
    name,
    path,
    author: normalizeText(value.author),
    version: normalizeText(value.version),
    summary: normalizeText(value.summary),
    thumbnail: normalizeText(value.thumbnail),
    tags: normalizeTags(value.tags),
    showcase: normalizeLauncherShowcase(value.showcase),
    legalNotices: normalizeLegalNotices(value.legalNotices),
    chapterCount: normalizeChapterCount(value.chapterCount),
    seo,
  };
}

function parseGameListManifest(raw: unknown): GameListManifest {
  if (!isObjectRecord(raw)) {
    return { games: [] };
  }
  const games = Array.isArray(raw.games)
    ? raw.games
      .map((entry, index) => normalizeGameListEntry(entry, index))
      .filter((entry): entry is GameListManifestEntry => Boolean(entry))
    : [];
  return {
    schemaVersion: typeof raw.schemaVersion === 'number' && Number.isFinite(raw.schemaVersion) ? raw.schemaVersion : undefined,
    generatedAt: normalizeText(raw.generatedAt),
    games,
    seo: normalizeGameListManifestSeo(raw.seo),
  };
}

function formatManifestTimestamp(raw: string | null): string {
  if (!raw) {
    return 'N/A';
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  return parsed.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function buildLauncherJsonLd(games: GameListManifestEntry[]): Record<string, unknown> | undefined {
  if (games.length === 0) {
    return undefined;
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '야븐엔진 (YAVN) 게임 목록',
    numberOfItems: games.length,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: games.slice(0, 100).map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      url: resolveAbsoluteSeoUrl(entry.path),
      ...(entry.seo?.description ? { description: entry.seo.description } : {}),
    })),
  };
}

function buildGameJsonLd(
  title: string,
  description: string,
  canonicalUrl: string,
  imageUrl: string,
  authorName?: string,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: title,
    description,
    url: canonicalUrl,
    image: imageUrl,
    inLanguage: 'ko-KR',
    isAccessibleForFree: true,
    playMode: 'SinglePlayer',
    ...(authorName
      ? {
          author: {
            '@type': 'Person',
            name: authorName,
          },
        }
      : {}),
    isPartOf: {
      '@type': 'WebSite',
      name: '야븐엔진 (YAVN)',
      url: DEFAULT_CANONICAL_URL,
    },
    potentialAction: {
      '@type': 'PlayAction',
      target: canonicalUrl,
    },
  };
}

function resolveEndingProgressStorageKey(gameTitle?: string): string | undefined {
  const normalizedTitle = gameTitle?.trim();
  if (!normalizedTitle) {
    return undefined;
  }
  const gameListMatch = window.location.pathname.match(/^\/game-list\/([^/]+)\/?$/);
  const gameKey = gameListMatch ? decodeURIComponent(gameListMatch[1]) : normalizedTitle;
  if (!gameKey) {
    return undefined;
  }
  return `${ENDING_PROGRESS_STORAGE_PREFIX}${gameKey}`;
}

function parseEndingProgress(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return Array.from(new Set(parsed.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)));
  } catch {
    return [];
  }
}

function normalizeAuthorCredit(author: string | AuthorMetaObject | undefined): {
  name?: string;
  contacts: CreditContactLine[];
} {
  if (!author) {
    return { contacts: [] };
  }

  if (typeof author === 'string') {
    const name = author.trim();
    return name ? { name, contacts: [] } : { contacts: [] };
  }

  const name = author.name?.trim() || undefined;
  const contacts: CreditContactLine[] = [];
  for (const contact of author.contacts ?? []) {
    if (typeof contact === 'string') {
      const value = contact.trim();
      if (value) {
        contacts.push({ value });
      }
      continue;
    }
    const value = contact.value?.trim();
    if (!value) {
      continue;
    }
    const label = contact.label?.trim();
    const href = contact.href?.trim();
    contacts.push({ label: label || undefined, value, href: href || undefined });
  }
  return { name, contacts };
}

function LegalNoticeList({
  notices,
  className = '',
  linkTabIndex,
}: {
  notices: LegalNotice[];
  className?: string;
  linkTabIndex?: number;
}) {
  if (notices.length === 0) {
    return null;
  }

  return (
    <div className={['legal-notice-list', className].filter(Boolean).join(' ')} aria-label="법적 고지">
      {notices.map((notice) => (
        <section className="legal-notice" key={notice.id}>
          <h4>{notice.title}</h4>
          <p>{notice.text}</p>
          {notice.copyright && <small>{notice.copyright}</small>}
          {notice.links && notice.links.length > 0 && (
            <nav aria-label={`${notice.title} 관련 링크`}>
              {notice.links.map((link, index) => (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  tabIndex={linkTabIndex}
                  key={`${notice.id}-${link.href}-${index}`}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          )}
        </section>
      ))}
    </div>
  );
}

function useAdvanceByKey(advanceLocked: boolean, onAdvance: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName.toLowerCase();
        if (
          target.isContentEditable ||
          tag === 'input' ||
          tag === 'textarea' ||
          tag === 'button' ||
          tag === 'select' ||
          tag === 'a' ||
          target.closest('button, a, input, textarea, select, [role="button"], [role="link"]')
        ) {
          return;
        }
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (advanceLocked) {
          return;
        }
        unlockAudioFromGesture();
        onAdvance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advanceLocked, onAdvance]);
}

type LockedStickerFit = StickerFit & {
  left: number;
  top: number;
  width: number;
  height: number;
};

const STICKER_LAYOUT_QUIET_MS = 72;
const STICKER_OBSTACLE_SAMPLE_MS = 48;
const STICKER_CHARACTER_LAYOUT_SETTLE_MS = 420;
const STICKER_RESIZE_QUIET_MS = 140;

const StickerView = memo(function StickerView({
  sticker,
  avoidanceKey,
  avoidanceSettleMs,
  motionTempo,
}: {
  sticker: StickerSlot;
  avoidanceKey: string;
  avoidanceSettleMs: number;
  motionTempo: PlaybackMotionTempo;
}) {
  const stickerRef = useRef<HTMLDivElement | null>(null);
  const [safeFit, setSafeFit] = useState<LockedStickerFit | null>(null);
  const [layoutMotionReady, setLayoutMotionReady] = useState(false);
  const [resolvedAvoidanceKey, setResolvedAvoidanceKey] = useState('');
  const [layoutReflowing, setLayoutReflowing] = useState(false);
  const [entryComplete, setEntryComplete] = useState(sticker.enterEffect === 'none');
  const layoutLockedRef = useRef(false);
  const imageReadyRef = useRef(false);
  const settleTimerRef = useRef<number | null>(null);
  const layoutMotionFrameRef = useRef<number | null>(null);
  const earliestMeasurementAtRef = useRef(0);
  const lockedStageSizeRef = useRef<StickerStageSize | null>(null);
  const previousObstacleRectsRef = useRef<StickerLayoutRect[] | null>(null);
  const previousAvoidanceKeyRef = useRef(avoidanceKey);
  const stickerEntryExitMotionTempo = useLatchedMotionTempo(
    `${sticker.renderKey}:${sticker.leaving ? 'leave' : 'enter'}`,
    motionTempo,
  );
  const stickerLayoutMotionTempo = useLatchedMotionTempo(avoidanceKey, motionTempo);
  const stickerEnterTiming = resolveAdaptiveMotionTiming(
    sticker.enterDuration,
    sticker.enterDelay,
    stickerEntryExitMotionTempo,
  );
  const stickerEnterEasing = resolveAdaptiveMotionEasing(
    sticker.enterEasing,
    stickerEntryExitMotionTempo,
  );
  const stickerLeaveTiming = resolveAdaptiveMotionTiming(
    sticker.leaveDuration,
    sticker.leaveDelay,
    stickerEntryExitMotionTempo,
  );
  const stickerLeaveEasing = resolveAdaptiveMotionEasing(
    sticker.leaveEasing,
    stickerEntryExitMotionTempo,
  );
  const translateX =
    sticker.anchorX === 'left' ? '0%' : sticker.anchorX === 'right' ? '-100%' : '-50%';
  const translateY =
    sticker.anchorY === 'top' ? '0%' : sticker.anchorY === 'bottom' ? '-100%' : '-50%';
  const placementTransform = `translate(${translateX}, ${translateY}) rotate(${sticker.rotate}deg)`;
  const fittedTransform = safeFit
    ? `translate(${safeFit.translateX}px, ${safeFit.translateY}px) ${placementTransform} scale(${safeFit.scale})`
    : placementTransform;

  const lockSafeFit = useCallback((recheckLockedFit = false) => {
    if ((!recheckLockedFit && layoutLockedRef.current) || !imageReadyRef.current) {
      return layoutLockedRef.current;
    }
    const stickerElement = stickerRef.current;
    const frameElement = stickerElement?.closest<HTMLElement>('.sticker-safe-frame');
    const stageElement = stickerElement?.closest<HTMLElement>('.stage-content-frame');
    if (!stickerElement || !frameElement || !stageElement) {
      return false;
    }

    const frameRect = frameElement.getBoundingClientRect();
    const characterElements = [
      ...stageElement.querySelectorAll<HTMLElement>('.char-layer .char'),
    ].filter((characterElement) => {
      if (
        characterElement.classList.contains('is-camera-hidden')
        || characterElement.getAttribute('aria-hidden') === 'true'
      ) {
        return false;
      }
      return window.getComputedStyle(characterElement).visibility !== 'hidden';
    });
    const characterImagesReady = characterElements.every((characterElement) => {
      const imageElements = characterElement.matches('img.char-image')
        ? [characterElement as HTMLImageElement]
        : [...characterElement.querySelectorAll<HTMLImageElement>('.char-image')];
      return imageElements.every((imageElement) => imageElement.complete);
    });
    if (!characterImagesReady) {
      return false;
    }

    const characterRects = characterElements
      .map((characterElement) => characterElement.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    if (
      characterRects.length > 0
      && !haveStickerObstacleRectsSettled(previousObstacleRectsRef.current, characterRects)
    ) {
      previousObstacleRectsRef.current = characterRects.map((rect) => ({
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      }));
      return false;
    }

    if (
      recheckLockedFit
      && layoutLockedRef.current
      && !doesStickerOverlapRects(
        stickerElement.getBoundingClientRect(),
        characterRects,
      )
    ) {
      setResolvedAvoidanceKey(avoidanceKey);
      return true;
    }

    // Reconstruct the authored box even while a previous safe fit remains rendered.
    // Temporary styles are restored in the same layout phase, before paint.
    const previousStyle = {
      left: stickerElement.style.left,
      top: stickerElement.style.top,
      width: stickerElement.style.width,
      height: stickerElement.style.height,
      transform: stickerElement.style.transform,
      transition: stickerElement.style.transition,
    };
    stickerElement.style.left = sticker.x;
    stickerElement.style.top = sticker.y;
    stickerElement.style.width = sticker.width ?? '';
    stickerElement.style.height = sticker.height ?? '';
    stickerElement.style.transition = 'none';
    stickerElement.style.transform = placementTransform;
    const stickerRect = stickerElement.getBoundingClientRect();
    const authoredBox = {
      left: stickerElement.offsetLeft,
      top: stickerElement.offsetTop,
      width: stickerElement.offsetWidth,
      height: stickerElement.offsetHeight,
    };
    stickerElement.style.left = previousStyle.left;
    stickerElement.style.top = previousStyle.top;
    stickerElement.style.width = previousStyle.width;
    stickerElement.style.height = previousStyle.height;
    stickerElement.style.transform = previousStyle.transform;
    stickerElement.style.transition = previousStyle.transition;

    if (stickerRect.width <= 0 || stickerRect.height <= 0) {
      return false;
    }

    const nextFit = fitStickerWithinFrameAvoidingRects(
      frameRect,
      stickerRect,
      characterRects,
    );
    lockedStageSizeRef.current = {
      width: stageElement.clientWidth,
      height: stageElement.clientHeight,
    };
    layoutLockedRef.current = true;
    setSafeFit({
      ...nextFit,
      ...authoredBox,
    });
    setResolvedAvoidanceKey(avoidanceKey);
    if (recheckLockedFit) {
      setLayoutReflowing(true);
    }
    return true;
  }, [
    avoidanceKey,
    placementTransform,
    sticker.anchorX,
    sticker.anchorY,
    sticker.height,
    sticker.rotate,
    sticker.source,
    sticker.width,
    sticker.x,
    sticker.y,
  ]);

  const scheduleSafeFit = useCallback((
    quietMs = STICKER_LAYOUT_QUIET_MS,
    recheckLockedFit = false,
  ) => {
    if ((!recheckLockedFit && layoutLockedRef.current) || !imageReadyRef.current) {
      return;
    }
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
    }
    const earliestDelay = Math.max(0, earliestMeasurementAtRef.current - performance.now());
    const attemptSafeFit = () => {
      settleTimerRef.current = null;
      if (lockSafeFit(recheckLockedFit)) {
        return;
      }
      settleTimerRef.current = window.setTimeout(
        attemptSafeFit,
        STICKER_OBSTACLE_SAMPLE_MS,
      );
    };
    settleTimerRef.current = window.setTimeout(() => {
      attemptSafeFit();
    }, Math.max(quietMs, earliestDelay));
  }, [lockSafeFit]);

  useLayoutEffect(() => {
    const avoidanceChanged = previousAvoidanceKeyRef.current !== avoidanceKey;
    previousAvoidanceKeyRef.current = avoidanceKey;
    if (layoutLockedRef.current) {
      if (avoidanceChanged) {
        if (sticker.leaving) {
          setResolvedAvoidanceKey(avoidanceKey);
          return;
        }
        // A camera or cast change can move an actor into the sticker before the
        // final obstacle bounds settle. Mark the old fit unresolved in the same
        // layout phase so it never paints on top of a face.
        setLayoutMotionReady(false);
        setLayoutReflowing(false);
        earliestMeasurementAtRef.current = performance.now()
          + Math.max(96, Math.ceil(avoidanceSettleMs) + 32);
        previousObstacleRectsRef.current = null;
        scheduleSafeFit(STICKER_LAYOUT_QUIET_MS, true);
      }
      return;
    }
    earliestMeasurementAtRef.current = performance.now()
      + Math.max(96, Math.ceil(avoidanceSettleMs) + 32);
    previousObstacleRectsRef.current = null;
    const imageElement = stickerRef.current?.querySelector<HTMLImageElement>('.sticker-visual');
    if (imageElement?.complete) {
      imageReadyRef.current = true;
    }
    scheduleSafeFit();
  }, [avoidanceKey, avoidanceSettleMs, scheduleSafeFit, sticker.leaving]);

  useEffect(() => {
    const stickerElement = stickerRef.current;
    const frameElement = stickerElement?.closest<HTMLElement>('.sticker-safe-frame');
    const stageElement = stickerElement?.closest<HTMLElement>('.stage-content-frame');
    if (!frameElement || !stageElement || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => {
      if (!layoutLockedRef.current) {
        scheduleSafeFit();
        return;
      }
      if (sticker.leaving) {
        return;
      }
      const lockedStageSize = lockedStageSizeRef.current;
      const nextStageSize = {
        width: stageElement.clientWidth,
        height: stageElement.clientHeight,
      };
      if (
        !lockedStageSize
        || !shouldRelayoutStickerForStageResize(lockedStageSize, nextStageSize)
      ) {
        return;
      }
      layoutLockedRef.current = false;
      lockedStageSizeRef.current = null;
      previousObstacleRectsRef.current = null;
      setSafeFit(null);
      setLayoutMotionReady(false);
      setResolvedAvoidanceKey('');
      setLayoutReflowing(false);
      earliestMeasurementAtRef.current = performance.now() + STICKER_RESIZE_QUIET_MS;
      scheduleSafeFit(STICKER_RESIZE_QUIET_MS);
    });
    observer.observe(stageElement);
    observer.observe(frameElement);
    stageElement.querySelectorAll<HTMLElement>('.char-layer .char').forEach((characterElement) => {
      observer.observe(characterElement);
    });
    return () => observer.disconnect();
  }, [avoidanceKey, scheduleSafeFit, sticker.leaving]);

  const layoutReady = Boolean(safeFit) && (
    sticker.leaving || resolvedAvoidanceKey === avoidanceKey
  );

  useEffect(() => {
    if (!layoutReady || layoutMotionReady) {
      return;
    }
    // The first collision-free fit is revealed in place. Enable interpolation
    // one paint later so only subsequent obstacle-driven relocations glide.
    layoutMotionFrameRef.current = window.requestAnimationFrame(() => {
      layoutMotionFrameRef.current = null;
      setLayoutMotionReady(true);
    });
    return () => {
      if (layoutMotionFrameRef.current !== null) {
        window.cancelAnimationFrame(layoutMotionFrameRef.current);
        layoutMotionFrameRef.current = null;
      }
    };
  }, [layoutMotionReady, layoutReady]);

  useEffect(() => {
    const stickerElement = stickerRef.current;
    const stageElement = stickerElement?.closest<HTMLElement>('.stage-content-frame');
    if (!stageElement) {
      return;
    }
    const onTransitionEnd = (event: TransitionEvent) => {
      const target = event.target;
      if (
        target instanceof Element
        && target.matches('.char, .char-composition-world, .char-camera-world')
        && !layoutLockedRef.current
      ) {
        scheduleSafeFit();
      }
    };
    stageElement.addEventListener('transitionend', onTransitionEnd);
    return () => {
      stageElement.removeEventListener('transitionend', onTransitionEnd);
    };
  }, [avoidanceKey, scheduleSafeFit]);

  useEffect(() => () => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
    }
    if (layoutMotionFrameRef.current !== null) {
      window.cancelAnimationFrame(layoutMotionFrameRef.current);
    }
  }, []);

  const markImageReady = useCallback(() => {
    imageReadyRef.current = true;
    scheduleSafeFit();
  }, [scheduleSafeFit]);

  return (
    <div
      ref={stickerRef}
      className="sticker"
      data-layout-ready={layoutReady ? 'true' : 'false'}
      data-layout-motion={layoutReady && layoutMotionReady ? 'true' : 'false'}
      data-layout-reflow={layoutReady && layoutReflowing ? 'true' : 'false'}
      data-motion-tempo={stickerLayoutMotionTempo}
      onAnimationEnd={(event) => {
        if (event.animationName === 'stickerSafeReflowReveal') {
          setLayoutReflowing(false);
        }
      }}
      style={{
        left: safeFit ? `${safeFit.left}px` : sticker.x,
        top: safeFit ? `${safeFit.top}px` : sticker.y,
        width: safeFit ? `${safeFit.width}px` : sticker.width,
        height: safeFit ? `${safeFit.height}px` : sticker.height,
        '--sticker-opacity': sticker.opacity,
        zIndex: sticker.zIndex,
        transform: fittedTransform,
        transformOrigin: 'center center',
        '--sticker-enter-duration': `${stickerEnterTiming.duration}ms`,
        '--sticker-enter-easing': stickerEnterEasing,
        '--sticker-enter-delay': `${stickerEnterTiming.delay}ms`,
        '--sticker-leave-duration': `${stickerLeaveTiming.duration}ms`,
        '--sticker-leave-easing': stickerLeaveEasing,
        '--sticker-leave-delay': `${stickerLeaveTiming.delay}ms`,
      } as CSSProperties}
    >
      <img
        className={[
          'sticker-visual',
          sticker.leaving
            ? `sticker-leave-${sticker.leaveEffect}`
            : entryComplete
              ? ''
              : `sticker-enter-${sticker.enterEffect}`,
        ].filter(Boolean).join(' ')}
        src={sticker.source}
        alt={sticker.id}
        loading="eager"
        decoding="async"
        onLoad={markImageReady}
        onError={markImageReady}
        onAnimationEnd={() => {
          if (!sticker.leaving) {
            setEntryComplete(true);
          }
        }}
        style={{
          width: sticker.width ? '100%' : undefined,
          height: sticker.height ? '100%' : undefined,
        }}
      />
    </div>
  );
});

export default function App() {
  const {
    baseUrl,
    assetOverrides,
    background,
    stickers,
    characters,
    speakerOrder,
    visibleCharacterIds,
    camera,
    dialogSpeaker,
    dialogSpeakerId,
    dialogCameraTargetId,
    dialogChannel,
    dialogDelivery,
    dialogUiHidden,
    effect,
    error,
    busy,
    isFinished,
    game,
    chapterLoading,
    chapterLoadingProgress,
    chapterLoadingMessage,
    videoCutscene,
    inputGate,
    choiceGate,
    inventory,
    storyLog,
    chapterIndex,
    chapterTotal,
    resolvedEndingId,
    gameOver,
    uiTemplate,
    setDialogUiHidden,
  } = useVNStore(useShallow((state) => ({
    baseUrl: state.baseUrl,
    assetOverrides: state.assetOverrides,
    background: state.background,
    stickers: state.stickers,
    characters: state.characters,
    speakerOrder: state.speakerOrder,
    visibleCharacterIds: state.visibleCharacterIds,
    camera: state.camera,
    dialogSpeaker: state.dialog.speaker,
    dialogSpeakerId: state.dialog.speakerId,
    dialogCameraTargetId: state.dialog.cameraTargetId,
    dialogChannel: state.dialog.channel,
    dialogDelivery: state.dialog.delivery,
    dialogUiHidden: state.dialogUiHidden,
    effect: state.effect,
    error: state.error,
    busy: state.busy,
    isFinished: state.isFinished,
    game: state.game,
    chapterLoading: state.chapterLoading,
    chapterLoadingProgress: state.chapterLoadingProgress,
    chapterLoadingMessage: state.chapterLoadingMessage,
    videoCutscene: state.videoCutscene,
    inputGate: state.inputGate,
    choiceGate: state.choiceGate,
    inventory: state.inventory,
    storyLog: state.storyLog,
    chapterIndex: state.chapterIndex,
    chapterTotal: state.chapterTotal,
    resolvedEndingId: state.resolvedEndingId,
    gameOver: state.gameOver,
    uiTemplate: state.uiTemplate,
    setDialogUiHidden: state.setDialogUiHidden,
  })));
  const [bootMode, setBootMode] = useState<BootMode>(
    () => resolveInitialBootPresentation(window.location.pathname).bootMode,
  );
  const [gameBootPending, setGameBootPending] = useState(
    () => resolveInitialBootPresentation(window.location.pathname).gameBootPending,
  );
  const [gameList, setGameList] = useState<GameListManifestEntry[]>([]);
  const [gameListLoading, setGameListLoading] = useState(false);
  const [gameListError, setGameListError] = useState<string | null>(null);
  const [manifestSchemaVersion, setManifestSchemaVersion] = useState<number | null>(null);
  const [manifestGeneratedAt, setManifestGeneratedAt] = useState<string | null>(null);
  const [manifestSeo, setManifestSeo] = useState<GameListManifestSeo | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTag, setActiveTag] = useState(ALL_TAG_FILTER);
  const [showAllLauncherTags, setShowAllLauncherTags] = useState(false);
  const [launcherShareNotice, setLauncherShareNotice] = useState('');
  const [uploading, setUploading] = useState(false);
  const [startGate, setStartGate] = useState<StartGateState | null>(null);
  const [startGateLaunching, setStartGateLaunching] = useState(false);
  const [inputAnswer, setInputAnswer] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [caseFileTab, setCaseFileTab] = useState<'log' | 'inventory' | 'system'>('log');
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<string | null>(null);
  const [inventoryDetailOpen, setInventoryDetailOpen] = useState(false);
  const [inventoryView, setInventoryView] = useState<InventoryViewPreference>(() => getInventoryUiSettings().view);
  const [inventorySort, setInventorySort] = useState<InventorySortPreference>(() => getInventoryUiSettings().sort);
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState<string>(() => getInventoryUiSettings().category);
  const [inventorySearchTerm, setInventorySearchTerm] = useState('');
  const [bgmEnabled, setBgmEnabledState] = useState(() => getBgmEnabled());
  const [autoSaveEnabled, setAutoSaveEnabledState] = useState(() => getAutoSaveEnabled());
  const [playerExperience, setPlayerExperience] = useState<PlayerExperienceSettings>(
    () => getPlayerExperienceSettings(),
  );
  const [saveSlots, setSaveSlots] = useState<SaveSlotSummary[]>(() => getSaveSlotSummaries());
  const [saveNotice, setSaveNotice] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [recoveredFailedChoice, setRecoveredFailedChoice] = useState<ChoiceRecoverySummary['failedChoice']>();
  const gameShellLocked = bootMode !== 'launcher' || Boolean(startGate);
  const [returningToStartGate, setReturningToStartGate] = useState(false);
  const holdTimerRef = useRef<number | undefined>(undefined);
  const holdStartRef = useRef<number>(0);
  const holdingRef = useRef(false);
  const settingsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const saveImportRef = useRef<HTMLInputElement | null>(null);
  const gameOverImportRef = useRef<HTMLInputElement | null>(null);
  const youtubeIframeRef = useRef<HTMLIFrameElement | null>(null);
  const nativeVideoRef = useRef<HTMLVideoElement | null>(null);
  const inputFieldRef = useRef<HTMLInputElement | null>(null);
  const choiceOptionButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const stageContentFrameRef = useRef<HTMLDivElement | null>(null);
  const dialogBoxRef = useRef<HTMLDivElement | null>(null);
  const previousPresentedVisibleCharacterIdsRef = useRef<ReadonlySet<string>>(new Set());
  const endingCreditsRollRef = useRef<HTMLDivElement | null>(null);
  const endingAutoScrollRafRef = useRef<number | null>(null);
  const endingAutoScrollLastTsRef = useRef<number | null>(null);
  const gameListRequestIdRef = useRef(0);
  const [launcherCarouselRef, launcherCarouselApi] = useEmblaCarousel(LAUNCHER_CAROUSEL_OPTIONS);
  const launcherTagFilterRef = useRef<HTMLDivElement | null>(null);
  const launcherCarouselPositionedRef = useRef(false);
  const launcherShareNoticeTimerRef = useRef<number | null>(null);
  const launcherShareGameIdRef = useRef<string | null>(null);
  const uploadedGameFileRef = useRef<File | null>(null);
  const [endingCreditsReady, setEndingCreditsReady] = useState(false);
  const [endingCreditsScrollUnlocked, setEndingCreditsScrollUnlocked] = useState(false);
  const [endingTopSpacerPx, setEndingTopSpacerPx] = useState(0);
  const [showEndingRestart, setShowEndingRestart] = useState(false);
  const [seenEndingIds, setSeenEndingIds] = useState<string[]>([]);
  const [stickerSafeInset, setStickerSafeInset] = useState(0);
  const [presentedVisibleCharacterIds, setPresentedVisibleCharacterIds] = useState<string[]>([]);
  const [layoutVisibleCharacterIds, setLayoutVisibleCharacterIds] = useState<string[]>([]);
  const {
    motionTempo,
    registerManualAdvance,
    sustainCatchUp,
    resetManualAdvanceTempo,
  } = useManualAdvanceTempo();
  const backgroundMotionTempo = useLatchedMotionTempo(background ?? '', motionTempo);
  const backgroundTransitionTiming = resolveAdaptiveMotionTiming(
    BACKGROUND_CROSSFADE_DURATION_MS,
    0,
    backgroundMotionTempo,
  );
  const backgroundTransitionEasing = resolveAdaptiveMotionEasing(
    'cubic-bezier(0.2, 0.72, 0.24, 1)',
    backgroundMotionTempo,
  );
  const characterVisibilityMotionKey = useMemo(
    () => presentedVisibleCharacterIds.join('::'),
    [presentedVisibleCharacterIds],
  );
  const characterVisibilityMotionTempo = useLatchedMotionTempo(
    characterVisibilityMotionKey,
    motionTempo,
  );
  const characterLeaveDurationMs = resolveAdaptiveExitFadeDuration(
    CHARACTER_EXIT_FADE_DURATION_MS,
    characterVisibilityMotionTempo,
  );
  const startGateAudioRef = useRef<HTMLAudioElement | null>(null);
  const characterVisibilityFrameRef = useRef<number | null>(null);
  const characterLayoutReleaseTimerRef = useRef<number | null>(null);
  const queuedManualAdvanceAtRef = useRef<number | null>(null);
  const recoveredChoiceWasPresentedRef = useRef(false);
  const youtubePlayerId = 'vn-cutscene-youtube-player';
  // const sampleZipUrl = '/sample.zip';
  const repositoryUrl = 'https://github.com/uiwwsw/yavn';
  const developmentGuideUrl = `${repositoryUrl}/blob/main/docs/DEVELOPMENT_GUIDE.ko.md`;
  const shareByPrUrl = 'https://github.com/uiwwsw/yavn/compare';
  const isDialogHiddenBySystem = videoCutscene.active || chapterLoading || Boolean(gameOver) || !game;
  const isDialogHidden = isDialogHiddenBySystem || dialogUiHidden;
  const showDialogRestoreButton = Boolean(game) && dialogUiHidden && !isDialogHiddenBySystem;
  const skipInputAutoFocus = useMemo(() => isMobilePointerEnvironment(), []);
  const startScreenReturnGameId = useMemo(() => parseGameIdFromPath(window.location.pathname), []);
  const canReturnToStartScreen = Boolean(startScreenReturnGameId || uploadedGameFileRef.current);
  const closeSettingsModal = useCallback(
    (restoreFocus: boolean = true) => {
      setSettingsOpen(false);
      setInventoryDetailOpen(false);
      if (!restoreFocus) {
        return;
      }
      window.requestAnimationFrame(() => {
        settingsTriggerRef.current?.focus({ preventScroll: true });
      });
    },
    [],
  );

  const stopStartGateMusic = useCallback(() => {
    const audio = startGateAudioRef.current;
    if (!audio) {
      return;
    }
    audio.pause();
    audio.src = '';
    startGateAudioRef.current = null;
  }, []);

  const tryPlayStartGateMusic = useCallback(() => {
    if (!bgmEnabled) {
      return;
    }
    const audio = startGateAudioRef.current;
    if (!audio || !audio.paused) {
      return;
    }
    void audio.play().catch(() => undefined);
  }, [bgmEnabled]);

  const loadGameListManifest = useCallback(async () => {
    const requestId = gameListRequestIdRef.current + 1;
    gameListRequestIdRef.current = requestId;
    setGameListLoading(true);
    setGameListError(null);
    try {
      const response = await fetch('/game-list/index.json', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`게임 목록을 불러오지 못했습니다. (HTTP ${response.status})`);
      }
      const rawManifest = (await response.json()) as unknown;
      const parsed = parseGameListManifest(rawManifest);
      if (requestId !== gameListRequestIdRef.current) {
        return;
      }
      setGameList(parsed.games);
      setManifestSchemaVersion(parsed.schemaVersion ?? null);
      setManifestGeneratedAt(parsed.generatedAt ?? null);
      setManifestSeo(parsed.seo ?? null);
      setGameListError(null);
      setGameListLoading(false);
      launcherCarouselPositionedRef.current = false;
      const normalizedLocationPath = normalizeLauncherDemoLocationPath(
        window.location.pathname,
        window.location.search,
        window.location.hash,
        parsed.games.map((entry) => entry.id),
      );
      if (normalizedLocationPath) {
        window.history.replaceState(window.history.state, '', normalizedLocationPath);
      }
      setSelectedGameId((prev) =>
        resolveInitialCarouselGameId(
          parsed.games.map((entry) => entry.id),
          prev,
          window.location.search,
          window.location.hash,
        ),
      );
    } catch (error) {
      if (requestId !== gameListRequestIdRef.current) {
        return;
      }
      setGameList([]);
      setManifestSchemaVersion(null);
      setManifestGeneratedAt(null);
      setManifestSeo(null);
      setSelectedGameId(null);
      launcherCarouselPositionedRef.current = false;
      setGameListError(error instanceof Error ? error.message : '게임 목록을 불러오지 못했습니다.');
      setGameListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (bootMode !== 'launcher') {
      return;
    }
    void loadGameListManifest();
  }, [bootMode, loadGameListManifest]);

  useEffect(() => {
    let cancelled = false;

    const initializeBoot = async () => {
      const pathname = window.location.pathname;
      const gameListMatch = pathname.match(/^\/game-list\/([^/]+)\/?$/);
      if (gameListMatch) {
        const gameId = decodeURIComponent(gameListMatch[1]);
        const gameUrl = `/game-list/${gameId}/`;
        const sessionKey = resolveStartGateSessionKey(gameId);
        setBootMode('gameList');
        if (!hasStartGateSessionFlag(sessionKey)) {
          try {
            const preview = await loadUrlStartScreenPreview(gameUrl);
            if (cancelled) {
              return;
            }
            if (preview.startScreen?.enabled) {
              const baseUrl = new URL(gameUrl, window.location.origin).toString();
              setStartGate({
                kind: 'url',
                gameUrl,
                sessionKey,
                uiTemplate: preview.uiTemplate,
                gameTitle: preview.gameTitle,
                seo: preview.seo,
                imageUrl: resolveStartGateAssetUrl(preview.startScreen.image, baseUrl),
                imagePosition: preview.startScreen.imagePosition,
                mobileImagePosition: preview.startScreen.mobileImagePosition,
                musicUrl: resolveStartGateAssetUrl(preview.startScreen.music, baseUrl),
                startButtonText: preview.startScreen.startButtonText || DEFAULT_START_BUTTON_TEXT,
                buttonPosition: preview.startScreen.buttonPosition ?? 'auto',
                showTitle: preview.startScreen.showTitle ?? true,
                titleColor: preview.startScreen.titleColor,
                showLoadButton: preview.hasLoadableSave,
                legalNotices: preview.legalNotices,
              });
              return;
            }
          } catch {
            // Ignore preview failures and continue with direct runtime loading.
          }
        }
        try {
          await loadGameFromUrl(gameUrl);
        } finally {
          if (!cancelled) {
            setGameBootPending(false);
          }
        }
        return;
      }

      setBootMode('launcher');
      setGameBootPending(false);
    };

    void initializeBoot();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (startGate?.kind === 'zip' && startGate.previewBlobUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(startGate.previewBlobUrl);
      }
      if (startGate?.kind === 'zip' && startGate.previewMusicBlobUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(startGate.previewMusicBlobUrl);
      }
    };
  }, [startGate]);

  useEffect(() => {
    stopStartGateMusic();
    if (!startGate?.musicUrl || !bgmEnabled) {
      return;
    }
    const audio = new Audio(startGate.musicUrl);
    audio.loop = true;
    audio.volume = getPlayerExperienceSettings().bgmVolume;
    startGateAudioRef.current = audio;
    void audio.play().catch(() => undefined);
    return () => {
      audio.pause();
      audio.src = '';
      if (startGateAudioRef.current === audio) {
        startGateAudioRef.current = null;
      }
    };
  }, [bgmEnabled, startGate, stopStartGateMusic]);

  useEffect(() => {
    if (startGateAudioRef.current) {
      startGateAudioRef.current.volume = playerExperience.bgmVolume;
    }
  }, [playerExperience.bgmVolume]);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle(GAME_SHELL_LOCK_CLASS, gameShellLocked);
    document.body.classList.toggle(GAME_SHELL_LOCK_CLASS, gameShellLocked);

    return () => {
      document.documentElement.classList.remove(GAME_SHELL_LOCK_CLASS);
      document.body.classList.remove(GAME_SHELL_LOCK_CLASS);
    };
  }, [gameShellLocked]);

  useEffect(() => {
    let previousTouchY: number | null = null;
    const preventGestureZoom = (event: Event) => {
      event.preventDefault();
    };
    const rememberTouchPosition = (event: TouchEvent) => {
      previousTouchY = event.touches[0]?.clientY ?? null;
    };
    const clearTouchPosition = () => {
      previousTouchY = null;
    };
    const preventPinchZoomAndShellOverscroll = (event: TouchEvent) => {
      if (event.touches.length > 1) {
        event.preventDefault();
        return;
      }
      const currentTouchY = event.touches[0]?.clientY;
      if (!gameShellLocked || currentTouchY === undefined || previousTouchY === null) {
        previousTouchY = currentTouchY ?? null;
        return;
      }
      const touchDeltaY = currentTouchY - previousTouchY;
      previousTouchY = currentTouchY;
      if (event.cancelable && shouldPreventGameShellOverscroll(event.target, touchDeltaY)) {
        event.preventDefault();
      }
    };
    document.addEventListener('gesturestart', preventGestureZoom, { passive: false });
    document.addEventListener('gesturechange', preventGestureZoom, { passive: false });
    document.addEventListener('gestureend', preventGestureZoom, { passive: false });
    document.addEventListener('touchstart', rememberTouchPosition, { passive: true });
    document.addEventListener('touchmove', preventPinchZoomAndShellOverscroll, { passive: false });
    document.addEventListener('touchend', clearTouchPosition, { passive: true });
    document.addEventListener('touchcancel', clearTouchPosition, { passive: true });
    return () => {
      document.removeEventListener('gesturestart', preventGestureZoom);
      document.removeEventListener('gesturechange', preventGestureZoom);
      document.removeEventListener('gestureend', preventGestureZoom);
      document.removeEventListener('touchstart', rememberTouchPosition);
      document.removeEventListener('touchmove', preventPinchZoomAndShellOverscroll);
      document.removeEventListener('touchend', clearTouchPosition);
      document.removeEventListener('touchcancel', clearTouchPosition);
    };
  }, [gameShellLocked]);

  const handleManualAdvance = useCallback(() => {
    const nextTempo = registerManualAdvance();
    const current = useVNStore.getState();
    if (current.busy && nextTempo === 'catch-up') {
      // Do not discard deliberate repeated input during a short authored lock.
      // Keep only one request so a held key cannot race through several lines.
      queuedManualAdvanceAtRef.current = performance.now();
      return;
    }
    queuedManualAdvanceAtRef.current = null;
    handleAdvance();
  }, [registerManualAdvance]);

  useEffect(() => {
    if (busy || queuedManualAdvanceAtRef.current === null) {
      return;
    }
    const queuedAt = queuedManualAdvanceAtRef.current;
    queuedManualAdvanceAtRef.current = null;
    if (
      !isQueuedManualAdvanceFresh(queuedAt, performance.now())
      || settingsOpen
      || dialogUiHidden
      || chapterLoading
      || Boolean(gameOver)
      || isFinished
      || videoCutscene.active
      || inputGate.active
      || choiceGate.active
    ) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      sustainCatchUp();
      handleAdvance();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    busy,
    chapterLoading,
    choiceGate.active,
    dialogUiHidden,
    gameOver,
    inputGate.active,
    isFinished,
    settingsOpen,
    sustainCatchUp,
    videoCutscene.active,
  ]);

  useAdvanceByKey(dialogUiHidden || settingsOpen || Boolean(gameOver), handleManualAdvance);

  useLayoutEffect(() => {
    if (characterVisibilityFrameRef.current !== null) {
      window.cancelAnimationFrame(characterVisibilityFrameRef.current);
      characterVisibilityFrameRef.current = null;
    }
    if (haveSameCharacterIds(presentedVisibleCharacterIds, visibleCharacterIds)) {
      return;
    }

    const nextVisibleCharacterIds = [...visibleCharacterIds];
    if (chapterLoading) {
      setLayoutVisibleCharacterIds(nextVisibleCharacterIds);
      setPresentedVisibleCharacterIds(nextVisibleCharacterIds);
      return;
    }
    characterVisibilityFrameRef.current = window.requestAnimationFrame(() => {
      characterVisibilityFrameRef.current = null;
      const shouldHoldPreviousLayout = isCharacterOnlyExit(
        presentedVisibleCharacterIds,
        nextVisibleCharacterIds,
      ) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!shouldHoldPreviousLayout) {
        // Stage new and replacement actors at their final ensemble coordinates
        // before revealing them, so an entrance never starts at a stale solo/duo slot.
        setLayoutVisibleCharacterIds(nextVisibleCharacterIds);
      }
      setPresentedVisibleCharacterIds(nextVisibleCharacterIds);
    });

    return () => {
      if (characterVisibilityFrameRef.current !== null) {
        window.cancelAnimationFrame(characterVisibilityFrameRef.current);
        characterVisibilityFrameRef.current = null;
      }
    };
  }, [chapterLoading, presentedVisibleCharacterIds, visibleCharacterIds]);

  useLayoutEffect(() => {
    if (characterLayoutReleaseTimerRef.current !== null) {
      window.clearTimeout(characterLayoutReleaseTimerRef.current);
      characterLayoutReleaseTimerRef.current = null;
    }
    if (haveSameCharacterIds(layoutVisibleCharacterIds, presentedVisibleCharacterIds)) {
      return;
    }

    const nextLayoutCharacterIds = [...presentedVisibleCharacterIds];
    const shouldWaitForExit = isCharacterOnlyExit(
      layoutVisibleCharacterIds,
      nextLayoutCharacterIds,
    )
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!shouldWaitForExit) {
      setLayoutVisibleCharacterIds(nextLayoutCharacterIds);
      return;
    }

    characterLayoutReleaseTimerRef.current = window.setTimeout(() => {
      characterLayoutReleaseTimerRef.current = null;
      setLayoutVisibleCharacterIds(nextLayoutCharacterIds);
    }, characterLeaveDurationMs);

    return () => {
      if (characterLayoutReleaseTimerRef.current !== null) {
        window.clearTimeout(characterLayoutReleaseTimerRef.current);
        characterLayoutReleaseTimerRef.current = null;
      }
    };
  }, [characterLeaveDurationMs, layoutVisibleCharacterIds, presentedVisibleCharacterIds]);

  useEffect(() => {
    const preventDefault = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.app')) {
        return;
      }
      const tag = target.tagName.toLowerCase();
      if (
        target.isContentEditable ||
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        Boolean(target.closest('a, button'))
      ) {
        return;
      }
      event.preventDefault();
    };
    document.addEventListener('contextmenu', preventDefault);
    document.addEventListener('dragstart', preventDefault);
    document.addEventListener('selectstart', preventDefault);
    return () => {
      document.removeEventListener('contextmenu', preventDefault);
      document.removeEventListener('dragstart', preventDefault);
      document.removeEventListener('selectstart', preventDefault);
    };
  }, []);

  useEffect(() => {
    setBgmEnabledState(getBgmEnabled());
    setAutoSaveEnabledState(getAutoSaveEnabled());
    setPlayerExperience(getPlayerExperienceSettings());
    setSaveSlots(getSaveSlotSummaries());
    setSaveNotice('');
    const inventoryUiSettings = getInventoryUiSettings();
    setInventoryView(inventoryUiSettings.view);
    setInventorySort(inventoryUiSettings.sort);
    setInventoryCategoryFilter(inventoryUiSettings.category);
    setInventorySearchTerm('');
  }, [bootMode, game?.meta.title, game?.meta.version, startGate?.kind, startGate?.gameTitle]);

  useEffect(() => {
    setPlayerAutoPlayPaused(settingsOpen || dialogUiHidden);
  }, [dialogUiHidden, settingsOpen]);

  useEffect(() => {
    setSaveNotice('');
    setSaveSlots(getSaveSlotSummaries());
  }, [gameOver, chapterIndex]);

  useEffect(() => {
    if (!game) {
      setSettingsOpen(false);
    }
  }, [game]);

  const allLauncherTags = useMemo(() => {
    const tagCounts = new Map<string, number>();
    for (const entry of gameList) {
      for (const tag of entry.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(tagCounts)
      .sort(([tagA, countA], [tagB, countB]) => countB - countA || tagA.localeCompare(tagB, 'ko'))
      .map(([tag]) => tag);
  }, [gameList]);

  useEffect(() => {
    if (activeTag === ALL_TAG_FILTER) {
      return;
    }
    if (!allLauncherTags.includes(activeTag)) {
      setActiveTag(ALL_TAG_FILTER);
    }
  }, [activeTag, allLauncherTags]);

  const visibleLauncherTags = useMemo(() => {
    if (showAllLauncherTags || allLauncherTags.length <= DEFAULT_VISIBLE_LAUNCHER_TAGS) {
      return allLauncherTags;
    }
    const visible = allLauncherTags.slice(0, DEFAULT_VISIBLE_LAUNCHER_TAGS);
    if (activeTag !== ALL_TAG_FILTER && !visible.includes(activeTag)) {
      visible[visible.length - 1] = activeTag;
    }
    return visible;
  }, [activeTag, allLauncherTags, showAllLauncherTags]);

  const hiddenLauncherTagCount = Math.max(0, allLauncherTags.length - visibleLauncherTags.length);

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredGames = useMemo(() => {
    return gameList.filter((entry) => {
      const matchesTag = activeTag === ALL_TAG_FILTER || entry.tags.includes(activeTag);
      if (!matchesTag) {
        return false;
      }
      if (!normalizedSearchTerm) {
        return true;
      }
      return [
        entry.id,
        entry.name,
        entry.path,
        entry.author ?? '',
        entry.summary ?? '',
        entry.tags.join(' '),
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearchTerm);
    });
  }, [activeTag, gameList, normalizedSearchTerm]);

  const selectedGame =
    gameList.find((entry) => entry.id === selectedGameId) ??
    gameList[0] ??
    null;
  const selectedGameIndex = selectedGame
    ? gameList.findIndex((entry) => entry.id === selectedGame.id)
    : -1;
  const manifestTimestampLabel = formatManifestTimestamp(manifestGeneratedAt);
  const gameListStatus = gameListLoading ? 'LOADING' : gameListError ? 'FAULT' : gameList.length > 0 ? 'READY' : 'EMPTY';

  useEffect(() => {
    const nextGameId = selectedGame?.id ?? null;
    if (launcherShareGameIdRef.current && launcherShareGameIdRef.current !== nextGameId) {
      setLauncherShareNotice('');
      if (launcherShareNoticeTimerRef.current !== null) {
        window.clearTimeout(launcherShareNoticeTimerRef.current);
        launcherShareNoticeTimerRef.current = null;
      }
    }
    launcherShareGameIdRef.current = nextGameId;
  }, [selectedGame?.id]);

  const clearLauncherDeepLinkFromAddress = useCallback(() => {
    const hasQuerySelection = Boolean(parseLauncherDemoQuery(window.location.search));
    const hasLegacyHashSelection = Boolean(parseLauncherDemoHash(window.location.hash));
    if (!hasQuerySelection && !hasLegacyHashSelection) {
      return;
    }
    const nextPath = clearLauncherDemoSharePath(window.location.pathname, window.location.search);
    const preservedHash = hasLegacyHashSelection ? '' : window.location.hash;
    window.history.replaceState(window.history.state, '', `${nextPath}${preservedHash}`);
  }, []);

  const copySelectedGameLink = useCallback(async () => {
    if (!selectedGame) {
      return;
    }
    const sharePath = buildLauncherDemoSharePath(
      window.location.pathname,
      window.location.search,
      selectedGame.id,
    );
    const shareUrl = new URL(sharePath, window.location.origin).toString();
    const copied = await copyTextToClipboard(shareUrl);
    setLauncherShareNotice(copied ? '링크를 복사했습니다.' : '링크 복사에 실패했습니다.');
    if (launcherShareNoticeTimerRef.current !== null) {
      window.clearTimeout(launcherShareNoticeTimerRef.current);
    }
    launcherShareNoticeTimerRef.current = window.setTimeout(() => {
      launcherShareNoticeTimerRef.current = null;
      setLauncherShareNotice('');
    }, 2400);
  }, [selectedGame]);

  const moveLauncherCarouselToIndex = useCallback((requestedIndex: number, jump = false) => {
    const nextIndex = wrapCarouselIndex(requestedIndex, gameList.length);
    if (nextIndex < 0 || !launcherCarouselApi) {
      return;
    }

    clearLauncherDeepLinkFromAddress();
    launcherCarouselApi.scrollTo(nextIndex, jump);
  }, [clearLauncherDeepLinkFromAddress, gameList.length, launcherCarouselApi]);

  const moveLauncherCarousel = useCallback((direction: -1 | 1) => {
    if (!launcherCarouselApi) {
      return;
    }
    clearLauncherDeepLinkFromAddress();
    if (direction < 0) {
      launcherCarouselApi.scrollPrev();
    } else {
      launcherCarouselApi.scrollNext();
    }
  }, [clearLauncherDeepLinkFromAddress, launcherCarouselApi]);

  const preserveLauncherControlFocus = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
  }, []);

  const onLauncherCarouselKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveLauncherCarousel(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveLauncherCarousel(1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      moveLauncherCarouselToIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      moveLauncherCarouselToIndex(gameList.length - 1);
    }
  }, [gameList.length, moveLauncherCarousel, moveLauncherCarouselToIndex]);

  useEffect(() => {
    if (!launcherCarouselApi) {
      return;
    }
    const commitSettledSnap = () => {
      const selectedIndex = wrapCarouselIndex(launcherCarouselApi.selectedScrollSnap(), gameList.length);
      const nextGameId = selectedIndex >= 0 ? gameList[selectedIndex]?.id : undefined;
      if (nextGameId) {
        setSelectedGameId((currentGameId) => currentGameId === nextGameId ? currentGameId : nextGameId);
      }
    };
    launcherCarouselApi.on('settle', commitSettledSnap);
    return () => {
      launcherCarouselApi.off('settle', commitSettledSnap);
    };
  }, [gameList, launcherCarouselApi]);

  useLayoutEffect(() => {
    if (
      bootMode !== 'launcher' ||
      launcherCarouselPositionedRef.current ||
      selectedGameIndex < 0
    ) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      if (!launcherCarouselApi) {
        return;
      }
      launcherCarouselApi.scrollTo(selectedGameIndex, true);
      launcherCarouselPositionedRef.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [bootMode, gameList.length, launcherCarouselApi, selectedGameIndex]);

  useEffect(() => {
    return () => {
      if (launcherShareNoticeTimerRef.current !== null) {
        window.clearTimeout(launcherShareNoticeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const launcherTitles =
      manifestSeo?.gameTitles && manifestSeo.gameTitles.length > 0 ? manifestSeo.gameTitles : gameList.map((entry) => entry.name);
    const launcherKeywords = mergeUniqueTextList(DEFAULT_SEO_KEYWORDS, manifestSeo?.keywords ?? [], launcherTitles);
    const launcherDescription =
      manifestSeo?.description ??
      (launcherTitles.length > 0
        ? `야븐엔진(YAVN)에서 플레이 가능한 게임: ${launcherTitles.slice(0, 8).join(', ')}${launcherTitles.length > 8 ? ` 외 ${launcherTitles.length - 8}개` : ''}.`
        : DEFAULT_SEO_DESCRIPTION);

    if (bootMode === 'launcher') {
      const launcherImage =
        resolveAbsoluteSeoUrl(selectedGame?.seo?.image ?? selectedGame?.thumbnail) ?? DEFAULT_SEO_IMAGE;
      const launcherImageAlt =
        selectedGame?.seo?.imageAlt ?? (selectedGame ? `${selectedGame.name} 대표 이미지` : DEFAULT_SEO_IMAGE_ALT);
      applySeoMetadata({
        title: manifestSeo?.title ?? DEFAULT_SEO_TITLE,
        description: launcherDescription,
        keywords: launcherKeywords,
        canonicalUrl: DEFAULT_CANONICAL_URL,
        imageUrl: launcherImage,
        imageAlt: launcherImageAlt,
        jsonLd: buildLauncherJsonLd(gameList),
      });
      return;
    }

    if (startGate) {
      const startGateTitle = startGate.gameTitle;
      const startGateDescription = startGate.seo?.description ?? `${startGateTitle}을(를) 시작할 준비가 되었습니다.`;
      const startGateCanonicalUrl =
        startGate.kind === 'url'
          ? new URL(startGate.gameUrl, window.location.origin).toString()
          : window.location.href;
      const startGateImageUrl =
        resolveAbsoluteSeoUrl(startGate.seo?.image, startGateCanonicalUrl) ??
        startGate.imageUrl ??
        DEFAULT_SEO_IMAGE;
      const startGateImageAlt = startGate.seo?.imageAlt ?? `${startGateTitle} 대표 이미지`;
      const startGateKeywords = mergeUniqueTextList(
        DEFAULT_SEO_KEYWORDS,
        [startGateTitle],
        startGate.seo?.keywords ?? [],
      );
      applySeoMetadata({
        title: startGateTitle,
        description: startGateDescription,
        keywords: startGateKeywords,
        canonicalUrl: startGateCanonicalUrl,
        imageUrl: startGateImageUrl,
        imageAlt: startGateImageAlt,
        jsonLd: buildGameJsonLd(startGateTitle, startGateDescription, startGateCanonicalUrl, startGateImageUrl),
      });
      return;
    }

    if (game) {
      const gameSeo: GameSeoMeta | undefined = game.meta.seo;
      const gameTitle = game.meta.title;
      const gameDescription = gameSeo?.description ?? `${gameTitle}을(를) 야븐엔진(YAVN)에서 플레이하세요.`;
      const gameCanonicalUrl = window.location.href;
      const gameImageUrl = resolveAbsoluteSeoUrl(gameSeo?.image, gameCanonicalUrl) ?? DEFAULT_SEO_IMAGE;
      const gameImageAlt = gameSeo?.imageAlt ?? `${gameTitle} 대표 이미지`;
      const gameKeywords = mergeUniqueTextList(DEFAULT_SEO_KEYWORDS, [gameTitle], gameSeo?.keywords ?? []);
      const gameAuthorName = normalizeAuthorCredit(game.meta.author).name;
      applySeoMetadata({
        title: gameTitle,
        description: gameDescription,
        keywords: gameKeywords,
        canonicalUrl: gameCanonicalUrl,
        imageUrl: gameImageUrl,
        imageAlt: gameImageAlt,
        jsonLd: buildGameJsonLd(gameTitle, gameDescription, gameCanonicalUrl, gameImageUrl, gameAuthorName),
      });
      return;
    }

    applySeoMetadata({
      title: DEFAULT_SEO_TITLE,
      description: DEFAULT_SEO_DESCRIPTION,
      keywords: DEFAULT_SEO_KEYWORDS,
      canonicalUrl: DEFAULT_CANONICAL_URL,
      imageUrl: DEFAULT_SEO_IMAGE,
      imageAlt: DEFAULT_SEO_IMAGE_ALT,
      jsonLd: undefined,
    });
  }, [
    bootMode,
    game,
    gameList,
    manifestSeo,
    startGate,
    selectedGame?.id,
    selectedGame?.thumbnail,
    selectedGame?.seo?.image,
    selectedGame?.seo?.imageAlt,
  ]);

  const effectClass = effect ? `effect-${effect}` : '';
  const authorCredit = normalizeAuthorCredit(game?.meta.author);
  const hasAuthorCredit = Boolean(authorCredit.name) || authorCredit.contacts.length > 0;
  const gameLegalNotices = game?.meta.legalNotices ?? [];
  const resolvedEnding = resolvedEndingId ? game?.endings?.[resolvedEndingId] : undefined;
  const endingTitle = resolvedEnding?.title ?? 'THE END';
  const endingMessage = resolvedEnding?.message ?? '게임이 종료되었습니다.';
  const endingBackgroundUrl = resolveRuntimeAssetUrl(game?.endingScreen?.image, baseUrl, assetOverrides);
  const totalEndingCount = Object.keys(game?.endings ?? {}).length;
  const seenEndingIdsInCurrentGame = seenEndingIds.filter((endingId) => Boolean(game?.endings?.[endingId]));
  const seenEndingCount = seenEndingIdsInCurrentGame.length;
  const endingCompletionPercent = totalEndingCount > 0 ? Math.round((seenEndingCount / totalEndingCount) * 100) : 0;
  const endingCollectionDone = totalEndingCount > 0 && seenEndingCount >= totalEndingCount;
  const inputSubmitLabel = inputAnswer.trim().length > 0 ? '확인' : '모르겠다';
  const saveSlotByKind = useMemo(
    () => new Map(saveSlots.map((slot) => [slot.slot, slot])),
    [saveSlots],
  );
  const autoRecoverySlot = saveSlotByKind.get('auto');
  const manualSaveSlot = saveSlotByKind.get('manual');
  const chapterSaveSlot = saveSlotByKind.get('chapter');
  const choiceRecoveryPoint = getChoiceRecoverySummary();
  const seenEndingTitles = seenEndingIdsInCurrentGame
    .map((endingId) => game?.endings?.[endingId]?.title ?? endingId)
    .filter((title, index, arr) => title.length > 0 && arr.indexOf(title) === index);
  const inventoryCatalogEntries = useMemo<InventoryCatalogEntry[]>(() => {
    const defaults = game?.inventory?.defaults ?? {};
    return Object.entries(defaults)
      .map(([id, item]) => ({
        id,
        name: item.name,
        description: item.description,
        imageUrl: resolveRuntimeAssetUrl(item.image, baseUrl, assetOverrides),
        owned: Boolean(inventory[id]),
        category: item.category ?? INVENTORY_DEFAULT_CATEGORY,
        order: typeof item.order === 'number' ? item.order : 9999,
      }));
  }, [assetOverrides, baseUrl, game?.inventory?.defaults, inventory]);
  const ownedInventoryCount = useMemo(
    () => inventoryCatalogEntries.reduce((acc, entry) => acc + (entry.owned ? 1 : 0), 0),
    [inventoryCatalogEntries],
  );
  const totalInventoryCount = inventoryCatalogEntries.length;
  const inventoryCategoryOptions = useMemo(() => {
    const categories = new Set<string>();
    for (const entry of inventoryCatalogEntries) {
      categories.add(entry.category);
    }
    return Array.from(categories).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [inventoryCatalogEntries]);
  const normalizedInventorySearchTerm = inventorySearchTerm.trim().toLowerCase();
  const inventoryViewEntries = useMemo(
    () => inventoryCatalogEntries.filter((entry) => (inventoryView === 'bag' ? entry.owned : true)),
    [inventoryCatalogEntries, inventoryView],
  );
  const inventoryVisibleEntries = useMemo(() => {
    const filtered = inventoryViewEntries
      .filter((entry) => (inventoryCategoryFilter ? entry.category === inventoryCategoryFilter : true))
      .filter((entry) => {
        if (!normalizedInventorySearchTerm) {
          return true;
        }
        return entry.name.toLowerCase().includes(normalizedInventorySearchTerm);
      });
    return filtered.sort((a, b) => {
      if (inventorySort === 'order' && a.order !== b.order) {
        return a.order - b.order;
      }
      return a.name.localeCompare(b.name, 'ko');
    });
  }, [
    inventoryViewEntries,
    inventoryCategoryFilter,
    normalizedInventorySearchTerm,
    inventorySort,
  ]);
  const selectedInventoryEntry = inventoryVisibleEntries.find((entry) => entry.id === selectedInventoryItemId) ?? null;
  const inventoryFiltersActive = normalizedInventorySearchTerm.length > 0 || inventoryCategoryFilter.length > 0;
  const inventoryGridEmptyMessage = useMemo(() => {
    if (inventoryCatalogEntries.length === 0) {
      return '이 게임에는 등록된 단서가 없습니다.';
    }
    if (inventoryViewEntries.length === 0) {
      return '아직 획득한 단서가 없습니다.';
    }
    if (inventoryVisibleEntries.length === 0) {
      return '검색 조건에 맞는 단서가 없습니다.';
    }
    return '';
  }, [inventoryCatalogEntries.length, inventoryViewEntries.length, inventoryVisibleEntries.length]);
  const recoveredFailedChoiceIndex = choiceGate.active
    && recoveredFailedChoice?.key === choiceGate.key
    ? (() => {
        const exactIndex = choiceGate.options.findIndex((option, index) =>
          index === recoveredFailedChoice.optionIndex && option.text === recoveredFailedChoice.value);
        return exactIndex >= 0
          ? exactIndex
          : choiceGate.options.findIndex((option) => option.text === recoveredFailedChoice.value);
      })()
    : -1;
  const hasRecoveredFailedChoice = recoveredFailedChoiceIndex >= 0;
  const visibleCharacterSet = useMemo(
    () => new Set(presentedVisibleCharacterIds),
    [presentedVisibleCharacterIds],
  );
  const enteringCharacterSet = useMemo(
    () => new Set(
      presentedVisibleCharacterIds.filter(
        (characterId) => !previousPresentedVisibleCharacterIdsRef.current.has(characterId),
      ),
    ),
    [presentedVisibleCharacterIds],
  );
  useEffect(() => {
    previousPresentedVisibleCharacterIdsRef.current = new Set(presentedVisibleCharacterIds);
  }, [presentedVisibleCharacterIds]);
  const layoutCharacterSet = useMemo(
    () => new Set(layoutVisibleCharacterIds),
    [layoutVisibleCharacterIds],
  );
  const stagedCharactersByPosition = useMemo(
    () => (
      [
        { position: 'left' as const, slot: characters.left },
        { position: 'center' as const, slot: characters.center },
        { position: 'right' as const, slot: characters.right },
      ] as const
    ).filter((entry): entry is { position: Position; slot: CharacterSlot } => Boolean(entry.slot)),
    [characters],
  );
  const enteringCharactersByPosition = useMemo(
    () => stagedCharactersByPosition.filter((entry) => enteringCharacterSet.has(entry.slot.id)),
    [enteringCharacterSet, stagedCharactersByPosition],
  );
  const characterEnterLayoutTiming = useMemo(
    () => enteringCharactersByPosition.reduce(
      (timing, entry) => {
        if (entry.slot.enterLayout !== 'push') {
          return timing;
        }
        const adaptiveTiming = resolveAdaptiveMotionTiming(
          entry.slot.enterDuration,
          entry.slot.enterDelay,
          characterVisibilityMotionTempo,
        );
        const total = adaptiveTiming.delay + adaptiveTiming.duration;
        return total >= timing.total
          ? {
              duration: adaptiveTiming.duration,
              easing: resolveAdaptiveMotionEasing(
                entry.slot.enterEasing,
                characterVisibilityMotionTempo,
              ),
              delay: adaptiveTiming.delay,
              total,
            }
          : timing;
      },
      { duration: 0, easing: 'ease-out', delay: 0, total: -1 },
    ),
    [characterVisibilityMotionTempo, enteringCharactersByPosition],
  );
  const characterEnterMotionDurationMs = enteringCharactersByPosition.reduce(
    (duration, entry) => {
      const timing = resolveAdaptiveMotionTiming(
        entry.slot.enterDuration,
        entry.slot.enterDelay,
        characterVisibilityMotionTempo,
      );
      return Math.max(duration, timing.delay + timing.duration);
    },
    0,
  );
  const characterEntranceMotionActive = useTransientMotionWindow(
    characterVisibilityMotionKey,
    enteringCharactersByPosition.length > 0
      ? Math.max(1, characterEnterMotionDurationMs)
      : 0,
  );
  const characterEnterLayout = !characterEntranceMotionActive
    ? 'idle'
    : enteringCharactersByPosition.some((entry) => entry.slot.enterLayout === 'push')
      ? 'push'
      : 'cut';
  const visibleCharactersByPosition = useMemo(
    () => stagedCharactersByPosition.filter((entry) => visibleCharacterSet.has(entry.slot.id)),
    [stagedCharactersByPosition, visibleCharacterSet],
  );
  const layoutCharactersByPosition = useMemo(
    () => stagedCharactersByPosition.filter((entry) => layoutCharacterSet.has(entry.slot.id)),
    [layoutCharacterSet, stagedCharactersByPosition],
  );
  const promptTopStagedCharactersByPosition = useMemo(
    () => stagedCharactersByPosition.filter((entry) => entry.slot.placement === 'prompt-top'),
    [stagedCharactersByPosition],
  );
  const characterStageLayout = useMemo(
    () => resolveCharacterStageLayout(
      layoutCharactersByPosition.map((entry) => ({
        id: entry.slot.id,
        position: entry.position,
      })),
    ),
    [layoutCharactersByPosition],
  );
  const visibleCharacterCount = visibleCharactersByPosition.length;
  const layoutCharacterCount = layoutCharactersByPosition.length;
  const effectiveCameraTargetId = useMemo(
    () => resolveStageCameraFocusTargetId(
      camera,
      presentedVisibleCharacterIds,
      dialogSpeakerId,
      dialogCameraTargetId,
    ),
    [camera, dialogCameraTargetId, dialogSpeakerId, presentedVisibleCharacterIds],
  );
  const cameraTargetPosition = useMemo(
    () => layoutCharactersByPosition.find(
      (entry) => entry.slot.id === effectiveCameraTargetId,
    )?.position,
    [effectiveCameraTargetId, layoutCharactersByPosition],
  );
  const characterStageSpacing = useMemo(
    () => resolveCharacterStageSpacing(
      layoutCharactersByPosition.map((entry) => entry.slot.calibration.spacing),
    ),
    [layoutCharactersByPosition],
  );
  const cameraPresentation = useMemo(
    () => resolveStageCameraPresentation(
      camera,
      visibleCharacterCount,
      cameraTargetPosition,
      characterStageLayout,
      characterStageSpacing,
    ),
    [
      camera,
      cameraTargetPosition,
      characterStageLayout,
      characterStageSpacing,
      visibleCharacterCount,
    ],
  );
  const cameraMotionKey = useMemo(() => [
    cameraPresentation.scale,
    cameraPresentation.mobileScale,
    cameraPresentation.panX,
    cameraPresentation.mobilePanX,
  ].join('::'), [cameraPresentation]);
  const cameraMotionTempo = useLatchedMotionTempo(cameraMotionKey, motionTempo);
  const authoredCameraTransitionTiming = useMemo(
    () => resolveStageCameraTransitionTiming(cameraPresentation, visibleCharacterCount),
    [cameraPresentation, visibleCharacterCount],
  );
  const cameraTransitionTiming = useMemo(() => {
    if (cameraMotionTempo === 'normal') {
      return authoredCameraTransitionTiming;
    }
    const adaptiveTiming = resolveAdaptiveMotionTiming(
      cameraPresentation.duration,
      0,
      cameraMotionTempo,
    );
    return {
      cameraDelay: 0,
      cameraDuration: adaptiveTiming.duration,
      characterExitDuration: resolveAdaptiveExitFadeDuration(
        authoredCameraTransitionTiming.characterExitDuration,
        cameraMotionTempo,
      ),
    };
  }, [authoredCameraTransitionTiming, cameraMotionTempo, cameraPresentation.duration]);
  const focusCharacterId = (cameraPresentation.shot === 'close' || cameraPresentation.shot === 'reaction') && effectiveCameraTargetId
    ? effectiveCameraTargetId
    : dialogSpeakerId;
  const focusedCharacterPlacement = stagedCharactersByPosition.find(
    (entry) => entry.slot.id === focusCharacterId,
  )?.slot.placement;
  const stageBottomLayerZIndex = focusedCharacterPlacement === 'prompt-top' ? 2 : 3;
  const promptTopLayerZIndex = focusedCharacterPlacement === 'stage-bottom' ? 2 : 3;
  const cameraStyle = useMemo(() => ({
    '--stage-camera-scale': cameraPresentation.scale,
    '--stage-camera-scale-mobile': cameraPresentation.mobileScale,
    '--stage-camera-pan-x': cameraPresentation.panX,
    '--stage-camera-pan-x-mobile': cameraPresentation.mobilePanX,
    '--stage-camera-origin-y': `${cameraPresentation.originY}%`,
    '--stage-camera-origin-y-mobile': `${cameraPresentation.mobileOriginY}%`,
    '--stage-camera-duration': `${cameraTransitionTiming.cameraDelay + cameraTransitionTiming.cameraDuration}ms`,
    '--stage-camera-motion-duration': `${cameraTransitionTiming.cameraDuration}ms`,
    '--stage-camera-motion-delay': `${cameraTransitionTiming.cameraDelay}ms`,
    '--stage-camera-motion-easing': resolveAdaptiveMotionEasing(
      'cubic-bezier(0.2, 0.72, 0.24, 1)',
      cameraMotionTempo,
    ),
    '--character-exit-duration': `${cameraTransitionTiming.characterExitDuration}ms`,
    '--character-leave-duration': `${characterLeaveDurationMs}ms`,
    '--character-enter-layout-duration': `${characterEnterLayoutTiming.duration}ms`,
    '--character-enter-layout-easing': characterEnterLayoutTiming.easing,
    '--character-enter-layout-delay': `${characterEnterLayoutTiming.delay}ms`,
  } as CSSProperties), [
    cameraPresentation,
    cameraTransitionTiming,
    characterEnterLayoutTiming,
    characterLeaveDurationMs,
  ]);
  const stagedCharacterMotionKey = useMemo(
    () => stagedCharactersByPosition.map(({ position, slot }) => [
      position,
      slot.id,
      slot.source,
      slot.framing.name,
      slot.framing.scale,
      slot.framing.x,
      slot.framing.y,
      slot.calibration.scale,
      slot.calibration.x,
      slot.calibration.y,
      slot.calibration.spacing,
      slot.placement,
    ].join(':')).join(','),
    [stagedCharactersByPosition],
  );
  const [settlingBreathingCharacterIds, setSettlingBreathingCharacterIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const previousBreathingSpeakerIdRef = useRef(dialogSpeakerId);

  useLayoutEffect(() => {
    const previousSpeakerId = previousBreathingSpeakerIdRef.current;
    const speakerChanged = previousSpeakerId !== dialogSpeakerId;
    previousBreathingSpeakerIdRef.current = dialogSpeakerId;
    const stagedCharacterIds = new Set(stagedCharactersByPosition.map(({ slot }) => slot.id));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    setSettlingBreathingCharacterIds((current) => {
      if (reducedMotion) {
        return current.size > 0 ? new Set() : current;
      }

      const next = new Set(current);
      let changed = false;
      for (const characterId of next) {
        if (!stagedCharacterIds.has(characterId)) {
          next.delete(characterId);
          changed = true;
        }
      }
      if (speakerChanged && previousSpeakerId && stagedCharacterIds.has(previousSpeakerId)) {
        if (!next.has(previousSpeakerId)) {
          next.add(previousSpeakerId);
          changed = true;
        }
      }
      if (dialogSpeakerId && next.delete(dialogSpeakerId)) {
        changed = true;
      }
      return changed ? next : current;
    });
  }, [dialogSpeakerId, stagedCharacterMotionKey, stagedCharactersByPosition]);

  const finishSettlingSpeakerBreathing = useCallback((characterId: string, animationName: string) => {
    if (animationName !== 'characterSpeakerBreathing' || characterId === dialogSpeakerId) {
      return;
    }
    setSettlingBreathingCharacterIds((current) => {
      if (!current.has(characterId)) {
        return current;
      }
      const next = new Set(current);
      next.delete(characterId);
      return next;
    });
  }, [dialogSpeakerId]);
  const stickerAvoidanceKey = useMemo(() => [
    cameraPresentation.shot,
    cameraPresentation.scale,
    cameraPresentation.mobileScale,
    cameraPresentation.panX,
    cameraPresentation.mobilePanX,
    cameraPresentation.originY,
    cameraPresentation.mobileOriginY,
    cameraPresentation.transition,
    stickerSafeInset,
    presentedVisibleCharacterIds.join(','),
    layoutVisibleCharacterIds.join(','),
    stagedCharacterMotionKey,
  ].join('::'), [
    cameraPresentation,
    layoutVisibleCharacterIds,
    presentedVisibleCharacterIds,
    stagedCharacterMotionKey,
    stickerSafeInset,
  ]);
  const stickerAvoidanceMotionTempo = useLatchedMotionTempo(
    stickerAvoidanceKey,
    motionTempo,
  );
  const stickerAvoidanceSettleMs = Math.max(
    resolveAdaptiveLayoutSettleDuration(
      STICKER_CHARACTER_LAYOUT_SETTLE_MS,
      stickerAvoidanceMotionTempo,
    ),
    characterEnterMotionDurationMs,
    cameraTransitionTiming.cameraDelay + cameraTransitionTiming.cameraDuration,
    cameraTransitionTiming.characterExitDuration,
  );
  // Manual dialog hiding collapses the prompt baseline through a zero inset, while
  // system overlays retain the last measurement. Suppress only an unmeasured visible dialog.
  const promptTopBaselineReady = isDialogHidden || stickerSafeInset > 0;
  const cameraMotionDurationMs = cameraTransitionTiming.cameraDelay
    + cameraTransitionTiming.cameraDuration;
  const cameraMotionActive = useTransientMotionWindow(
    cameraMotionKey,
    cameraMotionDurationMs,
  );
  const characterMotionKey = useMemo(
    () => `${stickerAvoidanceKey}::${promptTopBaselineReady}`,
    [promptTopBaselineReady, stickerAvoidanceKey],
  );
  const characterMotionActive = useTransientMotionWindow(
    characterMotionKey,
    Math.max(
      380,
      characterEnterMotionDurationMs,
      cameraMotionDurationMs,
      cameraTransitionTiming.characterExitDuration,
    ),
  );
  const characterStageMotionTempo = useLatchedMotionTempo(
    characterMotionKey,
    motionTempo,
  );
  const orderedCharacters = useMemo(
    () => [...visibleCharactersByPosition].sort((a, b) => {
      if (a.slot.id === focusCharacterId && b.slot.id !== focusCharacterId) return -1;
      if (b.slot.id === focusCharacterId && a.slot.id !== focusCharacterId) return 1;
      const aRank = speakerOrder.indexOf(a.slot.id);
      const bRank = speakerOrder.indexOf(b.slot.id);
      const aPriority = aRank >= 0 ? aRank : Number.MAX_SAFE_INTEGER;
      const bPriority = bRank >= 0 ? bRank : Number.MAX_SAFE_INTEGER;
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      return POSITION_TIEBREAKER[a.position] - POSITION_TIEBREAKER[b.position];
    }),
    [focusCharacterId, speakerOrder, visibleCharactersByPosition],
  );
  const orderByPosition = useMemo(() => {
    const nextOrderByPosition = new Map<Position, number>();
    orderedCharacters.forEach((entry, idx) => {
      nextOrderByPosition.set(entry.position, idx + 1);
    });
    return nextOrderByPosition;
  }, [orderedCharacters]);

  useEffect(() => {
    if (!selectedInventoryItemId) {
      return;
    }
    if (inventoryVisibleEntries.some((entry) => entry.id === selectedInventoryItemId)) {
      return;
    }
    setSelectedInventoryItemId(null);
    setInventoryDetailOpen(false);
  }, [inventoryVisibleEntries, selectedInventoryItemId]);

  useEffect(() => {
    if (settingsOpen) {
      return;
    }
    if (!inventoryDetailOpen) {
      return;
    }
    setInventoryDetailOpen(false);
  }, [inventoryDetailOpen, settingsOpen]);

  useEffect(() => {
    if (!inventoryCategoryFilter) {
      return;
    }
    if (!inventoryCategoryOptions.includes(inventoryCategoryFilter)) {
      setInventoryCategoryFilter(INVENTORY_CATEGORY_ALL);
    }
  }, [inventoryCategoryFilter, inventoryCategoryOptions]);

  useEffect(() => {
    setInventoryUiSettings({
      view: inventoryView,
      sort: inventorySort,
      category: inventoryCategoryFilter,
    });
  }, [inventoryCategoryFilter, inventorySort, inventoryView]);

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (inventoryDetailOpen) {
        setInventoryDetailOpen(false);
        return;
      }
      closeSettingsModal();
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [closeSettingsModal, inventoryDetailOpen, settingsOpen]);

  const onToggleBgmDisabled = useCallback(
    (disabled: boolean) => {
      const nextEnabled = !disabled;
      setBgmEnabled(nextEnabled);
      setBgmEnabledState(nextEnabled);
      if (nextEnabled) {
        tryPlayStartGateMusic();
      } else {
        stopStartGateMusic();
      }
    },
    [stopStartGateMusic, tryPlayStartGateMusic],
  );

  const updatePlayerExperience = useCallback((patch: Partial<PlayerExperienceSettings>) => {
    setPlayerExperienceSettings(patch);
    setPlayerExperience(getPlayerExperienceSettings());
  }, []);

  const refreshSaveSlots = useCallback(() => {
    setSaveSlots(getSaveSlotSummaries());
  }, []);

  const onToggleAutoSave = useCallback((enabled: boolean) => {
    setAutoSaveEnabled(enabled);
    setAutoSaveEnabledState(enabled);
    setSaveNotice(enabled ? '자동 저장을 켰습니다.' : '자동 저장을 껐습니다. 챕터 시작점은 계속 보호됩니다.');
    setSaveSlots(getSaveSlotSummaries());
  }, []);

  const onManualSave = useCallback(() => {
    const result = saveCurrentProgress();
    setSaveNotice(result.exists ? '현재 진행을 수동 저장했습니다.' : '현재 장면에서는 저장할 수 없습니다.');
    refreshSaveSlots();
  }, [refreshSaveSlots]);

  const onLoadSave = useCallback(
    async (slot: SaveSlotKind | 'latest') => {
      setSaveBusy(true);
      setSaveNotice('저장 데이터를 불러오는 중입니다.');
      try {
        const loaded = await loadSaveSlot(slot);
        if (!loaded) {
          setSaveNotice('불러올 수 있는 저장 데이터가 없습니다.');
          return;
        }
        setRecoveredFailedChoice(undefined);
        setSaveNotice('저장한 장면으로 돌아왔습니다.');
        closeSettingsModal(false);
      } catch (error) {
        setSaveNotice(error instanceof Error ? error.message : '저장 데이터를 불러오지 못했습니다.');
      } finally {
        setSaveBusy(false);
        refreshSaveSlots();
      }
    },
    [closeSettingsModal, refreshSaveSlots],
  );

  const onLoadLastChoice = useCallback(async () => {
    setSaveBusy(true);
    setSaveNotice('선택 복구점으로 돌아가는 중입니다.');
    const recoveryPoint = getChoiceRecoverySummary();
    try {
      const loaded = await loadChoiceRecovery();
      if (!loaded) {
        setSaveNotice('되돌아갈 선택 복구점을 찾지 못했습니다.');
        return;
      }
      setRecoveredFailedChoice(recoveryPoint.failedChoice);
      setSaveNotice('선택 복구점으로 돌아왔습니다.');
      closeSettingsModal(false);
    } catch (error) {
      setSaveNotice(error instanceof Error ? error.message : '선택 복구점으로 돌아가지 못했습니다.');
    } finally {
      setSaveBusy(false);
      refreshSaveSlots();
    }
  }, [closeSettingsModal, refreshSaveSlots]);

  const onRestartChapter = useCallback(async () => {
    setSaveBusy(true);
    setSaveNotice('챕터 시작점으로 돌아가는 중입니다.');
    const recoveryPoint = getChoiceRecoverySummary();
    try {
      const loaded = await restartCurrentChapter();
      if (!loaded) {
        setSaveNotice('이 챕터의 시작 저장점을 찾지 못했습니다.');
        return;
      }
      setRecoveredFailedChoice(recoveryPoint.failedChoice);
      closeSettingsModal(false);
    } catch (error) {
      setSaveNotice(error instanceof Error ? error.message : '챕터 시작점으로 돌아가지 못했습니다.');
    } finally {
      setSaveBusy(false);
      refreshSaveSlots();
    }
  }, [closeSettingsModal, refreshSaveSlots]);

  const onExportSave = useCallback(() => {
    const backup = exportSaveBackup();
    if (!backup) {
      setSaveNotice('내보낼 진행 데이터가 없습니다.');
      return;
    }
    const blobUrl = URL.createObjectURL(new Blob([backup.content], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = backup.filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
    setSaveNotice('저장 백업 파일을 내보냈습니다.');
    refreshSaveSlots();
  }, [refreshSaveSlots]);

  const onImportSave = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) {
        return;
      }
      setSaveBusy(true);
      try {
        importSaveBackup(await file.text());
        refreshSaveSlots();
        const loaded = await loadSaveSlot('manual');
        setSaveNotice(loaded ? '백업 저장을 불러왔습니다.' : '백업을 저장했지만 현재 장면을 열지 못했습니다.');
        if (loaded) {
          setRecoveredFailedChoice(undefined);
          closeSettingsModal(false);
        }
      } catch (error) {
        setSaveNotice(error instanceof Error ? error.message : '저장 파일을 불러오지 못했습니다.');
      } finally {
        setSaveBusy(false);
      }
    },
    [closeSettingsModal, refreshSaveSlots],
  );

  useEffect(() => {
    return () => {
      if (endingAutoScrollRafRef.current !== null) {
        window.cancelAnimationFrame(endingAutoScrollRafRef.current);
        endingAutoScrollRafRef.current = null;
      }
      if (holdTimerRef.current) {
        window.clearInterval(holdTimerRef.current);
        holdTimerRef.current = undefined;
      }
    };
  }, []);

  useEffect(() => {
    if (!isFinished) {
      setShowEndingRestart(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setShowEndingRestart(true);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [isFinished]);

  useEffect(() => {
    const storageKey = resolveEndingProgressStorageKey(game?.meta.title);
    if (!storageKey) {
      setSeenEndingIds([]);
      return;
    }
    setSeenEndingIds(parseEndingProgress(localStorage.getItem(storageKey)));
  }, [game?.meta.title]);

  useEffect(() => {
    if (!isFinished || !resolvedEndingId) {
      return;
    }
    const storageKey = resolveEndingProgressStorageKey(game?.meta.title);
    if (!storageKey) {
      return;
    }
    setSeenEndingIds((prev) => {
      if (prev.includes(resolvedEndingId)) {
        return prev;
      }
      const next = [...prev, resolvedEndingId];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Ignore storage failures and keep in-memory progress.
      }
      return next;
    });
  }, [game?.meta.title, isFinished, resolvedEndingId]);

  const handleEndingCreditsInput = useCallback(
    (event: SyntheticEvent<HTMLDivElement>) => {
      if (endingCreditsScrollUnlocked) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    },
    [endingCreditsScrollUnlocked],
  );

  useEffect(() => {
    if (!isFinished) {
      if (endingAutoScrollRafRef.current !== null) {
        window.cancelAnimationFrame(endingAutoScrollRafRef.current);
        endingAutoScrollRafRef.current = null;
      }
      endingAutoScrollLastTsRef.current = null;
      setEndingCreditsReady(false);
      setEndingCreditsScrollUnlocked(false);
      setEndingTopSpacerPx(0);
      return;
    }
    setEndingCreditsReady(false);
    setEndingCreditsScrollUnlocked(false);

    const setupRaf = window.requestAnimationFrame(() => {
      const rollEl = endingCreditsRollRef.current;
      if (!rollEl) {
        return;
      }
      const topSpacer = Math.max(0, rollEl.clientHeight + 16);
      setEndingTopSpacerPx(topSpacer);
      rollEl.scrollTop = 0;
      setEndingCreditsReady(true);
      endingAutoScrollLastTsRef.current = null;

      const pxPerSecond = 120;
      const step = (ts: number) => {
        const latestRollEl = endingCreditsRollRef.current;
        if (!latestRollEl) {
          endingAutoScrollRafRef.current = null;
          return;
        }
        setRecoveredFailedChoice(undefined);
        const maxScrollTop = Math.max(0, latestRollEl.scrollHeight - latestRollEl.clientHeight);
        if (maxScrollTop <= 0) {
          setEndingCreditsScrollUnlocked(true);
          endingAutoScrollRafRef.current = null;
          return;
        }
        const prevTs = endingAutoScrollLastTsRef.current;
        endingAutoScrollLastTsRef.current = ts;
        const deltaSec = prevTs == null ? 0 : Math.max(0, (ts - prevTs) / 1000);
        const nextScrollTop = Math.min(maxScrollTop, latestRollEl.scrollTop + pxPerSecond * deltaSec);
        latestRollEl.scrollTop = nextScrollTop;
        if (nextScrollTop >= maxScrollTop - 0.5) {
          setEndingCreditsScrollUnlocked(true);
          endingAutoScrollRafRef.current = null;
          return;
        }
        endingAutoScrollRafRef.current = window.requestAnimationFrame(step);
      };
      endingAutoScrollRafRef.current = window.requestAnimationFrame(step);
    });

    return () => {
      window.cancelAnimationFrame(setupRaf);
      if (endingAutoScrollRafRef.current !== null) {
        window.cancelAnimationFrame(endingAutoScrollRafRef.current);
        endingAutoScrollRafRef.current = null;
      }
      endingAutoScrollLastTsRef.current = null;
    };
  }, [isFinished, resolvedEndingId]);

  useEffect(() => {
    if (!inputGate.active) {
      setInputAnswer('');
      return;
    }
    if (skipInputAutoFocus) {
      return;
    }
    const rafId = window.requestAnimationFrame(() => {
      inputFieldRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [inputGate.active, skipInputAutoFocus]);

  useEffect(() => {
    if (!inputGate.active) {
      return;
    }
    const maxAttempt = inputGate.errors.length;
    if (maxAttempt <= 0) {
      return;
    }
    if (inputGate.attemptCount < maxAttempt) {
      return;
    }
    const answer = inputGate.correct.trim();
    if (answer.length === 0) {
      return;
    }
    setInputAnswer((prev) => (prev === answer ? prev : answer));
  }, [inputGate.active, inputGate.attemptCount, inputGate.errors.length, inputGate.correct]);

  useEffect(() => {
    if (hasRecoveredFailedChoice) {
      recoveredChoiceWasPresentedRef.current = true;
      return;
    }
    if (recoveredChoiceWasPresentedRef.current && !choiceGate.active) {
      recoveredChoiceWasPresentedRef.current = false;
      setRecoveredFailedChoice(undefined);
    }
  }, [choiceGate.active, hasRecoveredFailedChoice]);

  useEffect(() => {
    if (!choiceGate.active || choiceGate.options.length === 0) {
      choiceOptionButtonRefs.current = [];
      return;
    }
    const firstAlternativeIndex = choiceGate.options.findIndex((_, index) =>
      index !== recoveredFailedChoiceIndex);
    const focusIndex = firstAlternativeIndex >= 0 ? firstAlternativeIndex : 0;
    const rafId = window.requestAnimationFrame(() => {
      choiceOptionButtonRefs.current[focusIndex]?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [choiceGate.active, choiceGate.key, choiceGate.options.length, recoveredFailedChoiceIndex]);

  const postYouTubeCommand = useCallback(
    (func: string, args: unknown[] = []) => {
      const target = youtubeIframeRef.current?.contentWindow;
      if (!target) {
        return;
      }
      target.postMessage(
        JSON.stringify({
          event: 'command',
          func,
          args,
          id: youtubePlayerId,
        }),
        '*',
      );
    },
    [youtubePlayerId],
  );

  const resumeNativeCutsceneVideo = useCallback(() => {
    const video = nativeVideoRef.current;
    if (!video || video.ended) {
      return;
    }
    video.muted = true;
    void video.play().catch(() => {
      // Ignore autoplay-policy failures.
    });
  }, []);

  const resumeVideoCutscenePlayback = useCallback(() => {
    if (!videoCutscene.active) {
      return;
    }
    if (videoCutscene.youtubeId) {
      postYouTubeCommand('mute');
      postYouTubeCommand('playVideo');
      return;
    }
    resumeNativeCutsceneVideo();
  }, [postYouTubeCommand, resumeNativeCutsceneVideo, videoCutscene.active, videoCutscene.youtubeId]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!videoCutscene.active || !videoCutscene.youtubeId) {
        return;
      }
      if (typeof event.data !== 'string') {
        return;
      }
      let payload: { event?: string; info?: number; id?: string } | undefined;
      try {
        payload = JSON.parse(event.data) as { event?: string; info?: number; id?: string };
      } catch {
        return;
      }
      if (payload.event !== 'onStateChange' || payload.id !== youtubePlayerId) {
        return;
      }
      if (payload.info === 0) {
        completeVideoCutscene();
        return;
      }
      if (payload.info === 2 && document.visibilityState === 'visible') {
        postYouTubeCommand('playVideo');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [postYouTubeCommand, videoCutscene.active, videoCutscene.youtubeId, youtubePlayerId]);

  useEffect(() => {
    if (!videoCutscene.active) {
      return;
    }
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      resumeVideoCutscenePlayback();
    };
    const onWindowFocus = () => {
      resumeVideoCutscenePlayback();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onWindowFocus);
    window.addEventListener('pageshow', onWindowFocus);
    onVisibilityChange();
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onWindowFocus);
      window.removeEventListener('pageshow', onWindowFocus);
    };
  }, [resumeVideoCutscenePlayback, videoCutscene.active]);

  const clearHold = () => {
    holdingRef.current = false;
    holdStartRef.current = 0;
    if (holdTimerRef.current) {
      window.clearInterval(holdTimerRef.current);
      holdTimerRef.current = undefined;
    }
    resetVideoSkipProgress();
  };

  const onVideoPointerDown = () => {
    if (!videoCutscene.active) {
      return;
    }
    revealVideoSkipGuide();
    if (!videoCutscene.guideVisible || holdingRef.current) {
      return;
    }
    resetVideoSkipProgress();
    holdingRef.current = true;
    holdStartRef.current = performance.now();
    holdTimerRef.current = window.setInterval(() => {
      if (!holdingRef.current) {
        return;
      }
      const elapsed = performance.now() - holdStartRef.current;
      const ratio = elapsed / Math.max(1, videoCutscene.holdToSkipMs);
      updateVideoSkipProgress(ratio);
      if (ratio >= 1) {
        clearHold();
        skipVideoCutscene();
      }
    }, 16);
  };

  const onVideoPointerUp = () => {
    clearHold();
  };

  useEffect(() => {
    if (!videoCutscene.active) {
      clearHold();
    }
  }, [videoCutscene.active]);

  const updateStickerSafeInset = useCallback(() => {
    const stageFrameEl = stageContentFrameRef.current;
    const dialogEl = dialogBoxRef.current;
    if (!stageFrameEl || !dialogEl) {
      return;
    }
    // System overlays keep the last measured inset so actors do not jump when the
    // dialog fades back in. A manual hide intentionally releases the baseline.
    if (dialogUiHidden) {
      setStickerSafeInset((prev) => (prev === 0 ? prev : 0));
      return;
    }
    const nextInset = Math.max(0, Math.ceil(stageFrameEl.clientHeight - dialogEl.offsetTop));
    setStickerSafeInset((prev) => (prev === nextInset ? prev : nextInset));
  }, [dialogUiHidden]);

  useLayoutEffect(() => {
    updateStickerSafeInset();
    const raf1 = window.requestAnimationFrame(updateStickerSafeInset);
    const raf2 = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(updateStickerSafeInset);
    });
    const stageFrameEl = stageContentFrameRef.current;
    const dialogEl = dialogBoxRef.current;
    window.addEventListener('resize', updateStickerSafeInset);
    if (!stageFrameEl || !dialogEl || typeof ResizeObserver === 'undefined') {
      return () => {
        window.cancelAnimationFrame(raf1);
        window.cancelAnimationFrame(raf2);
        window.removeEventListener('resize', updateStickerSafeInset);
      };
    }

    const observer = new ResizeObserver(updateStickerSafeInset);
    observer.observe(stageFrameEl);
    observer.observe(dialogEl);
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      observer.disconnect();
      window.removeEventListener('resize', updateStickerSafeInset);
    };
  }, [bootMode, choiceGate.active, inputGate.active, isDialogHidden, updateStickerSafeInset]);

  const hasFocusedCharacter = Boolean(focusCharacterId && visibleCharacterSet.has(focusCharacterId));

  const renderCharacter = (
    slot: CharacterSlot | undefined,
    position: Position,
    renderPlacement: CharacterSlot['placement'] = 'stage-bottom',
  ) => {
    if (!slot || slot.placement !== renderPlacement) {
      return null;
    }
    const isCameraVisible = visibleCharacterSet.has(slot.id);
    const isEntering = isCameraVisible
      && characterEntranceMotionActive
      && enteringCharacterSet.has(slot.id);
    const order = orderByPosition.get(position) ?? Number.MAX_SAFE_INTEGER;
    const zIndex = Math.max(1, 1000 - order);
    const isFocused = hasFocusedCharacter && focusCharacterId === slot.id;
    const placementReady = renderPlacement !== 'prompt-top' || promptTopBaselineReady;
    const rendererActive = isCameraVisible && placementReady;
    const isSpeaking = rendererActive && dialogSpeakerId === slot.id;
    const isSettlingBreathing = dialogSpeakerId !== slot.id && (
      settlingBreathingCharacterIds.has(slot.id)
      || previousBreathingSpeakerIdRef.current === slot.id
    );
    const isBreathing = isSpeaking || isSettlingBreathing;
    const focusPresentation = resolveCharacterFocusPresentation(
      isFocused,
      hasFocusedCharacter,
    );
    const framingScale = slot.framing.scale;
    const currentDuoSide = characterStageLayout.duoSideByPosition[position];
    const currentStagePlacement = resolveCharacterStagePlacement(
      position,
      characterStageLayout,
      characterStageSpacing,
    );
    const placement = {
      ...currentStagePlacement,
      mobileAnchorX: resolveMobileCharacterStageAnchor(position, characterStageLayout),
      duoSide: currentDuoSide,
      facingScale: resolveCharacterFacingScale(
        slot.facing,
        layoutCharacterCount === 1 ? 'center' : position,
        currentDuoSide,
      ),
    };
    const duoClass = placement.duoSide ? `char-duo-${placement.duoSide}` : '';
    const characterEnterTiming = resolveAdaptiveMotionTiming(
      slot.enterDuration,
      slot.enterDelay,
      characterVisibilityMotionTempo,
    );
    const charStyle = {
      zIndex,
      '--char-scale': framingScale * slot.calibration.scale,
      '--char-facing-scale-x': placement.facingScale,
      '--char-desktop-anchor-x': placement.anchorX,
      '--char-mobile-anchor-x': placement.mobileAnchorX,
      '--char-offset-x': placement.offsetX,
      '--char-framing-x': `${slot.framing.x}%`,
      '--char-framing-y': `${slot.framing.y}%`,
      '--char-calibration-x': `${slot.calibration.x}%`,
      '--char-calibration-y': `${slot.calibration.y}%`,
      '--character-enter-duration': `${characterEnterTiming.duration}ms`,
      '--character-enter-easing': resolveAdaptiveMotionEasing(
        slot.enterEasing,
        characterVisibilityMotionTempo,
      ),
      '--character-enter-delay': `${characterEnterTiming.delay}ms`,
    } as CSSProperties;
    const visibilityClass = isCameraVisible ? '' : 'is-camera-hidden';
    const entryClass = isEntering ? `is-entering char-enter-${slot.enterEffect}` : '';
    const className = [
      'char',
      'char-image',
      position,
      focusPresentation.depthClass,
      isSpeaking ? 'is-speaking' : '',
      isBreathing ? 'is-breathing' : '',
      isSettlingBreathing ? 'is-breath-settling' : '',
      duoClass,
      `char-placement-${renderPlacement}`,
      visibilityClass,
      entryClass,
    ].filter(Boolean).join(' ');
    if (slot.kind === 'live2d') {
      return (
        <Suspense fallback={null} key={`character-${slot.id}`}>
          <Live2DCharacter
            slot={slot}
            position={position}
            trackingKey={buildLive2DLoadKey(slot)}
            active={rendererActive && !settingsOpen}
            className={[focusPresentation.depthClass, isSpeaking ? 'is-speaking' : '', isBreathing ? 'is-breathing' : '', isSettlingBreathing ? 'is-breath-settling' : '', duoClass, `char-placement-${renderPlacement}`, visibilityClass, entryClass].filter(Boolean).join(' ')}
            style={charStyle}
            onAnimationIteration={(event) => finishSettlingSpeakerBreathing(slot.id, event.animationName)}
          />
        </Suspense>
      );
    }
    return (
      <img
        {...HIGH_PRIORITY_IMAGE_PROPS}
        key={buildImageCharacterRenderKey(slot.id)}
        className={className}
        src={slot.source}
        alt={slot.id}
        data-character-id={slot.id}
        data-stage-position={position}
        data-character-placement={slot.placement}
        data-character-framing={slot.framing.name}
        aria-hidden={!rendererActive}
        loading="eager"
        decoding="async"
        style={charStyle}
        onAnimationIteration={(event) => finishSettlingSpeakerBreathing(slot.id, event.animationName)}
      />
    );
  };

  const renderSticker = (id: string) => {
    const sticker = stickers[id];
    if (!sticker) {
      return null;
    }
    return (
      <StickerView
        key={`${sticker.id}-${sticker.source}-${sticker.renderKey}`}
        sticker={sticker}
        avoidanceKey={stickerAvoidanceKey}
        avoidanceSettleMs={stickerAvoidanceSettleMs}
        motionTempo={motionTempo}
      />
    );
  };

  const onStartGateLaunch = useCallback(
    async (resumeFromSave: boolean) => {
      if (!startGate || startGateLaunching) {
        return;
      }
      const gate = startGate;
      setStartGateLaunching(true);
      stopStartGateMusic();
      await waitForStartGateLaunchTransition();
      setGameBootPending(true);
      setStartGate(null);
      try {
        if (gate.kind === 'url') {
          markStartGateSession(gate.sessionKey);
          await loadGameFromUrl(gate.gameUrl, { resumeFromSave });
          return;
        }
        await loadGameFromZip(gate.file, { resumeFromSave: false });
      } finally {
        setGameBootPending(false);
        setStartGateLaunching(false);
      }
    },
    [startGate, startGateLaunching, stopStartGateMusic],
  );

  const onUploadZip = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    if (!file.name.toLowerCase().endsWith('.zip')) {
      useVNStore.getState().setError({ message: 'ZIP 파일만 업로드할 수 있습니다.' });
      return;
    }
    uploadedGameFileRef.current = file;
    setUploading(true);
    setBootMode('uploaded');
    try {
      let preview: Awaited<ReturnType<typeof loadZipStartScreenPreview>> | undefined;
      try {
        preview = await loadZipStartScreenPreview(file);
      } catch {
        preview = undefined;
      }

      if (preview?.startScreen?.enabled) {
        const imageUrl = preview.startScreen.image;
        const musicUrl = preview.startScreen.music;
        setStartGate({
          kind: 'zip',
          file,
          uiTemplate: preview.uiTemplate,
          gameTitle: preview.gameTitle,
          seo: preview.seo,
          imageUrl,
          imagePosition: preview.startScreen.imagePosition,
          mobileImagePosition: preview.startScreen.mobileImagePosition,
          musicUrl,
          previewBlobUrl: imageUrl?.startsWith('blob:') ? imageUrl : undefined,
          previewMusicBlobUrl: musicUrl?.startsWith('blob:') ? musicUrl : undefined,
          startButtonText: preview.startScreen.startButtonText || DEFAULT_START_BUTTON_TEXT,
          buttonPosition: preview.startScreen.buttonPosition ?? 'auto',
          showTitle: preview.startScreen.showTitle ?? true,
          titleColor: preview.startScreen.titleColor,
          showLoadButton: false,
          legalNotices: preview.legalNotices,
        });
        return;
      }

      await loadGameFromZip(file);
    } finally {
      setUploading(false);
    }
  };

  const onReturnToStartScreen = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      const uploadedGameFile = uploadedGameFileRef.current;
      if ((!startScreenReturnGameId && !uploadedGameFile) || returningToStartGate) {
        return;
      }
      setRecoveredFailedChoice(undefined);
      setReturningToStartGate(true);
      closeSettingsModal(false);
      stopActiveBgm();
      stopStartGateMusic();
      try {
        if (startScreenReturnGameId) {
          const sessionKey = resolveStartGateSessionKey(startScreenReturnGameId);
          const gameUrl = `/game-list/${startScreenReturnGameId}/`;
          try {
            sessionStorage.removeItem(sessionKey);
          } catch {
            // Ignore sessionStorage failures and continue.
          }
          const preview = await loadUrlStartScreenPreview(gameUrl);
          if (preview.startScreen?.enabled) {
            const baseUrl = new URL(gameUrl, window.location.origin).toString();
            setStartGate({
              kind: 'url',
              gameUrl,
              sessionKey,
              uiTemplate: preview.uiTemplate,
              gameTitle: preview.gameTitle,
              seo: preview.seo,
              imageUrl: resolveStartGateAssetUrl(preview.startScreen.image, baseUrl),
              imagePosition: preview.startScreen.imagePosition,
              mobileImagePosition: preview.startScreen.mobileImagePosition,
              musicUrl: resolveStartGateAssetUrl(preview.startScreen.music, baseUrl),
              startButtonText: preview.startScreen.startButtonText || DEFAULT_START_BUTTON_TEXT,
              buttonPosition: preview.startScreen.buttonPosition ?? 'auto',
              showTitle: preview.startScreen.showTitle ?? true,
              titleColor: preview.startScreen.titleColor,
              showLoadButton: preview.hasLoadableSave,
              legalNotices: preview.legalNotices,
            });
            return;
          }
          await loadGameFromUrl(gameUrl);
          return;
        }

        if (uploadedGameFile) {
          const preview = await loadZipStartScreenPreview(uploadedGameFile);
          if (preview.startScreen?.enabled) {
            const imageUrl = preview.startScreen.image;
            const musicUrl = preview.startScreen.music;
            setStartGate({
              kind: 'zip',
              file: uploadedGameFile,
              uiTemplate: preview.uiTemplate,
              gameTitle: preview.gameTitle,
              seo: preview.seo,
              imageUrl,
              imagePosition: preview.startScreen.imagePosition,
              mobileImagePosition: preview.startScreen.mobileImagePosition,
              musicUrl,
              previewBlobUrl: imageUrl?.startsWith('blob:') ? imageUrl : undefined,
              previewMusicBlobUrl: musicUrl?.startsWith('blob:') ? musicUrl : undefined,
              startButtonText: preview.startScreen.startButtonText || DEFAULT_START_BUTTON_TEXT,
              buttonPosition: preview.startScreen.buttonPosition ?? 'auto',
              showTitle: preview.startScreen.showTitle ?? true,
              titleColor: preview.startScreen.titleColor,
              showLoadButton: false,
              legalNotices: preview.legalNotices,
            });
            return;
          }
          await loadGameFromZip(uploadedGameFile);
        }
      } finally {
        setReturningToStartGate(false);
      }
    },
    [closeSettingsModal, returningToStartGate, startScreenReturnGameId, stopStartGateMusic],
  );

  const onRestartFromBeginning = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      setRecoveredFailedChoice(undefined);
      if (canReturnToStartScreen) {
        void onReturnToStartScreen(event);
        return;
      }
      void restartFromBeginning();
    },
    [canReturnToStartScreen, onReturnToStartScreen],
  );

  if (startGate) {
    const actionClass = `start-gate-actions start-gate-actions-${startGate.buttonPosition}`;
    const startGateStyle = {
      ...(startGate.titleColor ? { '--start-gate-title-color': startGate.titleColor } : {}),
      ...(startGate.imagePosition ? { '--start-gate-image-position': startGate.imagePosition } : {}),
      ...(startGate.mobileImagePosition
        ? { '--start-gate-mobile-image-position': startGate.mobileImagePosition }
        : {}),
    } as CSSProperties;
    return (
      <div
        className={`start-gate${startGateLaunching ? ' is-launching' : ''}${startGate.legalNotices.length > 0 ? ' has-legal-notices' : ''}`}
        style={startGateStyle}
        data-show-title={String(startGate.showTitle)}
        data-ui-template={startGate.uiTemplate}
        aria-busy={startGateLaunching}
        onPointerDown={() => tryPlayStartGateMusic()}
      >
        {startGate.imageUrl && <img className="start-gate-bg-image" src={startGate.imageUrl} alt="" aria-hidden="true" />}
        {startGate.imageUrl && !startGate.showTitle && (
          <img className="start-gate-title-art" src={startGate.imageUrl} alt="" aria-hidden="true" />
        )}
        <div className="start-gate-overlay" aria-hidden="true" />
        <div className="start-gate-atmosphere" aria-hidden="true">
          <span className="start-gate-vignette" />
          <span className="start-gate-frame" />
          <span className="start-gate-grain" />
        </div>
        <div className="start-gate-content">
          {startGate.showTitle && (
            <div className="start-gate-title-block">
              <div className="start-gate-title-ornament" aria-hidden="true"><span /></div>
              <p className="start-gate-eyebrow">YAVN · INTERACTIVE STORY</p>
              <h1>{startGate.gameTitle}</h1>
              <p className="start-gate-prologue">당신의 선택으로 이야기가 시작됩니다</p>
            </div>
          )}
          <div className={actionClass}>
            <button
              type="button"
              className="start-gate-button start-gate-button-start"
              onClick={() => void onStartGateLaunch(false)}
              disabled={startGateLaunching}
            >
              <span className="start-gate-button-label">
                {startGate.startButtonText || DEFAULT_START_BUTTON_TEXT}
              </span>
              <span className="start-gate-button-mark" aria-hidden="true">→</span>
            </button>
            {startGate.showLoadButton && (
              <button
                type="button"
                className="start-gate-button start-gate-button-load"
                onClick={() => void onStartGateLaunch(true)}
                disabled={startGateLaunching}
              >
                <span className="start-gate-button-label">{DEFAULT_LOAD_BUTTON_TEXT}</span>
                <span className="start-gate-button-mark" aria-hidden="true">↗</span>
              </button>
            )}
            {startGate.musicUrl && <p className="start-gate-hint">화면을 눌러 음악과 함께 시작하세요</p>}
          </div>
        </div>
        <LegalNoticeList notices={startGate.legalNotices} className="start-gate-legal-notices" />
      </div>
    );
  }

  if (shouldShowGameRouteBoot(gameBootPending, Boolean(game))) {
    return (
      <div className="game-route-boot" role="status" aria-live="polite" aria-label="게임 화면 준비 중">
        <span className="game-route-boot-mark" aria-hidden="true">YAVN</span>
      </div>
    );
  }

  if (bootMode === 'launcher') {
    return (
      <div className="launcher">
        <a className="launcher-skip-link" href="#launcher-library-title">
          게임 목록으로 건너뛰기
        </a>
        <header className="launcher-topbar">
          <a className="launcher-brand" href="/" aria-label="YAVN 홈">
            <h1>YAVN</h1>
            <span>YAML VISUAL NOVEL ENGINE</span>
          </a>

          <div className="launcher-runtime" aria-label="엔진 상태">
            <span className={`launcher-status launcher-status-${gameListStatus.toLowerCase()}`}>{gameListStatus}</span>
            <span>{gameList.length} PLAYABLE</span>
            <span>DSL V{manifestSchemaVersion ?? 5}</span>
          </div>

          <nav className="launcher-nav" aria-label="엔진 링크">
            <a className="launcher-nav-github" href={repositoryUrl} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a className="launcher-nav-guide" href={developmentGuideUrl} target="_blank" rel="noreferrer">
              Guide
            </a>
            <label className="launcher-upload">
              <span>{uploading ? 'ZIP 로딩 중' : 'ZIP 실행'}</span>
              <input
                type="file"
                accept=".zip,application/zip"
                aria-label="YAVN 게임 ZIP 실행"
                onChange={onUploadZip}
              />
            </label>
          </nav>
        </header>

        <main className="launcher-console">
          {gameList.length > 0 ? (
            <section className="launcher-showcase" aria-label="플레이 가능한 데모">
              <div
                ref={launcherCarouselRef}
                className="launcher-carousel"
                role="region"
                aria-roledescription="carousel"
                aria-label="YAVN 데모 캐러셀"
                tabIndex={0}
                onKeyDown={onLauncherCarouselKeyDown}
                onPointerDown={(event) => {
                  const target = event.target;
                  if (!(target instanceof HTMLElement) || !target.closest('a, button, input, label')) {
                    clearLauncherDeepLinkFromAddress();
                  }
                }}
              >
                <div className="launcher-carousel-track">
                  {gameList.map((entry, index) => {
                    const isSelected = selectedGame?.id === entry.id;
                    const entryTags = entry.tags.length > 0 ? entry.tags : ['untagged'];
                    const chapterLabel =
                      typeof entry.chapterCount === 'number'
                        ? `${entry.chapterCount} CHAPTER${entry.chapterCount === 1 ? '' : 'S'}`
                        : 'CHAPTERS -';
                    const showcaseStyle = buildLauncherShowcaseStyle(entry.showcase) as CSSProperties | undefined;
                    return (
                      <article
                        key={`showcase-${entry.id}`}
                        className={`launcher-feature ${isSelected ? 'is-selected' : ''}${entry.legalNotices.length > 0 ? ' has-legal-notices' : ''}`}
                        role="group"
                        aria-roledescription="slide"
                        aria-label={`${index + 1} / ${gameList.length}: ${entry.name}`}
                        aria-hidden={!isSelected}
                      >
                      <div className="launcher-feature-media" style={showcaseStyle}>
                        {entry.thumbnail ? (
                          <img
                            src={entry.thumbnail}
                            alt={entry.seo?.imageAlt ?? `${entry.name} 대표 이미지`}
                            loading="eager"
                            decoding="async"
                          />
                        ) : (
                          <div className="launcher-feature-fallback">YAVN</div>
                        )}
                      </div>

                      <div className="launcher-feature-copy">
                        <div className="launcher-feature-content">
                        <p className="launcher-feature-kicker">
                          {entry.showcase?.label ?? 'PLAYABLE DEMO'}
                          <span>v{entry.version ?? '-'}</span>
                        </p>
                        <h2 id={`launcher-feature-title-${entry.id}`}>{entry.name}</h2>
                        <p className="launcher-feature-summary">{entry.summary ?? DEFAULT_LAUNCHER_SUMMARY}</p>
                        {entry.legalNotices.length > 0 && (
                          <LegalNoticeList
                            notices={entry.legalNotices}
                            className="launcher-feature-legal-notices"
                            linkTabIndex={isSelected ? undefined : -1}
                          />
                        )}

                        <div className="inspector-tag-row">
                          {entryTags.map((tag) => (
                            <span key={`inspect-${entry.id}-${tag}`}>{tag}</span>
                          ))}
                        </div>

                        <dl className="launcher-feature-meta">
                          <div>
                            <dt>CREATOR</dt>
                            <dd>{entry.author ?? 'UNKNOWN'}</dd>
                          </div>
                          <div>
                            <dt>BUILD</dt>
                            <dd>{entry.id}</dd>
                          </div>
                          <div>
                            <dt>LENGTH</dt>
                            <dd>{chapterLabel}</dd>
                          </div>
                        </dl>

                        <div className="inspector-actions">
                          <a
                            className="launcher-command launcher-command-primary"
                            href={entry.path}
                            tabIndex={isSelected ? undefined : -1}
                          >
                            지금 플레이
                          </a>
                          <a
                            className="launcher-command launcher-command-source"
                            href={buildGameSourceUrl(repositoryUrl, entry.id)}
                            target="_blank"
                            rel="noreferrer"
                            tabIndex={isSelected ? undefined : -1}
                          >
                            GitHub 폴더
                          </a>
                          <button
                            type="button"
                            className="launcher-command launcher-command-ghost"
                            tabIndex={isSelected ? undefined : -1}
                            onClick={() => void copySelectedGameLink()}
                          >
                            {launcherShareNotice ? '링크 복사됨' : '선택 링크 복사'}
                          </button>
                        </div>
                        <p
                          className="launcher-share-status"
                          role={isSelected ? 'status' : undefined}
                          aria-live={isSelected ? 'polite' : 'off'}
                        >
                          {isSelected ? launcherShareNotice : ''}
                        </p>
                        </div>
                      </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              <div className="launcher-carousel-controls">
                <button
                  type="button"
                  className="launcher-carousel-arrow launcher-carousel-arrow-prev"
                  aria-label="이전 데모"
                  onPointerDown={preserveLauncherControlFocus}
                  onClick={() => moveLauncherCarousel(-1)}
                  disabled={gameList.length < 2}
                >
                  <span aria-hidden="true">←</span>
                </button>

                <div className="launcher-carousel-pagination">
                  <div className="launcher-carousel-dots" role="group" aria-label="데모 선택">
                    {gameList.map((entry, index) => {
                      const isSelected = selectedGame?.id === entry.id;
                      return (
                        <button
                          key={`carousel-dot-${entry.id}`}
                          type="button"
                          aria-label={`${entry.name} 보기`}
                          aria-current={isSelected ? 'true' : undefined}
                          aria-pressed={isSelected}
                          className={isSelected ? 'is-active' : ''}
                          onPointerDown={preserveLauncherControlFocus}
                          onClick={() => moveLauncherCarouselToIndex(index)}
                        />
                      );
                    })}
                  </div>
                  <span aria-live="polite" aria-atomic="true">
                    <b>{selectedGame?.name}</b>
                    <small>
                      {String(Math.max(1, selectedGameIndex + 1)).padStart(2, '0')}
                      {' / '}
                      {String(Math.max(1, gameList.length)).padStart(2, '0')}
                    </small>
                  </span>
                </div>

                <button
                  type="button"
                  className="launcher-carousel-arrow launcher-carousel-arrow-next"
                  aria-label="다음 데모"
                  onPointerDown={preserveLauncherControlFocus}
                  onClick={() => moveLauncherCarousel(1)}
                  disabled={gameList.length < 2}
                >
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </section>
          ) : (
            <div
              className={`launcher-diagnostic ${gameListLoading ? 'launcher-diagnostic-loading' : ''}`}
              role={gameListError ? 'alert' : 'status'}
              aria-live={gameListError ? 'assertive' : 'polite'}
            >
              <strong>
                {gameListLoading ? 'SYNCING PLAYGROUND' : gameListError ? 'MANIFEST LOAD FAILURE' : 'PLAYGROUND EMPTY'}
              </strong>
              <p>
                {gameListLoading
                  ? '게임 매니페스트와 대표 이미지를 불러오는 중입니다.'
                  : gameListError ?? '등록된 게임이 아직 없습니다.'}
              </p>
              {!gameListLoading && gameListError && (
                <button type="button" onClick={() => void loadGameListManifest()}>
                  다시 불러오기
                </button>
              )}
            </div>
          )}

          {gameList.length > 0 && (
            <>
              <section className="launcher-engine-overview" aria-labelledby="launcher-engine-overview-title">
                <div className="launcher-engine-overview-copy">
                  <p>BUILD WITH YAVN</p>
                  <h2 id="launcher-engine-overview-title">코드보다 이야기에 집중하세요.</h2>
                  <p>
                    장면·대사·분기·저장·엔딩을 YAML로 작성하고, ZIP 하나로 브라우저에서 바로 테스트하세요.
                  </p>
                  <div className="launcher-engine-overview-actions">
                    <a href={developmentGuideUrl} target="_blank" rel="noreferrer">
                      제작 가이드 시작
                    </a>
                    <a href={`${repositoryUrl}/blob/main/sample.yaml`} target="_blank" rel="noreferrer">
                      샘플 YAML 보기
                    </a>
                  </div>
                </div>
                <dl className="launcher-engine-capabilities">
                  <div>
                    <dt>01</dt>
                    <dd><strong>YAML DSL</strong><span>코드 수정 없이 장면과 분기 작성</span></dd>
                  </div>
                  <div>
                    <dt>02</dt>
                    <dd><strong>GAME FLOW</strong><span>저장·복구·다중 엔딩·게임오버 기본 제공</span></dd>
                  </div>
                  <div>
                    <dt>03</dt>
                    <dd><strong>WEB RUNTIME</strong><span>ZIP·이미지·영상·Live2D를 즉시 실행</span></dd>
                  </div>
                </dl>
              </section>

          <section id="launcher-library" className="launcher-library" aria-labelledby="launcher-library-title">
            <div className="launcher-library-heading">
              <div>
                <p>PLAYABLE LIBRARY</p>
                <h2 id="launcher-library-title">게임 바로 시작</h2>
              </div>
              <span>
                {filteredGames.length} / {gameList.length}
              </span>
            </div>

            <div className="launcher-library-controls">
              <div className="launcher-search-box">
                <label htmlFor="launcher-search-input">게임 검색</label>
                <div className="launcher-search-field">
                  <input
                    id="launcher-search-input"
                    type="search"
                    placeholder="게임명, 태그, 작성자 검색"
                    value={searchTerm}
                    aria-controls="launcher-game-grid"
                    onChange={(event) => setSearchTerm(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape' && searchTerm) {
                        event.preventDefault();
                        setSearchTerm('');
                      }
                    }}
                  />
                  {searchTerm && (
                    <button type="button" aria-label="게임 검색어 지우기" onClick={() => setSearchTerm('')}>
                      ×
                    </button>
                  )}
                </div>
              </div>

              <div
                ref={launcherTagFilterRef}
                className="launcher-tag-filter"
                role="group"
                aria-label="게임 태그 필터"
              >
                <button
                  type="button"
                  className={`launcher-tag-button ${activeTag === ALL_TAG_FILTER ? 'is-active' : ''}`}
                  aria-pressed={activeTag === ALL_TAG_FILTER}
                  onClick={() => setActiveTag(ALL_TAG_FILTER)}
                >
                  ALL
                </button>
                {visibleLauncherTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`launcher-tag-button ${activeTag === tag ? 'is-active' : ''}`}
                    aria-pressed={activeTag === tag}
                    onClick={() => setActiveTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
                {allLauncherTags.length > DEFAULT_VISIBLE_LAUNCHER_TAGS && (
                  <button
                    type="button"
                    className="launcher-tag-button launcher-tag-toggle"
                    aria-expanded={showAllLauncherTags}
                    onClick={() => {
                      setShowAllLauncherTags((current) => !current);
                      window.requestAnimationFrame(() => {
                        launcherTagFilterRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
                      });
                    }}
                  >
                    {showAllLauncherTags ? '태그 접기' : `더보기 +${hiddenLauncherTagCount}`}
                  </button>
                )}
              </div>
            </div>

            {filteredGames.length === 0 && (
              <div className="launcher-diagnostic">
                <strong>NO MATCHED GAME</strong>
                <p>검색 조건과 일치하는 게임이 없습니다.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setActiveTag(ALL_TAG_FILTER);
                  }}
                >
                  검색 조건 초기화
                </button>
              </div>
            )}

            {filteredGames.length > 0 && (
              <div id="launcher-game-grid" className="workspace-grid" aria-live="polite">
                {filteredGames.map((entry) => {
                  const buildNumber = Math.max(1, gameList.findIndex((gameEntry) => gameEntry.id === entry.id) + 1);
                  const chapterLabel =
                    typeof entry.chapterCount === 'number'
                      ? `${entry.chapterCount} CHAPTER${entry.chapterCount === 1 ? '' : 'S'}`
                      : 'CHAPTERS -';
                  return (
                    <article
                      key={entry.id}
                      className="workspace-game-card"
                    >
                      <a
                        className="workspace-game-select"
                        href={entry.path}
                        aria-label={`${entry.name} 플레이`}
                      >
                        <span className="workspace-game-cover">
                          {entry.thumbnail ? (
                            <img src={entry.thumbnail} alt="" loading="lazy" decoding="async" />
                          ) : (
                            <span className="workspace-game-cover-fallback">YAVN</span>
                          )}
                          <span>BUILD {String(buildNumber).padStart(2, '0')}</span>
                        </span>
                        <span className="workspace-game-body">
                          <span className="workspace-game-header">
                            <strong>{entry.name}</strong>
                            {entry.version ? <em>v{entry.version}</em> : <em>v-</em>}
                          </span>
                          <span className="workspace-game-summary">{entry.summary ?? DEFAULT_LAUNCHER_SUMMARY}</span>
                          {entry.legalNotices.length > 0 && (
                            <span className="workspace-game-legal-badge">{entry.legalNotices[0].title}</span>
                          )}
                          <span className="workspace-game-meta">
                            {entry.author ?? 'UNKNOWN'} · {chapterLabel}
                          </span>
                        </span>
                        <span className="workspace-game-launch" aria-hidden="true">
                          →
                        </span>
                      </a>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
            </>
          )}
        </main>

        <footer className="launcher-footer">
          <p>
            <strong>YAVN</strong>
            <span>Type your story. Play your novel.</span>
          </p>
          <div>
            <span>MANIFEST V{manifestSchemaVersion ?? 5}</span>
            <span>SYNC {manifestTimestampLabel}</span>
            <a href={thirdPartyNoticesUrl} target="_blank" rel="noreferrer">
              제3자 고지
            </a>
            <a href={suiteLicenseUrl} target="_blank" rel="noreferrer">
              SUITE 라이선스
            </a>
            <a href={shareByPrUrl} target="_blank" rel="noreferrer">
              PR 보내기
            </a>
          </div>
        </footer>

        {error && <div className="launcher-error">{error.message}</div>}
      </div>
    );
  }

  const dialogueChannelLabel = {
    dialogue: undefined,
    narration: undefined,
    record: '기록',
    system: '시스템',
  }[dialogChannel];

  return (
    <div
      className="app"
      data-ui-template={uiTemplate}
      data-motion-tempo={motionTempo}
      onClick={() => {
        if (videoCutscene.active) {
          revealVideoSkipGuide();
          return;
        }
        if (dialogUiHidden) {
          return;
        }
        if (settingsOpen) {
          return;
        }
        unlockAudioFromGesture();
        handleManualAdvance();
      }}
    >
      <div
        className={`effect-viewport ${effectClass}`}
        data-effect-active={effect ? 'true' : 'false'}
        data-effect-level={playerExperience.effectLevel}
      >
      <div className="overlay" />
      <BackgroundTransition
        source={background}
        durationMs={backgroundTransitionTiming.duration}
        easing={backgroundTransitionEasing}
      />

      <div
        ref={stageContentFrameRef}
        className={`stage-content-frame${settingsOpen ? ' has-settings-modal' : ''}`}
      >
      <div
        className={`char-layer char-layer-stage-bottom${characterStageLayout.mode === 'default' ? '' : ` char-layout-${characterStageLayout.mode}`}`}
        data-character-layout={characterStageLayout.mode}
        data-character-count={visibleCharacterCount}
        data-camera-shot={cameraPresentation.shot}
        data-camera-requested-shot={camera.shot}
        data-camera-moving={cameraMotionActive ? 'true' : 'false'}
        data-character-moving={characterMotionActive ? 'true' : 'false'}
        data-motion-tempo={characterStageMotionTempo}
        data-character-enter-layout={characterEnterLayout}
        style={{ zIndex: stageBottomLayerZIndex }}
      >
        <div className="char-composition-world" style={cameraStyle}>
          <div
            className="char-camera-world"
            data-camera-target={camera.target}
            data-camera-transition={cameraPresentation.transition}
          >
            {renderCharacter(characters.left, 'left')}
            {renderCharacter(characters.center, 'center')}
            {renderCharacter(characters.right, 'right')}
          </div>
        </div>
      </div>
      {promptTopStagedCharactersByPosition.length > 0 && (
        <div
          className={`char-layer char-layer-prompt-top${characterStageLayout.mode === 'default' ? '' : ` char-layout-${characterStageLayout.mode}`}`}
          data-character-layout={characterStageLayout.mode}
          data-character-count={visibleCharacterCount}
          data-camera-shot={cameraPresentation.shot}
          data-camera-requested-shot={camera.shot}
          data-camera-moving={cameraMotionActive ? 'true' : 'false'}
          data-character-moving={characterMotionActive ? 'true' : 'false'}
          data-motion-tempo={characterStageMotionTempo}
          data-character-enter-layout={characterEnterLayout}
          data-baseline-ready={promptTopBaselineReady ? 'true' : 'false'}
          aria-hidden={!promptTopBaselineReady}
          style={{
            '--prompt-top-dialog-inset': `${stickerSafeInset}px`,
            zIndex: promptTopLayerZIndex,
          } as CSSProperties}
        >
          <div className="char-composition-world char-composition-world-prompt-top" style={cameraStyle}>
            <div
              className="char-camera-world char-camera-world-prompt-top"
              data-camera-target={camera.target}
              data-camera-transition={cameraPresentation.transition}
            >
              {renderCharacter(characters.left, 'left', 'prompt-top')}
              {renderCharacter(characters.center, 'center', 'prompt-top')}
              {renderCharacter(characters.right, 'right', 'prompt-top')}
            </div>
          </div>
        </div>
      )}
      <div
        className="sticker-layer"
        style={{ '--sticker-dialog-inset': `${stickerSafeInset}px` } as CSSProperties}
      >
        <div className="sticker-safe-frame">
          {Object.keys(stickers).map(renderSticker)}
        </div>
      </div>

      {videoCutscene.active && (
        <div className="video-cutscene-overlay">
          {videoCutscene.youtubeId ? (
            <iframe
              id={youtubePlayerId}
              ref={youtubeIframeRef}
              className="video-cutscene-frame video-cutscene-frame-youtube"
              src={`https://www.youtube.com/embed/${videoCutscene.youtubeId}?autoplay=1&mute=1&playsinline=1&controls=1&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
              title="Cutscene"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => {
                postYouTubeCommand('addEventListener', ['onStateChange']);
                postYouTubeCommand('mute');
                postYouTubeCommand('playVideo');
              }}
            />
          ) : (
            <video
              ref={nativeVideoRef}
              className="video-cutscene-frame video-cutscene-frame-native"
              src={videoCutscene.src}
              autoPlay
              muted
              playsInline
              onEnded={() => completeVideoCutscene()}
              onPause={() => {
                if (!videoCutscene.active || document.visibilityState !== 'visible') {
                  return;
                }
                window.requestAnimationFrame(() => {
                  resumeNativeCutsceneVideo();
                });
              }}
            />
          )}
          <div
            className="video-cutscene-interaction"
            onClick={(event) => {
              event.stopPropagation();
              revealVideoSkipGuide();
            }}
            onPointerDown={onVideoPointerDown}
            onPointerUp={onVideoPointerUp}
            onPointerCancel={onVideoPointerUp}
            onPointerLeave={onVideoPointerUp}
          />
          <div
            className={`video-skip-guide ${videoCutscene.guideVisible ? 'visible' : ''}`}
            onPointerDown={onVideoPointerDown}
            onPointerUp={onVideoPointerUp}
            onPointerCancel={onVideoPointerUp}
            onPointerLeave={onVideoPointerUp}
          >
            <div className="video-skip-guide-head">
              <span className="video-skip-guide-title">HOLD TO SKIP</span>
              <b>{Math.floor(videoCutscene.skipProgress * 100)}%</b>
            </div>
            <p className="video-skip-guide-desc">길게 눌러 건너뛰기</p>
            <div className="video-skip-progress">
              <i style={{ width: `${Math.floor(videoCutscene.skipProgress * 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="hud">
        <div className="hud-meta-group">
          <div className="meta">{game?.meta.title ?? '게임 불러오는 중'}</div>
          {chapterTotal > 1 && (
            <div className="hud-chapter-progress">
              CHAPTER {chapterIndex}/{chapterTotal}
            </div>
          )}
        </div>
        <div className="hud-right">
          {uploading && <div className="hint">ZIP 불러오는 중</div>}
          <button
            type="button"
            className="hud-action-button hud-log-button"
            aria-label={`케이스 로그 열기 (${storyLog.length})`}
            title="케이스 로그"
            onClick={(event) => {
              event.stopPropagation();
              settingsTriggerRef.current = event.currentTarget;
              setInventoryDetailOpen(false);
              setCaseFileTab('log');
              setSettingsOpen(true);
            }}
          >
            <span className="hud-log-icon" aria-hidden="true" />
            {storyLog.length > 0 && (
              <span className="hud-action-count" aria-hidden="true">
                {storyLog.length}
              </span>
            )}
          </button>
          <button
            type="button"
            className="hud-action-button hud-inventory-button"
            aria-label={`인벤토리 열기 (${ownedInventoryCount}/${totalInventoryCount})`}
            title="인벤토리"
            onClick={(event) => {
              event.stopPropagation();
              settingsTriggerRef.current = event.currentTarget;
              setInventoryDetailOpen(false);
              setCaseFileTab('inventory');
              setSettingsOpen(true);
            }}
          >
            <span className="hud-inventory-icon" aria-hidden="true" />
            {totalInventoryCount > 0 && (
              <span className="hud-inventory-progress" aria-hidden="true">
                {ownedInventoryCount}/{totalInventoryCount}
              </span>
            )}
          </button>
          <button
            type="button"
            className="hud-action-button hud-save-button"
            aria-label="시스템 열기"
            title="저장 및 설정"
            onClick={(event) => {
              event.stopPropagation();
              settingsTriggerRef.current = event.currentTarget;
              setInventoryDetailOpen(false);
              setSaveNotice('');
              refreshSaveSlots();
              setCaseFileTab('system');
              setSettingsOpen(true);
            }}
          >
            <span className="hud-save-icon" aria-hidden="true" />
          </button>
        </div>
      </div>

      {settingsOpen && (
        <div
          className="settings-modal-backdrop"
          onClick={(event) => {
            event.stopPropagation();
            closeSettingsModal();
          }}
        >
          <section
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-label="케이스 파일"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="settings-modal-header">
              <div className="settings-modal-heading">
                <p>STORY ARCHIVE</p>
                <h2>기록 보관소</h2>
              </div>
              <button
                type="button"
                className="settings-close-button"
                aria-label="케이스 파일 닫기"
                title="닫기"
                onClick={() => closeSettingsModal()}
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </header>
            <div className="case-file-tabs" role="tablist" aria-label="케이스 파일 보기">
              <button
                type="button"
                role="tab"
                className={`case-file-tab ${caseFileTab === 'log' ? 'is-active' : ''}`}
                aria-selected={caseFileTab === 'log'}
                onClick={() => {
                  setInventoryDetailOpen(false);
                  setCaseFileTab('log');
                }}
              >
                <span className="case-file-tab-label">기록</span>
                <span className="case-file-tab-count">{storyLog.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                className={`case-file-tab ${caseFileTab === 'inventory' ? 'is-active' : ''}`}
                aria-selected={caseFileTab === 'inventory'}
                onClick={() => setCaseFileTab('inventory')}
              >
                <span className="case-file-tab-label">인벤토리</span>
                <span className="case-file-tab-count">{ownedInventoryCount}/{totalInventoryCount}</span>
              </button>
              <button
                type="button"
                role="tab"
                className={`case-file-tab ${caseFileTab === 'system' ? 'is-active' : ''}`}
                aria-selected={caseFileTab === 'system'}
                onClick={() => {
                  setInventoryDetailOpen(false);
                  setSaveNotice('');
                  refreshSaveSlots();
                  setCaseFileTab('system');
                }}
              >
                <span className="case-file-tab-label">저장 · 설정</span>
                <span className="case-file-tab-count" aria-hidden="true">03</span>
              </button>
            </div>
            {caseFileTab === 'log' ? (
              <div className="settings-modal-body story-log-body">
                <div className="story-log-summary">
                  <span>최근 기록</span>
                  <b>{storyLog.length}/300</b>
                </div>
                {storyLog.length === 0 ? (
                  <p className="story-log-empty">대화를 시작하면 사건 기록이 여기에 쌓입니다.</p>
                ) : (
                  <ol className="story-log-list" aria-label="스토리 기록">
                    {[...storyLog].reverse().map((entry, index) => (
                      <li
                        key={`${entry.kind}-${entry.chapterPath ?? 'legacy'}-${entry.sceneId}-${entry.actionIndex}-${storyLog.length - index}`}
                        className={`story-log-entry story-log-entry-${entry.kind}`}
                      >
                        {entry.kind === 'dialogue' ? (
                          <>
                            <span className="story-log-kind">
                              {entry.speaker ?? (
                                entry.channel === 'record'
                                  ? '기록'
                                  : entry.channel === 'system'
                                    ? '시스템'
                                    : '서술'
                              )}
                            </span>
                            <p>{entry.text}</p>
                          </>
                        ) : (
                          <>
                            <span className="story-log-kind">{entry.kind === 'choice' ? 'CHOICE' : 'INPUT'}</span>
                            <p>{entry.prompt}</p>
                            <strong>{entry.value}</strong>
                          </>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ) : caseFileTab === 'inventory' ? (
            <div
              className={`settings-modal-body settings-inventory-body ${inventoryViewEntries.length > 0 ? 'has-tools' : ''}`}
            >
              <div className="inventory-collection-header">
                <div className="inventory-view-tabs" role="tablist" aria-label="인벤토리 보기">
                  <button
                    type="button"
                    role="tab"
                    className={`inventory-view-tab ${inventoryView === 'bag' ? 'is-active' : ''}`}
                    aria-selected={inventoryView === 'bag'}
                    onClick={() => {
                      setInventoryDetailOpen(false);
                      setInventoryView('bag');
                    }}
                  >
                    <span>내 가방</span>
                    <b>{ownedInventoryCount}</b>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className={`inventory-view-tab ${inventoryView === 'catalog' ? 'is-active' : ''}`}
                    aria-selected={inventoryView === 'catalog'}
                    onClick={() => {
                      setInventoryDetailOpen(false);
                      setInventoryView('catalog');
                    }}
                  >
                    <span>전체 도감</span>
                    <b>{totalInventoryCount}</b>
                  </button>
                </div>
                <div className="inventory-overview" aria-label={`단서 수집 ${ownedInventoryCount}/${totalInventoryCount}`}>
                  <div>
                    <span>COLLECTION PROGRESS</span>
                    <b>{ownedInventoryCount}<small> / {totalInventoryCount}</small></b>
                  </div>
                  <progress value={ownedInventoryCount} max={Math.max(totalInventoryCount, 1)} />
                </div>
              </div>
              {inventoryViewEntries.length > 0 && (
                <div className="inventory-tools">
                  <label className="inventory-search-field">
                    <span className="inventory-tool-label">검색</span>
                    <input
                      type="search"
                      value={inventorySearchTerm}
                      onChange={(event) => setInventorySearchTerm(event.target.value)}
                      placeholder="단서 이름 검색"
                    />
                  </label>
                  <label className="inventory-select-field">
                    <span className="inventory-tool-label">카테고리</span>
                    <select
                      value={inventoryCategoryFilter}
                      onChange={(event) => setInventoryCategoryFilter(event.target.value)}
                    >
                      <option value={INVENTORY_CATEGORY_ALL}>전체</option>
                      {inventoryCategoryOptions.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="inventory-select-field">
                    <span className="inventory-tool-label">정렬</span>
                    <select
                      value={inventorySort}
                      onChange={(event) => setInventorySort(event.target.value as InventorySortPreference)}
                    >
                      <option value="order">획득 순서</option>
                      <option value="name">이름순</option>
                    </select>
                  </label>
                </div>
              )}
              <div className="inventory-grid-scroll">
                {inventoryVisibleEntries.length === 0 ? (
                  <div className="inventory-grid-empty">
                    <span className="inventory-empty-icon" aria-hidden="true" />
                    <strong>{inventoryGridEmptyMessage}</strong>
                    <p>
                      {inventoryViewEntries.length === 0 && inventoryCatalogEntries.length > 0
                        ? '플레이 중 발견한 단서는 가방에 자동으로 보관됩니다.'
                        : inventoryFiltersActive
                          ? '검색어나 카테고리를 바꾸고 다시 확인해 보세요.'
                          : '게임에서 단서를 발견하면 이곳에 표시됩니다.'}
                    </p>
                    {inventoryViewEntries.length === 0 && inventoryCatalogEntries.length > 0 ? (
                      <button type="button" onClick={() => setInventoryView('catalog')}>
                        도감 살펴보기
                      </button>
                    ) : inventoryFiltersActive ? (
                      <button
                        type="button"
                        onClick={() => {
                          setInventorySearchTerm('');
                          setInventoryCategoryFilter(INVENTORY_CATEGORY_ALL);
                        }}
                      >
                        검색 조건 초기화
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="inventory-grid" role="list" aria-label="인벤토리 그리드">
                    {inventoryVisibleEntries.map((entry, index) => (
                      <button
                        key={entry.id}
                        type="button"
                        role="listitem"
                        className={`inventory-slot ${entry.id === selectedInventoryItemId ? 'is-selected' : ''} ${entry.owned ? '' : 'is-locked'}`}
                        onClick={() => {
                          if (!entry.owned) {
                            return;
                          }
                          setSelectedInventoryItemId(entry.id);
                          setInventoryDetailOpen(true);
                        }}
                        disabled={!entry.owned}
                        aria-haspopup={entry.owned ? 'dialog' : undefined}
                        aria-label={`${entry.owned ? entry.name : '미발견 단서'} ${entry.owned ? '획득됨' : '미획득'}`}
                      >
                        <span className="inventory-slot-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                        {inventoryView === 'catalog' && entry.owned && <span className="inventory-slot-owned-badge">획득</span>}
                        {entry.owned && entry.imageUrl ? (
                          <img src={entry.imageUrl} alt="" aria-hidden="true" loading="lazy" decoding="async" />
                        ) : (
                          <span
                            className={`inventory-slot-fallback ${entry.owned ? 'is-placeholder' : 'is-locked-placeholder'}`}
                            aria-hidden="true"
                          >
                            <span className="inventory-slot-fallback-icon" />
                            {entry.owned && <span>이미지 없음</span>}
                          </span>
                        )}
                        <span className="inventory-slot-name">{entry.owned ? entry.name : '미발견 단서'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            ) : (
              <div className="settings-modal-body save-system-body">
                <div className={`save-protection-hero ${autoSaveEnabled ? 'is-active' : 'is-paused'}`}>
                  <span className="save-protection-mark" aria-hidden="true" />
                  <div className="save-auto-status">
                    <span>
                      <small>PROGRESS PROTECTION</small>
                      <b>{autoSaveEnabled ? '진행 보호 작동 중' : '진행 보호 일시 중지'}</b>
                    </span>
                    <strong>{formatSaveSlotMeta(autoRecoverySlot)}</strong>
                  </div>
                  <label className="save-autosave-row">
                    <span>
                      <b>자동 저장</b>
                      <small>선택 직전 복구점</small>
                    </span>
                    <span className="settings-switch">
                      <input
                        type="checkbox"
                        checked={autoSaveEnabled}
                        onChange={(event) => onToggleAutoSave(event.target.checked)}
                        disabled={saveBusy}
                      />
                      <span aria-hidden="true" />
                    </span>
                  </label>
                </div>

                <div className="save-system-grid">
                  <section className="save-system-section" data-save-kind="manual">
                    <span className="save-section-index" aria-hidden="true">01</span>
                    <header>
                      <div>
                        <small>PLAYER SLOT</small>
                        <h3>수동 저장</h3>
                      </div>
                      <span>{formatSaveSlotMeta(manualSaveSlot)}</span>
                    </header>
                    <div className="save-system-actions save-system-actions-pair">
                      <button className="is-primary" type="button" onClick={onManualSave} disabled={saveBusy || Boolean(gameOver)}>
                        현재 진행 저장
                      </button>
                      <button
                        type="button"
                        onClick={() => void onLoadSave('manual')}
                        disabled={!manualSaveSlot?.exists || saveBusy}
                      >
                        저장 불러오기
                      </button>
                    </div>
                  </section>

                  <section className="save-system-section" data-save-kind="chapter">
                    <span className="save-section-index" aria-hidden="true">02</span>
                    <header>
                      <div>
                        <small>CHECKPOINT</small>
                        <h3>챕터 시작점</h3>
                      </div>
                      <span>{formatSaveSlotMeta(chapterSaveSlot)}</span>
                    </header>
                    <button
                      type="button"
                      className="save-system-wide-action"
                      onClick={() => void onRestartChapter()}
                      disabled={!chapterSaveSlot?.exists || saveBusy}
                    >
                      챕터 처음으로 돌아가기
                    </button>
                  </section>

                  <section className="save-system-section" data-save-kind="backup">
                    <span className="save-section-index" aria-hidden="true">03</span>
                    <header>
                      <div>
                        <small>PORTABLE DATA</small>
                        <h3>백업 파일</h3>
                      </div>
                      <span>기기 이동용</span>
                    </header>
                    <div className="save-system-actions save-system-actions-pair">
                      <button type="button" onClick={onExportSave} disabled={saveBusy || Boolean(gameOver)}>
                        내보내기
                      </button>
                      <button type="button" onClick={() => saveImportRef.current?.click()} disabled={saveBusy}>
                        가져오기
                      </button>
                    </div>
                    <input
                      ref={saveImportRef}
                      type="file"
                      accept=".json,.yavn-save.json,application/json"
                      onChange={(event) => void onImportSave(event)}
                      hidden
                    />
                  </section>

                  <section className="save-system-section player-experience-section">
                    <span className="save-section-index" aria-hidden="true">04</span>
                    <header>
                      <div>
                        <small>PLAYER EXPERIENCE</small>
                        <h3>플레이 감각</h3>
                      </div>
                      <span>게임별로 자동 저장</span>
                    </header>
                    <div className="player-experience-grid">
                      <label className="player-setting-control">
                        <span>
                          <b>텍스트 속도</b>
                          <small>대사 출력 배속</small>
                        </span>
                        <select
                          value={playerExperience.textSpeedRate}
                          onChange={(event) => updatePlayerExperience({
                            textSpeedRate: Number(event.target.value) as TextSpeedRate,
                          })}
                        >
                          <option value={0.75}>차분하게 · 0.75×</option>
                          <option value={1}>기본 · 1×</option>
                          <option value={1.5}>빠르게 · 1.5×</option>
                          <option value={2}>매우 빠르게 · 2×</option>
                        </select>
                      </label>
                      <label className="player-setting-control is-switch">
                        <span>
                          <b>자동 진행</b>
                          <small>선택지와 입력에서는 정지</small>
                        </span>
                        <span className="settings-switch">
                          <input
                            type="checkbox"
                            checked={playerExperience.autoPlayEnabled}
                            onChange={(event) => updatePlayerExperience({ autoPlayEnabled: event.target.checked })}
                          />
                          <span aria-hidden="true" />
                        </span>
                      </label>
                      <label className="player-setting-control">
                        <span>
                          <b>자동 진행 간격</b>
                          <small>타이핑 완료 후 대기</small>
                        </span>
                        <select
                          value={playerExperience.autoPlayDelayMs}
                          disabled={!playerExperience.autoPlayEnabled}
                          onChange={(event) => updatePlayerExperience({
                            autoPlayDelayMs: Number(event.target.value) as AutoPlayDelay,
                          })}
                        >
                          <option value={800}>짧게 · 0.8초</option>
                          <option value={1400}>기본 · 1.4초</option>
                          <option value={2200}>여유롭게 · 2.2초</option>
                        </select>
                      </label>
                      <label className="player-setting-control">
                        <span>
                          <b>화면 효과</b>
                          <small>움직임과 광량 강도</small>
                        </span>
                        <select
                          value={playerExperience.effectLevel}
                          onChange={(event) => updatePlayerExperience({
                            effectLevel: event.target.value as PlayerEffectLevel,
                          })}
                        >
                          <option value="full">풍부하게</option>
                          <option value="reduced">부드럽게</option>
                          <option value="minimal">최소화</option>
                        </select>
                      </label>
                      <div className="player-setting-control player-volume-control">
                        <span>
                          <b>배경음악</b>
                          <small>{Math.round(playerExperience.bgmVolume * 100)}%</small>
                        </span>
                        <div>
                          <span className="settings-switch">
                            <input
                              type="checkbox"
                              checked={bgmEnabled}
                              aria-label="배경음악 켜기"
                              onChange={(event) => onToggleBgmDisabled(!event.target.checked)}
                            />
                            <span aria-hidden="true" />
                          </span>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={playerExperience.bgmVolume}
                            aria-label="배경음악 음량"
                            disabled={!bgmEnabled}
                            onChange={(event) => updatePlayerExperience({ bgmVolume: Number(event.target.value) })}
                          />
                        </div>
                      </div>
                      <label className="player-setting-control player-volume-control">
                        <span>
                          <b>효과음</b>
                          <small>{Math.round(playerExperience.sfxVolume * 100)}%</small>
                        </span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={playerExperience.sfxVolume}
                          aria-label="효과음 음량"
                          onChange={(event) => updatePlayerExperience({ sfxVolume: Number(event.target.value) })}
                        />
                      </label>
                    </div>
                  </section>

                  <section className="save-system-section legal-notices-section">
                    <span className="save-section-index" aria-hidden="true">05</span>
                    <header>
                      <div>
                        <small>RIGHTS &amp; ATTRIBUTION</small>
                        <h3>법적 고지</h3>
                      </div>
                      <span>{gameLegalNotices.length > 0 ? `${gameLegalNotices.length}건` : '게임별 고지 없음'}</span>
                    </header>
                    {gameLegalNotices.length > 0 ? (
                      <LegalNoticeList notices={gameLegalNotices} className="settings-legal-notices" />
                    ) : (
                      <p className="legal-notice-empty">이 게임이 선언한 별도 법적 고지는 없습니다.</p>
                    )}
                    <nav className="legal-notice-global-links" aria-label="YAVN 라이선스 문서">
                      <a href={thirdPartyNoticesUrl} target="_blank" rel="noreferrer">YAVN 제3자 고지</a>
                      <a href={suiteLicenseUrl} target="_blank" rel="noreferrer">SUITE 글꼴 라이선스</a>
                      <a href={easyCl2dNoticeUrl} target="_blank" rel="noreferrer">easy-cl2d NOTICE</a>
                      <a href={easyCl2dLicenseUrl} target="_blank" rel="noreferrer">Live2D Framework 조건</a>
                      <a href={live2dRedistributableFilesUrl} target="_blank" rel="noreferrer">Live2D 재배포 파일</a>
                    </nav>
                  </section>
                </div>

                <section className="save-system-section save-preferences-section is-single-action">
                  <button
                    type="button"
                    className="settings-action-button"
                    onClick={(event) => void onReturnToStartScreen(event)}
                    disabled={!canReturnToStartScreen || returningToStartGate}
                  >
                    {returningToStartGate ? '시작 화면 여는 중...' : '게임 시작 화면으로 가기'}
                  </button>
                </section>

                <p className="save-system-status" role="status" aria-live="polite">
                  {saveNotice || '저장 데이터는 이 브라우저에 보관됩니다.'}
                </p>
              </div>
            )}
            {caseFileTab === 'inventory' && inventoryDetailOpen && selectedInventoryEntry && (
              <div
                className="inventory-detail-modal-backdrop"
                onClick={() => setInventoryDetailOpen(false)}
              >
                <section
                  className="inventory-detail-modal"
                  role="dialog"
                  aria-label="아이템 상세 정보"
                  onClick={(event) => event.stopPropagation()}
                >
                  <header className="inventory-detail-modal-header">
                    <h3>{selectedInventoryEntry.owned ? selectedInventoryEntry.name : '미확인 아이템'}</h3>
                    <button
                      type="button"
                      className="settings-close-button"
                      aria-label="아이템 상세 닫기"
                      title="닫기"
                      onClick={() => setInventoryDetailOpen(false)}
                    >
                      <span aria-hidden="true">&times;</span>
                    </button>
                  </header>
                  <div
                    className={`inventory-detail-modal-body ${selectedInventoryEntry.imageUrl ? 'has-image' : ''}`}
                  >
                    {selectedInventoryEntry.owned ? (
                      <>
                        {selectedInventoryEntry.imageUrl && (
                          <img
                            src={selectedInventoryEntry.imageUrl}
                            alt={`${selectedInventoryEntry.name} 아이템 이미지`}
                            loading="lazy"
                            decoding="async"
                          />
                        )}
                        <div className="inventory-detail-copy">
                          <p className="inventory-detail-owned is-owned">{selectedInventoryEntry.category} · 획득</p>
                          <p>{selectedInventoryEntry.description ?? '아이템 설명이 없습니다.'}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="inventory-detail-owned is-missing">아직 획득하지 못함</p>
                        <p>아직 획득하지 못한 아이템입니다.</p>
                      </>
                    )}
                  </div>
                </section>
              </div>
            )}
          </section>
        </div>
      )}

      <div
        ref={dialogBoxRef}
        className={`dialog-box channel-${dialogChannel} delivery-${dialogDelivery}${choiceGate.active ? ' has-choice-gate' : ''} ${isDialogHidden ? 'hidden' : ''}`}
      >
        {!isDialogHiddenBySystem && !dialogUiHidden && (
          <div className="dialog-controls">
            <button
              type="button"
              className={`dialog-toggle-button dialog-auto-button${playerExperience.autoPlayEnabled ? ' is-active' : ''}`}
              aria-pressed={playerExperience.autoPlayEnabled}
              title="일반 대사를 자동으로 진행합니다"
              onClick={(event) => {
                event.stopPropagation();
                queuedManualAdvanceAtRef.current = null;
                resetManualAdvanceTempo();
                updatePlayerExperience({ autoPlayEnabled: !playerExperience.autoPlayEnabled });
              }}
            >
              AUTO
            </button>
            <button
              type="button"
              className="dialog-toggle-button"
              onClick={(event) => {
                event.stopPropagation();
                setDialogUiHidden(true);
              }}
            >
              숨기기
            </button>
          </div>
        )}
        <div className="dialog-content-scroll">
          {dialogueChannelLabel && (
            <div className="dialog-channel-label">{dialogueChannelLabel}</div>
          )}
          {dialogSpeaker && (
            <div className={`speaker delivery-${dialogDelivery}`}>{dialogSpeaker}</div>
          )}
          <DialogueText />
          {inputGate.active && (
            <form
              className="input-gate-form"
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (busy) {
                  return;
                }
                submitInputAnswer(inputAnswer);
                setInputAnswer('');
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <input
                ref={inputFieldRef}
                className="input-gate-field"
                type="text"
                value={inputAnswer}
                autoFocus={!skipInputAutoFocus}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="정답 입력"
                disabled={busy}
                onChange={(event) => setInputAnswer(event.target.value)}
                onClick={(event) => event.stopPropagation()}
              />
              <button
                type="submit"
                className="input-gate-submit"
                disabled={busy}
                onClick={(event) => event.stopPropagation()}
              >
                {inputSubmitLabel}
              </button>
            </form>
          )}
          {choiceGate.active && (
            <div className="choice-gate" onClick={(event) => event.stopPropagation()}>
              {hasRecoveredFailedChoice && (
                <div className="choice-recovery-hint" role="status">
                  <span aria-hidden="true">!</span>
                  <p><strong>죽음의 원인이 된 선택이 표시되어 있습니다.</strong> 다른 경로를 선택해 다시 진행할 수 있습니다.</p>
                </div>
              )}
              {choiceGate.timeoutMs && (
                <div
                  className="choice-gate-timeout"
                  role="timer"
                  aria-label={`선택 제한 시간 ${Math.ceil(choiceGate.timeoutMs / 1000)}초`}
                  style={{ '--choice-timeout-ms': `${choiceGate.timeoutMs}ms` } as CSSProperties}
                >
                  <div className="choice-gate-timeout-meta">
                    <span>선택 제한</span>
                    <strong>{Math.ceil(choiceGate.timeoutMs / 1000)}s</strong>
                  </div>
                  <div className="choice-gate-timeout-track" aria-hidden="true">
                    <span />
                  </div>
                </div>
              )}
              <div
                className="choice-gate-options"
                data-choice-count={choiceGate.options.length}
              >
                {choiceGate.options.map((option, index) => {
                  const hasForgiveOnce = option.forgiveOnce ?? choiceGate.forgiveOnceDefault;
                  const forgiveAvailable = hasForgiveOnce && !choiceGate.forgivenOptionIndexes.includes(index);
                  const isPreviousGameOverChoice = index === recoveredFailedChoiceIndex;
                  return (
                    <button
                      key={`${choiceGate.key}-${option.text}-${index}`}
                      type="button"
                      className={`choice-gate-option${forgiveAvailable ? ' choice-gate-option-forgive' : ''}${isPreviousGameOverChoice ? ' choice-gate-option-previous-game-over' : ''}`}
                      ref={(el) => {
                        choiceOptionButtonRefs.current[index] = el;
                      }}
                      onKeyDown={(event) => {
                        if (busy) {
                          return;
                        }
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          event.stopPropagation();
                          if (hasRecoveredFailedChoice) {
                            setRecoveredFailedChoice(undefined);
                          }
                          submitChoiceOption(index);
                        }
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (busy) {
                          return;
                        }
                        if (hasRecoveredFailedChoice) {
                          setRecoveredFailedChoice(undefined);
                        }
                        submitChoiceOption(index);
                      }}
                      disabled={busy}
                      aria-label={`${option.text}${isPreviousGameOverChoice ? ', 죽음의 원인 선택, 게임 오버 경로' : ''}`}
                    >
                      <span className="choice-gate-option-copy">
                        <span className="choice-gate-option-index" aria-hidden="true">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="choice-gate-option-text">{option.text}</span>
                        <span className="choice-gate-option-mark" aria-hidden="true">›</span>
                      </span>
                      <span className="choice-gate-option-badges">
                        {isPreviousGameOverChoice && (
                          <span className="choice-gate-option-history-badge">
                            <b>원인 선택</b>
                            <em>GAME OVER</em>
                          </span>
                        )}
                        {forgiveAvailable && <span className="choice-gate-option-badge">1회 유예</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {showDialogRestoreButton && (
        <button
          type="button"
          className="dialog-restore-button"
          onClick={(event) => {
            event.stopPropagation();
            setDialogUiHidden(false);
          }}
        >
          대화창 열기
        </button>
      )}
      </div>

      {error && (
        <div className="error-overlay">
          <div className="error-title">YAML Error</div>
          <div className="error-body">{error.message}</div>
          {(error.line || error.column) && (
            <div className="error-pos">
              line {error.line ?? '?'} col {error.column ?? '?'}
            </div>
          )}
          {error.details && <div className="error-details">{error.details}</div>}
        </div>
      )}

      {chapterLoading && (
        <div className="chapter-loading" role="status" aria-live="polite">
          <div className="chapter-loading-kicker">
            {chapterTotal > 1 ? `YAVN / CHAPTER ${chapterIndex} OF ${chapterTotal}` : 'YAVN / LOADING SCENE'}
          </div>
          <div className="chapter-loading-row">
            <div className="chapter-loading-title">{chapterLoadingMessage ?? 'Loading chapter'}</div>
            <div className="chapter-loading-percent">{Math.floor(chapterLoadingProgress * 100)}%</div>
          </div>
          <div
            className="chapter-loading-bar"
            role="progressbar"
            aria-label="챕터 로딩"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.floor(chapterLoadingProgress * 100)}
          >
            <span style={{ width: `${Math.floor(chapterLoadingProgress * 100)}%` }} />
          </div>
        </div>
      )}

      {gameOver && !chapterLoading && (
        <div className="game-over-overlay" role="dialog" aria-modal="true" aria-labelledby="game-over-title">
          <div className="game-over-panel">
            <p className="game-over-kicker">GAME OVER</p>
            <h2 id="game-over-title">{gameOver.title ?? 'GAME OVER'}</h2>
            <p className="game-over-message">
              {gameOver.message ?? '선택의 결과로 더는 이야기를 이어갈 수 없습니다.'}
            </p>
            {choiceRecoveryPoint.failedChoice?.value && (
              <div className="game-over-cause" aria-label="결과를 만든 선택">
                <span>결과를 만든 선택</span>
                <strong>{choiceRecoveryPoint.failedChoice.value}</strong>
              </div>
            )}
            <div className="game-over-primary-actions">
              <button
                type="button"
                onClick={() => void (choiceRecoveryPoint.exists ? onLoadLastChoice() : onLoadSave('auto'))}
                disabled={(!choiceRecoveryPoint.exists && !autoRecoverySlot?.exists) || saveBusy}
              >
                <span>{choiceRecoveryPoint.exists ? '죽음의 원인 선택으로' : '자동 복구점으로'}</span>
                <small>{formatSaveSlotMeta(choiceRecoveryPoint.exists ? choiceRecoveryPoint : autoRecoverySlot)}</small>
              </button>
              <button
                type="button"
                onClick={() => void onLoadSave('manual')}
                disabled={!manualSaveSlot?.exists || saveBusy}
              >
                <span>수동 저장으로</span>
                <small>{formatSaveSlotMeta(manualSaveSlot)}</small>
              </button>
              <button
                type="button"
                onClick={() => void onRestartChapter()}
                disabled={!chapterSaveSlot?.exists || saveBusy}
              >
                <span>챕터 처음으로</span>
                <small>{formatSaveSlotMeta(chapterSaveSlot)}</small>
              </button>
            </div>

            <button
              type="button"
              className="game-over-import-button"
              onClick={() => gameOverImportRef.current?.click()}
              disabled={saveBusy}
            >
              백업 파일 불러오기
            </button>
            <input
              ref={gameOverImportRef}
              type="file"
              accept=".json,.yavn-save.json,application/json"
              onChange={(event) => void onImportSave(event)}
              hidden
            />
            <p className="game-over-status" role="status" aria-live="polite">
              {saveBusy ? '복구 중...' : saveNotice}
            </p>
          </div>
        </div>
      )}

      {isFinished && (
        <div className="ending-overlay">
          {endingBackgroundUrl && <img className="ending-overlay-bg-image" src={endingBackgroundUrl} alt="" aria-hidden="true" />}
          <div className="ending-overlay-decoration" aria-hidden="true" />
          <div className="ending-credits-screen" aria-label="엔딩 크레딧">
            <div
              className={`ending-credits-roll ${endingCreditsScrollUnlocked ? 'unlocked' : 'locked'}`}
              ref={endingCreditsRollRef}
              tabIndex={endingCreditsScrollUnlocked ? 0 : -1}
              onWheel={handleEndingCreditsInput}
              onPointerDown={handleEndingCreditsInput}
              onTouchStart={handleEndingCreditsInput}
              onKeyDown={handleEndingCreditsInput}
            >
              <div className="ending-credits-inner" style={{ visibility: endingCreditsReady ? 'visible' : 'hidden' }}>
                <div className="ending-credits-spacer ending-credits-spacer-top" style={{ height: `${endingTopSpacerPx}px` }} />
                <div className="ending-credits-content">
                  <h2>{endingTitle}</h2>
                  <p className="ending-credits-message">{endingMessage}</p>
                  {resolvedEndingId && <p className="ending-credits-line">ENDING ID: {resolvedEndingId}</p>}
                  {totalEndingCount > 0 && (
                    <section className="ending-credits-section ending-progress-card">
                      <h3>ENDING PROGRESS</h3>
                      <p className="ending-progress-value">
                        {seenEndingCount}/{totalEndingCount} ({endingCompletionPercent}%) ·{' '}
                        {endingCollectionDone ? '게임 완료' : '진행 중'}
                      </p>
                      <div className="ending-progress-bar" role="presentation">
                        <i style={{ width: `${endingCompletionPercent}%` }} />
                      </div>
                      {seenEndingTitles.length > 0 && (
                        <p className="ending-credits-line">획득 엔딩: {seenEndingTitles.join(' · ')}</p>
                      )}
                    </section>
                  )}

                  <section className="ending-credits-section">
                    <h3>CREATED BY</h3>
                    {hasAuthorCredit ? (
                      <>
                        {authorCredit.name && <p className="ending-credits-line ending-credits-name">{authorCredit.name}</p>}
                        {authorCredit.contacts.map((contact, index) => (
                          <p className="ending-credits-line" key={`${contact.value}-${index}`}>
                            {contact.label ? `${contact.label}: ` : ''}
                            {contact.href ? (
                              <a href={contact.href} target="_blank" rel="noreferrer">
                                {contact.value}
                              </a>
                            ) : (
                              contact.value
                            )}
                          </p>
                        ))}
                      </>
                    ) : (
                      <p className="ending-credits-line">제작자 정보 없음</p>
                    )}
                  </section>

                  {gameLegalNotices.length > 0 && (
                    <section className="ending-credits-section ending-legal-notices">
                      <h3>LEGAL NOTICES</h3>
                      <LegalNoticeList notices={gameLegalNotices} />
                    </section>
                  )}

                  <section className="ending-credits-section">
                    <h3>POWERED BY</h3>
                    <p className="ending-credits-line ending-credits-name">YAVN (야븐)</p>
                    <p className="ending-credits-line">Type your story. Play your novel.</p>
                    <p className="ending-credits-line">
                      <a href="https://yavn.vercel.app" target="_blank" rel="noreferrer">
                        https://yavn.vercel.app
                      </a>
                    </p>
                    <p className="ending-credits-line">
                      <a href={repositoryUrl} target="_blank" rel="noreferrer">
                        {repositoryUrl}
                      </a>
                    </p>
                    <p className="ending-credits-line">
                      <a href={thirdPartyNoticesUrl} target="_blank" rel="noreferrer">
                        제3자 소프트웨어·자산 고지
                      </a>
                    </p>
                  </section>
                </div>
                <div className="ending-credits-spacer ending-credits-spacer-bottom" />
              </div>
            </div>
            <div className={`ending-bottom-bar ${showEndingRestart ? 'visible' : ''}`} aria-hidden={!showEndingRestart}>
              {totalEndingCount > 1 && choiceRecoveryPoint.exists && (
                <button
                  type="button"
                  className="ending-restart ending-retry-choice"
                  onClick={(event) => {
                    event.stopPropagation();
                    void onLoadLastChoice();
                  }}
                  disabled={saveBusy}
                  tabIndex={showEndingRestart ? undefined : -1}
                >
                  {saveBusy ? '선택 불러오는 중...' : '마지막 선택으로'}
                </button>
              )}
              <button
                type="button"
                className="ending-restart"
                onClick={onRestartFromBeginning}
                disabled={returningToStartGate || saveBusy}
                tabIndex={showEndingRestart ? undefined : -1}
              >
                {returningToStartGate ? '초기화면 여는 중...' : '처음부터 다시하기'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
