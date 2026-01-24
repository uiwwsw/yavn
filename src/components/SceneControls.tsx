import { useTypingSound } from './TypingSoundContext';

interface SceneControlsProps {
  auto: boolean;
  onAutoChange: (next: boolean) => void;
  pass: boolean;
  onPassChange: (next: boolean) => void;
}

const chipBase =
  'inline-flex items-center gap-2 rounded-md border px-2 py-1 text-[11px] sm:text-[12px] font-mono transition-colors whitespace-nowrap';

const SceneControls = ({ auto, onAutoChange, pass, onPassChange }: SceneControlsProps) => {
  const { enabled: soundEnabled, toggleEnabled } = useTypingSound();

  return (
    <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-white/80 shadow-xl shadow-black/40 backdrop-blur-md sm:gap-2 sm:py-1.5">
      <button
        type="button"
        aria-pressed={auto}
        className={`${chipBase} ${
          auto
            ? 'border-emerald-300/40 bg-emerald-400/20 text-emerald-200'
            : 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10'
        }`}
        onClick={() => onAutoChange(!auto)}
      >
        <span className={`h-2 w-2 rounded-full ${auto ? 'bg-emerald-300' : 'bg-white/30'}`} />
        AUTO
      </button>

      <button
        type="button"
        aria-pressed={soundEnabled}
        className={`${chipBase} ${
          soundEnabled
            ? 'border-purple-300/40 bg-purple-400/20 text-purple-200'
            : 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10'
        }`}
        onClick={toggleEnabled}
        title="타이핑 소리 켜기/끄기"
      >
        <span className={`h-2 w-2 rounded-full ${soundEnabled ? 'bg-purple-300' : 'bg-white/30'}`} />
        SOUND
      </button>

      <button
        type="button"
        aria-pressed={pass}
        className={`${chipBase} ${
          pass
            ? 'border-sky-300/40 bg-sky-400/20 text-sky-200'
            : 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10'
        }`}
        onClick={() => onPassChange(!pass)}
      >
        <span className={`h-2 w-2 rounded-full ${pass ? 'bg-sky-300' : 'bg-white/30'}`} />
        PASS
      </button>
    </div>
  );
};

export default SceneControls;
