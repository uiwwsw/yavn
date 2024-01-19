import { useState } from 'react';
import { Outlet } from 'react-router-dom';

// import reactLogo from './assets/react.svg';
// import viteLogo from '/vite.svg';

const StartLayout = () => {
  const [count, setCount] = useState(0);

  return (
    <div className="flex h-screen w-screen items-center overflow-hidden bg-black">
      <Outlet />
    </div>
  );
};

export default StartLayout;
