import { ChangeEvent, MouseEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  completeVideoCutscene,
  handleAdvance,
  loadGameFromUrl,
  loadGameFromZip,
  restartFromBeginning,
  resetVideoSkipProgress,
  revealVideoSkipGuide,
  skipVideoCutscene,
  submitInputAnswer,
  submitChoiceOption,
  unlockAudioFromGesture,
  updateVideoSkipProgress,
} from './engine';
import { Live2DCharacter } from './Live2DCharacter';
import { buildLive2DLoadKey } from './live2dLoadTracker';
import { useVNStore } from './store';
import type { AuthorMetaObject, CharacterSlot, Position } from './types';
import type { CSSProperties, SyntheticEvent } from 'react';

type GameListManifestEntry = {
  id: string;
  name: string;
  path: string;
};

type GameListManifest = {
  games: GameListManifestEntry[];
};

const ENDING_PROGRESS_STORAGE_PREFIX = 'vn-ending-progress:';

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

function useAdvanceByKey() {
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
        unlockAudioFromGesture();
        handleAdvance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export default function App() {
  const {
    background,
    stickers,
    characters,
    speakerOrder,
    visibleCharacterIds,
    dialog,
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
    resolvedEndingId,
  } = useVNStore();
  const [bootMode, setBootMode] = useState<'launcher' | 'gameList' | 'uploaded'>('launcher');
  const [gameList, setGameList] = useState<GameListManifestEntry[]>([]);
  const [gameListError, setGameListError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [inputAnswer, setInputAnswer] = useState('');
  const holdTimerRef = useRef<number | undefined>(undefined);
  const holdStartRef = useRef<number>(0);
  const holdingRef = useRef(false);
  const youtubeIframeRef = useRef<HTMLIFrameElement | null>(null);
  const nativeVideoRef = useRef<HTMLVideoElement | null>(null);
  const inputFieldRef = useRef<HTMLInputElement | null>(null);
  const choiceOptionButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const appRef = useRef<HTMLDivElement | null>(null);
  const dialogBoxRef = useRef<HTMLDivElement | null>(null);
  const endingCreditsRollRef = useRef<HTMLDivElement | null>(null);
  const endingAutoScrollRafRef = useRef<number | null>(null);
  const endingAutoScrollLastTsRef = useRef<number | null>(null);
  const [endingCreditsReady, setEndingCreditsReady] = useState(false);
  const [endingCreditsScrollUnlocked, setEndingCreditsScrollUnlocked] = useState(false);
  const [endingTopSpacerPx, setEndingTopSpacerPx] = useState(0);
  const [showEndingRestart, setShowEndingRestart] = useState(false);
  const [seenEndingIds, setSeenEndingIds] = useState<string[]>([]);
  const [stickerSafeInset, setStickerSafeInset] = useState(0);
  const youtubePlayerId = 'vn-cutscene-youtube-player';
  const sampleZipUrl = '/sample.zip';
  const shareByPrUrl = 'https://github.com/uiwwsw/visual-novel/compare';
  const isDialogHidden = videoCutscene.active || chapterLoading || !game;

  useEffect(() => {
    let disposed = false;
    const loadGameList = async () => {
      try {
        const response = await fetch('/game-list/index.json', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`게임 목록을 불러오지 못했습니다. (HTTP ${response.status})`);
        }
        const parsed = (await response.json()) as GameListManifest;
        if (!disposed) {
          setGameList(Array.isArray(parsed.games) ? parsed.games : []);
          setGameListError(null);
        }
      } catch (error) {
        if (!disposed) {
          setGameList([]);
          setGameListError(error instanceof Error ? error.message : '게임 목록을 불러오지 못했습니다.');
        }
      }
    };
    void loadGameList();
    return () => {
      disposed = true;
    };
  }, [bootMode]);

  useEffect(() => {
    const pathname = window.location.pathname;
    const gameListMatch = pathname.match(/^\/game-list\/([^/]+)\/?$/);
    if (gameListMatch) {
      const gameId = decodeURIComponent(gameListMatch[1]);
      setBootMode('gameList');
      void loadGameFromUrl(`/game-list/${gameId}/`);
      return;
    }

    setBootMode('launcher');
  }, []);

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

  useAdvanceByKey();

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

  const effectClass = effect ? `effect-${effect}` : '';
  const authorCredit = normalizeAuthorCredit(game?.meta.author);
  const hasAuthorCredit = Boolean(authorCredit.name) || authorCredit.contacts.length > 0;
  const resolvedEnding = resolvedEndingId ? game?.endings?.[resolvedEndingId] : undefined;
  const endingTitle = resolvedEnding?.title ?? 'THE END';
  const endingMessage = resolvedEnding?.message ?? '게임이 종료되었습니다.';
  const totalEndingCount = Object.keys(game?.endings ?? {}).length;
  const seenEndingIdsInCurrentGame = seenEndingIds.filter((endingId) => Boolean(game?.endings?.[endingId]));
  const seenEndingCount = seenEndingIdsInCurrentGame.length;
  const endingCompletionPercent = totalEndingCount > 0 ? Math.round((seenEndingCount / totalEndingCount) * 100) : 0;
  const endingCollectionDone = totalEndingCount > 0 && seenEndingCount >= totalEndingCount;
  const inputSubmitLabel = inputAnswer.trim().length > 0 ? '확인' : '모르겠다';
  const seenEndingTitles = seenEndingIdsInCurrentGame
    .map((endingId) => game?.endings?.[endingId]?.title ?? endingId)
    .filter((title, index, arr) => title.length > 0 && arr.indexOf(title) === index);
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
    const rafId = window.requestAnimationFrame(() => {
      inputFieldRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [inputGate.active]);

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
    const appRect = appEl.getBoundingClientRect();
    const dialogRect = dialogEl.getBoundingClientRect();
    const nextInset = Math.max(0, Math.ceil(appRect.bottom - dialogRect.top));
    setStickerSafeInset((prev) => (prev === nextInset ? prev : nextInset));
  }, []);

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
  }, [bootMode, choiceGate.active, dialog.visibleText, inputGate.active, updateStickerSafeInset, videoCutscene.active]);

  const renderCharacter = (slot: CharacterSlot | undefined, position: Position) => {
    if (!slot || !visibleCharacterSet.has(slot.id)) {
      return null;
    }
    const order = orderByPosition.get(position) ?? Number.MAX_SAFE_INTEGER;
    const zIndex = Math.max(1, 1000 - order);
    const charStyle = {
      zIndex,
      '--char-mobile-scale': order === 1 ? 1 : 0.7,
    } as CSSProperties;
    const className = `char char-image ${position}`;
    if (slot.kind === 'live2d') {
      return (
        <Live2DCharacter
          key={`${position}-${slot.id}-${slot.source}`}
          slot={slot}
          position={position}
          trackingKey={buildLive2DLoadKey(position, slot)}
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
    await loadGameFromZip(file);
    setUploading(false);
  };

  const onRestartFromBeginning = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    void restartFromBeginning();
  };

  if (bootMode === 'launcher') {
    return (
      <div className="launcher">
        <div className="launcher-noise" aria-hidden="true" />
        <div className="launcher-card">
          <section className="launcher-hero">
            <p className="launcher-eyebrow">YAVN (야븐) // RETRO NARRATIVE ENGINE</p>
            <h1>비주얼노블을 위한 텍스트 중심 게임 엔진</h1>
            <p className="launcher-lead">
              YAML 기반으로 시나리오와 연출을 빠르게 구성하고, ZIP 업로드로 즉시 플레이합니다.
              <br />
              샘플로 시작하고 PR로 공유하는 제작 플로우를 기본으로 제공합니다.
            </p>
          </section>

          <section className="launcher-panel launcher-actions-panel">
            <h2 className="launcher-panel-title">START PANEL</h2>
            <div className="launcher-actions">
              <a className="sample-download-link launcher-action launcher-action-secondary" href={sampleZipUrl} download>
                샘플 파일 다운받기 (ZIP)
              </a>
              <label className="zip-upload launcher-action launcher-action-primary">
                게임 실행해보기 (ZIP 올려서)
                <input type="file" accept=".zip,application/zip" onChange={onUploadZip} />
              </label>
              <a
                className="share-pr-link launcher-action launcher-action-ghost"
                href={shareByPrUrl}
                target="_blank"
                rel="noreferrer"
              >
                게임 공유하기 (PR)
              </a>
            </div>
            <p className="launcher-cta-note">샘플 구조를 확인한 뒤, 포크/브랜치에서 PR로 공유를 요청해 주세요.</p>
          </section>

          <section className="launcher-panel">
            <h2 className="launcher-panel-title">GAME LIST</h2>
            {gameListError && <p className="game-list-error">{gameListError}</p>}
            {!gameListError && gameList.length === 0 && (
              <p className="game-list-empty">`public/game-list/` 아래에 게임 폴더를 추가하면 여기에 표시됩니다.</p>
            )}
            {!gameListError && gameList.length > 0 && (
              <div className="game-list-grid">
                {gameList.map((entry) => (
                  <a key={entry.id} className="game-entry-link" href={entry.path}>
                    <strong>{entry.name}</strong>
                    <span>{entry.path}</span>
                  </a>
                ))}
              </div>
            )}
          </section>

          <section className="launcher-panel">
            <h2 className="launcher-panel-title">BUILD FLOW</h2>
            <ol className="how-list">
              <li>
                <strong>1. 샘플 ZIP 확인</strong>
                <span>`샘플 파일 다운받기 (ZIP)`으로 기본 파일 구조를 확인합니다.</span>
              </li>
              <li>
                <strong>2. YAML 작성</strong>
                <span>대사/연출을 `1.yaml` 같은 파일로 작성합니다.</span>
              </li>
              <li>
                <strong>3. 에셋 ZIP 압축</strong>
                <span>이미지/사운드를 `assets/...` 구조로 묶어 ZIP을 만듭니다.</span>
              </li>
              <li>
                <strong>4. 업로드 즉시 실행</strong>
                <span>`게임 실행해보기 (ZIP 올려서)` 버튼으로 바로 플레이합니다.</span>
              </li>
              <li>
                <strong>5. 공유는 PR</strong>
                <span>`게임 공유하기 (PR)` 버튼으로 GitHub PR 생성 페이지로 이동합니다.</span>
              </li>
            </ol>
          </section>

          <section className="launcher-panel">
            <h2 className="launcher-panel-title">ENGINE FEATURES</h2>
            <div className="feature-grid">
              <span>타이핑 효과</span>
              <span>챕터 프리로드</span>
              <span>goto/effect</span>
              <span>에러 라인 표시</span>
              <span>ZIP 즉시 실행</span>
              <span>YAML DSL</span>
            </div>
          </section>

          <section className="launcher-panel">
            <h2 className="launcher-panel-title">FAQ</h2>
            <div className="faq-list">
              <div className="faq-item">
                <strong>코딩이 꼭 필요한가요?</strong>
                <p>복잡한 코드 없이 YAML 중심으로 시나리오를 구성해 빠르게 제작할 수 있습니다.</p>
              </div>
              <div className="faq-item">
                <strong>게임은 어디서 실행하나요?</strong>
                <p>`게임 리스트`에서 원하는 게임을 선택하거나, ZIP을 업로드해 즉시 실행할 수 있습니다.</p>
              </div>
              <div className="faq-item">
                <strong>개발 전에 참고할 파일이 있나요?</strong>
                <p>`샘플 파일 다운받기 (ZIP)` 버튼으로 기본 예시 파일(`public/sample.zip`)을 받을 수 있습니다.</p>
              </div>
              <div className="faq-item">
                <strong>내 게임을 홈페이지에 올리려면?</strong>
                <p>`게임 공유하기 (PR)` 버튼으로 PR을 생성해 공유 요청을 등록하면 됩니다.</p>
              </div>
              <div className="faq-item">
                <strong>로딩이 느릴 때는 어떻게 최적화하나요?</strong>
                <p>
                  `assets/ch01`, `assets/ch02`처럼 폴더를 나눠 챕터별 필수 에셋만 로드하세요. 스토리는 챕터당
                  `2만~3만자` 기준으로 `1.yaml`, `2.yaml`처럼 분할하고, 긴 장면은 `goto`로 분리하면 초기 로딩 부담을 줄일
                  수 있습니다.
                </p>
              </div>
            </div>
          </section>

          {error && <div className="launcher-error">{error.message}</div>}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={appRef}
      className={`app ${effectClass}`}
      onClick={() => {
        if (videoCutscene.active) {
          revealVideoSkipGuide();
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
        <div className="hint">{uploading ? 'ZIP Loading...' : 'Click / Enter / Space'}</div>
      </div>

      <div ref={dialogBoxRef} className={`dialog-box ${isDialogHidden ? 'hidden' : ''}`}>
        {dialog.speaker && <div className="speaker">{dialog.speaker}</div>}
        <div className="text">{dialog.visibleText}</div>
        {inputGate.active && (
          <form
            className="input-gate-form"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
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
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="정답 입력"
              onChange={(event) => setInputAnswer(event.target.value)}
              onClick={(event) => event.stopPropagation()}
            />
            <button type="submit" className="input-gate-submit" onClick={(event) => event.stopPropagation()}>
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
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        event.stopPropagation();
                        submitChoiceOption(index);
                      }
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      submitChoiceOption(index);
                    }}
                  >
                    <span>{option.text}</span>
                    {forgiveAvailable && <span className="choice-gate-option-badge">1회 유예</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="status">
          {busy ? '...' : isFinished ? 'End' : inputGate.active ? '입력 대기' : choiceGate.active ? '선택 대기' : 'Next'}
        </div>
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
              <button type="button" className="ending-restart" onClick={onRestartFromBeginning}>
                처음부터 다시하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
