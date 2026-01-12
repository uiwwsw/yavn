import SplashPage from '@/Splash';
import { useStorageContext } from './useStorageContext';
import StartMenuPage from '@/StartMenu';
import GamePage from '@/Game';
import SavePage from '@/Save';
import CreditPage from '@/Credit';
import GameOverPage from '@/GameOver';

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
    case 'gameOver':
      return <GameOverPage />;
    default:
      return <SplashPage />;
  }
};

export default Routes;
