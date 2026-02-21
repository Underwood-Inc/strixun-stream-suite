/**
 * Strixun Stream Suite - Main Entry Point
 * 
 * Initializes the Svelte application
 */

// CRITICAL: Handle display route query parameters IMMEDIATELY
// OBS browser sources sometimes strip hash fragments, so we use query params
// ?display=text-cycler&id=xxx → redirect to #/text-cycler-display?id=xxx
(function handleDisplayRouteRedirect() {
  const params = new URLSearchParams(window.location.search);
  const displayType = params.get('display');
  const configId = params.get('id');
  
  if (displayType === 'text-cycler' && configId) {
    // Redirect to hash-based route (preserves the URL for the app)
    const newUrl = window.location.origin + window.location.pathname + 
      '#/text-cycler-display?id=' + encodeURIComponent(configId);
    console.log('[MAIN.TS] Redirecting display route:', newUrl);
    window.location.replace(newUrl);
    // Stop execution - page will reload with correct hash
    throw new Error('DISPLAY_ROUTE_REDIRECT');
  }
})();

// CRITICAL: Set up window.addLogEntry IMMEDIATELY and SYNCHRONOUSLY
// SIMPLIFIED - Direct import, no queue bullshit
if (typeof window !== 'undefined') {
  // Set up window.addLogEntry to directly import and call the store
  (window as any).addLogEntry = async (
    message: string,
    type: 'info' | 'success' | 'error' | 'warning' | 'debug' = 'info',
    flair?: string,
    icon?: string
  ) => {
    try {
      // Direct import and call - no queue, no complexity
      const { addLogEntry } = await import('./stores/activity-log');
      addLogEntry(message, type, flair, icon);
    } catch (err) {
      // Fallback to console
      const consoleMethod = type === 'error' ? console.error : 
                            type === 'warning' ? console.warn :
                            type === 'debug' ? console.debug : 
                            console.log;
      consoleMethod(`[${type.toUpperCase()}] ${message}`);
    }
  };
  
  (window as any).clearLogEntries = async () => {
    try {
      const { clearLogEntries } = await import('./stores/activity-log');
      clearLogEntries();
    } catch (err) {
      console.error('[clearLogEntries] Failed:', err);
    }
  };
  
  // Set chat signaling server URL (API at chat-api.idling.app)
  (window as any).CHAT_SIGNALING_URL = 'https://chat-api.idling.app';
}

import { mount } from 'svelte';
import App from './App.svelte';
import './styles/main.scss';

// Initialize core communication layer FIRST
import { initializeCore } from './core/init';

// Import modules to ensure they're available
import './modules/app';
import './modules/layouts';
import './modules/script-status';
import './modules/source-swaps';
import './modules/sources';
import './modules/storage';
import './modules/storage-sync';
import './modules/api-url';
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

// Service worker registration is handled by vite-plugin-pwa automatically

export default app;
