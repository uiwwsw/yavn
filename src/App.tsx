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
  const { background, foregroundBg, characters, dialog, effect, error, busy, isFinished, game } = useVNStore();
  const [bootMode, setBootMode] = useState<'launcher' | 'sample' | 'uploaded'>('launcher');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (window.location.pathname === '/sample') {
      setBootMode('sample');
      void loadGameFromUrl('/sample.yaml');
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
        {characters.left && <img className="char left" src={characters.left.image} alt={characters.left.id} />}
        {characters.center && <img className="char center" src={characters.center.image} alt={characters.center.id} />}
        {characters.right && <img className="char right" src={characters.right.image} alt={characters.right.id} />}
      </div>
      {foregroundBg && <img className="bg-foreground" src={foregroundBg} alt="foreground background" />}

      <div className="hud">
        <div className="meta">{game?.meta.title ?? 'Loading...'}</div>
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
    </div>
  );
}
