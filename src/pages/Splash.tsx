import Fade from '@/Fade';
import Preload from '@/Preload';
import { useStorageContext } from '@/useStorageContext';

const splashAssets = [
  '/splash/typescript.svg',
  '/splash/react.svg',
  '/splash/tailwindcss.svg',
  '/splash/swr.svg',
  '/splash/chatgpt.png',
  '/start.png',
  '/start.mp3',
];

const SplashPage = () => {
  const { addStorage } = useStorageContext();

  const handleComplete = () => {
    addStorage({ page: 'startMenu' });
  };

  return (
    <Preload assets={splashAssets}>
      <Fade onComplete={handleComplete} className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black text-white">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-slate-950 to-black" />
        <div className="absolute inset-0 opacity-40" style={{ background: 'radial-gradient(circle at 50% 30%, rgba(56, 189, 248, 0.18), transparent 55%)' }} />

        <div className="relative flex flex-col items-center gap-6">
          <div className="text-[11px] uppercase tracking-[0.35em] text-white/55">Powered by</div>
          <div className="flex items-center gap-4">
            <img src="/splash/typescript.svg" className="h-20 w-20" alt="TypeScript" />
            <div>
              <div className="text-3xl font-semibold tracking-tight">TypeScript</div>
              <div className="text-sm text-white/60">Type-safe narrative runtime</div>
            </div>
          </div>
        </div>

        <div className="relative flex flex-col items-center gap-6">
          <div className="text-[11px] uppercase tracking-[0.35em] text-white/55">Powered by</div>
          <div className="flex items-center gap-4">
            <img src="/splash/react.svg" className="h-20 w-20" alt="React" />
            <div>
              <div className="text-3xl font-semibold tracking-tight">React</div>
              <div className="text-sm text-white/60">Scene composition</div>
            </div>
          </div>
        </div>

        <div className="relative flex flex-col items-center gap-6">
          <div className="text-[11px] uppercase tracking-[0.35em] text-white/55">Powered by</div>
          <div className="flex items-center gap-4">
            <img src="/splash/tailwindcss.svg" className="h-20 w-20" alt="Tailwind CSS" />
            <div>
              <div className="text-3xl font-semibold tracking-tight">Tailwind CSS</div>
              <div className="text-sm text-white/60">UI styling system</div>
            </div>
          </div>
        </div>

        <div className="relative flex flex-col items-center gap-6">
          <div className="text-[11px] uppercase tracking-[0.35em] text-white/55">Powered by</div>
          <div className="flex items-center gap-4">
            <img src="/splash/swr.svg" className="h-20 w-20" alt="SWR" />
            <div>
              <div className="text-3xl font-semibold tracking-tight">SWR</div>
              <div className="text-sm text-white/60">Data loading</div>
            </div>
          </div>
        </div>

        <div className="relative flex flex-col items-center gap-6">
          <div className="text-[11px] uppercase tracking-[0.35em] text-white/55">Assisted by</div>
          <div className="flex items-center gap-4">
            <img src="/splash/chatgpt.png" className="h-20 w-20 rounded-xl" alt="ChatGPT" />
            <div>
              <div className="text-3xl font-semibold tracking-tight">ChatGPT</div>
              <div className="text-sm text-white/60">Prototyping partner</div>
            </div>
          </div>
        </div>
      </Fade>
    </Preload>
  );
};

export default SplashPage;
