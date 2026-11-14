import { matchesStorySearch } from './storySearch';
import { t, uiLanguage, languageLabel, libraryHref, normalizeGameLanguages, gameHref } from './uiLanguage';
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
import { CinematicLayer } from './CinematicLayer';
import { YavnLogo } from './YavnLogo';
import { TitleScene } from './TitleScene';
import { GameIcon } from './GameIcon';
import { ResourceImage } from './ResourceImage';
import { StickerArtwork } from './StickerArtwork';
import { measureStickerBox } from './stickerMeasurement';
import { resolveDialogueScroll, resolvePromptActorInset } from './promptLayout';
import { selectPhoneContact, selectPhoneThread } from './phoneThread';
import { navigateGameTabs, trapGameDialogFocus } from './gameInterface';
import { useRetainedCast } from './retainedCast';
import { interpolateText } from './textVariables';
import './characterPresentation.css';
import './characterEmotes.css';
import { SceneCurtain, useSceneCurtain } from './SceneCurtain';
import { collectStartSceneAssets, DEFAULT_START_SCENE, mapStartSceneAssets } from './startScene';
import { OutcomePrelude, trapOutcomeFocus } from './OutcomePrelude';
import './cinematic.css';
import { BackgroundTransition } from './BackgroundTransition';
import { StageImageCharacter } from './StageImageCharacter';
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
  completeBackgroundTransition,
  completeVideoCutscene,
  deleteSaveSlot,
  describeStoredProgressForGame,
  exportSaveBackup,
  flushAutosave,
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
  setSkipReadActive,
  readSaveBackup,
  setInventoryUiSettings,
  setPlayerAutoPlayPaused,
  setScenePresentationPaused,
  setPlayerExperienceSettings,
  skipVideoCutscene,
  stopActiveBgm,
  submitInputAnswer,
  submitChoiceOption,
  saveCurrentProgress,
  MANUAL_SAVE_SLOTS,
  type ManualSaveSlot,
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
  StartScreenPreview,
  StoredProgressStatus,
  TextSpeedRate,
} from './engine';
import { SaveSlotMeta, UpdateBanner, VersionGate, VersionLine, VersionStamp, olderVersionMessage } from './VersionSaves';
import { formatRelativeSaveTime, formatSaveChapter, resolveSlotIntent, type SlotIntent } from './saveMeta';
import { consumeBootIntent, readGameIdFromPath, reloadIntoNewBuild, setBootIntent, useUpdateWatch } from './updateCheck';
import { canOpenGame } from './pwa/offlinePacks';
import { OfflineNote, OfflinePackControl, offlineCopy } from './pwa/OfflineControls';
import { useOfflinePacks, useReachable } from './pwa/useOffline';
import {
  buildImageCharacterRenderKey,
  resolveCharacterFocusPresentation,
  resolveCharacterStageLayout,
  resolveCharacterStageRenderPlacement,
  resolveCharacterStageSpacing,
  resolveLayoutCharacterIds,
  type CharacterStageRenderPlacement,
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
import { gameContentPath, parseGameRoute } from './gameRoute';
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
  isStickerWithinFrame,
  fitStickerWithinFrameAvoidingRects,
  haveStickerObstacleRectsSettled,
  shouldRelayoutStickerForStageResize,
  type StickerFit,
  type StickerLayoutRect,
  type StickerStageSize,
} from './stickerLayout';
import {
  CHARACTER_EXIT_FADE_DURATION_MS,
  MOBILE_PROMPT_CAMERA_FIT_SCALE,
  PROMPT_CAMERA_FIT_SCALE,
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
  StartSceneConfig,
  StickerSlot,
  UiTemplateId,
} from './types';
import type { InventorySortPreference, InventoryViewPreference } from './engine';
import type { CSSProperties } from 'react';

const HUD_IDLE_DELAY_MS = 4000;
const Live2DCharacter = lazy(() =>
  import('./Live2DCharacter').then((module) => ({ default: module.Live2DCharacter })),
);

// The story map is opened on demand, so its UI and stylesheet load in a separate chunk.
const StoryMap = lazy(() => import('./StoryAtlas').then((module) => ({ default: module.StoryMap })));

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

const DialogueActionButton = memo(function DialogueActionButton() {
  const { label, typing, busy } = useVNStore(useShallow(state => ({
    label: state.dialog.continueLabel, typing: state.dialog.typing, busy: state.busy,
  })));
  if (!label) return null;
  return (
    <button type="button" className="dialog-action-button" disabled={typing || busy}
      onClick={event => { event.stopPropagation(); handleAdvance(true); }}>
      <span>{label}</span><GameIcon name="arrow" />
    </button>
  );
});

const DialogueText = memo(function DialogueText() {
  const {
    visibleText,
    fullText,
    typing,
    channel,
    delivery,
    typingIntensity,
    typingPulse,
  } = useVNStore(useShallow((state) => ({
    visibleText: state.dialog.visibleText,
    fullText: state.dialog.fullText,
    typing: state.dialog.typing,
    channel: state.dialog.channel,
    delivery: state.dialog.delivery,
    typingIntensity: state.dialog.typingIntensity,
    typingPulse: state.dialog.typingPulse,
  })));
  const visibleDialogue = splitLastGrapheme(typing ? visibleText : '');
  const textRef = useRef<HTMLDivElement>(null);

  // A line longer than the dialogue box would type on out of sight, so follow it down while it
  // types and keep the newest words visible. Each new line starts back at the top. A line the
  // reader completed with a click is left at the top instead, so they still see its beginning.
  // Jumps are instant: smooth scrolling cannot keep up with character-by-character typing.
  const lineStartRef = useRef<string>();
  const threadRef = useRef(false);
  useLayoutEffect(() => {
    const scroller = textRef.current?.closest<HTMLElement>('.dialog-content-scroll');
    if (!scroller) return;
    const lineChanged = lineStartRef.current !== fullText;
    lineStartRef.current = fullText;
    threadRef.current = Boolean(scroller.querySelector('.phone-thread'));
    const target = resolveDialogueScroll({ lineChanged, typing, thread: threadRef.current });
    if (target === 'top') scroller.scrollTop = 0;
    else if (target === 'bottom') scroller.scrollTop = scroller.scrollHeight;
    // A bubble that grows as it types changes the scroll height after this effect has run,
    // so the newest line can end up a few pixels under the fold. Settle it on the next frame.
    if (target !== 'top' && threadRef.current) {
      const settle = requestAnimationFrame(() => { scroller.scrollTop = scroller.scrollHeight; });
      return () => cancelAnimationFrame(settle);
    }
    return undefined;
  }, [fullText, visibleText, typing]);

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
      ref={textRef}
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
  summaryEn?: string;
  thumbnail?: string;
  tags: string[];
  tagLabels?: Record<string, string>;
  languages: string[];
  showcase?: LauncherShowcase;
  legalNotices: LegalNotice[];
  chapterCount?: number;
  endingCount?: number;
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
    eyebrow?: string;
    subtitle?: string;
    scene?: StartSceneConfig;
    showLoadButton: boolean;
    saveStatus?: StoredProgressStatus;
    gameVersion?: string;
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
    eyebrow?: string;
    subtitle?: string;
    scene?: StartSceneConfig;
    showLoadButton: false;
    saveStatus?: StoredProgressStatus;
    gameVersion?: string;
    legalNotices: LegalNotice[];
  };

const ENDING_PROGRESS_STORAGE_PREFIX = 'vn-ending-progress:';
// Items the player has opened at least once; anything owned but not here is shown as new.
const INVENTORY_INSPECTED_STORAGE_PREFIX = 'vn-inventory-inspected:';
// Reading size is a player preference, not a per-game setting.
const TEXT_SCALE_STORAGE_KEY = 'vn-ui-text-scale';
const TEXT_SCALE_VALUES = ['base', 'large', 'larger'] as const;
type TextScale = (typeof TEXT_SCALE_VALUES)[number];
function readTextScale(): TextScale {
  try {
    const stored = localStorage.getItem(TEXT_SCALE_STORAGE_KEY);
    return TEXT_SCALE_VALUES.includes(stored as TextScale) ? (stored as TextScale) : 'base';
  } catch {
    return 'base';
  }
}
function readInspectedInventory(title: string | undefined): Set<string> {
  if (!title) return new Set();
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(`${INVENTORY_INSPECTED_STORAGE_PREFIX}${title}`) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}
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

const DEFAULT_LAUNCHER_SUMMARY = t("당신의 선택으로 이어지는 이야기. 첫 장을 열어보세요.");
const DEFAULT_START_BUTTON_TEXT = t("시작하기");
const DEFAULT_LOAD_BUTTON_TEXT = t("이어하기");
const DEFAULT_SEO_TITLE = uiLanguage === 'en' ? 'YAVN — Visual Novel & Story RPG Game Maker' : '야븐 YAVN — 비주얼노벨·스토리 RPG 게임 만들기';
const DEFAULT_SEO_DESCRIPTION =
  uiLanguage === 'en' ? 'Make browser visual novels and choice-driven story RPGs with YAML scenes, dialogue, branching choices, inventory and Live2D. Play free web game demos.' : '야븐으로 비주얼노벨·선택형 스토리 RPG 웹게임을 만들어 보세요. YAML 장면·대사·분기·아이템·Live2D로 게임 만들기부터 브라우저 데모 플레이까지 지원합니다.';
const DEFAULT_SEO_KEYWORDS = [
  'RPG 만들기', '게임 만들기', '웹게임 만들기', '비주얼노벨 만들기', 'RPG game maker', 'make a game', 'web game maker', 'visual novel maker',
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
const DEFAULT_CANONICAL_URL = `https://yavn.vercel.app/${uiLanguage === 'en' ? 'en/' : ''}`;
const DYNAMIC_JSON_LD_SCRIPT_ID = 'yavn-dynamic-jsonld';
// Preserve the actual published story languages when replacing its initial JSON-LD.
const INITIAL_GAME_LANGUAGES = (() => {
  if (typeof document === 'undefined') return [];
  try {
    const data = JSON.parse(document.getElementById(DYNAMIC_JSON_LD_SCRIPT_ID)?.textContent ?? '{}');
    return data['@type'] === 'VideoGame' ? normalizeGameLanguages(data.inLanguage) : [];
  } catch { return []; }
})();
const INVENTORY_DEFAULT_CATEGORY = t("기타");
const INVENTORY_CATEGORY_ALL = '';

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

function formatSaveSlotMeta(
  slot?: Pick<SaveSlotSummary, 'exists' | 'savedAt' | 'chapterIndex' | 'chapterTitle'>,
): string {
  if (!slot?.exists) {
    return t("저장 없음");
  }
  return `${formatSaveChapter(slot)} · ${formatRelativeSaveTime(slot.savedAt)}`;
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

function waitForStartGateLaunchTransition(duration = 500): Promise<void> {
  if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return Promise.resolve();
  }
  return new Promise((resolve) => window.setTimeout(resolve, duration));
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
  const path = rawPath ?? gameContentPath(id);
  const name = normalizeText(value.name) ?? id;
  const seo = normalizeGameListSeoEntry(value.seo, name);
  return {
    id,
    name,
    path,
    author: normalizeText(value.author),
    version: normalizeText(value.version),
    summary: normalizeText(value.summary),
    summaryEn: normalizeText(value.summaryEn),
    thumbnail: normalizeText(value.thumbnail),
    tags: normalizeTags(value.tags),
    tagLabels: normalizeTagLabels(value.tagLabels),
    languages: normalizeGameLanguages(value.languages),
    showcase: normalizeLauncherShowcase(value.showcase),
    legalNotices: normalizeLegalNotices(value.legalNotices),
    chapterCount: normalizeChapterCount(value.chapterCount),
    endingCount: normalizeChapterCount(value.endingCount),
    seo,
  };
}

function normalizeTagLabels(value: unknown): Record<string, string> | undefined {
  if (!isObjectRecord(value)) return undefined;
  const labels = Object.fromEntries(
    Object.entries(value)
      .map(([tag, label]) => [tag, normalizeText(label)] as const)
      .filter((pair): pair is readonly [string, string] => Boolean(pair[1])),
  );
  return Object.keys(labels).length ? labels : undefined;
}

// Tags are stable IDs such as "political-thriller". Korean screens use the game's own label when it
// provides one; otherwise both languages read the ID as words ("Political thriller").
export function launcherTagLabel(tag: string, labels: Record<string, string> | undefined, uiLanguage: string): string {
  const own = uiLanguage === 'en' ? undefined : labels?.[tag];
  if (own) return own;
  const words = tag.replace(/[-_]+/g, ' ').trim();
  return /^[a-z0-9 ]+$/.test(words) ? words.charAt(0).toUpperCase() + words.slice(1) : tag;
}

function parseGameListManifest(raw: unknown): GameListManifest {
  if (!isObjectRecord(raw)) {
    return { games: [] };
  }
  const games = Array.isArray(raw.games)
    ? raw.games
      // An unlisted entry is a fixture, not a work: it ships, it opens by its own address,
      // and the update check still finds its version here, but the library does not offer it.
      .filter((entry) => !(isObjectRecord(entry) && entry.unlisted === true))
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
    ...(INITIAL_GAME_LANGUAGES.length ? { inLanguage: INITIAL_GAME_LANGUAGES } : {}),
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
  // Keyed by the game, so endings found on one language's address are found on the other's.
  const gameKey = parseGameRoute(window.location.pathname)?.id ?? normalizedTitle;
  if (!gameKey) {
    return undefined;
  }
  return `${ENDING_PROGRESS_STORAGE_PREFIX}${gameKey}`;
}

// Library cards show what this browser already holds for a game: a resumable save and found endings.
function readLauncherProgress(entry: GameListManifestEntry): string[] {
  const labels: string[] = [];
  // Mirrors the loader: the newest save is what 이어하기 opens, so an older-version save says so.
  const stored = describeStoredProgressForGame(entry.id, entry.version);
  if (stored.status === 'resume') {
    labels.push(t("이어서 읽을 수 있음"));
  } else if (stored.status === 'older-version') {
    labels.push(uiLanguage === 'en' ? `Save from v${stored.slot?.savedVersion}` : `v${stored.slot?.savedVersion} 기록 있음`);
  }
  if (entry.endingCount) {
    let found = 0;
    try {
      found = parseEndingProgress(localStorage.getItem(`${ENDING_PROGRESS_STORAGE_PREFIX}${entry.id}`)).length;
    } catch {
      found = 0;
    }
    labels.push(uiLanguage === 'en'
      ? `${Math.min(found, entry.endingCount)}/${entry.endingCount} endings found`
      : `결말 ${Math.min(found, entry.endingCount)}/${entry.endingCount} 발견`);
  }
  return labels;
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
    <div className={['legal-notice-list', className].filter(Boolean).join(' ')} aria-label={t("법적 고지")}>
      {notices.map((notice) => (
        <section className="legal-notice" key={notice.id}>
          {/* The heading is a label, not the notice: translate the ones we know, leave the rest. */}
          <h4>{t(notice.title)}</h4>
          <p>{notice.text}</p>
          {notice.copyright && <small>{notice.copyright}</small>}
          {notice.links && notice.links.length > 0 && (
            <nav aria-label={`${t(notice.title)} ${t("관련 링크")}`}>
              {notice.links.map((link, index) => (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  tabIndex={linkTabIndex}
                  key={`${notice.id}-${link.href}-${index}`}
                >
                  {t(link.label)}
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
      const target = event.target instanceof HTMLElement
        ? event.target
        : event.target instanceof Node ? event.target.parentElement : null;
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
  const [entryComplete, setEntryComplete] = useState(sticker.enterEffect === 'none');
  const layoutLockedRef = useRef(false);
  const imageReadyRef = useRef(false);
  const settleTimerRef = useRef<number | null>(null);
  const layoutMotionFrameRef = useRef<number | null>(null);
  const earliestMeasurementAtRef = useRef(0);
  const lockedStageSizeRef = useRef<StickerStageSize | null>(null);
  const previousObstacleRectsRef = useRef<StickerLayoutRect[] | null>(null);
  const placementKey = [sticker.x, sticker.y, sticker.width, sticker.height,
    sticker.anchorX, sticker.anchorY, sticker.rotate].join(':');
  const previousPlacementKeyRef = useRef(placementKey);
  const previousAvoidanceKeyRef = useRef(avoidanceKey);
  const forceFitRef = useRef(false);
  const fillWidth = Boolean(sticker.width && sticker.width !== 'auto');
  const fillHeight = Boolean(sticker.height && sticker.height !== 'auto');
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
        : [...characterElement.querySelectorAll<HTMLImageElement>('.character-art:not(.portrait-pending)')];
      return imageElements.every((imageElement) => imageElement.complete);
    });
    if (!characterImagesReady) {
      return false;
    }

    const characterRects = characterElements
      .flatMap((characterElement) => {
        const painted = [...characterElement.querySelectorAll<HTMLElement>('.character-art:not(.portrait-pending), canvas')];
        return (painted.length ? painted : [characterElement]).map(element => element.getBoundingClientRect());
      })
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
      && !forceFitRef.current
      && isStickerWithinFrame(frameRect, stickerElement.getBoundingClientRect())
      && !doesStickerOverlapRects(stickerElement.getBoundingClientRect(), characterRects)
    ) {
      return true;
    }

    const image = stickerElement.querySelector<HTMLImageElement>('.sticker-art.portrait-current');
    if (!image) return false;
    // Never change the live box to measure an authored pose: forced layout on
    // that box cancels its in-flight CSS transition, even before the next paint.
    const { rect: stickerRect, box: authoredBox } = measureStickerBox(
      frameElement, sticker, image, placementTransform,
    );

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
    forceFitRef.current = false;
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
    const placementChanged = previousPlacementKeyRef.current !== placementKey;
    previousPlacementKeyRef.current = placementKey;
    if (placementChanged) forceFitRef.current = true;
    previousAvoidanceKeyRef.current = avoidanceKey;
    if (layoutLockedRef.current) {
      if (sticker.leaving) return;
      if (avoidanceChanged || placementChanged) {
        // Keep the last painted fit throughout remeasurement. Only the new pose
        // changes; neither visibility nor the entrance animation is restarted.
        earliestMeasurementAtRef.current = performance.now()
          + (placementChanged ? 0 : Math.max(96, Math.ceil(avoidanceSettleMs) + 32));
        previousObstacleRectsRef.current = null;
        scheduleSafeFit(STICKER_LAYOUT_QUIET_MS, true);
      }
      return;
    }
    earliestMeasurementAtRef.current = performance.now()
      + Math.max(96, Math.ceil(avoidanceSettleMs) + 32);
    previousObstacleRectsRef.current = null;
    const imageElement = stickerRef.current?.querySelector<HTMLImageElement>('.sticker-art.portrait-current');
    if (imageElement?.complete) {
      imageReadyRef.current = true;
    }
    scheduleSafeFit();
  }, [avoidanceKey, avoidanceSettleMs, placementKey, scheduleSafeFit, sticker.leaving]);

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
      forceFitRef.current = true;
      previousObstacleRectsRef.current = null;
      earliestMeasurementAtRef.current = performance.now() + STICKER_RESIZE_QUIET_MS;
      scheduleSafeFit(STICKER_RESIZE_QUIET_MS, true);
    });
    observer.observe(stageElement);
    observer.observe(frameElement);
    stageElement.querySelectorAll<HTMLElement>('.char-layer .char').forEach((characterElement) => {
      observer.observe(characterElement);
    });
    return () => observer.disconnect();
  }, [avoidanceKey, scheduleSafeFit, sticker.leaving]);

  const layoutReady = Boolean(safeFit);

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
    forceFitRef.current = true;
    scheduleSafeFit(STICKER_LAYOUT_QUIET_MS, true);
  }, [scheduleSafeFit]);

  return (
    <div
      ref={stickerRef}
      className="sticker"
      data-layout-ready={layoutReady ? 'true' : 'false'}
      data-layout-motion={layoutReady && layoutMotionReady ? 'true' : 'false'}
      data-motion-tempo={stickerLayoutMotionTempo}
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
      <StickerArtwork
        className={[
          'sticker-visual',
          sticker.leaving
            ? `sticker-leave-${sticker.leaveEffect}`
            : entryComplete
              ? ''
              : `sticker-enter-${sticker.enterEffect}`,
        ].filter(Boolean).join(' ')}
        source={sticker.source}
        alt={sticker.id}
        fillWidth={fillWidth}
        fillHeight={fillHeight}
        onReady={markImageReady}
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget && !sticker.leaving) {
            setEntryComplete(true);
          }
        }}
        style={{
          width: fillWidth ? '100%' : undefined,
          height: fillHeight ? '100%' : undefined,
        }}
      />
    </div>
  );
});

// The shared usage-analytics widget floats a preference button that would cover the dialogue
// box during play. The game hides it with CSS and reopens the same choice from settings.
function useUsageChoiceControl() {
  const [available, setAvailable] = useState(
    () => typeof document !== 'undefined' && Boolean(document.getElementById('movv-usage-choice')),
  );
  useEffect(() => {
    const sync = () => setAvailable(Boolean(document.getElementById('movv-usage-choice')));
    sync();
    window.addEventListener('movv-usage-ready', sync);
    return () => window.removeEventListener('movv-usage-ready', sync);
  }, []);
  const open = useCallback(() => {
    document.querySelector<HTMLButtonElement>('#movv-usage-choice .usage-preference')?.click();
  }, []);
  return { available, open };
}

export default function App() {
  const usageChoice = useUsageChoiceControl();
  const routeVars = useVNStore((state) => state.routeVars);
  // Reading text may carry {{variable}} placeholders such as a player-chosen name.
  const fillText = useCallback((text: string) => interpolateText(text, routeVars), [routeVars]);
  useEffect(() => { document.documentElement.lang = uiLanguage; }, []);
  const {
    baseUrl,
    assetOverrides,
    background,
    backgroundPresentation,
    attack,
    stickers,
    characters,
    visibleCharacterIds,
    characterLayoutMode,
    camera,
    dialogSpeaker,
    dialogSpeakerId,
    dialogHasText,
    dialogCameraTargetId,
    dialogChannel,
    dialogSide,
    dialogErase,
    dialogTyping,
    dialogDelivery,
    dialogUiHidden,
    skipReadActive,
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
    characterStances,
    characterMotions,
    placeCaption,
    setDialogUiHidden,
  } = useVNStore(useShallow((state) => ({
    baseUrl: state.baseUrl,
    assetOverrides: state.assetOverrides,
    background: state.background,
    backgroundPresentation: state.backgroundPresentation,
    attack: state.attack,
    stickers: state.stickers,
    characters: state.characters,
    visibleCharacterIds: state.visibleCharacterIds,
    characterLayoutMode: state.game?.scenes[state.currentSceneId]?.layout ?? 'auto',
    camera: state.camera,
    dialogSpeaker: state.dialog.speaker,
    dialogSpeakerId: state.dialog.speakerId,
    dialogHasText: Boolean(state.dialog.fullText),
    dialogCameraTargetId: state.dialog.cameraTargetId,
    dialogChannel: state.dialog.channel,
    dialogSide: state.dialog.side,
    dialogErase: state.dialog.erase,
    dialogTyping: state.dialog.typing,
    dialogDelivery: state.dialog.delivery,
    dialogUiHidden: state.dialogUiHidden,
    skipReadActive: state.skipReadActive,
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
    characterStances: state.characterStances,
    characterMotions: state.characterMotions,
    placeCaption: state.placeCaption,
    setDialogUiHidden: state.setDialogUiHidden,
  })));
  // A phone conversation reads as a conversation only if the lines before it are still there.
  const phoneThread = useMemo(
    () => (dialogChannel === 'message' ? selectPhoneThread(storyLog) : []),
    [dialogChannel, storyLog],
  );
  // Whose phone screen this is: the last person who wrote in, so the header names the
  // other end of the conversation rather than whoever happens to be speaking right now.
  const phoneContact = useMemo(
    () => (dialogChannel === 'message'
      ? selectPhoneContact(phoneThread, { speaker: dialogSpeaker, side: dialogSide })
      : undefined),
    [dialogChannel, phoneThread, dialogSide, dialogSpeaker],
  );

  const [bootMode, setBootMode] = useState<BootMode>(
    () => resolveInitialBootPresentation(window.location.pathname).bootMode,
  );
  const [gameBootPending, setGameBootPending] = useState(
    () => resolveInitialBootPresentation(window.location.pathname).gameBootPending,
  );
  const [gameList, setGameList] = useState<GameListManifestEntry[]>([]);
  const [gameListLoading, setGameListLoading] = useState(false);
  const [gameListError, setGameListError] = useState<string | null>(null);
  const [manifestSeo, setManifestSeo] = useState<GameListManifestSeo | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeLanguage, setActiveLanguage] = useState('');
  const [activeTag, setActiveTag] = useState(ALL_TAG_FILTER);
  const [showAllLauncherTags, setShowAllLauncherTags] = useState(false);
  const [launcherShareNotice, setLauncherShareNotice] = useState('');
  const [uploading, setUploading] = useState(false);
  const [startGate, setStartGate] = useState<StartGateState | null>(null);
  const [startGateLaunching, setStartGateLaunching] = useState(false);
  const [startGateRevealing, setStartGateRevealing] = useState(false);
  const [startGateError, setStartGateError] = useState<string>();
  const [documentHidden, setDocumentHidden] = useState(() => document.hidden);
  const [startGateAudioPlaying, setStartGateAudioPlaying] = useState(false);
  const startGateLaunchLockRef = useRef(false);
  const [inputAnswer, setInputAnswer] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [caseFileTab, setCaseFileTab] = useState<'log' | 'inventory' | 'system'>('log');
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<string | null>(null);
  const [inventoryDetailOpen, setInventoryDetailOpen] = useState(false);
  const [inspectedInventoryIds, setInspectedInventoryIds] = useState<ReadonlySet<string>>(() => new Set());
  const [textScale, setTextScale] = useState<TextScale>(readTextScale);
  const [systemReducedMotion, setSystemReducedMotion] = useState(
    () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
  );
  const [inventoryView, setInventoryView] = useState<InventoryViewPreference>(() => getInventoryUiSettings().view);
  const [inventorySort, setInventorySort] = useState<InventorySortPreference>(() => getInventoryUiSettings().sort);
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState<string>(() => getInventoryUiSettings().category);
  const [inventorySearchTerm, setInventorySearchTerm] = useState('');
  const [bgmEnabled, setBgmEnabledState] = useState(() => getBgmEnabled());
  // Save cards ask before overwriting, deleting or opening an older-version save.
  const [slotIntent, setSlotIntent] = useState<SlotIntent>();
  // A backup file waits here until the player picks the slot it goes into.
  const [importDraft, setImportDraft] = useState<{ raw: string; summary: SaveSlotSummary }>();
  // Direct boot (no start screen) found an older-version save and asks before loading it.
  const [versionGate, setVersionGate] = useState<{ gameUrl: string; title?: string; status: StoredProgressStatus; uiTemplate?: UiTemplateId }>();
  const [updateBusy, setUpdateBusy] = useState(false);
  const resumeNotice = useVNStore((state) => state.resumeNotice);
  const storyWaiting = useVNStore((state) => state.waitingInput);
  const updateGameId = readGameIdFromPath(window.location.pathname);
  const updateWatch = useUpdateWatch({ gameId: updateGameId, contentVersion: game?.meta.version });
  // Offline: the launcher reads which games are saved and greys out the rest.
  const siteReachable = useReachable();
  const launcherGameIds = useMemo(() => (bootMode === 'launcher' ? gameList.map((entry) => entry.id) : []), [bootMode, gameList]);
  const offlinePacks = useOfflinePacks(launcherGameIds, siteReachable);
  // Never cut into a line while it types: wait for a choice, an input, a finished line or an outcome.
  const updateNoticeIdle = !game
    || (!dialogTyping && !chapterLoading && (storyWaiting || choiceGate.active || inputGate.active || Boolean(gameOver) || isFinished));
  const reloadForUpdate = useCallback((intent: 'fresh' | 'continue') => {
    setUpdateBusy(true);
    if (intent === 'continue') flushAutosave();
    if (updateGameId) setBootIntent(updateGameId, intent);
    // A waiting service worker takes over first, so the reload boots the new build.
    void reloadIntoNewBuild();
  }, [updateGameId]);
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
  const inventoryDetailTriggerRef = useRef<HTMLButtonElement | null>(null);
  const saveImportRef = useRef<HTMLInputElement | null>(null);
  const gameOverImportRef = useRef<HTMLInputElement | null>(null);
  const youtubeIframeRef = useRef<HTMLIFrameElement | null>(null);
  const nativeVideoRef = useRef<HTMLVideoElement | null>(null);
  const inputFieldRef = useRef<HTMLInputElement | null>(null);
  const choiceOptionButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const stageContentFrameRef = useRef<HTMLDivElement | null>(null);
  const dialogBoxRef = useRef<HTMLDivElement | null>(null);
  const previousPresentedVisibleCharacterIdsRef = useRef<ReadonlySet<string>>(new Set());
  const gameListRequestIdRef = useRef(0);
  const [launcherCarouselRef, launcherCarouselApi] = useEmblaCarousel(LAUNCHER_CAROUSEL_OPTIONS);
  const launcherTagFilterRef = useRef<HTMLDivElement | null>(null);
  const launcherCarouselPositionedRef = useRef(false);
  const launcherShareNoticeTimerRef = useRef<number | null>(null);
  const launcherShareGameIdRef = useRef<string | null>(null);
  const uploadedGameFileRef = useRef<File | null>(null);
  const [endingCreditsOpen, setEndingCreditsOpen] = useState(false);
  const [gameOverRecoveryOpen, setGameOverRecoveryOpen] = useState(false);
  const [storyMapOpen, setStoryMapOpen] = useState(false);
  const usageScreen = settingsOpen ? ({log:'history',inventory:'inventory',system:'settings'} as const)[caseFileTab] : storyMapOpen ? 'story_map' : endingCreditsOpen ? 'ending' : startGate ? 'game_start' : game ? (isFinished ? 'ending' : 'play') : (uiLanguage === 'en' ? 'launcher_en' : 'launcher');
  const lastUsageScreen = useRef(uiLanguage === 'en' ? 'launcher_en' : 'launcher');
  // While a story is playing, the HUD and dialogue controls recede after a short stillness so the
  // scene fills the screen. Any pointer, touch or key brings them straight back.
  const [hudIdle, setHudIdle] = useState(false);
  const hudIdleActive = usageScreen === 'play';
  useEffect(() => {
    if (!hudIdleActive) {
      setHudIdle(false);
      return;
    }
    let timer = window.setTimeout(() => setHudIdle(true), HUD_IDLE_DELAY_MS);
    const wake = () => {
      setHudIdle(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setHudIdle(true), HUD_IDLE_DELAY_MS);
    };
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'focusin'] as const;
    for (const name of events) window.addEventListener(name, wake, { passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const name of events) window.removeEventListener(name, wake);
    };
  }, [hudIdleActive]);
  useEffect(() => {
    const sync = () => { if (lastUsageScreen.current !== usageScreen && window.movvUsage) { window.movvUsage.screen(usageScreen); lastUsageScreen.current = usageScreen; } };
    sync(); window.addEventListener('movv-usage-ready', sync);
    return () => window.removeEventListener('movv-usage-ready', sync);
  }, [usageScreen]);
  const [seenEndingIds, setSeenEndingIds] = useState<string[]>([]);
  const [stickerSafeInset, setStickerSafeInset] = useState(0);
  const [characterPromptInset, setCharacterPromptInset] = useState(0);
  const [characterPromptFitInset, setCharacterPromptFitInset] = useState(0);
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
    backgroundPresentation.duration,
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
  const leavingCharacterPlacementRef = useRef<Map<string, CharacterStageRenderPlacement>>(new Map());
  const queuedManualAdvanceAtRef = useRef<number | null>(null);
  const recoveredChoiceWasPresentedRef = useRef(false);
  const youtubePlayerId = 'vn-cutscene-youtube-player';
  // const sampleZipUrl = '/sample.zip';
  const repositoryUrl = 'https://github.com/uiwwsw/yavn';
  const developmentGuideUrl = `${repositoryUrl}/blob/main/docs/DEVELOPMENT_GUIDE.${uiLanguage}.md`;
  const shareByPrUrl = 'https://github.com/uiwwsw/yavn/compare';
  const isDialogHiddenBySystem = videoCutscene.active || chapterLoading || Boolean(gameOver) || isFinished || Boolean(attack) || !game;
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
    setStartGateAudioPlaying(false);
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
      setManifestSeo(null);
      setSelectedGameId(null);
      launcherCarouselPositionedRef.current = false;
      setGameListError(error instanceof Error ? error.message : t("게임 목록을 불러오지 못했습니다."));
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
      const gameRoute = parseGameRoute(pathname);
      if (gameRoute) {
        const gameId = gameRoute.id;
        const gameUrl = gameContentPath(gameId);
        const sessionKey = resolveStartGateSessionKey(gameId);
        setBootMode('gameList');
        // A reload the player asked for from the update notice: no start screen, no second question.
        const bootIntent = consumeBootIntent(gameId);
        if (bootIntent) {
          try {
            await loadGameFromUrl(gameUrl, { resumeFromSave: bootIntent === 'continue' });
          } finally {
            if (!cancelled) setGameBootPending(false);
          }
          return;
        }
        let preview: StartScreenPreview | undefined;
        if (!hasStartGateSessionFlag(sessionKey)) {
          try {
            preview = await loadUrlStartScreenPreview(gameUrl);
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
                eyebrow: preview.startScreen.eyebrow,
                subtitle: preview.startScreen.subtitle,
                scene: mapStartSceneAssets(preview.startScreen.scene, (path) => resolveStartGateAssetUrl(path, baseUrl) ?? path),
                showLoadButton: preview.hasLoadableSave,
                saveStatus: preview.saveStatus,
                gameVersion: preview.gameVersion,
                legalNotices: preview.legalNotices,
              });
              return;
            }
          } catch {
            // Ignore preview failures and continue with direct runtime loading.
          }
        }
        // No start screen to explain it, so ask here before resuming an older-version save.
        try {
          preview ??= await loadUrlStartScreenPreview(gameUrl);
        } catch {
          preview = undefined;
        }
        if (cancelled) return;
        if (preview?.saveStatus.status === 'older-version') {
          setVersionGate({ gameUrl, title: preview.gameTitle, status: preview.saveStatus, uiTemplate: preview.uiTemplate });
          setGameBootPending(false);
          return;
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
      if (startGate?.kind === 'zip') {
        collectStartSceneAssets(startGate.scene).filter((url) => url.startsWith('blob:')).forEach((url) => URL.revokeObjectURL(url));
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
    const onPlay = () => setStartGateAudioPlaying(true);
    const onPause = () => setStartGateAudioPlaying(false);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    void audio.play().catch(() => undefined);
    return () => {
      audio.pause();
      audio.src = '';
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      if (startGateAudioRef.current === audio) {
        startGateAudioRef.current = null;
      }
    };
  }, [bgmEnabled, startGate, stopStartGateMusic]);

  useEffect(() => {
    if (!startGateLaunching) return;
    const audio = startGateAudioRef.current;
    if (!audio) return;
    const duration = (startGate?.scene ?? DEFAULT_START_SCENE).transition.duration / 2;
    const initialVolume = audio.volume;
    const started = performance.now();
    let frame = 0;
    const fade = () => {
      const progress = Math.min(1, (performance.now() - started) / duration);
      audio.volume = initialVolume * (1 - progress);
      if (progress < 1) frame = requestAnimationFrame(fade);
      else audio.pause();
    };
    frame = requestAnimationFrame(fade);
    return () => { cancelAnimationFrame(frame); audio.volume = initialVolume; };
  }, [startGateLaunching, startGate]);

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

  const chapterCurtainVisible = useSceneCurtain(chapterLoading && !startGate);
  const playbackCovered = Boolean(startGate) || chapterCurtainVisible || documentHidden || storyMapOpen;

  const handleManualAdvance = useCallback(() => {
    const current = useVNStore.getState();
    if (playbackCovered || startGateLaunchLockRef.current || current.attack) {
      queuedManualAdvanceAtRef.current = null;
      return;
    }
    const nextTempo = registerManualAdvance();
    if (current.busy && nextTempo === 'catch-up') {
      // Do not discard deliberate repeated input during a short authored lock.
      // Keep only one request so a held key cannot race through several lines.
      queuedManualAdvanceAtRef.current = performance.now();
      return;
    }
    queuedManualAdvanceAtRef.current = null;
    handleAdvance();
  }, [playbackCovered, registerManualAdvance]);

  useEffect(() => {
    if (attack || startGateLaunching || chapterCurtainVisible) queuedManualAdvanceAtRef.current = null;
  }, [attack?.revision, startGateLaunching, chapterCurtainVisible]);

  useEffect(() => {
    if (busy || queuedManualAdvanceAtRef.current === null) {
      return;
    }
    const queuedAt = queuedManualAdvanceAtRef.current;
    queuedManualAdvanceAtRef.current = null;
    if (
      !isQueuedManualAdvanceFresh(queuedAt, performance.now())
      || settingsOpen
      || storyMapOpen
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
    storyMapOpen,
    sustainCatchUp,
    videoCutscene.active,
  ]);

  useAdvanceByKey(dialogUiHidden || settingsOpen || storyMapOpen || Boolean(gameOver), handleManualAdvance);

  useEffect(() => {
    const preventDefault = (event: Event) => {
      const target = event.target instanceof HTMLElement
        ? event.target
        : event.target instanceof Node ? event.target.parentElement : null;
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
    setPlayerAutoPlayPaused(storyMapOpen || settingsOpen || dialogUiHidden || Boolean(startGate) || chapterCurtainVisible);
  }, [dialogUiHidden, settingsOpen, storyMapOpen, startGate, chapterCurtainVisible]);

  useEffect(() => {
    const update = () => {
      setDocumentHidden(document.hidden);
      setScenePresentationPaused(Boolean(startGate) || chapterCurtainVisible || settingsOpen || storyMapOpen || document.hidden);
    };
    update();
    document.addEventListener('visibilitychange', update);
    return () => { document.removeEventListener('visibilitychange', update); setScenePresentationPaused(false); };
  }, [startGate, chapterCurtainVisible, settingsOpen, storyMapOpen]);

  useEffect(() => {
    setSaveNotice('');
    setSaveSlots(getSaveSlotSummaries());
  }, [gameOver, chapterIndex]);

  useEffect(() => {
    if (!game) {
      setSettingsOpen(false);
    }
  }, [game]);

  const launcherTagLabels = useMemo(
    () => Object.assign({}, ...gameList.map((entry) => entry.tagLabels ?? {})) as Record<string, string>,
    [gameList],
  );

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

  const normalizedSearchTerm = searchTerm.normalize('NFKC').trim().toLowerCase();
  const filteredGames = useMemo(() => {
    return gameList.filter((entry) => {
      if (activeLanguage && !entry.languages.includes(activeLanguage)) return false;
      const matchesTag = activeTag === ALL_TAG_FILTER || entry.tags.includes(activeTag);
      if (!matchesTag) {
        return false;
      }
      if (!normalizedSearchTerm) {
        return true;
      }
      return matchesStorySearch([
        entry.id,
        entry.name,
        entry.path,
        entry.author ?? '',
        entry.summary ?? '',
        entry.summaryEn ?? '',
        entry.tags.join(' '),
        Object.values(entry.tagLabels ?? {}).join(' '),
        entry.languages.map(code => `${code} ${languageLabel(code)}`).join(' '),
      ], normalizedSearchTerm);
    });
  }, [activeTag, activeLanguage, gameList, normalizedSearchTerm]);

  const selectedGame =
    gameList.find((entry) => entry.id === selectedGameId) ??
    gameList[0] ??
    null;
  const selectedGameIndex = selectedGame
    ? gameList.findIndex((entry) => entry.id === selectedGame.id)
    : -1;

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
    setLauncherShareNotice(copied ? t("링크를 복사했습니다.") : t("링크 복사에 실패했습니다."));
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
    const jumpImmediately = jump || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    launcherCarouselApi.scrollTo(nextIndex, jumpImmediately);
    // An instant jump has no running animation to emit a settle event.
    if (jumpImmediately) {
      setSelectedGameId(gameList[nextIndex]?.id ?? null);
    }
  }, [clearLauncherDeepLinkFromAddress, gameList, launcherCarouselApi]);

  const moveLauncherCarousel = useCallback((direction: -1 | 1) => {
    if (!launcherCarouselApi) {
      return;
    }
    clearLauncherDeepLinkFromAddress();
    const jumpImmediately = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (direction < 0) {
      launcherCarouselApi.scrollPrev(jumpImmediately);
    } else {
      launcherCarouselApi.scrollNext(jumpImmediately);
    }
    if (jumpImmediately) {
      setSelectedGameId(gameList[launcherCarouselApi.selectedScrollSnap()]?.id ?? null);
    }
  }, [clearLauncherDeepLinkFromAddress, gameList, launcherCarouselApi]);

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
      document.documentElement.lang = uiLanguage;
      setMetaTagByProperty('og:locale', uiLanguage === 'en' ? 'en_US' : 'ko_KR');
      const launcherImage =
        resolveAbsoluteSeoUrl(selectedGame?.seo?.image ?? selectedGame?.thumbnail) ?? DEFAULT_SEO_IMAGE;
      const launcherImageAlt =
        selectedGame?.seo?.imageAlt ?? (selectedGame ? `${selectedGame.name} 대표 이미지` : DEFAULT_SEO_IMAGE_ALT);
      applySeoMetadata({
        title: DEFAULT_SEO_TITLE,
        description: DEFAULT_SEO_DESCRIPTION,
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
          ? new URL(new URL(startGate.gameUrl, window.location.origin).pathname, window.location.origin).toString()
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
      const gameCanonicalUrl = `${window.location.origin}${window.location.pathname}`;
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
  const endingTitle = resolvedEnding?.title ? fillText(resolvedEnding.title) : 'THE END';
  const endingMessage = resolvedEnding?.message ? fillText(resolvedEnding.message) : t("게임이 종료되었습니다.");
  const endingBackgroundUrl = resolveRuntimeAssetUrl(
    (resolvedEnding?.background ? game?.assets.backgrounds[resolvedEnding.background] : undefined) ?? game?.endingScreen?.image,
    baseUrl, assetOverrides,
  );
  const totalEndingCount = Object.keys(game?.endings ?? {}).length;
  const seenEndingIdsInCurrentGame = seenEndingIds.filter((endingId) => Boolean(game?.endings?.[endingId]));
  const seenEndingCount = seenEndingIdsInCurrentGame.length;
  const endingCompletionPercent = totalEndingCount > 0 ? Math.round((seenEndingCount / totalEndingCount) * 100) : 0;
  const endingCollectionDone = totalEndingCount > 0 && seenEndingCount >= totalEndingCount;
  const inputSubmitLabel = inputAnswer.trim().length > 0 ? t("확인") : t("모르겠다");
  const saveSlotByKind = useMemo(
    () => new Map(saveSlots.map((slot) => [slot.slot, slot])),
    [saveSlots],
  );
  const autoRecoverySlot = saveSlotByKind.get('auto');
  const manualSaveSlots = MANUAL_SAVE_SLOTS.map((slot) => saveSlotByKind.get(slot) ?? { slot, exists: false });
  // The game-over shortcut returns to the most recent manual save across all slots.
  const manualSaveSlot = manualSaveSlots
    .filter((slot) => slot.exists)
    .sort((a, b) => (Date.parse(b.savedAt ?? '') || 0) - (Date.parse(a.savedAt ?? '') || 0))[0];
  const chapterSaveSlot = saveSlotByKind.get('chapter');
  const choiceRecoveryPoint = getChoiceRecoverySummary();
  // Backup import, step 2: the player picks which manual slot receives the file.
  const renderImportPicker = () => importDraft && (
      <div className="vs-import-picker" role="group" aria-label={t("백업을 넣을 칸")}>
        <p>{t("백업 기록")}: <SaveSlotMeta slot={importDraft.summary} /></p>
        {importDraft.summary.versionMismatch && (
          <p className="vs-older-save-note">{olderVersionMessage(importDraft.summary.savedVersion)}</p>
        )}
        <ol>
          {manualSaveSlots.map((slot, index) => (
            <li key={slot.slot}>
              <button type="button" onClick={() => void onConfirmImport(slot.slot as ManualSaveSlot)} disabled={saveBusy}>
                <b>{uiLanguage === 'en' ? `Into slot ${index + 1}` : `${index + 1}번 칸에 넣기`}</b>
                <small>{slot.exists
                  ? (uiLanguage === 'en' ? `Replaces ${formatSaveSlotMeta(slot)}` : `${formatSaveSlotMeta(slot)} 기록을 덮어써요`)
                  : t("빈 칸")}</small>
              </button>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => { setImportDraft(undefined); setSaveNotice(''); }}>{t("취소")}</button>
      </div>
  );
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
  const inspectableInventoryEntries = inventoryVisibleEntries.filter((entry) => entry.owned);
  const selectedInventoryPosition = selectedInventoryEntry
    ? inspectableInventoryEntries.findIndex((entry) => entry.id === selectedInventoryEntry.id)
    : -1;
  const newInventoryCount = inventoryCatalogEntries.filter(
    (entry) => entry.owned && !inspectedInventoryIds.has(entry.id),
  ).length;
  useEffect(() => {
    setInspectedInventoryIds(readInspectedInventory(game?.meta.title));
  }, [game?.meta.title]);
  useEffect(() => {
    const title = game?.meta.title;
    if (!inventoryDetailOpen || !selectedInventoryItemId || !title) return;
    setInspectedInventoryIds((previous) => {
      if (previous.has(selectedInventoryItemId)) return previous;
      const next = new Set(previous).add(selectedInventoryItemId);
      try {
        localStorage.setItem(`${INVENTORY_INSPECTED_STORAGE_PREFIX}${title}`, JSON.stringify([...next]));
      } catch {
        // Storage can be full or blocked; the new marker then clears for this session only.
      }
      return next;
    });
  }, [game?.meta.title, inventoryDetailOpen, selectedInventoryItemId]);
  useEffect(() => {
    try {
      localStorage.setItem(TEXT_SCALE_STORAGE_KEY, textScale);
    } catch {
      // Keep the in-memory choice when storage is unavailable.
    }
  }, [textScale]);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const update = () => setSystemReducedMotion(query.matches);
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  const inventoryFiltersActive = normalizedInventorySearchTerm.length > 0 || inventoryCategoryFilter.length > 0;
  // Search and sorting only earn their space once the list is long enough to need them.
  const showInventoryTools = inventoryViewEntries.length > 6 || inventoryFiltersActive;
  const inventoryGridEmptyMessage = useMemo(() => {
    if (inventoryCatalogEntries.length === 0) {
      return t("이 게임에는 등록된 단서가 없습니다.");
    }
    if (inventoryViewEntries.length === 0) {
      return t("아직 획득한 단서가 없습니다.");
    }
    if (inventoryVisibleEntries.length === 0) {
      return t("검색 조건에 맞는 단서가 없습니다.");
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
  const characterStageLayout = useMemo(
    () => resolveCharacterStageLayout(
      layoutCharactersByPosition.map((entry) => ({
        id: entry.slot.id,
        position: entry.position,
      })),
      undefined,
      characterLayoutMode,
    ),
    [layoutCharactersByPosition, characterLayoutMode],
  );
  const visibleCharacterCount = visibleCharactersByPosition.length;
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
  const stageCastKey = stagedCharactersByPosition.map(({ position, slot }) => `${position}:${slot.id}`).join('|');
  const previousLayoutCastKey = useRef(stageCastKey);
  const previousLayoutMode = useRef(characterLayoutMode);
  useLayoutEffect(() => {
    const castChanged = previousLayoutCastKey.current !== stageCastKey
      || previousLayoutMode.current !== characterLayoutMode;
    if (characterVisibilityFrameRef.current !== null) {
      window.cancelAnimationFrame(characterVisibilityFrameRef.current);
      characterVisibilityFrameRef.current = null;
    }
    if (haveSameCharacterIds(presentedVisibleCharacterIds, visibleCharacterIds) && !castChanged) {
      return;
    }
    const nextVisibleCharacterIds = [...visibleCharacterIds];
    if (chapterLoading) {
      previousLayoutCastKey.current = stageCastKey;
      previousLayoutMode.current = characterLayoutMode;
      leavingCharacterPlacementRef.current.clear();
      setLayoutVisibleCharacterIds(nextVisibleCharacterIds);
      setPresentedVisibleCharacterIds(nextVisibleCharacterIds);
      return;
    }

    characterVisibilityFrameRef.current = window.requestAnimationFrame(() => {
      characterVisibilityFrameRef.current = null;
      const nextVisibleCharacterSet = new Set(nextVisibleCharacterIds);
      const nextLeavingPlacements = new Map(leavingCharacterPlacementRef.current);
      const stagedCharacterIds = new Set(
        stagedCharactersByPosition.map(({ slot }) => slot.id),
      );

      nextLeavingPlacements.forEach((_, characterId) => {
        if (!stagedCharacterIds.has(characterId)) {
          nextLeavingPlacements.delete(characterId);
        }
      });
      nextVisibleCharacterIds.forEach((characterId) => {
        nextLeavingPlacements.delete(characterId);
      });
      stagedCharactersByPosition.forEach(({ position, slot }) => {
        if (
          presentedVisibleCharacterIds.includes(slot.id)
          && !nextVisibleCharacterSet.has(slot.id)
        ) {
          nextLeavingPlacements.set(
            slot.id,
            resolveCharacterStageRenderPlacement(
              position,
              characterStageLayout,
              characterStageSpacing,
              slot.facing,
            ),
          );
        }
      });
      leavingCharacterPlacementRef.current = nextLeavingPlacements;

      // DOM lifetime and composition are independent. Departing actors keep
      // their snapshot while the surviving cast glides to the new arrangement.
      previousLayoutCastKey.current = stageCastKey;
      previousLayoutMode.current = characterLayoutMode;
      setLayoutVisibleCharacterIds(previous => resolveLayoutCharacterIds(
        previous, nextVisibleCharacterIds, [...stagedCharacterIds],
      ));
      setPresentedVisibleCharacterIds(nextVisibleCharacterIds);
    });

    return () => {
      if (characterVisibilityFrameRef.current !== null) {
        window.cancelAnimationFrame(characterVisibilityFrameRef.current);
        characterVisibilityFrameRef.current = null;
      }
    };
  }, [
    characterLayoutMode,
    stageCastKey,
    chapterLoading,
    characterStageLayout,
    characterStageSpacing,
    presentedVisibleCharacterIds,
    stagedCharactersByPosition,
    visibleCharacterIds,
  ]);
  const cameraPresentation = useMemo(
    () => resolveStageCameraPresentation(
      camera,
      layoutCharactersByPosition.length,
      cameraTargetPosition,
      characterStageLayout,
      characterStageSpacing,
    ),
    [
      camera,
      cameraTargetPosition,
      characterStageLayout,
      characterStageSpacing,
      layoutCharactersByPosition,
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
  const firstCastEntrance = visibleCharacterCount > 0 && previousPresentedVisibleCharacterIdsRef.current.size === 0;
  const cameraTransitionTiming = useMemo(() => {
    if (firstCastEntrance) return { cameraDelay: 0, cameraDuration: 0, characterExitDuration: 0 };
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
  }, [authoredCameraTransitionTiming, cameraMotionTempo, cameraPresentation.duration, firstCastEntrance]);
  const focusCharacterId = (cameraPresentation.shot === 'close' || cameraPresentation.shot === 'reaction') && effectiveCameraTargetId
    ? effectiveCameraTargetId
    : dialogSpeakerId;
  const focusedCharacterPlacement = stagedCharactersByPosition.find(
    (entry) => entry.slot.id === focusCharacterId,
  )?.slot.placement;
  const stageBottomLayerZIndex = focusedCharacterPlacement === 'prompt-top' ? 2 : 3;
  const promptTopLayerZIndex = focusedCharacterPlacement === 'stage-bottom' ? 2 : 3;
  const cameraStyle = useMemo(() => ({
    '--prompt-camera-fit-scale': PROMPT_CAMERA_FIT_SCALE,
    '--prompt-camera-fit-scale-mobile': MOBILE_PROMPT_CAMERA_FIT_SCALE,
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
    if (!inventoryDetailOpen && settingsOpen) inventoryDetailTriggerRef.current?.focus({ preventScroll: true });
  }, [inventoryDetailOpen]);

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

  const onManualSave = useCallback((slot: ManualSaveSlot = 'manual') => {
    setSlotIntent(undefined);
    const result = saveCurrentProgress(slot);
    setSaveNotice(result.exists ? t("지금 장면을 저장했어요.") : t("이 장면에서는 저장할 수 없어요."));
    refreshSaveSlots();
  }, [refreshSaveSlots]);

  const onDeleteSave = useCallback((slot: ManualSaveSlot) => {
    setSlotIntent(undefined);
    setSaveNotice(deleteSaveSlot(slot) ? t("저장을 지웠어요.") : t("저장을 지우지 못했어요."));
    refreshSaveSlots();
  }, [refreshSaveSlots]);

  const onLoadSave = useCallback(
    async (slot: SaveSlotKind | 'latest') => {
      setSlotIntent(undefined);
      setSaveBusy(true);
      setSaveNotice(t("저장 데이터를 불러오는 중입니다."));
      try {
        const loaded = await loadSaveSlot(slot);
        if (!loaded) {
          setSaveNotice(t("불러올 수 있는 저장 데이터가 없습니다."));
          return;
        }
        setRecoveredFailedChoice(undefined);
        setSaveNotice(t("저장한 장면으로 돌아왔습니다."));
        closeSettingsModal(false);
      } catch (error) {
        setSaveNotice(error instanceof Error ? error.message : t("저장 데이터를 불러오지 못했습니다."));
      } finally {
        setSaveBusy(false);
        refreshSaveSlots();
      }
    },
    [closeSettingsModal, refreshSaveSlots],
  );

  const onLoadLastChoice = useCallback(async () => {
    setSaveBusy(true);
    setSaveNotice(t("선택 복구점으로 돌아가는 중입니다."));
    const recoveryPoint = getChoiceRecoverySummary();
    try {
      const loaded = await loadChoiceRecovery();
      if (!loaded) {
        setSaveNotice(t("되돌아갈 선택 복구점을 찾지 못했습니다."));
        return;
      }
      setRecoveredFailedChoice(recoveryPoint.failedChoice);
      setSaveNotice(t("선택 복구점으로 돌아왔습니다."));
      closeSettingsModal(false);
    } catch (error) {
      setSaveNotice(error instanceof Error ? error.message : t("선택 복구점으로 돌아가지 못했습니다."));
    } finally {
      setSaveBusy(false);
      refreshSaveSlots();
    }
  }, [closeSettingsModal, refreshSaveSlots]);

  const onRestartChapter = useCallback(async () => {
    setSaveBusy(true);
    setSaveNotice(t("챕터 시작점으로 돌아가는 중입니다."));
    const recoveryPoint = getChoiceRecoverySummary();
    try {
      const loaded = await restartCurrentChapter();
      if (!loaded) {
        setSaveNotice(t("이 챕터의 시작 저장점을 찾지 못했습니다."));
        return;
      }
      setRecoveredFailedChoice(recoveryPoint.failedChoice);
      closeSettingsModal(false);
    } catch (error) {
      setSaveNotice(error instanceof Error ? error.message : t("챕터 시작점으로 돌아가지 못했습니다."));
    } finally {
      setSaveBusy(false);
      refreshSaveSlots();
    }
  }, [closeSettingsModal, refreshSaveSlots]);

  // Game over: go straight back to the choice that caused it (its recoverToChoice target,
  // else the latest choice), with the state from before that choice.
  const onReturnToCausingChoice = useCallback(async () => {
    if (getChoiceRecoverySummary().exists) {
      await onLoadLastChoice();
      return;
    }
    if (getSaveSlotSummaries().find((slot) => slot.slot === 'chapter')?.exists) {
      await onRestartChapter();
      return;
    }
    await onLoadSave('auto');
  }, [onLoadLastChoice, onLoadSave, onRestartChapter]);

  const onExportSave = useCallback(() => {
    const backup = exportSaveBackup();
    if (!backup) {
      setSaveNotice(t("내보낼 진행 데이터가 없습니다."));
      return;
    }
    const blobUrl = URL.createObjectURL(new Blob([backup.content], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = backup.filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
    setSaveNotice(t("저장 백업 파일을 내보냈습니다."));
    refreshSaveSlots();
  }, [refreshSaveSlots]);

  // Step 1: read and check the file. Nothing is written until the player picks a slot.
  const onImportSave = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) {
        return;
      }
      try {
        const raw = await file.text();
        setImportDraft({ raw, summary: readSaveBackup(raw) });
        setSaveNotice(t("백업을 넣을 칸을 골라 주세요."));
      } catch (error) {
        setImportDraft(undefined);
        setSaveNotice(error instanceof Error ? error.message : t("저장 파일을 불러오지 못했습니다."));
      }
    },
    [],
  );

  // Step 2: write the backup into the chosen slot, then open it.
  const onConfirmImport = useCallback(
    async (slot: ManualSaveSlot) => {
      if (!importDraft) return;
      setSaveBusy(true);
      try {
        importSaveBackup(importDraft.raw, slot);
        setImportDraft(undefined);
        refreshSaveSlots();
        const loaded = await loadSaveSlot(slot);
        setSaveNotice(loaded ? t("백업 저장을 불러왔습니다.") : t("백업을 저장했지만 현재 장면을 열지 못했습니다."));
        if (loaded) {
          setRecoveredFailedChoice(undefined);
          setGameOverRecoveryOpen(false);
          closeSettingsModal(false);
        }
      } catch (error) {
        setSaveNotice(error instanceof Error ? error.message : t("저장 파일을 불러오지 못했습니다."));
      } finally {
        setSaveBusy(false);
      }
    },
    [closeSettingsModal, importDraft, refreshSaveSlots],
  );

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        window.clearInterval(holdTimerRef.current);
        holdTimerRef.current = undefined;
      }
    };
  }, []);

  useEffect(() => {
    setEndingCreditsOpen(false);
  }, [isFinished, resolvedEndingId]);
  useEffect(() => {
    setGameOverRecoveryOpen(false);
  }, [gameOver]);

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

  useEffect(() => {
    if (!inputGate.active) {
      setInputAnswer('');
      return;
    }
    if (skipInputAutoFocus || playbackCovered) {
      return;
    }
    const rafId = window.requestAnimationFrame(() => {
      inputFieldRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [inputGate.active, skipInputAutoFocus, playbackCovered]);

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
    const answer = inputGate.correct?.trim() ?? '';
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
    if (playbackCovered || !choiceGate.active || choiceGate.options.length === 0) {
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
  }, [choiceGate.active, choiceGate.key, choiceGate.options.length, recoveredFailedChoiceIndex, playbackCovered]);

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
    if (playbackCovered || !video || video.ended) {
      return;
    }
    video.muted = true;
    void video.play().catch(() => {
      // Ignore autoplay-policy failures.
    });
  }, [playbackCovered]);

  const resumeVideoCutscenePlayback = useCallback(() => {
    if (playbackCovered || !videoCutscene.active) {
      return;
    }
    if (videoCutscene.youtubeId) {
      postYouTubeCommand('mute');
      postYouTubeCommand('playVideo');
      return;
    }
    resumeNativeCutsceneVideo();
  }, [postYouTubeCommand, resumeNativeCutsceneVideo, videoCutscene.active, videoCutscene.youtubeId, playbackCovered]);

  useEffect(() => {
    if (!videoCutscene.active) return;
    if (playbackCovered) { nativeVideoRef.current?.pause(); postYouTubeCommand('pauseVideo'); }
    else resumeVideoCutscenePlayback();
  }, [playbackCovered, videoCutscene.active, postYouTubeCommand, resumeVideoCutscenePlayback]);

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
      if (payload.info === 2 && !playbackCovered && document.visibilityState === 'visible') {
        postYouTubeCommand('playVideo');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [postYouTubeCommand, videoCutscene.active, videoCutscene.youtubeId, youtubePlayerId, playbackCovered]);

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
      setCharacterPromptInset(0);
      return;
    }
    const nextInset = Math.max(0, Math.ceil(stageFrameEl.clientHeight - dialogEl.offsetTop));
    setStickerSafeInset((prev) => (prev === nextInset ? prev : nextInset));
    const readingHeight = Number.parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue('--yavn-character-prompt-height')) || dialogEl.offsetHeight;
    const readingInset = resolvePromptActorInset(nextInset, dialogEl.offsetHeight, readingHeight);
    setCharacterPromptInset(readingInset);
    // Hiding the dialog releases its baseline, but must not enlarge the portrait.
    setCharacterPromptFitInset(readingInset);
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
  }, [bootMode, choiceGate, inputGate, isDialogHidden, updateStickerSafeInset]);

  const currentCast = useMemo(() => stagedCharactersByPosition.map(({ position, slot }) => ({
    position, slot, visible: visibleCharacterSet.has(slot.id),
    placement: resolveCharacterStageRenderPlacement(position, characterStageLayout, characterStageSpacing, slot.facing),
  })), [stagedCharactersByPosition, visibleCharacterSet, characterStageLayout, characterStageSpacing]);
  const renderedCast = useRetainedCast(currentCast, characterLeaveDurationMs);

  const hasFocusedCharacter = Boolean(focusCharacterId && visibleCharacterSet.has(focusCharacterId));
  // Empty text between actions is a loading gap, not a new speaker cue.
  const speakerPresentationRef = useRef<{ game: typeof game; speakerId?: string }>({ game });
  if (speakerPresentationRef.current.game !== game || dialogHasText) {
    speakerPresentationRef.current = { game, speakerId: dialogSpeakerId };
  }
  const presentedSpeakerId = speakerPresentationRef.current.speakerId;

  const renderCharacter = (
    slot: CharacterSlot | undefined,
    position: Position,
    renderPlacement: CharacterSlot['placement'] = 'stage-bottom',
    retiredPlacement?: CharacterStageRenderPlacement,
  ) => {
    if (!slot || slot.placement !== renderPlacement) {
      return null;
    }
    const isCameraVisible = !retiredPlacement && visibleCharacterSet.has(slot.id);
    const isEntering = isCameraVisible
      && characterEntranceMotionActive
      && enteringCharacterSet.has(slot.id);
    const isFocused = hasFocusedCharacter && focusCharacterId === slot.id;
    const placementReady = renderPlacement !== 'prompt-top' || promptTopBaselineReady;
    const rendererActive = isCameraVisible && placementReady;
    const isSpeaking = rendererActive && presentedSpeakerId === slot.id;
    const zIndex = attack?.attacker === slot.id ? 1100 : isSpeaking ? 10 : position === 'center' ? 3 : position === 'left' ? 2 : 1;
    const focusPresentation = resolveCharacterFocusPresentation(
      isFocused,
      hasFocusedCharacter,
    );
    const framingScale = slot.framing.scale;
    const currentPlacement = resolveCharacterStageRenderPlacement(
      position,
      characterStageLayout,
      characterStageSpacing,
      slot.facing,
    );
    const placement = retiredPlacement ?? (isCameraVisible
      ? currentPlacement
      : leavingCharacterPlacementRef.current.get(slot.id) ?? currentPlacement);
    const duoClass = placement.duoSide ? `char-duo-${placement.duoSide}` : '';
    const characterEnterTiming = resolveAdaptiveMotionTiming(
      slot.enterDuration,
      slot.enterDelay,
      characterVisibilityMotionTempo,
    );
    const combatRole = attack?.attacker === slot.id ? 'attacker' : attack?.target === slot.id ? 'target' : undefined;
    const combatClass = combatRole && attack ? `combat-${combatRole} combat-${attack.phase}` : '';
    const stance = characterStances[slot.id];
    const motionState = characterMotions[slot.id];
    // In the art's own frame (before the facing flip): which way is "toward the other person".
    const emote = {
      motion: motionState?.motion,
      motionRepeat: motionState?.repeat,
      motionRevision: motionState?.revision,
      motionSettled: motionState?.settled,
      motionForward: slot.facing === 'left' ? -1 : slot.facing === 'right' ? 1 : 0,
    };
    const charStyle = {
      '--char-stance-x': `${stance?.x ?? 0}cqw`,
      '--char-stance-scale': stance?.scale ?? 1,
      '--combat-direction': attack?.from === 'left' ? 1 : attack?.from === 'center' ? 0 : -1,
      '--combat-duration': attack ? `${attack[attack.phase]}ms` : '0ms',
      '--combat-distance': attack?.strength === 'light' ? '3cqw' : '6cqw',
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
    const entryClass = isEntering ? 'is-entering' : '';
    const className = [
      'char',
      'char-image',
      combatClass,
      position,
      focusPresentation.depthClass,
      isSpeaking ? 'is-speaking' : '',
      duoClass,
      `char-placement-${renderPlacement}`,
      visibilityClass,
      entryClass,
      stance ? `stance-${stance.style}` : '',
    ].filter(Boolean).join(' ');
    if (slot.kind === 'live2d') {
      return (
        <Suspense fallback={null} key={`character-${slot.id}`}>
          <Live2DCharacter
            slot={slot}
            position={position}
            trackingKey={buildLive2DLoadKey(slot)}
            active={rendererActive && !settingsOpen}
            className={[combatClass, focusPresentation.depthClass, isSpeaking ? 'is-speaking' : '', duoClass, `char-placement-${renderPlacement}`, visibilityClass, entryClass].filter(Boolean).join(' ')}
            style={charStyle}
            visible={rendererActive}
            emote={emote}
          />
        </Suspense>
      );
    }
    return (
      <StageImageCharacter
        {...HIGH_PRIORITY_IMAGE_PROPS}
        key={buildImageCharacterRenderKey(slot.id)}
        className={className}
        cropBottom={slot.framing.cropBottom}
        source={slot.source}
        alt={slot.id}
        data-character-id={slot.id}
        data-stage-position={position}
        data-character-placement={slot.placement}
        data-character-framing={slot.framing.name}
        aria-hidden={!rendererActive}
        loading="eager"
        decoding="async"
        style={charStyle}
        visible={rendererActive}
        enterEffect={slot.enterEffect}
        {...emote}
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
        key={`${sticker.id}-${sticker.renderKey}`}
        sticker={sticker}
        avoidanceKey={stickerAvoidanceKey}
        avoidanceSettleMs={stickerAvoidanceSettleMs}
        motionTempo={motionTempo}
      />
    );
  };

  const onStartGateLaunch = useCallback(
    async (resumeFromSave: boolean) => {
      if (!startGate || startGateLaunchLockRef.current) return;
      startGateLaunchLockRef.current = true;
      const gate = startGate;
      const duration = (gate.scene ?? DEFAULT_START_SCENE).transition.duration / 2;
      setStartGateError(undefined);
      setStartGateRevealing(false);
      setStartGateLaunching(true);
      setScenePresentationPaused(true);
      setGameBootPending(true);
      try {
        // Mount and decode the game behind the title scene while the cover closes.
        await Promise.all([
          gate.kind === 'url'
            ? loadGameFromUrl(gate.gameUrl, { resumeFromSave })
            : loadGameFromZip(gate.file, { resumeFromSave: false }),
          waitForStartGateLaunchTransition(duration),
        ]);
        const state = useVNStore.getState();
        if (state.error || !state.game) throw new Error(state.error?.message ?? t("첫 장면을 준비하지 못했습니다."));
        setStartGateRevealing(true);
        await waitForStartGateLaunchTransition(duration);
        if (gate.kind === 'url') markStartGateSession(gate.sessionKey);
        stopStartGateMusic();
        setStartGate(null);
      } catch (failure) {
        setStartGateError(failure instanceof Error ? failure.message : t("게임을 불러오지 못했습니다."));
        setStartGateRevealing(false);
      } finally {
        setGameBootPending(false);
        setStartGateRevealing(false);
        setStartGateLaunching(false);
        startGateLaunchLockRef.current = false;
      }
    },
    [startGate, stopStartGateMusic],
  );

  const onUploadZip = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    if (!file.name.toLowerCase().endsWith('.zip')) {
      useVNStore.getState().setError({ message: t("ZIP 파일만 업로드할 수 있습니다.") });
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
          eyebrow: preview.startScreen.eyebrow,
          subtitle: preview.startScreen.subtitle,
          scene: preview.startScreen.scene,
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
          const gameUrl = gameContentPath(startScreenReturnGameId);
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
              eyebrow: preview.startScreen.eyebrow,
              subtitle: preview.startScreen.subtitle,
              scene: mapStartSceneAssets(preview.startScreen.scene, (path) => resolveStartGateAssetUrl(path, baseUrl) ?? path),
              showLoadButton: preview.hasLoadableSave,
              saveStatus: preview.saveStatus,
              gameVersion: preview.gameVersion,
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
              eyebrow: preview.startScreen.eyebrow,
              subtitle: preview.startScreen.subtitle,
              scene: preview.startScreen.scene,
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

  let startGateView = null;
  if (startGate) {
    const scene = startGate.scene ?? DEFAULT_START_SCENE;
    const actionClass = `start-gate-actions start-gate-actions-${startGate.buttonPosition}`;
    const startGateStyle = {
      '--scene-exit-duration': `${scene.transition.duration / 2}ms`,
      ...(scene.accent ? { '--start-gate-accent': scene.accent } : {}),
      ...(startGate.titleColor ? { '--start-gate-title-color': startGate.titleColor } : {}),
      ...(startGate.imagePosition ? { '--start-gate-image-position': startGate.imagePosition } : {}),
      ...(startGate.mobileImagePosition
        ? { '--start-gate-mobile-image-position': startGate.mobileImagePosition }
        : {}),
    } as CSSProperties;
    startGateView = (
      <div
        className={`start-gate is-scene${startGateLaunching ? ' is-launching' : ''}${startGateRevealing ? ' is-revealing' : ''}${startGate.legalNotices.length > 0 ? ' has-legal-notices' : ''}`}
        style={startGateStyle}
        data-show-title={String(startGate.showTitle)}
        data-scene-layout={scene.layout}
        data-transition={scene.transition.type}
        data-ui-template={startGate.uiTemplate}
        aria-busy={startGateLaunching}
        onPointerDown={() => tryPlayStartGateMusic()}
      >
        <TitleScene scene={startGate.scene} imageUrl={startGate.imageUrl} showTitle={startGate.showTitle}
          paused={false} />
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
              <p className="start-gate-eyebrow">{startGate.eyebrow ?? 'YAVN · INTERACTIVE STORY'}</p>
              <h1>{startGate.gameTitle}</h1>
              <p className="start-gate-prologue">{startGate.subtitle ?? t("당신의 선택으로 이야기가 시작됩니다")}</p>
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
                aria-describedby={startGate.saveStatus?.slot ? 'vs-start-save' : undefined}
              >
                <span className="start-gate-button-label">
                  {startGate.saveStatus?.status === 'older-version' ? t("그래도 이어하기") : DEFAULT_LOAD_BUTTON_TEXT}
                </span>
                <span className="start-gate-button-mark" aria-hidden="true">↗</span>
              </button>
            )}
            {startGate.showLoadButton && startGate.saveStatus?.slot && (
              // What 이어하기 opens: the newest of auto, manual and chapter saves.
              <div className="vs-start-save" id="vs-start-save">
                {startGate.saveStatus.status === 'older-version' && (
                  <p className="vs-older-save-note" role="note">{olderVersionMessage(startGate.saveStatus.slot.savedVersion)}</p>
                )}
                <SaveSlotMeta slot={startGate.saveStatus.slot} />
              </div>
            )}
            <p className="start-gate-hint">{startGate.musicUrl && !startGateAudioPlaying ? t("화면을 눌러 음악과 함께 시작하세요") : t("당신의 선택을 기다리고 있습니다")}</p>
            {startGateError && <div className="start-gate-load-error" role="alert">
              <strong>{t("이야기를 열지 못했습니다.")}</strong><p>{startGateError}</p><span>{t("시작 버튼을 눌러 다시 시도할 수 있습니다.")}</span>
            </div>}
          </div>
          <LegalNoticeList notices={startGate.legalNotices} className="start-gate-legal-notices" />
        </div>
        <VersionLine className="vs-version-line vs-version-start" contentVersion={startGate.gameVersion} />
        <div className="start-scene-controls">
          <a href={libraryHref()} aria-label={t("게임 목록으로")}>{t("← 게임 목록")}</a>
          <div>
            {startGate.musicUrl && <button type="button" aria-pressed={startGateAudioPlaying}
              disabled={startGateLaunching} onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                if (startGateAudioPlaying) { setBgmEnabled(false); setBgmEnabledState(false); }
                else { setBgmEnabled(true); setBgmEnabledState(true); tryPlayStartGateMusic(); }
              }}>{startGateAudioPlaying ? t("♫ 소리 켜짐") : t("♪ 소리 켜기")}</button>}
          </div>
        </div>
        <div className="start-scene-cover" aria-hidden="true"><i /><i /></div>
        {startGateLaunching && <div className="start-scene-loading" role="status" aria-live="polite">
          <span>{startGateRevealing ? t("이야기가 시작됩니다") : t("첫 장면을 여는 중")}</span>
          <div role="progressbar" aria-label={t("게임 준비")} aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={Math.floor(chapterLoadingProgress * 100)}><i style={{ transform: `scaleX(${Math.max(.04, chapterLoadingProgress)})` }} /></div>
        </div>}
      </div>
    );
    if (!startGateLaunching || !game) return <>{null}{startGateView}</>;
  }

  if (versionGate && !game) {
    const openGame = async (resumeFromSave: boolean) => {
      const gate = versionGate;
      setVersionGate(undefined);
      setGameBootPending(true);
      try {
        await loadGameFromUrl(gate.gameUrl, { resumeFromSave });
      } finally {
        setGameBootPending(false);
      }
    };
    return (
      <VersionGate uiTemplate={versionGate.uiTemplate} title={versionGate.title} slot={versionGate.status.slot} currentVersion={versionGate.status.currentVersion}
        onRestart={() => void openGame(false)} onContinue={() => void openGame(true)} />
    );
  }

  if (shouldShowGameRouteBoot(gameBootPending, Boolean(game))) {
    return (
      <div className="game-route-boot" role="status" aria-live="polite" aria-label={t("게임 화면 준비 중")}>
        <span className="game-route-boot-mark" aria-hidden="true">YAVN</span>
      </div>
    );
  }

  if (bootMode === 'launcher') {
    return (
      <div className="launcher">
        <a className="launcher-skip-link" href="#launcher-library-title">{t("게임 목록으로 건너뛰기")}</a>
        <header className="launcher-topbar">
          <a className="launcher-brand" href={libraryHref()} aria-label={t("YAVN 홈")}>
            <YavnLogo />
            <span>{t("이야기가 플레이가 되는 곳")}</span>
          </a>
          <a className="launcher-language-switch" href={uiLanguage === 'en' ? '/' : '/en/'} hrefLang={uiLanguage === 'en' ? 'ko' : 'en'}>{uiLanguage === 'en' ? '한국어' : 'English'}</a>
          <nav className="launcher-nav" aria-label={t("메인 메뉴")}>
            <a className="launcher-nav-library" href="#launcher-library">{t("이야기 둘러보기")}</a>
            <a className="launcher-nav-guide" href={developmentGuideUrl} target="_blank" rel="noreferrer">{t("만들기 가이드")}<span aria-hidden="true">↗</span>
            </a>
            <a className="launcher-nav-github" href={repositoryUrl} target="_blank" rel="noreferrer">GitHub ↗</a>
            <label className={`launcher-upload${uploading ? ' is-loading' : ''}`}>
              <span aria-hidden="true">＋</span>
              <span>{uploading ? t("불러오는 중") : t("내 게임 열기")}</span>
              <input
                type="file"
                accept=".zip,application/zip"
                aria-label={t("YAVN 게임 ZIP 실행")}
                disabled={uploading}
                onChange={onUploadZip}
              />
            </label>
          </nav>
        </header>
        {!siteReachable && <OfflineNote />}

        <main className="launcher-console">
          <section className="launcher-intro" aria-labelledby="launcher-intro-title">
            <div>
              <p className="launcher-eyebrow"><span aria-hidden="true" /> EVERY CHOICE, A NEW STORY</p>
              <h1 id="launcher-intro-title">{t("이야기를 읽다.")}<br /><em>{t("세계를 바꾸다.")}</em></h1>
            </div>
            <div className="launcher-intro-note">
              <p>{t("다음 장면을 결정하는 건, 당신.")}<br />{t("선택으로 완성하는 비주얼 노벨을 만나보세요.")}</p>
              <a href="#launcher-library">{t("당신의 이야기 찾기")}<span aria-hidden="true">↘</span></a>
              <span className="launcher-browser-note">{t("설치 없이, 브라우저에서 바로.")}</span>
            </div>
          </section>
          <div className="launcher-section-label">
            <span><b>01</b> SPOTLIGHT</span>
            <span>{t("지금 펼쳐볼 이야기")}</span>
          </div>
          {gameList.length > 0 ? (
            <section className="launcher-showcase" aria-label={t("플레이 가능한 데모")}>
              <div
                ref={launcherCarouselRef}
                className="launcher-carousel"
                role="region"
                aria-roledescription="carousel"
                aria-label={t("YAVN 데모 캐러셀")}
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
                    const entryTags = entry.tags;
                    const chapterLabel =
                      typeof entry.chapterCount === 'number'
                        ? uiLanguage === 'en' ? `${entry.chapterCount} chapters` : `${entry.chapterCount}개 챕터`
                        : t("챕터 정보 없음");
                    const showcaseStyle = buildLauncherShowcaseStyle(entry.showcase) as CSSProperties | undefined;
                    const offlineState = offlinePacks.states[entry.id];
                    const openable = !offlineState || canOpenGame(offlineState.status, siteReachable);
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
                          <span className="launcher-art-caption" aria-hidden="true">
                            <YavnLogo compact />
                            <span>THE YAVN COLLECTION<br /><b>STORY {String(index + 1).padStart(2, '0')}</b></span>
                          </span>
                        </div>

                        <div className="launcher-feature-copy">
                          <div className="launcher-feature-content">
                            <p className="launcher-feature-kicker">
                              {entry.showcase?.label ?? 'INTERACTIVE STORY'}
                              <span>v{entry.version ?? '-'}</span>
                            </p>
                            <h2 id={`launcher-feature-title-${entry.id}`}>{entry.name}</h2>
                            <p className="launcher-feature-summary">{(uiLanguage === 'en' ? entry.summaryEn ?? entry.summary : entry.summary) ?? DEFAULT_LAUNCHER_SUMMARY}</p>

                            <div className="inspector-tag-row">
                              {entryTags.map((tag) => (
                                <span key={`inspect-${entry.id}-${tag}`}>{launcherTagLabel(tag, entry.tagLabels, uiLanguage)}</span>
                              ))}
                            </div>

                            <p className="launcher-game-languages">{uiLanguage === 'en' ? 'Game language: ' : '지원 언어: '}{entry.languages.length ? entry.languages.map(languageLabel).join(', ') : (uiLanguage === 'en' ? 'Not specified' : '미등록')}</p>
                            <p className="launcher-feature-meta">
                              <span>by {entry.author ?? 'YAVN creator'}</span><span>{chapterLabel}</span>
                              {readLauncherProgress(entry).map((label) => <span key={label} className="launcher-progress">{label}</span>)}
                            </p>

                            {offlineState && (
                              <OfflinePackControl
                                state={offlineState}
                                reachable={siteReachable}
                                tabIndex={isSelected ? undefined : -1}
                                onSave={() => void offlinePacks.save(entry.id)}
                                onRemove={() => void offlinePacks.remove(entry.id)}
                              />
                            )}

                            <div className="inspector-actions">
                              {openable ? (
                                <a
                                  className="launcher-command launcher-command-primary"
                                  href={gameHref(entry.path, entry.languages)}
                                  tabIndex={isSelected ? undefined : -1}
                                >{t("이야기 시작하기")}<span aria-hidden="true">↗</span>
                                </a>
                              ) : (
                                <span className="launcher-command launcher-command-primary is-unavailable" aria-disabled="true">
                                  {offlineCopy.unavailable}
                                </span>
                              )}
                              <a
                                className="launcher-command launcher-command-source"
                                href={buildGameSourceUrl(repositoryUrl, entry.id)}
                                target="_blank"
                                rel="noreferrer"
                                tabIndex={isSelected ? undefined : -1}
                              >{t("작품 소스 ↗")}</a>
                              <button
                                type="button"
                                className="launcher-command launcher-command-ghost"
                                tabIndex={isSelected ? undefined : -1}
                                onClick={() => void copySelectedGameLink()}
                              >
                                {launcherShareNotice ? t("링크 복사됨") : t("선택 링크 복사")}
                              </button>
                            </div>
                            <p
                              className="launcher-share-status"
                              role={isSelected ? 'status' : undefined}
                              aria-live={isSelected ? 'polite' : 'off'}
                            >
                              {isSelected ? launcherShareNotice : ''}
                            </p>
                            {entry.legalNotices.length > 0 && (
                              <LegalNoticeList
                                notices={entry.legalNotices}
                                className="launcher-feature-legal-notices"
                                linkTabIndex={isSelected ? undefined : -1}
                              />
                            )}
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
                  aria-label={t("이전 데모")}
                  onPointerDown={preserveLauncherControlFocus}
                  onClick={() => moveLauncherCarousel(-1)}
                  disabled={gameList.length < 2}
                >
                  <span aria-hidden="true">←</span>
                </button>

                <div className="launcher-carousel-pagination">
                  <div className="launcher-carousel-dots" role="group" aria-label={t("데모 선택")}>
                    {gameList.map((entry, index) => {
                      const isSelected = selectedGame?.id === entry.id;
                      return (
                        <button
                          key={`carousel-dot-${entry.id}`}
                          type="button"
                          aria-label={`${entry.name} ${t("보기")}`}
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
                  aria-label={t("다음 데모")}
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
                {gameListLoading ? t("이야기를 준비하고 있어요") : gameListError ? t("이야기를 불러오지 못했어요") : t("새로운 이야기를 기다리고 있어요")}
              </strong>
              <p>
                {gameListLoading
                  ? t("잠시만 기다려주세요. 곧 첫 장이 열립니다.")
                  : gameListError ?? t("등록된 게임이 아직 없습니다.")}
              </p>
              {!gameListLoading && gameListError && (
                <button type="button" onClick={() => void loadGameListManifest()}>{t("다시 불러오기")}</button>
              )}
            </div>
          )}

          {gameList.length > 0 && (
            <>
          <section id="launcher-library" className="launcher-library" aria-labelledby="launcher-library-title">
            <div className="launcher-library-heading">
              <div>
                <p className="launcher-eyebrow">02 / THE COLLECTION</p>
                <h2 id="launcher-library-title" tabIndex={-1}>{t("어떤 세계로 떠나볼까요?")}</h2>
                <p className="launcher-section-description">{t("마음에 드는 이야기의 첫 장을 열어보세요.")}</p>
              </div>
              <span className="launcher-library-count" role="status">
                <b>{String(filteredGames.length).padStart(2, '0')}</b> / {String(gameList.length).padStart(2, '0')} STORIES
              </span>
            </div>

            <div className="launcher-library-controls">
              <div className="launcher-search-box">
                <label htmlFor="launcher-search-input">{t("게임 검색")}</label>
                <div className="launcher-search-field">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
                  <input
                    id="launcher-search-input"
                    type="search"
                    placeholder={uiLanguage === 'en' ? 'Title, genre, author or language' : '제목, 장르, 작가, 언어로 찾기'}
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
                    <button type="button" aria-label={t("게임 검색어 지우기")} onClick={() => setSearchTerm('')}>
                      ×
                    </button>
                  )}
                </div>
              </div>

              <label className="launcher-language-filter">{uiLanguage === 'en' ? 'Game language' : '게임 지원 언어'}
                <select value={activeLanguage} onChange={event => setActiveLanguage(event.target.value)} aria-controls="launcher-game-grid">
                  <option value="">{uiLanguage === 'en' ? 'All languages' : '모든 언어'}</option>
                  {[...new Set(gameList.flatMap(entry => entry.languages))].sort().map(code => <option key={code} value={code}>{languageLabel(code)}</option>)}
                </select>
              </label>
              <div
                ref={launcherTagFilterRef}
                className="launcher-tag-filter"
                role="group"
                aria-label={t("게임 태그 필터")}
              >
                <button
                  type="button"
                  className={`launcher-tag-button ${activeTag === ALL_TAG_FILTER ? 'is-active' : ''}`}
                  aria-pressed={activeTag === ALL_TAG_FILTER}
                  onClick={() => setActiveTag(ALL_TAG_FILTER)}
                >{t("전체")}</button>
                {visibleLauncherTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`launcher-tag-button ${activeTag === tag ? 'is-active' : ''}`}
                    aria-pressed={activeTag === tag}
                    onClick={() => setActiveTag(tag)}
                  >
                    {launcherTagLabel(tag, launcherTagLabels, uiLanguage)}
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
                        launcherTagFilterRef.current?.scrollTo({
                          left: 0,
                          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                        });
                      });
                    }}
                  >
                    {showAllLauncherTags ? t("태그 접기") : `${uiLanguage === 'en' ? 'More' : '더보기'} +${hiddenLauncherTagCount}`}
                  </button>
                )}
              </div>
            </div>

            {filteredGames.length === 0 && (
              <div className="launcher-diagnostic">
                <strong>{t("아직 찾는 이야기가 없네요")}</strong>
                <p>{t("검색 조건과 일치하는 게임이 없습니다.")}</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setActiveLanguage('');
                    setActiveTag(ALL_TAG_FILTER);
                  }}
                >{t("검색 조건 초기화")}</button>
              </div>
            )}

            {filteredGames.length > 0 && (
              <div id="launcher-game-grid" className="workspace-grid" aria-live="polite">
                {filteredGames.map((entry) => {
                  const buildNumber = Math.max(1, gameList.findIndex((gameEntry) => gameEntry.id === entry.id) + 1);
                  const chapterLabel =
                    typeof entry.chapterCount === 'number'
                      ? uiLanguage === 'en' ? `${entry.chapterCount} chapters` : `${entry.chapterCount}개 챕터`
                      : t("챕터 정보 없음");
                  const offlineState = offlinePacks.states[entry.id];
                  const openable = !offlineState || canOpenGame(offlineState.status, siteReachable);
                  const savedOffline = offlineState?.status === 'saved' || offlineState?.status === 'outdated';
                  return (
                    <article
                      key={entry.id}
                      className={`workspace-game-card${openable ? '' : ' is-offline-unavailable'}`}
                    >
                      <a
                        className="workspace-game-select"
                        href={openable ? gameHref(entry.path, entry.languages) : undefined}
                        aria-disabled={openable ? undefined : true}
                        aria-label={openable ? `${entry.name} ${t("플레이")}` : `${entry.name} · ${offlineCopy.unavailable}`}
                      >
                        <span className="workspace-game-cover">
                          {entry.thumbnail ? (
                            <img src={entry.thumbnail} alt="" loading="lazy" decoding="async" />
                          ) : (
                            <span className="workspace-game-cover-fallback">YAVN</span>
                          )}
                          <span className="workspace-cover-number">{String(buildNumber).padStart(2, '0')}</span>
                          <span className="workspace-cover-play" aria-hidden="true">{t("이야기 시작 ↗")}</span>
                        </span>
                        <span className="workspace-game-body">
                          <span className="workspace-game-category">{entry.tags.slice(0, 2).map((tag) => launcherTagLabel(tag, entry.tagLabels, uiLanguage)).join(' / ') || 'VISUAL NOVEL'}</span>
                          <span className="workspace-game-header">
                            <strong>{entry.name}</strong>
                          </span>
                          <span className="workspace-game-summary">{(uiLanguage === 'en' ? entry.summaryEn ?? entry.summary : entry.summary) ?? DEFAULT_LAUNCHER_SUMMARY}</span>
                          {entry.legalNotices.length > 0 && (
                            <span className="workspace-game-legal-badge">{entry.legalNotices[0].title}</span>
                          )}
                          <span className="launcher-game-languages">{uiLanguage === 'en' ? 'Game language: ' : '지원 언어: '}{entry.languages.length ? entry.languages.map(languageLabel).join(', ') : (uiLanguage === 'en' ? 'Not specified' : '미등록')}</span>
                          <span className="workspace-game-meta">
                            {entry.author ?? 'UNKNOWN'} · {chapterLabel}
                            {readLauncherProgress(entry).map((label) => <b key={label} className="launcher-progress">{label}</b>)}
                          </span>
                          {!openable && <span className="workspace-game-offline is-unavailable">{offlineCopy.unavailable}</span>}
                          {openable && savedOffline && <span className="workspace-game-offline">{offlineCopy.saved}</span>}
                        </span>
                        <span className="workspace-game-launch" aria-hidden="true">
                          ↗
                        </span>
                      </a>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
          <section className="launcher-engine-overview" aria-labelledby="launcher-engine-overview-title">
            <div className="launcher-engine-overview-copy">
              <p className="launcher-eyebrow">03 / FOR THE STORYTELLERS</p>
              <h2 id="launcher-engine-overview-title">{t("이번엔 당신의")}<br />{t("이야기를 들려주세요.")}</h2>
              <p>{uiLanguage === 'en' ? 'Make a visual novel or story RPG for the web. Write YAML scenes, dialogue, branching choices and inventory; this is a narrative engine, not a 3D combat editor.' : '웹게임 만들기, 비주얼노벨 제작, 선택형 스토리 RPG 만들기를 시작하세요. YAML로 대사·분기·아이템을 구성하는 이야기 엔진입니다.'}</p>
              <a href={uiLanguage === 'en' ? '/en/create/' : '/create/'}>{uiLanguage === 'en' ? 'How to make a web game →' : '웹게임·RPG 만들기 안내 →'}</a>
              <p className="launcher-creator-lead">{t("코드보다 이야기에 집중하세요.")}</p>
              <p>{t("장면과 대사, 선택과 결말.")}<br />{t("상상 속 이야기를 플레이할 수 있는 작품으로 만드세요.")}</p>
              <div className="launcher-engine-overview-actions">
                <a href={developmentGuideUrl} target="_blank" rel="noreferrer">{t("제작 가이드 시작")}<span aria-hidden="true">↗</span></a>
                <a href={`${repositoryUrl}/blob/main/sample.yaml`} target="_blank" rel="noreferrer">{t("샘플 YAML 보기 ↗")}</a>
              </div>
            </div>
            <div className="launcher-story-sheet" aria-hidden="true">
              <div className="launcher-sheet-heading"><YavnLogo compact /><span>YOUR NEXT STORY</span><span>01 —</span></div>
              <p className="launcher-sheet-chapter">CHAPTER 01</p>
              <p className="launcher-sheet-title">{t("모든 이야기는")}<br />{t("작은 선택에서 시작된다.")}</p>
              <p className="launcher-sheet-line">{t("낯선 편지 한 통이 도착했다.")}<br />{t("봉투에는 아직 쓰지 않은 내 이름이 적혀 있었다.")}</p>
              <div className="launcher-sheet-choices"><span>{t("편지를 열어본다")}<b>↗</b></span><span>{t("보낸 사람을 찾아간다")}<b>↗</b></span></div>
              <div className="launcher-sheet-ending"><span /> THE REST IS YOURS.</div>
            </div>
            <dl className="launcher-engine-capabilities">
              <div><dt>01 / WRITE</dt><dd><strong>{t("이야기를 쓰고")}</strong><span>{t("YAML로 장면과 선택지 구성")}</span></dd></div>
              <div><dt>02 / DIRECT</dt><dd><strong>{t("장면에 숨을 불어넣고")}</strong><span>{t("캐릭터·음악·영상으로 연출")}</span></dd></div>
              <div><dt>03 / PLAY</dt><dd><strong>{t("하나의 세계로 완성")}</strong><span>{t("ZIP을 열어 브라우저에서 플레이")}</span></dd></div>
            </dl>
          </section>
            </>
          )}
        </main>

        <footer className="launcher-footer">
          <div className="launcher-footer-brand">
            <a href={libraryHref()} aria-label={t("YAVN 홈")}><YavnLogo /></a>
            <p>Type your story. Play your novel.<br /><span>{t("당신의 선택이, 하나의 이야기가 되도록.")}</span></p>
          </div>
          <nav aria-label={t("프로젝트 및 법적 고지")}>
            <a href={repositoryUrl} target="_blank" rel="noreferrer">GitHub ↗</a>
            <a href={shareByPrUrl} target="_blank" rel="noreferrer">{t("작품 기여하기 ↗")}</a>
            <a href={thirdPartyNoticesUrl} target="_blank" rel="noreferrer">{t("제3자 고지")}</a>
            <a href={suiteLicenseUrl} target="_blank" rel="noreferrer">{t("SUITE 라이선스")}</a>
          </nav>
          <p className="launcher-footer-colophon">MADE FOR STORIES. OPEN TO EVERYONE.<span>YAVN · VISUAL NOVEL ENGINE</span></p>
        </footer>

        {error && <div className="launcher-error">{error.message}</div>}
      </div>
    );
  }

  const renderChoiceOption = (
    option: typeof choiceGate.options[number],
    index: number,
    spatial = false,
    displayNumber = index + 1,
  ) => {
    const hasForgiveOnce = option.forgiveOnce ?? choiceGate.forgiveOnceDefault;
    const forgiveAvailable = hasForgiveOnce && !choiceGate.forgivenOptionIndexes.includes(index);
    const isPreviousGameOverChoice = index === recoveredFailedChoiceIndex;
    return (
      <button
        key={`${choiceGate.key}-${option.text}-${index}`}
        type="button"
        className={`choice-gate-option${spatial ? ' exploration-target' : ''}${forgiveAvailable ? ' choice-gate-option-forgive' : ''}${isPreviousGameOverChoice ? ' choice-gate-option-previous-game-over' : ''}`}
        style={spatial && option.at ? { '--target-x': `${option.at.x}%`, '--target-y': `${option.at.y}%` } as CSSProperties : undefined}
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
        aria-label={`${fillText(option.text)}${isPreviousGameOverChoice ? t(", 죽음의 원인 선택, 게임 오버 경로") : ''}`}
      >
        <span className="choice-gate-option-copy">
          <span className="choice-gate-option-index" aria-hidden="true">
            {String(displayNumber).padStart(2, '0')}
          </span>
          <span className="choice-gate-option-text">{fillText(option.text)}</span>
          <GameIcon name="arrow" className="choice-gate-option-mark" />
        </span>
        <span className="choice-gate-option-badges">
          {isPreviousGameOverChoice && (
            <span className="choice-gate-option-history-badge">
              <b>{t("원인 선택")}</b>
              <em>GAME OVER</em>
            </span>
          )}
          {forgiveAvailable && <span className="choice-gate-option-badge">{t("1회 유예")}</span>}
        </span>
      </button>
    );
  };

  const dialogueChannelLabel = {
    dialogue: undefined,
    narration: undefined,
    record: t("기록"),
    system: t("시스템"),
    thought: t("속마음"),
    action: undefined,
    message: t("메시지"),
    card: undefined,
  }[dialogChannel];

  return (
    <>
    <div
      {...(startGate || storyMapOpen ? { inert: '' } : {})}
      data-story-paused={Boolean(startGate) || chapterCurtainVisible || settingsOpen || storyMapOpen || documentHidden}
      className="app"
      data-ui-template={uiTemplate}
      data-text-scale={textScale === 'base' ? undefined : textScale}
      data-motion-tempo={motionTempo}
      data-hud-idle={hudIdle ? 'true' : undefined}
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
        data-attack-phase={attack?.phase}
        data-outcome-active={Boolean(gameOver) || isFinished ? 'true' : 'false'}
        data-effect-active={effect ? 'true' : 'false'}
        data-effect-level={playerExperience.effectLevel}
      >
      <div className="overlay" />
      <BackgroundTransition
        source={background}
        durationMs={backgroundTransitionTiming.duration}
        easing={backgroundTransitionEasing}
        kind={backgroundPresentation.transition}
        requestRevision={backgroundPresentation.revision}
        onComplete={completeBackgroundTransition}
      />
      <CinematicLayer attack={attack} />

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
            {renderedCast.map(actor => renderCharacter(actor.slot, actor.position, 'stage-bottom', actor.retiredAt === undefined ? undefined : actor.placement))}
          </div>
        </div>
      </div>
      {renderedCast.some(actor => actor.slot.placement === 'prompt-top') && (
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
            '--prompt-top-dialog-inset': `${characterPromptInset}px`,
            '--prompt-top-fit-inset': `${characterPromptFitInset}px`,
            zIndex: promptTopLayerZIndex,
          } as CSSProperties}
        >
          <div className="char-composition-world char-composition-world-prompt-top" style={cameraStyle}>
            <div
              className="char-camera-world char-camera-world-prompt-top"
              data-camera-target={camera.target}
              data-camera-transition={cameraPresentation.transition}
            >
            {renderedCast.map(actor => renderCharacter(actor.slot, actor.position, 'prompt-top', actor.retiredAt === undefined ? undefined : actor.placement))}
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

      {choiceGate.active && choiceGate.presentation === 'explore' && !isDialogHidden && (
        <div className="exploration-field" role="group" aria-label={t("주변 살펴보기")}
          style={{ '--exploration-dialog-inset': `${stickerSafeInset}px` } as CSSProperties}>
          {choiceGate.options.map((option, index) => option.at ? renderChoiceOption(option, index, true) : null)}
        </div>
      )}

      {videoCutscene.active && (
        <div className="video-cutscene-overlay">
          {videoCutscene.youtubeId ? (
            <iframe
              id={youtubePlayerId}
              ref={youtubeIframeRef}
              className="video-cutscene-frame video-cutscene-frame-youtube"
              src={`https://www.youtube.com/embed/${videoCutscene.youtubeId}?autoplay=0&mute=1&playsinline=1&controls=1&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
              title="Cutscene"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => {
                postYouTubeCommand('addEventListener', ['onStateChange']);
                postYouTubeCommand('mute');
                if (!playbackCovered) postYouTubeCommand('playVideo');
              }}
            />
          ) : (
            <video
              ref={nativeVideoRef}
              className="video-cutscene-frame video-cutscene-frame-native"
              src={videoCutscene.src}
              autoPlay={!playbackCovered}
              muted
              playsInline
              onEnded={() => completeVideoCutscene()}
              onPause={() => {
                if (playbackCovered || !videoCutscene.active || document.visibilityState !== 'visible') {
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
              <span className="video-skip-guide-title">{t("길게 눌러 건너뛰기")}</span>
              <b>{Math.floor(videoCutscene.skipProgress * 100)}%</b>
            </div>
            <p className="video-skip-guide-desc">{t("길게 눌러 건너뛰기")}</p>
            <div className="video-skip-progress">
              <i style={{ width: `${Math.floor(videoCutscene.skipProgress * 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="hud">
        <div className="hud-meta-group">
          <div className="meta">{game?.meta.title ?? t("게임 불러오는 중")}</div>
          {chapterTotal > 1 && (
            <div className="hud-chapter-progress" aria-label={uiLanguage === 'en' ? `Chapter ${chapterIndex} of ${chapterTotal}` : `전체 ${chapterTotal}장 중 ${chapterIndex}장`}>
              <span aria-hidden="true">{uiLanguage === 'en' ? `Chapter ${chapterIndex}` : `${chapterIndex}장`}</span>
              <span className="hud-chapter-total" aria-hidden="true">/ {chapterTotal}</span>
            </div>
          )}
          {placeCaption && (
            <div className="place-caption" key={placeCaption.revision} role="status">{placeCaption.text}</div>
          )}
          <VersionStamp contentVersion={game?.meta.version} />
        </div>
        <div className="hud-right">
          {uploading && <div className="hint">{t("ZIP 불러오는 중")}</div>}
          <button
            type="button"
            className="hud-action-button hud-map-button"
            aria-label={t("이야기 지도 열기")}
            title={t("이야기 지도")}
            onClick={(event) => { event.stopPropagation(); setStoryMapOpen(true); }}
          >
            <GameIcon name="map" /><span className="hud-action-label">{t("지도")}</span>
          </button>
          <button
            type="button"
            className="hud-action-button hud-log-button"
            aria-label={uiLanguage === 'en' ? `Open story log (${storyLog.length})` : `이야기 기록 열기 (${storyLog.length})`}
            title={t("이야기 기록")}
            onClick={(event) => {
              event.stopPropagation();
              settingsTriggerRef.current = event.currentTarget;
              setInventoryDetailOpen(false);
              setCaseFileTab('log');
              setSettingsOpen(true);
            }}
          >
            <GameIcon name="log" /><span className="hud-action-label">{t("기록")}</span>
          </button>
          <button
            type="button"
            className={`hud-action-button hud-inventory-button${newInventoryCount > 0 ? ' has-new' : ''}`}
            aria-label={uiLanguage === 'en'
              ? `Open inventory (${ownedInventoryCount}/${totalInventoryCount}${newInventoryCount > 0 ? `, ${newInventoryCount} new` : ''})`
              : `소지품 열기 (${ownedInventoryCount}/${totalInventoryCount}${newInventoryCount > 0 ? `, 새로 얻은 단서 ${newInventoryCount}개` : ''})`}
            title={t("소지품")}
            onClick={(event) => {
              event.stopPropagation();
              settingsTriggerRef.current = event.currentTarget;
              setInventoryDetailOpen(false);
              setCaseFileTab('inventory');
              setSettingsOpen(true);
            }}
          >
            <GameIcon name="bag" /><span className="hud-action-label">{t("소지품")}</span>
            {totalInventoryCount > 0 && (
              <span className="hud-inventory-progress" aria-hidden="true">
                {ownedInventoryCount}/{totalInventoryCount}
              </span>
            )}
            {newInventoryCount > 0 && <span className="hud-new-dot" aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="hud-action-button hud-save-button"
            aria-label={t("저장과 설정 열기")}
            title={t("저장과 설정")}
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
            <GameIcon name="menu" /><span className="hud-action-label">{t("메뉴")}</span>
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
            data-menu-tab={caseFileTab}
            onKeyDown={trapGameDialogFocus}
            role="dialog"
            aria-modal="true"
            aria-label={t("게임 메뉴")}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="settings-modal-header">
              <div className="settings-modal-heading">
                <h2>{caseFileTab === 'log' ? t("이야기 기록") : caseFileTab === 'inventory' ? t("소지품") : t("저장과 설정")}</h2>
                <p>{game?.meta.title}</p>
              </div>
              <button
                type="button"
                className="settings-close-button"
                autoFocus
                aria-label={t("메뉴 닫고 이야기로 돌아가기")}
                title={t("닫기")}
                onClick={() => closeSettingsModal()}
              >
                <GameIcon name="close" />
              </button>
            </header>
            <nav className="case-file-rail" aria-label={t("메뉴")}>
              <div className="case-file-tabs" onKeyDown={navigateGameTabs} role="tablist" aria-label={t("메뉴 보기")}>
                <button
                  type="button"
                  role="tab"
                  className={`case-file-tab ${caseFileTab === 'log' ? 'is-active' : ''}`}
                  aria-selected={caseFileTab === 'log'}
                  id="game-menu-tab-log"
                  aria-controls="game-menu-panel-log"
                  tabIndex={caseFileTab === 'log' ? 0 : -1}
                  onClick={() => {
                    setInventoryDetailOpen(false);
                    setCaseFileTab('log');
                  }}
                >
                  <GameIcon name="log" /><span className="case-file-tab-label">{t("기록")}</span>
                  <span className="case-file-tab-count">{storyLog.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`case-file-tab ${caseFileTab === 'inventory' ? 'is-active' : ''}`}
                  aria-selected={caseFileTab === 'inventory'}
                  id="game-menu-tab-inventory"
                  aria-controls="game-menu-panel-inventory"
                  tabIndex={caseFileTab === 'inventory' ? 0 : -1}
                  onClick={() => setCaseFileTab('inventory')}
                >
                  <GameIcon name="bag" /><span className="case-file-tab-label">{t("소지품")}</span>
                  <span className={`case-file-tab-count${newInventoryCount > 0 ? ' has-new' : ''}`}>
                    {newInventoryCount > 0
                      ? (uiLanguage === 'en' ? `${newInventoryCount} new` : `새 ${newInventoryCount}`)
                      : `${ownedInventoryCount}/${totalInventoryCount}`}
                  </span>
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`case-file-tab ${caseFileTab === 'system' ? 'is-active' : ''}`}
                  aria-selected={caseFileTab === 'system'}
                  id="game-menu-tab-system"
                  aria-controls="game-menu-panel-system"
                  tabIndex={caseFileTab === 'system' ? 0 : -1}
                  onClick={() => {
                    setInventoryDetailOpen(false);
                    setSaveNotice('');
                    refreshSaveSlots();
                    setCaseFileTab('system');
                  }}
                >
                  <GameIcon name="menu" /><span className="case-file-tab-label">{t("설정")}</span>
                </button>
              </div>
              <p className="case-file-rail-note"><kbd>Esc</kbd>{t("이야기로 돌아가기")}</p>
            </nav>
            {caseFileTab === 'log' ? (
              <div key="log" className="settings-modal-body story-log-body" role="tabpanel" id="game-menu-panel-log" aria-labelledby="game-menu-tab-log">
                <p className="story-log-summary">
                  {uiLanguage === 'en' ? `${storyLog.length} lines, newest first` : `최근 것부터 ${storyLog.length}줄`}
                </p>
                {storyLog.length === 0 ? (
                  <p className="story-log-empty">{t("대화를 시작하면 사건 기록이 여기에 쌓입니다.")}</p>
                ) : (
                  <ol className="story-log-list" tabIndex={0} aria-label={t("스토리 기록")}>
                    {[...storyLog].reverse().map((entry, index, newestFirst) => {
                      const channel = entry.kind === 'dialogue' ? entry.channel ?? 'dialogue' : entry.kind;
                      const speakerLabel = entry.kind !== 'dialogue'
                        ? (entry.kind === 'choice' ? t("내 선택") : t("내 답"))
                        : entry.channel === 'thought'
                          ? (entry.speaker ? `${entry.speaker}${uiLanguage === 'en' ? ' (thinking)' : '의 속마음'}` : t("속마음"))
                          : entry.channel === 'action'
                            ? t("행동")
                            : entry.channel === 'record'
                              ? entry.speaker ?? t("기록")
                              : entry.channel === 'system'
                                ? entry.speaker ?? t("시스템")
                                : entry.speaker;
                      // Lines in a row from the same speaker show the name once, like a script.
                      const newer = newestFirst[index - 1];
                      const continued = Boolean(speakerLabel) && entry.kind === 'dialogue' && newer?.kind === 'dialogue'
                        && newer.speaker === entry.speaker && (newer.channel ?? 'dialogue') === channel;
                      return (
                        <li
                          key={`${entry.kind}-${entry.chapterPath ?? 'legacy'}-${entry.sceneId}-${entry.actionIndex}-${storyLog.length - index}`}
                          className={`story-log-entry story-log-entry-${entry.kind}${speakerLabel ? '' : ' is-unattributed'}${continued ? ' is-continued' : ''}`}
                          data-channel={channel}
                        >
                          {speakerLabel && <span className="story-log-kind">{speakerLabel}</span>}
                          {entry.kind === 'dialogue' ? (
                            <p>{entry.text}</p>
                          ) : (
                            <div className="story-log-decision">
                              <p>{entry.prompt}</p>
                              <strong>{entry.value}</strong>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            ) : caseFileTab === 'inventory' ? (
            <div
              key="inventory" role="tabpanel" id="game-menu-panel-inventory" aria-labelledby="game-menu-tab-inventory"
              className={`settings-modal-body settings-inventory-body ${showInventoryTools ? 'has-tools' : ''}`}
            >
              <div className="inventory-collection-header">
                <div className="inventory-view-tabs" onKeyDown={navigateGameTabs} role="tablist" aria-label={t("소지품 보기")}>
                  <button
                    type="button"
                    role="tab"
                    className={`inventory-view-tab ${inventoryView === 'bag' ? 'is-active' : ''}`}
                    aria-selected={inventoryView === 'bag'}
                    tabIndex={inventoryView === 'bag' ? 0 : -1}
                    onClick={() => {
                      setInventoryDetailOpen(false);
                      setInventoryView('bag');
                    }}
                  >
                    <span>{t("내 가방")}</span>
                    <b>{ownedInventoryCount}</b>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className={`inventory-view-tab ${inventoryView === 'catalog' ? 'is-active' : ''}`}
                    aria-selected={inventoryView === 'catalog'}
                    tabIndex={inventoryView === 'catalog' ? 0 : -1}
                    onClick={() => {
                      setInventoryDetailOpen(false);
                      setInventoryView('catalog');
                    }}
                  >
                    <span>{t("전체 도감")}</span>
                    <b>{totalInventoryCount}</b>
                  </button>
                </div>
                <div className="inventory-overview" aria-label={uiLanguage === 'en' ? `Collected clues ${ownedInventoryCount}/${totalInventoryCount}` : `단서 수집 ${ownedInventoryCount}/${totalInventoryCount}`}>
                  <div>
                    <span>{t("모은 단서")}</span>
                    <b>{ownedInventoryCount}<small> / {totalInventoryCount}</small></b>
                  </div>
                  <progress value={ownedInventoryCount} max={Math.max(totalInventoryCount, 1)} />
                </div>
              </div>
              {showInventoryTools && (
                <div className="inventory-tools">
                  <label className="inventory-search-field">
                    <span className="inventory-tool-label">{t("검색")}</span>
                    <input
                      type="search"
                      value={inventorySearchTerm}
                      onChange={(event) => setInventorySearchTerm(event.target.value)}
                      placeholder={t("단서 이름")}
                    />
                  </label>
                  <label className="inventory-select-field">
                    <span className="inventory-tool-label">{t("분류")}</span>
                    <select
                      value={inventoryCategoryFilter}
                      onChange={(event) => setInventoryCategoryFilter(event.target.value)}
                    >
                      <option value={INVENTORY_CATEGORY_ALL}>{t("전체")}</option>
                      {inventoryCategoryOptions.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="inventory-select-field">
                    <span className="inventory-tool-label">{t("정렬")}</span>
                    <select
                      value={inventorySort}
                      onChange={(event) => setInventorySort(event.target.value as InventorySortPreference)}
                    >
                      <option value="order">{t("획득 순서")}</option>
                      <option value="name">{t("이름순")}</option>
                    </select>
                  </label>
                </div>
              )}
              <div className="inventory-grid-scroll">
                {inventoryVisibleEntries.length === 0 ? (
                  <div className="inventory-grid-empty">
                    <span className="inventory-empty-icon" aria-hidden="true"><GameIcon name="bag" /></span>
                    <strong>{inventoryGridEmptyMessage}</strong>
                    <p>
                      {inventoryViewEntries.length === 0 && inventoryCatalogEntries.length > 0
                        ? t("플레이 중 발견한 단서는 가방에 자동으로 보관됩니다.")
                        : inventoryFiltersActive
                          ? t("검색어나 카테고리를 바꾸고 다시 확인해 보세요.")
                          : t("게임에서 단서를 발견하면 이곳에 표시됩니다.")}
                    </p>
                    {inventoryViewEntries.length === 0 && inventoryCatalogEntries.length > 0 ? (
                      <button type="button" onClick={() => setInventoryView('catalog')}>{t("도감 살펴보기")}</button>
                    ) : inventoryFiltersActive ? (
                      <button
                        type="button"
                        onClick={() => {
                          setInventorySearchTerm('');
                          setInventoryCategoryFilter(INVENTORY_CATEGORY_ALL);
                        }}
                      >{t("검색 조건 초기화")}</button>
                    ) : null}
                  </div>
                ) : (
                  <div className="inventory-grid" role="list" aria-label={t("소지품 목록")}>
                    {inventoryVisibleEntries.map((entry, index) => {
                      const isNew = entry.owned && !inspectedInventoryIds.has(entry.id);
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          role="listitem"
                          className={`inventory-slot ${entry.id === selectedInventoryItemId ? 'is-selected' : ''} ${entry.owned ? '' : 'is-locked'}${isNew ? ' is-new' : ''}`}
                          onClick={(event) => {
                            inventoryDetailTriggerRef.current = event.currentTarget;
                            if (!entry.owned) {
                              return;
                            }
                            setSelectedInventoryItemId(entry.id);
                            setInventoryDetailOpen(true);
                          }}
                          disabled={!entry.owned}
                          aria-haspopup={entry.owned ? 'dialog' : undefined}
                          aria-label={`${entry.owned ? entry.name : t("미발견 단서")} ${entry.owned ? t("획득됨") : t("미획득")}${isNew ? `, ${t("새로 얻음")}` : ''}`}
                        >
                          <span className="inventory-slot-art">
                            {entry.owned && entry.imageUrl ? (
                              <img src={entry.imageUrl} alt="" aria-hidden="true" loading="lazy" decoding="async" />
                            ) : (
                              <span
                                className={`inventory-slot-fallback ${entry.owned ? 'is-placeholder' : 'is-locked-placeholder'}`}
                                aria-hidden="true"
                              >
                                <span className="inventory-slot-fallback-icon" />
                              </span>
                            )}
                          </span>
                          <span className="inventory-slot-tag">
                            <span className="inventory-slot-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                            <span className="inventory-slot-name">{entry.owned ? entry.name : t("미발견 단서")}</span>
                            {entry.owned && <span className="inventory-slot-category">{entry.category}</span>}
                          </span>
                          {isNew ? (
                            <span className="inventory-slot-new" aria-hidden="true">{t("새로 얻음")}</span>
                          ) : inventoryView === 'catalog' && entry.owned ? (
                            <span className="inventory-slot-owned-badge" aria-hidden="true">{t("획득")}</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            ) : (
              <div key="system" className="settings-modal-body save-system-body" role="tabpanel" id="game-menu-panel-system" aria-labelledby="game-menu-tab-system">
                <div className="save-protection-hero is-active">
                  <GameIcon name="bookmark" className="save-protection-symbol" />
                  <div className="save-auto-status vs-auto-slot">
                    <span>
                      <small>{t("자동 저장")}</small>
                      <b>{t("한 장면 넘길 때마다 저장돼요")}</b>
                    </span>
                    <SaveSlotMeta slot={autoRecoverySlot} emptyLabel={t("아직 저장된 장면이 없어요")} />
                  </div>
                  <button
                    type="button"
                    className="save-auto-load"
                    onClick={() => {
                      const intent = resolveSlotIntent('load', 'auto', autoRecoverySlot);
                      if (intent) setSlotIntent(intent); else void onLoadSave('auto');
                    }}
                    disabled={!autoRecoverySlot?.exists || saveBusy}
                    aria-label={t("자동 저장 불러오기")}
                  >{t("불러오기")}</button>
                  {slotIntent?.slot === 'auto' && slotIntent.kind === 'load-old' && (
                    <div className="vs-slot-confirm" role="alertdialog" aria-label={t("이전 버전 저장 불러오기")}>
                      <p>{olderVersionMessage(autoRecoverySlot?.savedVersion)}</p>
                      <button type="button" className="is-primary" autoFocus onClick={() => void onLoadSave('auto')} disabled={saveBusy}>{t("그래도 불러오기")}</button>
                      <button type="button" onClick={() => setSlotIntent(undefined)}>{t("취소")}</button>
                    </div>
                  )}
                </div>

                <div className="save-system-grid">
                  <section className="save-system-section" data-save-kind="manual">
                    <span className="save-section-index" aria-hidden="true">01</span>
                    <header>
                      <div>
                        <small>{t("직접 저장")}</small>
                        <h3>{t("수동 저장")}</h3>
                      </div>
                    </header>
                    <ol className="manual-save-slots">
                      {manualSaveSlots.map((slot, index) => {
                        const slotName = uiLanguage === 'en' ? `Slot ${index + 1}` : `${index + 1}번 칸`;
                        const intent = slotIntent?.slot === slot.slot ? slotIntent : undefined;
                        return (
                          <li key={slot.slot} className={slot.exists ? 'has-save' : undefined}>
                            <span className="manual-save-slot-label">
                              <b>{slotName}</b>
                              <SaveSlotMeta slot={slot} />
                            </span>
                            <button
                              type="button"
                              className="is-primary"
                              onClick={() => {
                                const next = resolveSlotIntent('save', slot.slot, slot);
                                if (next) setSlotIntent(next); else onManualSave(slot.slot as ManualSaveSlot);
                              }}
                              disabled={saveBusy || Boolean(gameOver)}
                              aria-label={uiLanguage === 'en' ? `Save to slot ${index + 1}` : `${index + 1}번 칸에 저장`}
                            >{slot.exists ? t("덮어쓰기") : t("저장")}</button>
                            <button
                              type="button"
                              onClick={() => {
                                const next = resolveSlotIntent('load', slot.slot, slot);
                                if (next) setSlotIntent(next); else void onLoadSave(slot.slot);
                              }}
                              disabled={!slot.exists || saveBusy}
                              aria-label={uiLanguage === 'en' ? `Load slot ${index + 1}` : `${index + 1}번 칸 불러오기`}
                            >{t("불러오기")}</button>
                            <button
                              type="button"
                              className="vs-slot-delete"
                              onClick={() => setSlotIntent(resolveSlotIntent('delete', slot.slot, slot))}
                              disabled={!slot.exists || saveBusy}
                              aria-label={uiLanguage === 'en' ? `Delete slot ${index + 1}` : `${index + 1}번 칸 지우기`}
                            >{t("지우기")}</button>
                            {intent && (
                              <div className={`vs-slot-confirm${intent.kind === 'delete' ? ' is-destructive' : ''}`} role="alertdialog" aria-label={slotName}>
                                {intent.kind === 'overwrite' && <>
                                  <p>{uiLanguage === 'en' ? `Replace slot ${index + 1} with this scene?` : `${slotName}에 있던 기록을 지금 장면으로 바꿀까요?`}</p>
                                  <button type="button" className="is-primary" autoFocus onClick={() => onManualSave(slot.slot as ManualSaveSlot)}>{t("덮어쓰기")}</button>
                                </>}
                                {intent.kind === 'delete' && <>
                                  <p>{uiLanguage === 'en' ? `Delete slot ${index + 1}? This can't be undone.` : `${slotName} 기록을 지울까요? 되돌릴 수 없어요.`}</p>
                                  <button type="button" className="is-primary" onClick={() => onDeleteSave(slot.slot as ManualSaveSlot)}>{t("지우기")}</button>
                                </>}
                                {intent.kind === 'load-old' && <>
                                  <p>{olderVersionMessage(slot.savedVersion)}</p>
                                  <button type="button" className="is-primary" autoFocus onClick={() => void onLoadSave(slot.slot)} disabled={saveBusy}>{t("그래도 불러오기")}</button>
                                </>}
                                {/* Deleting cannot be undone, so focus lands on the safe choice. */}
                                <button type="button" autoFocus={intent.kind === 'delete'} onClick={() => setSlotIntent(undefined)}>{t("취소")}</button>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  </section>

                  <section className="save-system-section" data-save-kind="chapter">
                    <span className="save-section-index" aria-hidden="true">02</span>
                    <header>
                      <div>
                        <small>{t("체크포인트")}</small>
                        <h3>{t("챕터 시작점")}</h3>
                      </div>
                      <span>{formatSaveSlotMeta(chapterSaveSlot)}</span>
                    </header>
                    <button
                      type="button"
                      className="save-system-wide-action"
                      onClick={() => void onRestartChapter()}
                      disabled={!chapterSaveSlot?.exists || saveBusy}
                    >{t("챕터 처음으로 돌아가기")}</button>
                    <p className="vs-checkpoint-hint">{t("선택지마다 그 직전으로 돌아갈 수 있어요. 이야기 지도에서 고르세요.")}</p>
                  </section>

                  <section className="save-system-section" data-save-kind="backup">
                    <span className="save-section-index" aria-hidden="true">03</span>
                    <header>
                      <div>
                        <small>{t("데이터 옮기기")}</small>
                        <h3>{t("백업 파일")}</h3>
                      </div>
                      <span>{t("기기 이동용")}</span>
                    </header>
                    <div className="save-system-actions save-system-actions-pair">
                      <button type="button" onClick={onExportSave} disabled={saveBusy || Boolean(gameOver)}>{t("내보내기")}</button>
                      <button type="button" onClick={() => saveImportRef.current?.click()} disabled={saveBusy}>{t("가져오기")}</button>
                    </div>
                    <input
                      ref={saveImportRef}
                      type="file"
                      accept=".json,.yavn-save.json,application/json"
                      onChange={(event) => void onImportSave(event)}
                      hidden
                    />
                    {renderImportPicker()}
                  </section>

                  <section className="save-system-section player-experience-section" aria-labelledby="player-settings-title">
                    <span className="save-section-index" aria-hidden="true">04</span>
                    <header>
                      <div>
                        <h3 id="player-settings-title">{t("플레이 설정")}</h3>
                      </div>
                      <span>{t("이 게임에만 적용돼요")}</span>
                    </header>
                    <div className="player-settings">
                      <fieldset className="player-setting-group">
                        <legend>{t("텍스트 속도")}</legend>
                        <div className="player-segmented" data-count="4">
                          {([
                            [0.75, t("차분하게"), '0.75×'],
                            [1, t("기본"), '1×'],
                            [1.5, t("빠르게"), '1.5×'],
                            [2, t("매우 빠르게"), '2×'],
                          ] as const).map(([value, label, detail]) => (
                            <label key={value} className="player-segment">
                              <input
                                type="radio"
                                name="player-text-speed"
                                value={value}
                                checked={playerExperience.textSpeedRate === value}
                                onChange={() => updatePlayerExperience({ textSpeedRate: value as TextSpeedRate })}
                              />
                              <span>{label}</span>
                              <small>{detail}</small>
                            </label>
                          ))}
                        </div>
                      </fieldset>

                      <fieldset className="player-setting-group">
                        <legend>{t("자동 진행")}</legend>
                        <label className="player-setting-row">
                          <span>
                            <b>{t("대사를 자동으로 넘기기")}</b>
                            <small>{t("선택지와 입력에서는 멈춥니다")}</small>
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
                        <div className="player-setting-row is-stacked" aria-disabled={!playerExperience.autoPlayEnabled}>
                          <span id="player-autoplay-delay-label">
                            <b>{t("다음 대사까지 기다리는 시간")}</b>
                          </span>
                          <div className="player-segmented" data-count="3" role="radiogroup" aria-labelledby="player-autoplay-delay-label">
                            {([
                              [800, t("짧게"), t("0.8초")],
                              [1400, t("기본"), t("1.4초")],
                              [2200, t("여유롭게"), t("2.2초")],
                            ] as const).map(([value, label, detail]) => (
                              <label key={value} className="player-segment">
                                <input
                                  type="radio"
                                  name="player-autoplay-delay"
                                  value={value}
                                  disabled={!playerExperience.autoPlayEnabled}
                                  checked={playerExperience.autoPlayDelayMs === value}
                                  onChange={() => updatePlayerExperience({ autoPlayDelayMs: value as AutoPlayDelay })}
                                />
                                <span>{label}</span>
                                <small>{detail}</small>
                              </label>
                            ))}
                          </div>
                        </div>
                      </fieldset>

                      <fieldset className="player-setting-group">
                        <legend>{t("소리")}</legend>
                        <div className="player-setting-row player-volume-control">
                          <span>
                            <b id="player-bgm-label">{t("배경음악")}</b>
                          </span>
                          <label className="settings-switch">
                            <input
                              type="checkbox"
                              checked={bgmEnabled}
                              aria-label={t("배경음악 켜기")}
                              onChange={(event) => onToggleBgmDisabled(!event.target.checked)}
                            />
                            <span aria-hidden="true" />
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={playerExperience.bgmVolume}
                            aria-label={t("배경음악 음량")}
                            disabled={!bgmEnabled}
                            onChange={(event) => updatePlayerExperience({ bgmVolume: Number(event.target.value) })}
                          />
                          <output aria-hidden="true">{bgmEnabled ? `${Math.round(playerExperience.bgmVolume * 100)}%` : t("꺼짐")}</output>
                        </div>
                        <label className="player-setting-row player-volume-control">
                          <span>
                            <b>{t("효과음")}</b>
                          </span>
                          <span aria-hidden="true" />
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={playerExperience.sfxVolume}
                            aria-label={t("효과음 음량")}
                            onChange={(event) => updatePlayerExperience({ sfxVolume: Number(event.target.value) })}
                          />
                          <output aria-hidden="true">{Math.round(playerExperience.sfxVolume * 100)}%</output>
                        </label>
                      </fieldset>

                      <fieldset className="player-setting-group">
                        <legend>{t("화면과 움직임")}</legend>
                        <div className="player-segmented" data-count="3">
                          {([
                            ['full', t("풍부하게"), t("연출 그대로")],
                            ['reduced', t("부드럽게"), t("흔들림 약하게")],
                            ['minimal', t("최소화"), t("움직임 거의 없이")],
                          ] as const).map(([value, label, detail]) => (
                            <label key={value} className="player-segment">
                              <input
                                type="radio"
                                name="player-effect-level"
                                value={value}
                                checked={playerExperience.effectLevel === value}
                                onChange={() => updatePlayerExperience({ effectLevel: value as PlayerEffectLevel })}
                              />
                              <span>{label}</span>
                              <small>{detail}</small>
                            </label>
                          ))}
                        </div>
                        {systemReducedMotion && (
                          <p className="player-setting-note">{t("기기에서 동작 줄이기가 켜져 있어 움직임을 줄여 보여 줍니다.")}</p>
                        )}
                      </fieldset>

                      <fieldset className="player-setting-group">
                        <legend>{t("접근성")}</legend>
                        <div className="player-setting-row is-stacked">
                          <span id="player-text-scale-label">
                            <b>{t("글자 크기")}</b>
                            <small>{t("대사창과 기록, 소지품 설명에 적용돼요. 모든 게임에 같이 적용됩니다.")}</small>
                          </span>
                          <div className="player-segmented" data-count="3" role="radiogroup" aria-labelledby="player-text-scale-label">
                            {([
                              ['base', t("기본")],
                              ['large', t("크게")],
                              ['larger', t("더 크게")],
                            ] as const).map(([value, label]) => (
                              <label key={value} className={`player-segment player-text-scale-${value}`}>
                                <input
                                  type="radio"
                                  name="player-text-scale"
                                  value={value}
                                  checked={textScale === value}
                                  onChange={() => setTextScale(value)}
                                />
                                <span>{label}</span>
                                <small aria-hidden="true">가</small>
                              </label>
                            ))}
                          </div>
                        </div>
                      </fieldset>
                    </div>
                  </section>

                  <section className="save-system-section legal-notices-section">
                    <span className="save-section-index" aria-hidden="true">05</span>
                    <header>
                      <div>
                        <small>{t("권리·출처")}</small>
                        <h3>{t("법적 고지")}</h3>
                      </div>
                      <span>{gameLegalNotices.length > 0 ? uiLanguage === 'en' ? `${gameLegalNotices.length} notices` : `${gameLegalNotices.length}건` : t("게임별 고지 없음")}</span>
                    </header>
                    {gameLegalNotices.length > 0 ? (
                      <LegalNoticeList notices={gameLegalNotices} className="settings-legal-notices" />
                    ) : (
                      <p className="legal-notice-empty">{t("이 게임이 선언한 별도 법적 고지는 없습니다.")}</p>
                    )}
                    <nav className="legal-notice-global-links" aria-label={t("YAVN 라이선스 문서")}>
                      <a href={thirdPartyNoticesUrl} target="_blank" rel="noreferrer">{t("YAVN 제3자 고지")}</a>
                      <a href={suiteLicenseUrl} target="_blank" rel="noreferrer">{t("SUITE 글꼴 라이선스")}</a>
                      <a href={easyCl2dNoticeUrl} target="_blank" rel="noreferrer">easy-cl2d NOTICE</a>
                      <a href={easyCl2dLicenseUrl} target="_blank" rel="noreferrer">{t("Live2D Framework 조건")}</a>
                      <a href={live2dRedistributableFilesUrl} target="_blank" rel="noreferrer">{t("Live2D 재배포 파일")}</a>
                      {usageChoice.available && (
                        <button type="button" className="legal-notice-usage" onClick={usageChoice.open}>{t("이용 통계 설정")}</button>
                      )}
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
                    {returningToStartGate ? t("시작 화면 여는 중...") : t("게임 시작 화면으로 가기")}
                  </button>
                </section>

                <p className="save-system-status" role="status" aria-live="polite">
                  {saveNotice || t("저장 데이터는 이 브라우저에 보관됩니다.")}
                </p>
                <VersionLine contentVersion={game?.meta.version} />
              </div>
            )}
            {caseFileTab === 'inventory' && inventoryDetailOpen && selectedInventoryEntry && (
              <div
                className="inventory-detail-modal-backdrop"
                onClick={() => setInventoryDetailOpen(false)}
              >
                <section
                  className="inventory-detail-modal"
                  onKeyDown={trapGameDialogFocus}
                  role="dialog"
                  aria-labelledby="inventory-detail-title"
                  onClick={(event) => event.stopPropagation()}
                >
                  <header className="inventory-detail-modal-header">
                    <p className="inventory-detail-owned is-owned">
                      {selectedInventoryEntry.owned ? selectedInventoryEntry.category : t("아직 획득하지 못함")}
                    </p>
                    {selectedInventoryPosition >= 0 && inspectableInventoryEntries.length > 1 && (
                      <p className="inventory-detail-position">
                        {selectedInventoryPosition + 1}<span> / {inspectableInventoryEntries.length}</span>
                      </p>
                    )}
                    <button
                      type="button"
                      className="settings-close-button"
                      autoFocus
                      aria-label={t("아이템 상세 닫기")}
                      title={t("닫기")}
                      onClick={() => setInventoryDetailOpen(false)}
                    >
                      <GameIcon name="close" />
                    </button>
                  </header>
                  <div
                    className={`inventory-detail-modal-body ${selectedInventoryEntry.imageUrl ? 'has-image' : ''}`}
                  >
                    {selectedInventoryEntry.owned ? (
                      <>
                        {selectedInventoryEntry.imageUrl && (
                          <figure className="inventory-detail-art">
                            <img
                              src={selectedInventoryEntry.imageUrl}
                              alt={`${selectedInventoryEntry.name} ${t("아이템 이미지")}`}
                              loading="lazy"
                              decoding="async"
                            />
                          </figure>
                        )}
                        <div className="inventory-detail-copy">
                          <h3 id="inventory-detail-title">{selectedInventoryEntry.name}</h3>
                          <p>{selectedInventoryEntry.description ?? t("아이템 설명이 없습니다.")}</p>
                        </div>
                      </>
                    ) : (
                      <div className="inventory-detail-copy">
                        <h3 id="inventory-detail-title">{t("미확인 아이템")}</h3>
                        <p>{t("아직 획득하지 못한 아이템입니다.")}</p>
                      </div>
                    )}
                  </div>
                  {inspectableInventoryEntries.length > 1 && selectedInventoryPosition >= 0 && (
                    <footer className="inventory-detail-pager">
                      <button
                        type="button"
                        disabled={selectedInventoryPosition === 0}
                        onClick={() => setSelectedInventoryItemId(inspectableInventoryEntries[selectedInventoryPosition - 1]?.id ?? null)}
                      >
                        <GameIcon name="prev" /><span>{t("이전 단서")}</span>
                      </button>
                      <button
                        type="button"
                        disabled={selectedInventoryPosition >= inspectableInventoryEntries.length - 1}
                        onClick={() => setSelectedInventoryItemId(inspectableInventoryEntries[selectedInventoryPosition + 1]?.id ?? null)}
                      >
                        <span>{t("다음 단서")}</span><GameIcon name="next" />
                      </button>
                    </footer>
                  )}
                </section>
              </div>
            )}
          </section>
        </div>
      )}

      <div
        ref={dialogBoxRef}
        className={`dialog-box channel-${dialogChannel}${dialogChannel === 'message' ? ` side-${dialogSide ?? 'them'}${phoneContact?.group ? ' phone-group' : ''}` : ''}${dialogErase && !dialogTyping ? ' is-erasing' : ''} delivery-${dialogDelivery}${choiceGate.active ? ' has-choice-gate' : ''}${choiceGate.active && choiceGate.presentation === 'explore' ? ' has-exploration' : ''} ${isDialogHidden ? 'hidden' : ''}`}
      >
        {!isDialogHiddenBySystem && !dialogUiHidden && (
          <div className="dialog-controls">
            <button
              type="button"
              className={`dialog-toggle-button dialog-auto-button${playerExperience.autoPlayEnabled ? ' is-active' : ''}`}
              aria-pressed={playerExperience.autoPlayEnabled}
              title={t("일반 대사를 자동으로 진행합니다")}
              onClick={(event) => {
                event.stopPropagation();
                queuedManualAdvanceAtRef.current = null;
                resetManualAdvanceTempo();
                updatePlayerExperience({ autoPlayEnabled: !playerExperience.autoPlayEnabled });
              }}
            >
              <GameIcon name={playerExperience.autoPlayEnabled ? 'pause' : 'play'} /><span>AUTO</span>
            </button>
            <button
              type="button"
              className={`dialog-toggle-button dialog-skip-button${skipReadActive ? ' is-active' : ''}`}
              aria-pressed={skipReadActive}
              title={t("읽은 대사를 빠르게 넘기고 처음 보는 대사나 선택지에서 멈춥니다")}
              onClick={(event) => {
                event.stopPropagation();
                queuedManualAdvanceAtRef.current = null;
                setSkipReadActive(!skipReadActive);
              }}
            >
              <GameIcon name="skip" /><span>{t("건너뛰기")}</span>
            </button>
            <button
              type="button"
              className="dialog-toggle-button"
              onClick={(event) => {
                event.stopPropagation();
                setDialogUiHidden(true);
              }}
            >
              <GameIcon name="eye" /><span>{t("숨기기")}</span>
            </button>
          </div>
        )}
        {dialogChannel === 'message' && (
          <>
            <div className="phone-chrome-top">
              <span className="phone-chrome-back" aria-hidden="true" />
              <span className="phone-chrome-contact">{phoneContact?.name ?? t("메시지")}</span>
            </div>
            <div className="phone-chrome-bottom" aria-hidden="true">
              <span className="phone-chrome-field">{t("메시지 입력")}</span>
              <span className="phone-chrome-send" />
            </div>
          </>
        )}
        <div className="dialog-content-scroll">
          {phoneThread.length > 0 && (
            <ol className="phone-thread">
              {phoneThread.map((bubble) => (
                <li key={bubble.key} className={`phone-thread-bubble side-${bubble.side}`}>
                  {bubble.speaker && <span className="phone-thread-speaker">{bubble.speaker}</span>}
                  <span className="phone-thread-text">{bubble.text}</span>
                </li>
              ))}
            </ol>
          )}
          {/* Name tag first so it always reads on the left; a channel label moves to the right. */}
          {dialogSpeaker && (
            <div className={`speaker delivery-${dialogDelivery}`}>{dialogSpeaker}</div>
          )}
          {dialogueChannelLabel && (
            <div className="dialog-channel-label">{dialogueChannelLabel}</div>
          )}
          <DialogueText />
          <DialogueActionButton />
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
                aria-label={t("답변 입력")}
                placeholder={inputGate.defaultValue ?? t("답변을 입력하세요")}
                maxLength={inputGate.correct === undefined ? inputGate.maxLength ?? 12 : undefined}
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
                  <p><strong>{t("죽음의 원인이 된 선택이 표시되어 있습니다.")}</strong>{t("다른 경로를 선택해 다시 진행할 수 있습니다.")}</p>
                </div>
              )}
              {choiceGate.timeoutMs && (
                <div
                  className="choice-gate-timeout"
                  role="timer"
                  aria-label={uiLanguage === 'en' ? `Choice deadline ${Math.ceil(choiceGate.timeoutMs / 1000)} seconds` : `선택 제한 시간 ${Math.ceil(choiceGate.timeoutMs / 1000)}초`}
                  style={{ '--choice-timeout-ms': `${choiceGate.timeoutMs}ms` } as CSSProperties}
                >
                  <div className="choice-gate-timeout-meta">
                    <span>{t("선택 제한")}</span>
                    <strong>{Math.ceil(choiceGate.timeoutMs / 1000)}s</strong>
                  </div>
                  <div className="choice-gate-timeout-track" aria-hidden="true">
                    <span />
                  </div>
                </div>
              )}
              {choiceGate.presentation === 'explore' && choiceGate.options.some(option => option.at) && (
                <p className="choice-gate-explore-hint">{t("화면에서 살펴볼 곳을 누르세요")}</p>
              )}
              <div
                className="choice-gate-options"
                data-choice-count={choiceGate.options.filter(option => choiceGate.presentation !== 'explore' || !option.at).length}
              >
                {/* Number listed options by their visible position: spatial targets and options
                    already explored are not in this list, so original indexes would skip numbers. */}
                {choiceGate.options
                  .map((option, index) => ({ option, index }))
                  .filter(({ option }) => !(choiceGate.presentation === 'explore' && option.at))
                  .map(({ option, index }, position) => renderChoiceOption(option, index, false, position + 1))}
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
          <GameIcon name="eye" /><span>{t("대화창 열기")}</span>
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

      {chapterCurtainVisible && !startGate && (
        <SceneCurtain loading={chapterLoading} progress={chapterLoadingProgress} chapter={chapterIndex} title={game?.meta.title} />
      )}

      {gameOver && !chapterLoading && !gameOverRecoveryOpen && !storyMapOpen && (
        <OutcomePrelude kind="gameOver" title={gameOver.title ? fillText(gameOver.title) : 'GAME OVER'}
          message={gameOver.message ? fillText(gameOver.message) : t("이곳에서 이야기가 멈췄습니다.")}
          onContinue={() => void onReturnToCausingChoice()}
          continueDisabled={saveBusy}
          continueLabel={choiceRecoveryPoint.exists ? t("마지막 선택으로 돌아가기") : chapterSaveSlot?.exists ? t("이 장의 처음으로") : t("마지막 저장으로")}
          continueDetail={choiceRecoveryPoint.failedChoice?.value
            ? (uiLanguage === 'en' ? `You chose “${choiceRecoveryPoint.failedChoice.value}”` : `“${choiceRecoveryPoint.failedChoice.value}”를 고른 순간`)
            : undefined}
          footnote={choiceRecoveryPoint.exists ? t("선택 직전 상태 그대로 돌아갑니다. 다른 길을 골라 보세요.") : undefined}
          secondary={<>
            <button type="button" onClick={() => setStoryMapOpen(true)} disabled={saveBusy}>{t("이야기 지도")}</button>
            <button type="button" onClick={() => setGameOverRecoveryOpen(true)} disabled={saveBusy}>{t("다른 저장에서 이어하기")}</button>
          </>} />
      )}
      {isFinished && !endingCreditsOpen && !storyMapOpen && (
        <OutcomePrelude kind="ending" title={endingTitle} message={endingMessage}
          epilogue={resolvedEnding?.epilogue ? fillText(resolvedEnding.epilogue) : undefined} background={endingBackgroundUrl} tone={resolvedEnding?.tone}
          onContinue={() => setStoryMapOpen(true)} />
      )}
      {gameOver && !chapterLoading && gameOverRecoveryOpen && (
        <div className="game-over-overlay" role="dialog" aria-modal="true" aria-labelledby="game-over-title" onKeyDown={trapOutcomeFocus} onClick={(event) => event.stopPropagation()}>
          <div className="game-over-panel">
            <button type="button" className="outcome-back" autoFocus onClick={() => setGameOverRecoveryOpen(false)}>{t("← 마지막 장면")}</button>
            <p className="game-over-kicker">{t("다시 이어갈 이야기")}</p>
            <button type="button" onClick={() => { setGameOverRecoveryOpen(false); setStoryMapOpen(true); }}>{t("이야기 지도로 돌아가기")}</button>
            <h2 id="game-over-title">{gameOver.title ? fillText(gameOver.title) : 'GAME OVER'}</h2>
            <p className="game-over-message">
              {gameOver.message ? fillText(gameOver.message) : t("선택의 결과로 더는 이야기를 이어갈 수 없습니다.")}
            </p>
            {choiceRecoveryPoint.failedChoice?.value && (
              <div className="game-over-cause" aria-label={t("결과를 만든 선택")}>
                <span>{t("결과를 만든 선택")}</span>
                <strong>{choiceRecoveryPoint.failedChoice.value}</strong>
              </div>
            )}
            <div className="game-over-primary-actions">
              <button
                type="button"
                onClick={() => void onReturnToCausingChoice()}
                disabled={(!choiceRecoveryPoint.exists && !autoRecoverySlot?.exists && !chapterSaveSlot?.exists) || saveBusy}
              >
                <span>{choiceRecoveryPoint.exists ? t("마지막 선택으로 돌아가기") : t("자동 저장으로")}</span>
                <small>{formatSaveSlotMeta(choiceRecoveryPoint.exists ? choiceRecoveryPoint : autoRecoverySlot)}</small>
              </button>
              <button
                type="button"
                onClick={() => manualSaveSlot && void onLoadSave(manualSaveSlot.slot)}
                disabled={!manualSaveSlot?.exists || saveBusy}
              >
                <span>{t("수동 저장으로")}</span>
                <small>{formatSaveSlotMeta(manualSaveSlot)}</small>
              </button>
              <button
                type="button"
                onClick={() => void onRestartChapter()}
                disabled={!chapterSaveSlot?.exists || saveBusy}
              >
                <span>{t("챕터 처음으로")}</span>
                <small>{formatSaveSlotMeta(chapterSaveSlot)}</small>
              </button>
            </div>

            <button
              type="button"
              className="game-over-import-button"
              onClick={() => gameOverImportRef.current?.click()}
              disabled={saveBusy}
            >{t("백업 파일 불러오기")}</button>
            <input
              ref={gameOverImportRef}
              type="file"
              accept=".json,.yavn-save.json,application/json"
              onChange={(event) => void onImportSave(event)}
              hidden
            />
            {renderImportPicker()}
            <p className="game-over-status" role="status" aria-live="polite">
              {saveBusy ? t("복구 중...") : saveNotice}
            </p>
          </div>
        </div>
      )}

      {isFinished && endingCreditsOpen && (
        <div className="ending-overlay" role="dialog" aria-modal="true" aria-label={t("엔딩 기록과 크레딧")} onKeyDown={trapOutcomeFocus} onClick={(event) => event.stopPropagation()}>
          {endingBackgroundUrl && <ResourceImage className="ending-overlay-bg-image" src={endingBackgroundUrl} alt="" aria-hidden="true" />}
          <div className="ending-overlay-decoration" aria-hidden="true" />
          <div className="ending-credits-screen" aria-label={t("엔딩 크레딧")}>
            <div
              className="ending-credits-roll unlocked"
              tabIndex={0}
            >
              <div className="ending-credits-inner">
                <div className="ending-credits-content">
                  <h2>{endingTitle}</h2>
                  <p className="ending-credits-message">{endingMessage}</p>
                  {totalEndingCount > 0 && (
                    <section className="ending-credits-section ending-progress-card">
                      <h3>{t("엔딩 수집")}</h3>
                      <p className="ending-progress-value">
                        {seenEndingCount}/{totalEndingCount} ({endingCompletionPercent}%) ·{' '}
                        {endingCollectionDone ? t("게임 완료") : t("진행 중")}
                      </p>
                      <div className="ending-progress-bar" role="presentation">
                        <i style={{ width: `${endingCompletionPercent}%` }} />
                      </div>
                      {seenEndingTitles.length > 0 && (
                        <p className="ending-credits-line">{t("획득 엔딩:")}{seenEndingTitles.join(' · ')}</p>
                      )}
                    </section>
                  )}

                  <section className="ending-credits-section">
                    <h3>{t("만든 사람")}</h3>
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
                      <p className="ending-credits-line">{t("제작자 정보 없음")}</p>
                    )}
                  </section>

                  {gameLegalNotices.length > 0 && (
                    <section className="ending-credits-section ending-legal-notices">
                      <h3>{t("법적 고지")}</h3>
                      <LegalNoticeList notices={gameLegalNotices} />
                    </section>
                  )}

                  <section className="ending-credits-section">
                    <h3>{t("엔진")}</h3>
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
                      <a href={thirdPartyNoticesUrl} target="_blank" rel="noreferrer">{t("제3자 소프트웨어·자산 고지")}</a>
                    </p>
                  </section>
                </div>
                <div className="ending-credits-spacer ending-credits-spacer-bottom" />
              </div>
            </div>
            <div className="ending-bottom-bar visible">
              <button type="button" className="ending-restart" onClick={() => { setEndingCreditsOpen(false); setStoryMapOpen(true); }}>{t("이야기 지도")}</button>
              <button type="button" className="ending-restart ending-retry-choice" autoFocus onClick={() => setEndingCreditsOpen(false)}>{t("결말 다시 보기")}</button>
              {totalEndingCount > 1 && choiceRecoveryPoint.exists && (
                <button
                  type="button"
                  className="ending-restart ending-retry-choice"
                  onClick={(event) => {
                    event.stopPropagation();
                    void onLoadLastChoice();
                  }}
                  disabled={saveBusy}
                >
                  {saveBusy ? t("선택 불러오는 중...") : t("마지막 선택으로")}
                </button>
              )}
              <button
                type="button"
                className="ending-restart"
                onClick={onRestartFromBeginning}
                disabled={returningToStartGate || saveBusy}
              >
                {returningToStartGate ? t("초기화면 여는 중...") : t("처음부터 다시하기")}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
    {storyMapOpen && <Suspense fallback={null}><StoryMap
      uiTemplate={uiTemplate}
      outcome={gameOver?.title ?? (isFinished ? endingTitle : undefined)} ending={isFinished}
      onClose={() => setStoryMapOpen(false)}
      onReplayed={(failedChoice) => { setStoryMapOpen(false); setGameOverRecoveryOpen(false); setEndingCreditsOpen(false); setRecoveredFailedChoice(failedChoice); refreshSaveSlots(); }}
      onRecords={() => { setStoryMapOpen(false); if (gameOver) setGameOverRecoveryOpen(true);
        else if (isFinished) setEndingCreditsOpen(true); else { setCaseFileTab('system'); setSettingsOpen(true); } }} /></Suspense>}
    <UpdateBanner uiTemplate={game ? uiTemplate : undefined} buildChanged={updateWatch.buildChanged} contentChange={updateWatch.contentChange}
      idle={updateNoticeIdle && !startGate} inGame={Boolean(game)} busy={updateBusy}
      onReloadNow={() => reloadForUpdate('continue')}
      onRestartNewVersion={() => reloadForUpdate('fresh')}
      onContinueNewVersion={() => reloadForUpdate('continue')}
      onDismissBuild={updateWatch.dismissBuild} onDismissContent={updateWatch.dismissContent} />
    {resumeNotice && game && !chapterLoading && (
      <div className="vs-resume-notice" data-ui-template={uiTemplate} role="status" onClick={(event) => event.stopPropagation()}>
        <p>{t(resumeNotice)}</p>
        <button type="button" onClick={() => useVNStore.getState().setResumeNotice(undefined)}>{t("확인")}</button>
      </div>
    )}
    {startGateView}
    </>
  );
}
