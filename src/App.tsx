import { ChangeEvent, MouseEvent, useEffect, useRef, useState } from 'react';
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
    foregroundBg,
    characters,
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
  const [bootMode, setBootMode] = useState<'launcher' | 'sample' | 'uploaded'>('launcher');
  const [uploading, setUploading] = useState(false);
  const [inputAnswer, setInputAnswer] = useState('');
  const holdTimerRef = useRef<number | undefined>(undefined);
  const holdStartRef = useRef<number>(0);
  const holdingRef = useRef(false);
  const youtubeIframeRef = useRef<HTMLIFrameElement | null>(null);
  const youtubePlayerId = 'vn-cutscene-youtube-player';

  useEffect(() => {
    if (window.location.pathname === '/sample') {
      setBootMode('sample');
      void loadGameFromUrl('/sample/');
    } else {
      setBootMode('launcher');
    }
  }, []);

  useAdvanceByKey();

  const effectClass = effect ? `effect-${effect}` : '';
  const activeSpeakerId = dialog.speakerId;
  const hasActiveSpeaker =
    typeof activeSpeakerId === 'string' && Object.values(characters).some((slot) => slot?.id === activeSpeakerId);

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
    }
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

  const renderCharacter = (slot: CharacterSlot | undefined, position: Position) => {
    if (!slot) {
      return null;
    }
    const emphasisClass = hasActiveSpeaker ? (slot.id === activeSpeakerId ? 'char-active' : 'char-inactive') : '';
    const className = `char ${position}${emphasisClass ? ` ${emphasisClass}` : ''}`;
    if (slot.kind === 'live2d') {
      return (
        <Live2DCharacter
          key={`${position}-${slot.id}-${slot.source}-${slot.emotion ?? ''}`}
          slot={slot}
          position={position}
          className={emphasisClass}
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
      />
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
          <p className="launcher-eyebrow">TYPO-DRIVEN WEB VN ENGINE</p>
          <h1>YAML + ZIP으로 바로 실행되는 비주얼노벨 엔진</h1>
          <p className="launcher-lead">
            무엇인지: 가장 심플한 타이포 기반 게임엔진입니다.
            <br />
            어떻게 동작하나: YAML과 에셋을 ZIP으로 업로드하면 즉시 플레이됩니다.
          </p>

          <div className="launcher-cta">
            <a className="sample-link sample-link-primary" href="/sample">
              샘플 게임 보기
            </a>
            <a className="sample-zip-link" href="/sample.zip" download>
              sample.zip 다운로드
            </a>
            <label className="zip-upload">
              내 ZIP 업로드
              <input type="file" accept=".zip,application/zip" onChange={onUploadZip} />
            </label>
          </div>

          <section className="launcher-section">
            <h2>어떻게 동작하나</h2>
            <ol className="how-list">
              <li>
                <strong>1. YAML 작성</strong>
                <span>대사/연출을 `1.yaml` 같은 파일로 작성합니다.</span>
              </li>
              <li>
                <strong>2. 에셋 ZIP 압축</strong>
                <span>이미지/사운드를 `assets/...` 구조로 묶어 ZIP을 만듭니다.</span>
              </li>
              <li>
                <strong>3. 업로드 즉시 실행</strong>
                <span>ZIP 업로드 직후 게임이 바로 시작됩니다.</span>
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
              <strong>샘플은 어디서 확인하나요?</strong>
              <p>`샘플 게임 보기`로 즉시 플레이하고, `sample.zip 다운로드`로 구조를 확인할 수 있습니다.</p>
            </div>
          </section>

          {error && <div className="launcher-error">{error.message}</div>}
        </div>
      </div>
    );
  }

  return (
    <div
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
      {foregroundBg && <img className="bg-foreground" src={foregroundBg} alt="foreground background" />}

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

      <div className={`dialog-box ${videoCutscene.active ? 'hidden' : ''}`}>
        <div className="speaker">{dialog.speaker ?? 'Narration'}</div>
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
              className="input-gate-field"
              type="text"
              value={inputAnswer}
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
