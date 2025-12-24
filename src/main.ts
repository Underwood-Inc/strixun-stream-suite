/**
 * Strixun Stream Suite - Main Entry Point
 * 
 * Initializes the Svelte application
 */

import { mount } from 'svelte';
import App from './App.svelte';
import './styles/main.scss';

// Initialize core communication layer FIRST
import { initializeCore } from './core/init';

// Set chat signaling server URL
if (typeof window !== 'undefined') {
  (window as any).CHAT_SIGNALING_URL = 'https://strixun-chat-signaling.strixuns-script-suite.workers.dev';
}

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

// Initialize core architecture
initializeCore().catch(error => {
  // Log error - use store if available
  if (typeof window !== 'undefined' && (window as any).addLogEntry) {
    (window as any).addLogEntry(`Failed to initialize core: ${error instanceof Error ? error.message : String(error)}`, 'error', 'ERROR');
  }
});

// Initialize the app using Svelte 5 mount API
const app = mount(App, {
  target: document.body,
  props: {}
});

// Don't initialize here - let App.svelte handle it in onMount
// This ensures the Svelte app is fully mounted before initialization

export default app;

