import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initializePromptLayout } from './promptLayout';
import './styles.css';
import './choiceLayout.mobile.css';
import './promptLayout.css';

initializePromptLayout();

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);