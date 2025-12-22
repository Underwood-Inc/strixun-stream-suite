/**
 * Strixun Stream Suite - Main Entry Point
 * 
 * Initializes the Svelte application
 */

import App from './App.svelte';
import './styles/main.scss';

// Import modules to ensure they're available
import './modules/storage';
import './modules/websocket';
import './modules/text-cycler';

// Initialize the app
const app = new App({
  target: document.body,
  props: {}
});

export default app;

