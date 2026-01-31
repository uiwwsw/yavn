import SplashPage from '@/Splash';
import { useStorageContext } from './useStorageContext';
import StartMenuPage from '@/StartMenu';
import GamePage from '@/Game';
import SavePage from '@/Save';
import CreditPage from '@/Credit';
import GameOverPage from '@/GameOver';
import ToBeContinuedPage from '@/ToBeContinued';

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
    case 'toBeContinued':
      return <ToBeContinuedPage />;
    default:
      return <SplashPage />;
  }
};

export default Routes;
