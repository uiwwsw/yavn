import Fade from '@/Fade';
import { useState } from 'react';
// import reactLogo from './assets/react.svg';
// import viteLogo from '/vite.svg';

const MainPage = () => {
  const [count, setCount] = useState(0);

  return (
    <div className="m-auto h-[480px] w-[640px]">
      <Fade>
        <span className="text-white">uiwwsw</span>
        <span className="text-white">uiwwsw</span>
      </Fade>
    </div>
  );
};

export default MainPage;
