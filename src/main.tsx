import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initializePromptLayout } from './promptLayout';
import './styles.css';
import './launcher.css';
import './titleScene.css';
import './choiceLayout.mobile.css';
import './promptLayout.css';
import './gameInterface.css';

initializePromptLayout();

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);