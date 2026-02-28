import { ChangeEvent, MouseEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  completeVideoCutscene,
  getBgmEnabled,
  getInventoryUiSettings,
  handleAdvance,
  loadUrlStartScreenPreview,
  loadGameFromUrl,
  loadGameFromZip,
  loadZipStartScreenPreview,
  restartFromBeginning,
  resetVideoSkipProgress,
  revealVideoSkipGuide,
  setBgmEnabled,
  setInventoryUiSettings,
  skipVideoCutscene,
  stopActiveBgm,
  submitInputAnswer,
  submitChoiceOption,
  unlockAudioFromGesture,
  updateVideoSkipProgress,
} from './engine';
import { Live2DCharacter } from './Live2DCharacter';
import { buildLive2DLoadKey } from './live2dLoadTracker';
import { useVNStore } from './store';
import type { AuthorMetaObject, CharacterSlot, GameSeoMeta, Position, StartButtonPosition, UiTemplateId } from './types';
import type { InventorySortPreference, InventoryViewPreference } from './engine';
import type { CSSProperties, SyntheticEvent } from 'react';

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
    musicUrl?: string;
    startButtonText: string;
    buttonPosition: StartButtonPosition;
    showLoadButton: boolean;
  }
  | {
    kind: 'zip';
    file: File;
    uiTemplate: UiTemplateId;
    gameTitle: string;
    seo?: GameSeoMeta;
    imageUrl?: string;
    musicUrl?: string;
    previewBlobUrl?: string;
    previewMusicBlobUrl?: string;
    startButtonText: string;
    buttonPosition: StartButtonPosition;
    showLoadButton: false;
  };

const ENDING_PROGRESS_STORAGE_PREFIX = 'vn-ending-progress:';
const START_GATE_SESSION_PREFIX = 'vn-start-gate-session:';
const ALL_TAG_FILTER = '__all';
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
  setCanonicalUrl(input.canonicalUrl);
  setDynamicJsonLd(input.jsonLd);
}

function parseGameIdFromPath(pathValue: string): string | undefined {
  const match = pathValue.match(/^\/game-list\/([^/]+)\/?$/);
  if (!match) {
    return undefined;
  }
  return decodeURIComponent(match[1]);
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
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: title,
    description,
    url: canonicalUrl,
    image: imageUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: '야븐엔진 (YAVN)',
      url: DEFAULT_CANONICAL_URL,
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

function useAdvanceByKey(advanceLocked: boolean) {
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
        handleAdvance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advanceLocked]);
}

export default function App() {
  const {
    baseUrl,
    assetOverrides,
    background,
    stickers,
    characters,
    speakerOrder,
    visibleCharacterIds,
    dialog,
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
    resolvedEndingId,
    uiTemplate,
    setDialogUiHidden,
  } = useVNStore();
  const [bootMode, setBootMode] = useState<'launcher' | 'gameList' | 'uploaded'>('launcher');
  const [gameList, setGameList] = useState<GameListManifestEntry[]>([]);
  const [gameListError, setGameListError] = useState<string | null>(null);
  const [manifestSchemaVersion, setManifestSchemaVersion] = useState<number | null>(null);
  const [manifestGeneratedAt, setManifestGeneratedAt] = useState<string | null>(null);
  const [manifestSeo, setManifestSeo] = useState<GameListManifestSeo | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTag, setActiveTag] = useState(ALL_TAG_FILTER);
  const [uploading, setUploading] = useState(false);
  const [startGate, setStartGate] = useState<StartGateState | null>(null);
  const [startGateLaunching, setStartGateLaunching] = useState(false);
  const [inputAnswer, setInputAnswer] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<string | null>(null);
  const [inventoryDetailOpen, setInventoryDetailOpen] = useState(false);
  const [inventoryView, setInventoryView] = useState<InventoryViewPreference>(() => getInventoryUiSettings().view);
  const [inventorySort, setInventorySort] = useState<InventorySortPreference>(() => getInventoryUiSettings().sort);
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState<string>(() => getInventoryUiSettings().category);
  const [inventorySearchTerm, setInventorySearchTerm] = useState('');
  const [bgmEnabled, setBgmEnabledState] = useState(() => getBgmEnabled());
  const [returningToStartGate, setReturningToStartGate] = useState(false);
  const holdTimerRef = useRef<number | undefined>(undefined);
  const holdStartRef = useRef<number>(0);
  const holdingRef = useRef(false);
  const inventoryButtonRef = useRef<HTMLButtonElement | null>(null);
  const youtubeIframeRef = useRef<HTMLIFrameElement | null>(null);
  const nativeVideoRef = useRef<HTMLVideoElement | null>(null);
  const inputFieldRef = useRef<HTMLInputElement | null>(null);
  const choiceOptionButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const appRef = useRef<HTMLDivElement | null>(null);
  const dialogBoxRef = useRef<HTMLDivElement | null>(null);
  const endingCreditsRollRef = useRef<HTMLDivElement | null>(null);
  const endingAutoScrollRafRef = useRef<number | null>(null);
  const endingAutoScrollLastTsRef = useRef<number | null>(null);
  const gameListRequestIdRef = useRef(0);
  const [endingCreditsReady, setEndingCreditsReady] = useState(false);
  const [endingCreditsScrollUnlocked, setEndingCreditsScrollUnlocked] = useState(false);
  const [endingTopSpacerPx, setEndingTopSpacerPx] = useState(0);
  const [showEndingRestart, setShowEndingRestart] = useState(false);
  const [seenEndingIds, setSeenEndingIds] = useState<string[]>([]);
  const [stickerSafeInset, setStickerSafeInset] = useState(0);
  const startGateAudioRef = useRef<HTMLAudioElement | null>(null);
  const youtubePlayerId = 'vn-cutscene-youtube-player';
  // const sampleZipUrl = '/sample.zip';
  const shareByPrUrl = 'https://github.com/uiwwsw/yavn/compare';
  const isDialogHiddenBySystem = videoCutscene.active || chapterLoading || !game;
  const isDialogHidden = isDialogHiddenBySystem || dialogUiHidden;
  const showDialogRestoreButton = Boolean(game) && dialogUiHidden && !isDialogHiddenBySystem;
  const skipInputAutoFocus = useMemo(() => isMobilePointerEnvironment(), []);
  const startScreenReturnGameId = useMemo(() => parseGameIdFromPath(window.location.pathname), []);
  const canReturnToStartScreen = Boolean(startScreenReturnGameId);
  const closeSettingsModal = useCallback(
    (restoreFocus: boolean = true) => {
      setSettingsOpen(false);
      setInventoryDetailOpen(false);
      if (!restoreFocus) {
        return;
      }
      window.requestAnimationFrame(() => {
        inventoryButtonRef.current?.focus({ preventScroll: true });
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
      setSelectedGameId((prev) => {
        if (prev && parsed.games.some((entry) => entry.id === prev)) {
          return prev;
        }
        return parsed.games[0]?.id ?? null;
      });
    } catch (error) {
      if (requestId !== gameListRequestIdRef.current) {
        return;
      }
      setGameList([]);
      setManifestSchemaVersion(null);
      setManifestGeneratedAt(null);
      setManifestSeo(null);
      setSelectedGameId(null);
      setGameListError(error instanceof Error ? error.message : '게임 목록을 불러오지 못했습니다.');
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
                musicUrl: resolveStartGateAssetUrl(preview.startScreen.music, baseUrl),
                startButtonText: preview.startScreen.startButtonText || DEFAULT_START_BUTTON_TEXT,
                buttonPosition: preview.startScreen.buttonPosition ?? 'auto',
                showLoadButton: preview.hasLoadableSave,
              });
              return;
            }
          } catch {
            // Ignore preview failures and continue with direct runtime loading.
          }
        }
        void loadGameFromUrl(gameUrl);
        return;
      }

      setBootMode('launcher');
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
    audio.volume = 0.56;
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
    const preventGestureZoom = (event: Event) => {
      event.preventDefault();
    };
    const preventPinchZoom = (event: TouchEvent) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    };
    document.addEventListener('gesturestart', preventGestureZoom, { passive: false });
    document.addEventListener('gesturechange', preventGestureZoom, { passive: false });
    document.addEventListener('gestureend', preventGestureZoom, { passive: false });
    document.addEventListener('touchmove', preventPinchZoom, { passive: false });
    return () => {
      document.removeEventListener('gesturestart', preventGestureZoom);
      document.removeEventListener('gesturechange', preventGestureZoom);
      document.removeEventListener('gestureend', preventGestureZoom);
      document.removeEventListener('touchmove', preventPinchZoom);
    };
  }, []);

  useAdvanceByKey(dialogUiHidden || settingsOpen);

  useEffect(() => {
    const preventDefault = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName.toLowerCase();
        if (target.isContentEditable || tag === 'input' || tag === 'textarea') {
          return;
        }
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
    const inventoryUiSettings = getInventoryUiSettings();
    setInventoryView(inventoryUiSettings.view);
    setInventorySort(inventoryUiSettings.sort);
    setInventoryCategoryFilter(inventoryUiSettings.category);
    setInventorySearchTerm('');
  }, [bootMode, game?.meta.title, startGate?.kind, startGate?.gameTitle]);

  useEffect(() => {
    if (!game) {
      setSettingsOpen(false);
    }
  }, [game]);

  const allLauncherTags = useMemo(() => {
    const tags = new Set<string>();
    for (const entry of gameList) {
      for (const tag of entry.tags) {
        tags.add(tag);
      }
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b, 'ko'));
  }, [gameList]);

  useEffect(() => {
    if (activeTag === ALL_TAG_FILTER) {
      return;
    }
    if (!allLauncherTags.includes(activeTag)) {
      setActiveTag(ALL_TAG_FILTER);
    }
  }, [activeTag, allLauncherTags]);

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

  useEffect(() => {
    if (filteredGames.length === 0) {
      return;
    }
    if (!selectedGameId || !filteredGames.some((entry) => entry.id === selectedGameId)) {
      setSelectedGameId(filteredGames[0].id);
    }
  }, [filteredGames, selectedGameId]);

  const selectedGame =
    gameList.find((entry) => entry.id === selectedGameId) ??
    filteredGames[0] ??
    gameList[0] ??
    null;
  const isSelectedGameVisible = Boolean(selectedGame && filteredGames.some((entry) => entry.id === selectedGame.id));
  const manifestTimestampLabel = formatManifestTimestamp(manifestGeneratedAt);
  const gameListStatus = gameListError ? 'FAULT' : gameList.length > 0 ? 'READY' : 'EMPTY';

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
        title: `${startGateTitle} | 야븐엔진 (YAVN)`,
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
      applySeoMetadata({
        title: `${gameTitle} | 야븐엔진 (YAVN)`,
        description: gameDescription,
        keywords: gameKeywords,
        canonicalUrl: gameCanonicalUrl,
        imageUrl: gameImageUrl,
        imageAlt: gameImageAlt,
        jsonLd: buildGameJsonLd(gameTitle, gameDescription, gameCanonicalUrl, gameImageUrl),
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
  const inventoryVisibleEntries = useMemo(() => {
    const filtered = inventoryCatalogEntries
      .filter((entry) => (inventoryView === 'bag' ? entry.owned : true))
      .filter((entry) =>
        inventoryView === 'catalog' && inventoryCategoryFilter ? entry.category === inventoryCategoryFilter : true,
      )
      .filter((entry) => {
        if (inventoryView !== 'catalog' || !normalizedInventorySearchTerm) {
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
    inventoryCatalogEntries,
    inventoryView,
    inventoryCategoryFilter,
    normalizedInventorySearchTerm,
    inventorySort,
  ]);
  const selectedInventoryEntry = inventoryVisibleEntries.find((entry) => entry.id === selectedInventoryItemId) ?? null;
  const inventoryGridEmptyMessage = useMemo(() => {
    if (inventoryCatalogEntries.length === 0) {
      return '등록된 아이템이 없습니다.';
    }
    if (inventoryVisibleEntries.length === 0) {
      return inventoryView === 'bag' ? '획득한 아이템이 없습니다.' : '조건에 맞는 아이템이 없습니다.';
    }
    return '';
  }, [inventoryCatalogEntries.length, inventoryView, inventoryVisibleEntries.length]);
  const visibleCharacterSet = new Set(visibleCharacterIds);
  const orderedCharacters = (
    [
      { position: 'left' as const, slot: characters.left },
      { position: 'center' as const, slot: characters.center },
      { position: 'right' as const, slot: characters.right },
    ] as const
  )
    .filter((entry): entry is { position: Position; slot: CharacterSlot } => {
      const slot = entry.slot;
      if (!slot) {
        return false;
      }
      return visibleCharacterSet.has(slot.id);
    })
    .sort((a, b) => {
      const aRank = speakerOrder.indexOf(a.slot.id);
      const bRank = speakerOrder.indexOf(b.slot.id);
      const aPriority = aRank >= 0 ? aRank : Number.MAX_SAFE_INTEGER;
      const bPriority = bRank >= 0 ? bRank : Number.MAX_SAFE_INTEGER;
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      return POSITION_TIEBREAKER[a.position] - POSITION_TIEBREAKER[b.position];
    });
  const orderByPosition = new Map<Position, number>();
  orderedCharacters.forEach((entry, idx) => {
    orderByPosition.set(entry.position, idx + 1);
  });

  useEffect(() => {
    if (inventoryVisibleEntries.length === 0) {
      if (selectedInventoryItemId !== null) {
        setSelectedInventoryItemId(null);
      }
      if (inventoryDetailOpen) {
        setInventoryDetailOpen(false);
      }
      return;
    }
    if (selectedInventoryItemId && inventoryVisibleEntries.some((entry) => entry.id === selectedInventoryItemId)) {
      return;
    }
    setSelectedInventoryItemId(inventoryVisibleEntries[0].id);
  }, [inventoryDetailOpen, inventoryVisibleEntries, selectedInventoryItemId]);

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
    if (!choiceGate.active || choiceGate.options.length === 0) {
      choiceOptionButtonRefs.current = [];
      return;
    }
    const rafId = window.requestAnimationFrame(() => {
      choiceOptionButtonRefs.current[0]?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [choiceGate.active, choiceGate.key, choiceGate.options.length]);

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
    const appEl = appRef.current;
    const dialogEl = dialogBoxRef.current;
    if (!appEl || !dialogEl) {
      return;
    }
    if (dialogUiHidden) {
      setStickerSafeInset((prev) => (prev === 0 ? prev : 0));
      return;
    }
    const nextInset = Math.max(0, Math.ceil(appEl.clientHeight - dialogEl.offsetTop));
    setStickerSafeInset((prev) => (prev === nextInset ? prev : nextInset));
  }, [dialogUiHidden]);

  useLayoutEffect(() => {
    updateStickerSafeInset();
    const raf1 = window.requestAnimationFrame(updateStickerSafeInset);
    const raf2 = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(updateStickerSafeInset);
    });
    const appEl = appRef.current;
    const dialogEl = dialogBoxRef.current;
    window.addEventListener('resize', updateStickerSafeInset);
    if (!appEl || !dialogEl || typeof ResizeObserver === 'undefined') {
      return () => {
        window.cancelAnimationFrame(raf1);
        window.cancelAnimationFrame(raf2);
        window.removeEventListener('resize', updateStickerSafeInset);
      };
    }

    const observer = new ResizeObserver(updateStickerSafeInset);
    observer.observe(appEl);
    observer.observe(dialogEl);
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      observer.disconnect();
      window.removeEventListener('resize', updateStickerSafeInset);
    };
  }, [bootMode, choiceGate.active, dialog.visibleText, inputGate.active, isDialogHidden, updateStickerSafeInset]);

  const hasFocusedSpeaker = Boolean(dialog.speakerId && visibleCharacterSet.has(dialog.speakerId));

  const renderCharacter = (slot: CharacterSlot | undefined, position: Position) => {
    if (!slot || !visibleCharacterSet.has(slot.id)) {
      return null;
    }
    const order = orderByPosition.get(position) ?? Number.MAX_SAFE_INTEGER;
    const zIndex = Math.max(1, 1000 - order);
    const isSpeaker = hasFocusedSpeaker && dialog.speakerId === slot.id;
    const depthStep = Math.max(0, order - 1);
    const depthBrightness = hasFocusedSpeaker ? (isSpeaker ? 1 : Math.max(0.64, 1 - depthStep * 0.15)) : 1;
    const depthScale = hasFocusedSpeaker ? (isSpeaker ? 1.02 : Math.max(0.98, 1 - depthStep * 0.01)) : 1;
    const depthClass = !hasFocusedSpeaker ? 'is-neutral' : isSpeaker ? 'is-speaker' : 'is-listener';
    const charStyle = {
      zIndex,
      '--char-scale': depthScale,
      '--char-brightness': depthBrightness,
    } as CSSProperties;
    const className = `char char-image ${position} ${depthClass}`;
    if (slot.kind === 'live2d') {
      return (
        <Live2DCharacter
          key={`${position}-${slot.id}-${slot.source}`}
          slot={slot}
          position={position}
          trackingKey={buildLive2DLoadKey(position, slot)}
          className={depthClass}
          style={charStyle}
        />
      );
    }
    return (
      <img
        key={`${position}-${slot.id}-${slot.source}`}
        className={className}
        src={slot.source}
        alt={slot.id}
        loading="eager"
        decoding="async"
        style={charStyle}
      />
    );
  };

  const renderSticker = (id: string) => {
    const sticker = stickers[id];
    if (!sticker) {
      return null;
    }
    const translateX =
      sticker.anchorX === 'left' ? '0%' : sticker.anchorX === 'right' ? '-100%' : '-50%';
    const translateY =
      sticker.anchorY === 'top' ? '0%' : sticker.anchorY === 'bottom' ? '-100%' : '-50%';
    return (
      <div
        key={`${sticker.id}-${sticker.source}-${sticker.renderKey}`}
        className="sticker"
        style={{
          left: sticker.x,
          top: sticker.y,
          width: sticker.width,
          height: sticker.height,
          opacity: sticker.opacity,
          zIndex: sticker.zIndex,
          transform: `translate(${translateX}, ${translateY}) rotate(${sticker.rotate}deg)`,
          '--sticker-enter-duration': `${sticker.enterDuration}ms`,
          '--sticker-enter-easing': sticker.enterEasing,
          '--sticker-enter-delay': `${sticker.enterDelay}ms`,
          '--sticker-leave-duration': `${sticker.leaveDuration}ms`,
          '--sticker-leave-easing': sticker.leaveEasing,
          '--sticker-leave-delay': `${sticker.leaveDelay}ms`,
        } as CSSProperties}
      >
        <img
          className={`sticker-visual ${sticker.leaving ? `sticker-leave-${sticker.leaveEffect}` : `sticker-enter-${sticker.enterEffect}`}`}
          src={sticker.source}
          alt={sticker.id}
          loading="eager"
          decoding="async"
          style={{
            width: sticker.width ? '100%' : undefined,
            height: sticker.height ? '100%' : undefined,
          }}
        />
      </div>
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
      setStartGate(null);
      try {
        if (gate.kind === 'url') {
          markStartGateSession(gate.sessionKey);
          await loadGameFromUrl(gate.gameUrl, { resumeFromSave });
          return;
        }
        await loadGameFromZip(gate.file, { resumeFromSave: false });
      } finally {
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
          musicUrl,
          previewBlobUrl: imageUrl?.startsWith('blob:') ? imageUrl : undefined,
          previewMusicBlobUrl: musicUrl?.startsWith('blob:') ? musicUrl : undefined,
          startButtonText: preview.startScreen.startButtonText || DEFAULT_START_BUTTON_TEXT,
          buttonPosition: preview.startScreen.buttonPosition ?? 'auto',
          showLoadButton: false,
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
      if (!startScreenReturnGameId || returningToStartGate) {
        return;
      }
      const sessionKey = resolveStartGateSessionKey(startScreenReturnGameId);
      const gameUrl = `/game-list/${startScreenReturnGameId}/`;
      try {
        sessionStorage.removeItem(sessionKey);
      } catch {
        // Ignore sessionStorage failures and continue.
      }
      setReturningToStartGate(true);
      closeSettingsModal(false);
      stopActiveBgm();
      stopStartGateMusic();
      try {
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
            musicUrl: resolveStartGateAssetUrl(preview.startScreen.music, baseUrl),
            startButtonText: preview.startScreen.startButtonText || DEFAULT_START_BUTTON_TEXT,
            buttonPosition: preview.startScreen.buttonPosition ?? 'auto',
            showLoadButton: preview.hasLoadableSave,
          });
          return;
        }
        await loadGameFromUrl(gameUrl);
      } finally {
        setReturningToStartGate(false);
      }
    },
    [closeSettingsModal, returningToStartGate, startScreenReturnGameId, stopStartGateMusic],
  );

  const onRestartFromBeginning = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
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
    return (
      <div className="start-gate" data-ui-template={startGate.uiTemplate} onPointerDown={() => tryPlayStartGateMusic()}>
        {startGate.imageUrl && <img className="start-gate-bg-image" src={startGate.imageUrl} alt="" aria-hidden="true" />}
        <div className="start-gate-overlay" aria-hidden="true" />
        <div className="start-gate-content">
          <div className="start-gate-title-block">
            <p className="start-gate-eyebrow">YAVN</p>
            <h1>{startGate.gameTitle}</h1>
          </div>
          <div className={actionClass}>
            <button
              type="button"
              className="start-gate-button start-gate-button-start"
              onClick={() => void onStartGateLaunch(false)}
              disabled={startGateLaunching}
            >
              {startGate.startButtonText || DEFAULT_START_BUTTON_TEXT}
            </button>
            {startGate.showLoadButton && (
              <button
                type="button"
                className="start-gate-button start-gate-button-load"
                onClick={() => void onStartGateLaunch(true)}
                disabled={startGateLaunching}
              >
                {DEFAULT_LOAD_BUTTON_TEXT}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (bootMode === 'launcher') {
    const selectedGameTagList = selectedGame?.tags ?? [];
    const selectedGameChapters =
      typeof selectedGame?.chapterCount === 'number' ? `${selectedGame.chapterCount} chapter(s)` : 'chapter count 미수집';
    const selectedGameSummary = selectedGame?.summary ?? DEFAULT_LAUNCHER_SUMMARY;

    return (
      <div className="launcher">
        <div className="launcher-noise" aria-hidden="true" />
        <div className="launcher-scanline" aria-hidden="true" />
        <div className="launcher-console">
          <header className="launcher-topbar">
            <div className="launcher-topbar-title">
              <p className="launcher-topbar-eyebrow">YAVN // RETRO CRT ENGINE CONSOLE</p>
              <h1>텍스트 기반 비주얼노블 제작 워크스테이션</h1>
            </div>
            <dl className="launcher-topbar-stats">
              <div>
                <dt>DSL</dt>
                <dd>YAML V3</dd>
              </div>
              <div>
                <dt>MANIFEST</dt>
                <dd>v{manifestSchemaVersion ?? 1}</dd>
              </div>
              <div>
                <dt>GAMES</dt>
                <dd>{gameList.length}</dd>
              </div>
              <div>
                <dt>SYNC</dt>
                <dd>{manifestTimestampLabel}</dd>
              </div>
              <div>
                <dt>STATUS</dt>
                <dd className={`launcher-status launcher-status-${gameListStatus.toLowerCase()}`}>{gameListStatus}</dd>
              </div>
            </dl>
          </header>

          <div className="launcher-layout">
            <section className="launcher-panel launcher-panel-actions">
              <h2 className="launcher-panel-title">EXECUTION CONSOLE</h2>
              <div className="launcher-command-group">
                <label className="launcher-command launcher-command-primary launcher-command-upload">
                  {uploading ? 'ZIP 패키지 로딩 중...' : 'ZIP 즉시 실행'}
                  <input type="file" accept=".zip,application/zip" onChange={onUploadZip} />
                </label>
                {/* <a className="launcher-command launcher-command-secondary" href={sampleZipUrl} download>
                  샘플 ZIP 다운로드
                </a> */}
                <a className="launcher-command launcher-command-ghost" href={shareByPrUrl} target="_blank" rel="noreferrer">
                  GitHub PR 공유
                </a>
              </div>

              <p className="launcher-cta-note">
                실행 우선 전략: ZIP으로 런타임을 먼저 확인한 뒤, 샘플 구조를 기반으로 YAML/에셋을 조립해 PR로 공유합니다.
              </p>

              <h3 className="launcher-subtitle">BUILD PIPELINE</h3>
              <ol className="launcher-flow-list">
                <li>
                  <strong>1. BOOT SAMPLE</strong>
                  <span>샘플 ZIP으로 폴더 구조와 DSL 패턴을 확인합니다.</span>
                </li>
                <li>
                  <strong>2. AUTHOR YAML</strong>
                  <span>`config.yaml` + 챕터 YAML로 분기와 연출을 정의합니다.</span>
                </li>
                <li>
                  <strong>3. PACK ASSETS</strong>
                  <span>`assets/...` 체계를 유지한 상태로 ZIP 패키징합니다.</span>
                </li>
                <li>
                  <strong>4. RUN RUNTIME</strong>
                  <span>업로드 즉시 플레이해 텍스트/연출/로딩을 검증합니다.</span>
                </li>
                <li>
                  <strong>5. SHARE PR</strong>
                  <span>검증 완료 결과물을 PR로 제출해 목록에 반영합니다.</span>
                </li>
              </ol>
            </section>

            <section className="launcher-panel launcher-panel-workspace">
              <div className="launcher-workspace-header">
                <h2 className="launcher-panel-title">WORKSPACE CATALOG</h2>
                <span className="launcher-workspace-count">
                  FILTERED {filteredGames.length} / TOTAL {gameList.length}
                </span>
              </div>

              <div className="launcher-search-box">
                <label htmlFor="launcher-search-input">검색</label>
                <input
                  id="launcher-search-input"
                  type="search"
                  placeholder="게임명, 태그, 작성자, 요약 검색"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>

              <div className="launcher-tag-filter" role="group" aria-label="게임 태그 필터">
                <button
                  type="button"
                  className={`launcher-tag-button ${activeTag === ALL_TAG_FILTER ? 'is-active' : ''}`}
                  onClick={() => setActiveTag(ALL_TAG_FILTER)}
                >
                  ALL
                </button>
                {allLauncherTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`launcher-tag-button ${activeTag === tag ? 'is-active' : ''}`}
                    onClick={() => setActiveTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {gameListError && (
                <div className="launcher-diagnostic" role="alert">
                  <strong>MANIFEST LOAD FAILURE</strong>
                  <p>{gameListError}</p>
                  <button type="button" onClick={() => void loadGameListManifest()}>
                    다시 시도
                  </button>
                </div>
              )}

              {!gameListError && filteredGames.length === 0 && (
                <div className="launcher-diagnostic">
                  <strong>NO MATCHED GAME</strong>
                  <p>검색어/태그 조건을 만족하는 게임이 없습니다. 필터를 초기화하거나 `launcher.yaml` 메타를 점검해 주세요.</p>
                </div>
              )}

              {!gameListError && filteredGames.length > 0 && (
                <div className="workspace-grid">
                  {filteredGames.map((entry) => {
                    const isSelected = selectedGame?.id === entry.id;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        className={`workspace-game-card ${isSelected ? 'is-selected' : ''}`}
                        onClick={() => setSelectedGameId(entry.id)}
                      >
                        <span className="workspace-game-header">
                          <strong>{entry.name}</strong>
                          {entry.version ? <em>v{entry.version}</em> : <em>v-</em>}
                        </span>
                        <span className="workspace-game-meta">
                          {entry.author ? `Author ${entry.author}` : 'Author 미등록'} /{' '}
                          {typeof entry.chapterCount === 'number' ? `${entry.chapterCount} chapters` : 'chapter 미수집'}
                        </span>
                        <span className="workspace-game-summary">{entry.summary ?? DEFAULT_LAUNCHER_SUMMARY}</span>
                        <span className="workspace-game-tags">
                          {(entry.tags.length > 0 ? entry.tags : ['untagged']).map((tag) => (
                            <b key={`${entry.id}-${tag}`}>{tag}</b>
                          ))}
                        </span>
                        <span className="workspace-game-path">{entry.path}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="launcher-panel launcher-panel-inspector">
              <h2 className="launcher-panel-title">ASSET INSPECTOR</h2>

              {selectedGame ? (
                <>
                  <div className="inspector-preview">
                    {selectedGame.thumbnail ? (
                      <img src={selectedGame.thumbnail} alt={`${selectedGame.name} thumbnail`} loading="lazy" decoding="async" />
                    ) : (
                      <div className="inspector-preview-fallback">NO THUMBNAIL</div>
                    )}
                  </div>

                  <dl className="inspector-meta">
                    <div>
                      <dt>GAME</dt>
                      <dd>{selectedGame.name}</dd>
                    </div>
                    <div>
                      <dt>ID</dt>
                      <dd>{selectedGame.id}</dd>
                    </div>
                    <div>
                      <dt>AUTHOR</dt>
                      <dd>{selectedGame.author ?? '미등록'}</dd>
                    </div>
                    <div>
                      <dt>VERSION</dt>
                      <dd>{selectedGame.version ?? '미등록'}</dd>
                    </div>
                    <div>
                      <dt>CHAPTERS</dt>
                      <dd>{selectedGameChapters}</dd>
                    </div>
                    <div>
                      <dt>VISIBLE</dt>
                      <dd>{isSelectedGameVisible ? 'LISTED' : 'FILTERED OUT'}</dd>
                    </div>
                  </dl>

                  <p className="inspector-summary">{selectedGameSummary}</p>

                  <div className="inspector-tag-row">
                    {(selectedGameTagList.length > 0 ? selectedGameTagList : ['untagged']).map((tag) => (
                      <span key={`inspect-${selectedGame.id}-${tag}`}>{tag}</span>
                    ))}
                  </div>

                  <a className="launcher-command launcher-command-primary" href={selectedGame.path}>
                    선택 게임 즉시 실행
                  </a>
                </>
              ) : (
                <div className="launcher-diagnostic">
                  <strong>INSPECTOR IDLE</strong>
                  <p>게임 항목을 선택하면 상세 메타와 실행 액션이 표시됩니다.</p>
                </div>
              )}

              <div className="inspector-feature-block">
                <h3>ENGINE CAPABILITIES</h3>
                <ul>
                  <li>YAML V3 계층 병합(`config/base/chapter`)</li>
                  <li>분기 DSL(`choice/branch/input/ending`) 런타임 검증</li>
                  <li>챕터 프리로드 + Live2D/오디오/비디오 연출 동기화</li>
                  <li>ZIP 업로드 즉시 실행 + PR 기반 공유 워크플로우</li>
                </ul>
              </div>
            </section>
          </div>

          {error && <div className="launcher-error">{error.message}</div>}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={appRef}
      className={`app ${effectClass}`}
      data-ui-template={uiTemplate}
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
        handleAdvance();
      }}
    >
      <div className="overlay" />
      {background && <img className="bg" src={background} alt="background" />}

      <div className="char-layer" style={{ bottom: `${stickerSafeInset}px` }}>
        {renderCharacter(characters.left, 'left')}
        {renderCharacter(characters.center, 'center')}
        {renderCharacter(characters.right, 'right')}
      </div>
      <div className="sticker-layer" style={{ bottom: `${stickerSafeInset}px` }}>
        {Object.keys(stickers).map(renderSticker)}
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
        <div className="meta">
          {game?.meta.title ?? 'Loading...'}
        </div>
        <div className="hud-right">
          <div className="hint">{uploading ? 'ZIP Loading...' : 'YAVN ENGINE'}</div>
          <button
            ref={inventoryButtonRef}
            type="button"
            className="hud-inventory-button"
            aria-label={`인벤토리 열기 (${ownedInventoryCount}/${totalInventoryCount})`}
            title="인벤토리"
            onClick={(event) => {
              event.stopPropagation();
              setInventoryDetailOpen(false);
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
            aria-label="인벤토리 창"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="settings-modal-header">
              <h2>인벤토리</h2>
              <button
                type="button"
                className="settings-close-button"
                onClick={() => closeSettingsModal()}
              >
                닫기
              </button>
            </header>
            <div className="settings-modal-body settings-inventory-body">
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
                  가방 ({ownedInventoryCount})
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
                  도감 ({totalInventoryCount})
                </button>
              </div>
              <div className={`inventory-tools ${inventoryView === 'bag' ? 'is-bag-view' : ''}`}>
                {inventoryView === 'catalog' && (
                  <>
                    <label className="inventory-search-field">
                      <span className="inventory-tool-label">검색</span>
                      <input
                        type="search"
                        value={inventorySearchTerm}
                        onChange={(event) => setInventorySearchTerm(event.target.value)}
                        placeholder="아이템 이름 검색"
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
                  </>
                )}
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
              <div className="inventory-grid-scroll">
                {inventoryVisibleEntries.length === 0 ? (
                  <p className="settings-empty-note inventory-grid-empty">{inventoryGridEmptyMessage}</p>
                ) : (
                  <div className="inventory-grid" role="list" aria-label="인벤토리 그리드">
                    {inventoryVisibleEntries.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        role="listitem"
                        className={`inventory-slot ${entry.id === selectedInventoryItemId ? 'is-selected' : ''} ${entry.owned ? '' : 'is-locked'}`}
                        onClick={() => {
                          setInventoryDetailOpen(false);
                          setSelectedInventoryItemId(entry.id);
                        }}
                        aria-label={`${entry.owned ? entry.name : '미확인 아이템'} ${entry.owned ? '획득됨' : '미획득'}`}
                      >
                        {entry.owned && <span className="inventory-slot-owned-badge">획득</span>}
                        {entry.owned && entry.imageUrl ? (
                          <img src={entry.imageUrl} alt="" aria-hidden="true" loading="lazy" decoding="async" />
                        ) : (
                          <span className="inventory-slot-fallback" aria-hidden="true">
                            {entry.owned ? 'ITEM' : 'LOCKED'}
                          </span>
                        )}
                        <span className="inventory-slot-name">{entry.owned ? entry.name : '미확인 아이템'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="inventory-detail-actions">
                {inventoryVisibleEntries.length === 0 ? (
                  <p className="settings-empty-note">{inventoryGridEmptyMessage}</p>
                ) : selectedInventoryEntry ? (
                    <>
                      <p className="inventory-selected-label">
                        선택한 아이템: {selectedInventoryEntry.owned ? selectedInventoryEntry.name : '미확인 아이템'}
                      </p>
                      <button
                        type="button"
                        className="inventory-detail-open-button"
                        onClick={() => setInventoryDetailOpen(true)}
                      >
                        상세보기
                      </button>
                    </>
                ) : (
                  <p className="settings-empty-note">확인할 아이템을 선택해 주세요.</p>
                )}
              </div>

              <div className="settings-bottom-row">
                <label className="settings-toggle-row">
                  <span>배경음악 끄기</span>
                  <input
                    type="checkbox"
                    checked={!bgmEnabled}
                    onChange={(event) => onToggleBgmDisabled(event.target.checked)}
                  />
                </label>
                <button
                  type="button"
                  className="settings-action-button"
                  onClick={(event) => void onReturnToStartScreen(event)}
                  disabled={!canReturnToStartScreen || returningToStartGate}
                >
                  {returningToStartGate ? '초기화면 여는 중...' : '초기화면 가기'}
                </button>
                <p className="settings-note">이 설정은 현재 게임 기준으로 저장됩니다.</p>
                <p className="settings-note">
                  {canReturnToStartScreen
                    ? '초기화면 가기는 Start Gate 세션 플래그를 초기화한 뒤 다시 시작 화면을 표시합니다.'
                    : 'ZIP 실행 게임은 초기화면 재진입을 지원하지 않습니다.'}
                </p>
              </div>
            </div>
            {inventoryDetailOpen && selectedInventoryEntry && (
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
                      onClick={() => setInventoryDetailOpen(false)}
                    >
                      닫기
                    </button>
                  </header>
                  <div className="inventory-detail-modal-body">
                    {selectedInventoryEntry.owned ? (
                      <>
                        <p className="inventory-detail-owned is-owned">내 가방에 있음</p>
                        <p>{selectedInventoryEntry.description ?? '아이템 설명이 없습니다.'}</p>
                        {selectedInventoryEntry.imageUrl && (
                          <img
                            src={selectedInventoryEntry.imageUrl}
                            alt={`${selectedInventoryEntry.name} 아이템 이미지`}
                            loading="lazy"
                            decoding="async"
                          />
                        )}
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

      <div ref={dialogBoxRef} className={`dialog-box ${isDialogHidden ? 'hidden' : ''}`}>
        {!isDialogHiddenBySystem && !dialogUiHidden && (
          <div className="dialog-controls">
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
          {dialog.speaker && <div className="speaker">{dialog.speaker}</div>}
          <div className="text">{dialog.visibleText}</div>
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
              <div className="choice-gate-options">
                {choiceGate.options.map((option, index) => {
                  const hasForgiveOnce = option.forgiveOnce ?? choiceGate.forgiveOnceDefault;
                  const forgiveAvailable = hasForgiveOnce && !choiceGate.forgivenOptionIndexes.includes(index);
                  return (
                    <button
                      key={`${choiceGate.key}-${option.text}-${index}`}
                      type="button"
                      className={`choice-gate-option${forgiveAvailable ? ' choice-gate-option-forgive' : ''}`}
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
                          submitChoiceOption(index);
                        }
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (busy) {
                          return;
                        }
                        submitChoiceOption(index);
                      }}
                      disabled={busy}
                    >
                      <span>{option.text}</span>
                      {forgiveAvailable && <span className="choice-gate-option-badge">1회 유예</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="status">
          {busy ? '...' : isFinished ? 'End' : inputGate.active ? '입력 대기' : choiceGate.active ? '선택 대기' : 'Next'}
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
        <div className="chapter-loading">
          <div className="chapter-loading-title">{chapterLoadingMessage ?? 'Chapter loading...'}</div>
          <div className="chapter-loading-bar">
            <span style={{ width: `${Math.floor(chapterLoadingProgress * 100)}%` }} />
          </div>
          <div className="chapter-loading-percent">{Math.floor(chapterLoadingProgress * 100)}%</div>
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
                      <a href="https://github.com/uiwwsw/visual-novel" target="_blank" rel="noreferrer">
                        https://github.com/uiwwsw/visual-novel
                      </a>
                    </p>
                  </section>
                </div>
                <div className="ending-credits-spacer ending-credits-spacer-bottom" />
              </div>
            </div>
            <div className={`ending-bottom-bar ${showEndingRestart ? 'visible' : ''}`} aria-hidden={!showEndingRestart}>
              <button type="button" className="ending-restart" onClick={onRestartFromBeginning} disabled={returningToStartGate}>
                {returningToStartGate ? '초기화면 여는 중...' : '처음부터 다시하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
