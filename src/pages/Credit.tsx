// import viteLogo from '/vite.svg';

import { motion } from 'framer-motion';

const CreditPage = () => {
  return (
    <motion.div
      className="relative h-full text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <ul className="h-full">
        <li>uiwwsw</li>
        <li>matthew</li>
        <li>윤창원</li>
      </ul>
    </motion.div>
  );
};

export default CreditPage;
