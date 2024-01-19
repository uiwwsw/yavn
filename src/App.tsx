// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'

import MainPage from '@/Main';
import StartLayout from '@/Start';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route element={<StartLayout />}>
          <Route path="/" element={<MainPage />} />
        </Route>
        {/* <Route element={<StartLayout />}>
          <Route path="/" element={<Main />} />
        </Route> */}
        {/* <Route path={ROUTES_PATH['/sign-out']} element={<SignOut />} /> */}
      </Routes>
    </Router>
  );
};

export default App;
