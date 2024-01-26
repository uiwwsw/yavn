import React from 'react';
import ReactDOM from 'react-dom/client';
import { StorageProvider } from '@/StorageContext';
import App from './App.tsx';
import './index.scss';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StorageProvider>
      <App />
    </StorageProvider>
  </React.StrictMode>,
);
