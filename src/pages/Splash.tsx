import Fade from '@/Fade';
import { useStorageContext } from '@/StorageContext';

import Assets from '@/Assets';
// import viteLogo from '/vite.svg';

const SplashPage = () => {
  const { addStorage } = useStorageContext();
  const handleComplete = async () => {
    addStorage({ page: 'startMenu' });
  };

  return (
    <Assets
      assets={[
        '/splash/typescript.svg',
        '/splash/react.svg',
        '/splash/tailwindcss.svg',
        '/splash/swr.svg',
        '/splash/chatgpt.png',
      ]}
    >
      <Fade onComplete={handleComplete} className="flex h-full w-full items-center justify-center text-white">
        <span className="text-7xl">
          <img src="/splash/typescript.svg" width={100} alt="타입스크립트" />
          Typescript
        </span>
        <span className="text-7xl">
          <img src="/splash/react.svg" width={100} alt="리엑트" />
          React
        </span>
        <span className="text-7xl">
          <img src="/splash/tailwindcss.svg" width={100} alt="테일윈드" />
          Tailwind
        </span>
        <div className="flex h-full w-full justify-center bg-white">
          <span className="self-center text-7xl text-black ">
            <img src="/splash/swr.svg" width={100} alt="swr" />
            SWR
          </span>
        </div>
        <span className="text-7xl">
          <img src="/splash/chatgpt.png" width={100} alt="ChatGPT" />
          ChatGPT
        </span>
      </Fade>
    </Assets>
  );
};

export default SplashPage;
