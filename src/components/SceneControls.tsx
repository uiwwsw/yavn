import { useTypingSound } from './TypingSoundContext';

interface SceneControlsProps {
  auto: boolean;
  onAutoChange: (next: boolean) => void;
  pass: boolean;
  onPassChange: (next: boolean) => void;
  onBacklogOpen?: () => void;
  onSettingsOpen?: () => void;
  onSaveOpen?: () => void;
  onLoadOpen?: () => void;
}

const chipBase =
  'inline-flex items-center gap-2 rounded-md border px-2 py-1 text-[11px] sm:text-[12px] font-mono transition-colors whitespace-nowrap';

const SceneControls = ({ auto, onAutoChange, pass, onPassChange, onBacklogOpen, onSettingsOpen, onSaveOpen, onLoadOpen }: SceneControlsProps) => {
  const { enabled: soundEnabled, toggleEnabled } = useTypingSound();

  return (
    <>
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-white/80 shadow-xl shadow-black/40 backdrop-blur-md sm:gap-2 sm:py-1.5">
        {/* Auto 버튼 */}
        <button
          type="button"
          aria-pressed={auto}
          className={`${chipBase} ${auto
            ? 'border-emerald-300/40 bg-emerald-400/20 text-emerald-200'
            : 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10'
            }`}
          onClick={() => onAutoChange(!auto)}
          title="자동 진행 (A)"
        >
          <span className={`h-2 w-2 rounded-full ${auto ? 'bg-emerald-300' : 'bg-white/30'}`} />
          AUTO
        </button>

        {/* Sound 버튼 */}
        <button
          type="button"
          aria-pressed={soundEnabled}
          className={`${chipBase} ${soundEnabled
            ? 'border-purple-300/40 bg-purple-400/20 text-purple-200'
            : 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10'
            }`}
          onClick={toggleEnabled}
          title="타이핑 소리 켜기/끄기"
        >
          <span className={`h-2 w-2 rounded-full ${soundEnabled ? 'bg-purple-300' : 'bg-white/30'}`} />
          SOUND
        </button>

        {/* Pass 버튼 */}
        <button
          type="button"
          aria-pressed={pass}
          className={`${chipBase} ${pass
            ? 'border-sky-300/40 bg-sky-400/20 text-sky-200'
            : 'border-white/15 bg-white/5 text-white/80 hover:bg-white/10'
            }`}
          onClick={() => onPassChange(!pass)}
          title="빠른 진행 (Ctrl)"
        >
          <span className={`h-2 w-2 rounded-full ${pass ? 'bg-sky-300' : 'bg-white/30'}`} />
          PASS
        </button>

        {/* 구분선 */}
        <div className="h-4 w-px bg-white/20" />

        {/* 저장 버튼 */}
        {onSaveOpen && (
          <button
            type="button"
            className={`${chipBase} border-white/15 bg-white/5 text-white/80 hover:bg-white/10`}
            onClick={onSaveOpen}
            title="저장"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            SAVE
          </button>
        )}

        {/* 불러오기 버튼 */}
        {onLoadOpen && (
          <button
            type="button"
            className={`${chipBase} border-white/15 bg-white/5 text-white/80 hover:bg-white/10`}
            onClick={onLoadOpen}
            title="불러오기"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            LOAD
          </button>
        )}

        {/* 백로그 버튼 */}
        {onBacklogOpen && (
          <button
            type="button"
            className={`${chipBase} border-white/15 bg-white/5 text-white/80 hover:bg-white/10`}
            onClick={onBacklogOpen}
            title="대화 기록 (H)"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            LOG
          </button>
        )}

        {/* 설정 버튼 */}
        {onSettingsOpen && (
          <button
            type="button"
            className={`${chipBase} border-white/15 bg-white/5 text-white/80 hover:bg-white/10`}
            onClick={onSettingsOpen}
            title="설정 (ESC)"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}
      </div>
    </>
  );
};

export default SceneControls;
