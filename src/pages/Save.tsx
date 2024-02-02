// import reactLogo from './assets/react.svg';
// import viteLogo from '/vite.svg';

import Btn from '@/Btn';
import { useStorageContext } from '@/StorageContext';
import { motion } from 'framer-motion';
import { useMemo } from 'react';

const SavePage = () => {
  const { level, addStorage } = useStorageContext();
  const nextLevel = useMemo(() => (level ?? 0) + 1, [level]);

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
      className="relative h-full w-full border text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <h1>PAUSE</h1>
      <Btn onClick={handleSave}>저장</Btn>
      <Btn onClick={handleGame}>저장없이 시작</Btn>
    </motion.div>
  );
};

export default SavePage;
