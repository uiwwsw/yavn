import Fade from '@/Fade';
import { useStorageContext } from '@/StorageContext';
import { useNavigate } from 'react-router-dom';
import reactLogo from '$/react.svg';
import typescriptLogo from '$/typescript.svg';
import tailwindcssLogo from '$/tailwindcss.svg';
import swrLogo from '$/swr.svg';
// import viteLogo from '/vite.svg';

const SplashPage = () => {
  const { addStorage } = useStorageContext();
  const handleComplete = async () => {
    addStorage({ page: 'start' });
  };
  return (
    <Fade onComplete={handleComplete} className="flex h-full w-full items-center justify-center text-white">
      <span className="text-7xl">
        <img src={typescriptLogo} width={100} alt="타입스크립트" />
        Typescript
      </span>
      <span className="text-7xl">
        <img src={reactLogo} width={100} alt="리엑트" />
        React
      </span>
      <span className="text-7xl">
        <img src={tailwindcssLogo} width={100} alt="테일윈드" />
        Tailwind
      </span>
      <div className="flex h-full w-full justify-center bg-white">
        <span className="self-center text-7xl text-black ">
          <img src={swrLogo} width={100} alt="swr" />
          SWR
        </span>
      </div>
    </Fade>
  );
};

export default SplashPage;
