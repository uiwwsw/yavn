import SplashPage from '@/Splash';
import { useStorageContext } from './StorageContext';
import StartMenuPage from '@/StartMenu';
import MainPage from '@/Main';

const Routes = () => {
  const { page } = useStorageContext();
  switch (page) {
    case 'startMenu':
      return <StartMenuPage />;
    case 'start':
      return <MainPage />;
    case 'load':
      return <MainPage />;
    default:
      return <SplashPage />;
  }
};

export default Routes;
