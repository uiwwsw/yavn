import MainPage from '@/Main';
import SplashPage from '@/Splash';
import StartPage from '@/Start';
import { useStorageContext } from '@/StorageContext';

const App = () => {
  const { page } = useStorageContext();
  return (
    <>
      {page === undefined && <SplashPage />}
      {page === 'start' && <StartPage />}
      {page === 'game' && <MainPage />}
    </>
  );
};

export default App;
