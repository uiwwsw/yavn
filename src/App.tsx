import { ChangeEvent, MouseEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  completeVideoCutscene,
  handleAdvance,
  loadGameFromUrl,
  loadGameFromZip,
  resetVideoSkipProgress,
  restartFromBeginning,
  revealVideoSkipGuide,
  skipVideoCutscene,
  submitInputAnswer,
  unlockAudioFromGesture,
  updateVideoSkipProgress,
} from './engine';
import { Live2DCharacter } from './Live2DCharacter';
import { useVNStore } from './store';
import type { CharacterSlot, Position } from './types';
import type { CSSProperties } from 'react';

type GameListManifestEntry = {
  id: string;
  name: string;
  path: string;
};

type GameListManifest = {
  games: GameListManifestEntry[];
};

const POSITION_TIEBREAKER: Record<Position, number> = {
  center: 0,
  left: 1,
  right: 2,
};

function useAdvanceByKey() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName.toLowerCase();
        if (target.isContentEditable || tag === 'input' || tag === 'textarea') {
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
  const inputFieldRef = useRef<HTMLInputElement | null>(null);
  const appRef = useRef<HTMLDivElement | null>(null);
  const dialogBoxRef = useRef<HTMLDivElement | null>(null);
  const [stickerSafeInset, setStickerSafeInset] = useState(0);
  const youtubePlayerId = 'vn-cutscene-youtube-player';
  const sampleZipUrl = '/sample.zip';
  const shareByPrUrl = 'https://github.com/uiwwsw/visual-novel/compare';

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
      if (holdTimerRef.current) {
        window.clearInterval(holdTimerRef.current);
        holdTimerRef.current = undefined;
      }
    };
  }, []);

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
      if (payload.event === 'onStateChange' && payload.info === 0 && payload.id === youtubePlayerId) {
        completeVideoCutscene();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [videoCutscene.active, videoCutscene.youtubeId]);

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
  }, [bootMode, dialog.visibleText, inputGate.active, updateStickerSafeInset, videoCutscene.active]);

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
    const className = `char ${position}`;
    if (slot.kind === 'live2d') {
      return (
        <Live2DCharacter
          key={`${position}-${slot.id}-${slot.source}-${slot.emotion ?? ''}`}
          slot={slot}
          position={position}
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

  const onRestart = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    void restartFromBeginning();
  };

  if (bootMode === 'launcher') {
    return (
      <div className="launcher">
        <div className="launcher-card">
          <p className="launcher-eyebrow">YAVN (야븐)</p>
          <h1>Type your story. Play your novel.</h1>
          <p className="launcher-lead">
            무엇인지: 가장 심플한 타이포 기반 게임엔진입니다.
            <br />
            어떻게 쓰나: ZIP으로 바로 실행해볼 수 있고, 공유는 PR로 등록합니다.
          </p>

          <div className="launcher-cta">
            <a className="sample-download-link" href={sampleZipUrl} download>
              샘플 파일 다운받기 (ZIP)
            </a>
            <label className="zip-upload">
              게임 실행해보기 (ZIP 올려서)
              <input type="file" accept=".zip,application/zip" onChange={onUploadZip} />
            </label>
            <a className="share-pr-link" href={shareByPrUrl} target="_blank" rel="noreferrer">
              게임 공유하기 (PR)
            </a>
          </div>
          <p className="launcher-cta-note">샘플 ZIP으로 구조를 먼저 확인하고, 공유를 원하면 포크/브랜치에서 PR을 열어 주세요.</p>

          <section className="launcher-section">
            <h2>게임 리스트</h2>
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

          <section className="launcher-section">
            <h2>어떻게 동작하나</h2>
            <ol className="how-list">
              <li>
                <strong>1. 샘플 ZIP 확인</strong>
                <span>`샘플 파일 다운받기 (ZIP)` 버튼으로 기본 파일 구조를 먼저 확인합니다.</span>
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

          <section className="launcher-section">
            <h2>핵심 기능</h2>
            <div className="feature-grid">
              <span>타이핑 효과</span>
              <span>챕터 프리로드</span>
              <span>goto/effect</span>
              <span>에러 라인 표시</span>
              <span>ZIP 즉시 실행</span>
              <span>YAML DSL</span>
            </div>
          </section>

          <section className="launcher-section">
            <h2>FAQ</h2>
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

      <div className="char-layer">
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
                const target = youtubeIframeRef.current?.contentWindow;
                if (!target) {
                  return;
                }
                target.postMessage(
                  JSON.stringify({
                    event: 'command',
                    func: 'addEventListener',
                    args: ['onStateChange'],
                    id: youtubePlayerId,
                  }),
                  '*',
                );
              }}
            />
          ) : (
            <video
              className="video-cutscene-frame video-cutscene-frame-native"
              src={videoCutscene.src}
              autoPlay
              muted
              playsInline
              onEnded={() => completeVideoCutscene()}
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
            <span>길게 눌러 건너뛰기</span>
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

      <div ref={dialogBoxRef} className={`dialog-box ${videoCutscene.active ? 'hidden' : ''}`}>
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
              확인
            </button>
          </form>
        )}
        <div className="status">{busy ? '...' : isFinished ? 'End' : inputGate.active ? '입력 대기' : 'Next'}</div>
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
          <div className="ending-card">
            <h2>THE END</h2>
            <p>모든 챕터를 끝까지 플레이했습니다.</p>
            <button type="button" className="ending-restart" onClick={onRestart}>
              처음부터 다시 시작
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
