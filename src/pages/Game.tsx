// import reactLogo from './assets/react.svg';
// import viteLogo from '/vite.svg';

import Scene from '@/Scene';
import { useStorageContext } from '@/StorageContext';
import { motion } from 'framer-motion';

const GamePage = () => {
  const { level, addStorage } = useStorageContext();

  const handleGoSavePage = () => addStorage({ page: 'save', level });
  return (
    <motion.div
      className="relative h-full w-full border text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Scene chapter={level ?? 0} onComplete={handleGoSavePage} />
    </motion.div>
  );
};

export default GamePage;
