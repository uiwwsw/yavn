import SplashPage from '@/Splash';
import { useStorageContext } from './StorageContext';
import StartMenuPage from '@/StartMenu';
import GamePage from '@/Game';
import SavePage from '@/Save';
import CreditPage from '@/Credit';

const Routes = () => {
  const { page } = useStorageContext();
  switch (page) {
    case 'startMenu':
      return <StartMenuPage />;
    case 'game':
      return <GamePage />;
    case 'save':
      return <SavePage />;
    case 'credit':
      return <CreditPage />;
    default:
      return <SplashPage />;
  }
};

export default Routes;
