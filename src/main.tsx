import React from 'react';
import ReactDOM from 'react-dom/client';
import { StorageProvider } from '@/StorageContext';
import { SettingsProvider } from './contexts/SettingsContext';
import ErrorBoundary from '@/ErrorBoundary';
import App from './App.tsx';
import './index.scss';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <SettingsProvider>
        <StorageProvider>
          <App />
        </StorageProvider>
      </SettingsProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
