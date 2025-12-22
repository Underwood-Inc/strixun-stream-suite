/**
 * Strixun Stream Suite - Main Entry Point
 * 
 * Initializes the Svelte application
 */

import App from './App.svelte';
import './styles/main.scss';

// Import modules to ensure they're available
import './modules/app';
import './modules/layouts';
import './modules/script-status';
import './modules/source-swaps';
import './modules/sources';
import './modules/storage';
import './modules/storage-sync';
import './modules/text-cycler';
import './modules/twitch-api';
import './modules/ui-utils';
import './modules/version';
import './modules/websocket';

// Initialize the app
const app = new App({
  target: document.body,
  props: {}
});

// Don't initialize here - let App.svelte handle it in onMount
// This ensures the Svelte app is fully mounted before initialization

export default app;

