// import reactLogo from './assets/react.svg';
// import viteLogo from '/vite.svg';

import Btn from '@/Btn';
import { useStorageContext } from '@/useStorageContext';
import { motion } from 'framer-motion';
import { useMemo } from 'react';

const SavePage = () => {
  const { level, addStorage } = useStorageContext();
  const chapterNumber = useMemo(() => (level ?? 0) + 1, [level]);
  const nextLevel = useMemo(() => chapterNumber, [chapterNumber]);

  const handleGame = () => addStorage({ level: nextLevel, page: 'game' });
  const handleSave = () => {
    const blob = new Blob([`${nextLevel}`], { type: 'JSON' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "matthew's_save.json"; // 저장할 파일 이름
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url); // URL 해제
    handleGame();
  };
  return (
    <motion.div
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-56 w-56 translate-x-16 translate-y-16 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>
      <div className="relative flex w-full max-w-md flex-col items-center gap-6 rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur">
        <span className="text-sm uppercase tracking-[0.35em] text-emerald-200">Chapter {chapterNumber}</span>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-white">챕터 {chapterNumber} 종료</h1>
          <p className="text-sm text-slate-200/80">
            이어지는 이야기를 저장하거나 바로 다음 장을 시작해 보세요.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3">
          <Btn onClick={handleSave}>진행 상황 저장</Btn>
          <Btn autoFocus onClick={handleGame}>
            다음 챕터로 이동
          </Btn>
        </div>
      </div>
    </motion.div>
  );
};

export default SavePage;
