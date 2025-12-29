/**
 * URL Shortener App Entry Point
 */

import './app.scss';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

const container = document.getElementById('app');
if (!container) {
  throw new Error('Failed to find app container');
}

const root = createRoot(container);
root.render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

