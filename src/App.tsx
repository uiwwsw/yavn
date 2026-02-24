import { ChangeEvent, useEffect, useState } from 'react';
import { handleAdvance, loadGameFromUrl, loadGameFromZip } from './engine';
import { useVNStore } from './store';

function useAdvanceByKey() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
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

  if (bootMode === 'launcher') {
    return (
      <div className="launcher">
        <div className="launcher-card">
          <h1>Visual Novel Engine</h1>
          <p>
            yaml + 이미지 배경등을 zip로 압축하여 올려보세요.
            <br />
            업로드 시 그 게임이 바로 시작됩니다.
          </p>
          <label className="zip-upload">
            ZIP 업로드
            <input type="file" accept=".zip,application/zip" onChange={onUploadZip} />
          </label>
          <a className="sample-zip-link" href="/sample/sample.zip" download>
            sample.zip 다운로드
          </a>
          <a className="sample-link" href="/sample">
            샘플 게임 보기
          </a>
          {error && <div className="launcher-error">{error.message}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className={`app ${effectClass}`} onClick={() => handleAdvance()}>
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
    </div>
  );
}
