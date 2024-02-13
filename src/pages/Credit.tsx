// import viteLogo from '/vite.svg';

import Btn from '@/Btn';
import { useStorageContext } from '@/StorageContext';
import { motion } from 'framer-motion';

const CreditPage = () => {
  const { addStorage } = useStorageContext();
  const handleClick = () => addStorage({ page: 'startMenu' });
  return (
    <motion.div
      className="relative h-full text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      만든이
      <ul className="h-full">
        <li>uiwwsw</li>
        <li>matthew</li>
        <li>윤창원</li>
      </ul>
      <Btn onClick={handleClick}>처음부터 시작하기</Btn>
    </motion.div>
  );
};

export default CreditPage;
