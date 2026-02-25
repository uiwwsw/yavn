import { ChangeEvent, MouseEvent, useEffect, useState } from 'react';
import { handleAdvance, loadGameFromUrl, loadGameFromZip, restartFromBeginning, unlockAudioFromGesture } from './engine';
import { useVNStore } from './store';

function useAdvanceByKey() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
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
    chapterIndex,
    chapterTotal,
    chapterLoading,
    chapterLoadingProgress,
    chapterLoadingMessage,
  } = useVNStore();
  const [bootMode, setBootMode] = useState<'launcher' | 'sample' | 'uploaded'>('launcher');
  const [uploading, setUploading] = useState(false);

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
        unlockAudioFromGesture();
        handleAdvance();
      }}
    >
      <div className="overlay" />
      {background && <img className="bg" src={background} alt="background" />}

      <div className="char-layer">
        {characters.left && (
          <img
            key={`left-${characters.left.id}-${characters.left.image}`}
            className="char left"
            src={characters.left.image}
            alt={characters.left.id}
            loading="eager"
            decoding="async"
          />
        )}
        {characters.center && (
          <img
            key={`center-${characters.center.id}-${characters.center.image}`}
            className="char center"
            src={characters.center.image}
            alt={characters.center.id}
            loading="eager"
            decoding="async"
          />
        )}
        {characters.right && (
          <img
            key={`right-${characters.right.id}-${characters.right.image}`}
            className="char right"
            src={characters.right.image}
            alt={characters.right.id}
            loading="eager"
            decoding="async"
          />
        )}
      </div>
      {foregroundBg && <img className="bg-foreground" src={foregroundBg} alt="foreground background" />}

      <div className="hud">
        <div className="meta">
          {game?.meta.title ?? 'Loading...'}
          {chapterTotal > 0 ? ` (${chapterIndex}/${chapterTotal})` : ''}
        </div>
        <div className="hint">{uploading ? 'ZIP Loading...' : 'Click / Enter / Space'}</div>
      </div>

      <div className="dialog-box">
        <div className="speaker">{dialog.speaker ?? 'Narration'}</div>
        <div className="text">{dialog.visibleText}</div>
        <div className="status">{busy ? '...' : isFinished ? 'End' : 'Next'}</div>
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
