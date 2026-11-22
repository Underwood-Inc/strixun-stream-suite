import React from 'react';
import ReactDOM from 'react-dom/client';
import { installFeatureFlagsFetchHook } from '@strixun/api-framework/client';
import { App } from './App';
import './app.scss';

installFeatureFlagsFetchHook();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
