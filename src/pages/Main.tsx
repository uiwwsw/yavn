// import reactLogo from './assets/react.svg';
// import viteLogo from '/vite.svg';

import Script from '@/Script';
import { motion } from 'framer-motion';

const MainPage = () => {
  // useEffect(() => {
  //   if (!storage.isStart) navigate('/splash');
  // }, [storage]);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Script level={0} onComplete={() => console.log('dwdwa')} />
    </motion.div>
  );
};

export default MainPage;
