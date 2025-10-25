// import reactLogo from './assets/react.svg';
// import viteLogo from '/vite.svg';

import Btn from '@/Btn';
import { useStorageContext } from '@/StorageContext';
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
      className="relative flex h-full w-full items-center border text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex w-full flex-col items-center gap-3 p-5">
        <h1 className="text-center">챕터{chapterNumber} 끝</h1>
        <Btn onClick={handleSave}>저장</Btn>
        <Btn autoFocus onClick={handleGame}>
          바로 시작
        </Btn>
      </div>
    </motion.div>
  );
};

export default SavePage;
