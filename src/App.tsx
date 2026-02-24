import { useEffect, useMemo } from 'react';
import { handleAdvance, loadGameFromUrl } from './engine';
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
  const { background, characters, dialog, effect, error, busy, isFinished, game } = useVNStore();

  useEffect(() => {
    void loadGameFromUrl('/sample.yaml');
  }, []);

  useAdvanceByKey();

  const effectClass = useMemo(() => {
    if (effect === 'shake') {
      return 'effect-shake';
    }
    if (effect === 'flash') {
      return 'effect-flash';
    }
    return '';
  }, [effect]);

  return (
    <div className={`app ${effectClass}`} onClick={() => handleAdvance()}>
      <div className="overlay" />
      {background && <img className="bg" src={background} alt="background" />}

      <div className="char-layer">
        {characters.left && <img className="char left" src={characters.left.image} alt={characters.left.id} />}
        {characters.center && <img className="char center" src={characters.center.image} alt={characters.center.id} />}
        {characters.right && <img className="char right" src={characters.right.image} alt={characters.right.id} />}
      </div>

      <div className="hud">
        <div className="meta">{game?.meta.title ?? 'Loading...'}</div>
        <div className="hint">Click / Enter / Space</div>
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
