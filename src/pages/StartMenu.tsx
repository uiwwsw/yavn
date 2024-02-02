// import viteLogo from '/vite.svg';

import Btn from '@/Btn';
import { useStorageContext } from '@/StorageContext';
import LoadBtn from '@/LoadBtn';
import { motion } from 'framer-motion';

const StartMenuPage = () => {
  const { addStorage } = useStorageContext();

  const handleStart = () => {
    addStorage({ page: 'game', level: 0 });
  };
  const handleLoad = (level: number) => {
    addStorage({ page: 'game', level });
  };
  return (
    <motion.div
      className="relative h-full text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <img className="h-full w-full object-cover" src="/start.png" alt="시작화면" />
      <div className="absolute inset-0 top-auto m-auto flex w-3/5 flex-col gap-3 pb-10">
        <Btn autoFocus onClick={handleStart}>
          시작하기
        </Btn>
        <LoadBtn onChange={handleLoad}>불러오기</LoadBtn>
      </div>
    </motion.div>
  );
};

export default StartMenuPage;
