// import viteLogo from '/vite.svg';

import Button from '@/Button';
import { useStorageContext } from '@/StorageContext';
import { motion } from 'framer-motion';

const StartPage = () => {
  const { addStorage } = useStorageContext();

  const handleStart = () => {
    addStorage({ page: 'game' });
  };
  const handleLoad = () => {
    addStorage({ page: 'game' });
  };
  return (
    <motion.div
      className="relative h-full text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <h1 className="text-center text-5xl">visual novel</h1>
      <p className="text-right">made by react</p>
      <div className="absolute inset-0 top-auto m-auto flex w-3/5 flex-col gap-3">
        <Button onClick={handleStart}>시작하기</Button>
        <Button onClick={handleLoad}>불러오기</Button>
      </div>
    </motion.div>
  );
};

export default StartPage;
