/**
 * Application Bootstrap
 * 
 * Initializes all modules and sets up the application
 */

import { navigateTo, restorePage } from '../stores/navigation';
import { connected, currentScene, sources, textSources } from '../stores/connection';
import { initIndexedDB, loadStorageCache, storage } from './storage';
import { loadCredentials, connect as wsConnect } from './websocket';
import * as textCycler from './text-cycler';

/**
 * Initialize the application
 */
export async function initializeApp(): Promise<void> {
  console.log('[Bootstrap] Starting application initialization...');
  
  try {
    // CRITICAL: Initialize storage system FIRST
    await initIndexedDB();
    await loadStorageCache();
    console.log('[Bootstrap] Storage system ready');
    
    // Initialize modules in order
    await initializeModules();
    
    // Restore saved page
    restorePage();
    
    // Load saved credentials and auto-connect
    await loadCredentialsAndConnect();
    
    console.log('[Bootstrap] Application initialized');
  } catch (error) {
    console.error('[Bootstrap] Initialization error:', error);
  }
}

/**
 * Initialize all modules
 */
async function initializeModules(): Promise<void> {
  // Initialize Source Swaps
  if (window.SourceSwaps) {
    window.SourceSwaps.init({
      storage: storage,
      log: (msg: string, type?: string) => {
        // Use logger module when available
        if (window.App?.log) {
          window.App.log(msg, type);
        } else {
          console.log(`[${type || 'info'}] ${msg}`);
        }
      },
      get connected() { return window.connected || false; },
      get currentScene() { return window.currentScene || ''; },
      get sources() { return window.sources || []; },
      request: window.request,
      isOBSDock: window.isOBSDock,
      showPage: navigateTo,
      initSearchForList: window.UIUtils?.initSearchForList
    });
    window.SourceSwaps.loadConfigs();
  }
  
  // Initialize Text Cycler (TypeScript module)
  textCycler.init({
    log: (msg: string, type?: string) => {
      if (window.App?.log) {
        window.App.log(msg, type);
      } else {
        console.log(`[${type || 'info'}] ${msg}`);
      }
    },
    isOBSDock: window.isOBSDock || (() => false),
    get storageSyncTimer() { return window.StorageSync?.storageSyncTimer || null; },
    set storageSyncTimer(val) { if (window.StorageSync) window.StorageSync.storageSyncTimer = val; },
    broadcastStorage: () => { if (window.StorageSync) window.StorageSync.scheduleBroadcast(); },
    STORAGE_SYNC_DEBOUNCE: window.StorageSync?.STORAGE_SYNC_DEBOUNCE || 500,
    showPage: navigateTo,
    initSearchForList: window.UIUtils?.initSearchForList,
    updateTextCyclerMode: window.updateTextCyclerMode,
    updateTransitionMode: window.updateTransitionMode,
    updateBrowserSourceUrlPreview: window.updateBrowserSourceUrlPreview
  });
  textCycler.loadConfigs();
  
  // Expose to window for legacy compatibility
  (window as any).TextCycler = textCycler;
  
  // Initialize other modules...
  // (Layouts, Sources, etc.)
}

/**
 * Load credentials and auto-connect
 */
async function loadCredentialsAndConnect(): Promise<void> {
  try {
    const hasCreds = await loadCredentials();
    const passwordEl = document.getElementById('password') as HTMLInputElement;
    
    if (hasCreds && passwordEl?.value) {
      if ((window as any).App?.log) {
        (window as any).App.log('Credentials unlocked. Auto-connecting...', 'info');
      }
      setTimeout(() => {
        wsConnect();
      }, 500);
    } else if (hasCreds) {
      if ((window as any).App?.log) {
        (window as any).App.log('Host/port loaded. Enter password to connect.', 'info');
      }
    }
  } catch (error) {
    console.error('[Bootstrap] Credential load error:', error);
  }
}

