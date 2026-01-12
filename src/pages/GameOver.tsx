import Btn from '@/Btn';
import { useStorageContext } from '@/useStorageContext';
import { motion } from 'framer-motion';

const GameOverPage = () => {
  const { level, addStorage } = useStorageContext();
  const handleRetry = () => addStorage({ page: 'game', level: level ?? 0 });
  const handleTitle = () => addStorage({ page: 'startMenu', level: 0 });

  return (
    <motion.div
      className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex w-full max-w-md flex-col gap-6 rounded-2xl border border-red-400/20 bg-white/5 p-8 text-center shadow-2xl backdrop-blur">
        <div>
          <p className="text-sm uppercase tracking-[0.4em] text-red-300">System Halted</p>
          <h1 className="text-3xl font-bold text-white">게임 오버</h1>
        </div>
        <p className="text-sm text-slate-100/80">
          전투에서 패배했습니다. 장비를 점검하고 다시 도전해 보세요.
        </p>
        <div className="flex flex-col gap-3">
          <Btn onClick={handleRetry}>다시 시도</Btn>
          <Btn autoFocus onClick={handleTitle}>
            타이틀로 돌아가기
          </Btn>
        </div>
      </div>
    </motion.div>
  );
};

export default GameOverPage;
