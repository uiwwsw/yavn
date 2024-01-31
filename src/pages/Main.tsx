// import reactLogo from './assets/react.svg';
// import viteLogo from '/vite.svg';

import Scene from '@/Scene';
import { motion } from 'framer-motion';
import { useState } from 'react';

const MainPage = () => {
  const [level, setLevel] = useState(0);
  // useEffect(() => {
  //   if (!storage.isStart) navigate('/splash');
  // }, [storage]);
  return (
    <motion.div
      className="relative h-full w-full border text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Scene chapter={level} onComplete={() => setLevel(level + 1)} />
    </motion.div>
  );
};

export default MainPage;
