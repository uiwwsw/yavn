import Routes from '@/Routes';
import { TypingSoundProvider } from './components/TypingSoundContext';

const App = () => {
  return (
    <TypingSoundProvider>
      <div className="relative h-full w-full select-none">
        <Routes />
      </div>
    </TypingSoundProvider>
  );
};

export default App;
