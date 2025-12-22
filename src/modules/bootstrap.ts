/**
 * Application Bootstrap
 * 
 * Initializes all modules and sets up the application
 */

import { navigateTo, restorePage } from '../stores/navigation';
import { connected, currentScene, sources, textSources } from '../stores/connection';
import { initIndexedDB, loadStorageCache, storage, startAutoBackup } from './storage';
import { loadCredentials, connect as wsConnect, updateConnectionState } from './websocket';
import * as textCycler from './text-cycler';
import * as sourceSwaps from './source-swaps';
import * as storageSync from './storage-sync';
import { UIUtils } from './ui-utils';
import { Version } from './version';
import { ScriptStatus, isOBSDock, openUrlOrCopy } from './script-status';
import { Sources } from './sources';
import { Layouts } from './layouts';
import { TwitchAPI } from './twitch-api';
import * as App from './app';

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
    
    // Complete app initialization (rendering, UI state, etc.)
    await completeAppInitialization();
    
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
  // Initialize Source Swaps (TypeScript module)
  sourceSwaps.init({
    log: (msg: string, type?: string) => {
      // Use logger module when available
      if (window.App?.log) {
        window.App.log(msg, type);
      } else {
        console.log(`[${type || 'info'}] ${msg}`);
      }
    },
    isOBSDock: window.isOBSDock || (() => false),
    showPage: navigateTo,
    initSearchForList: UIUtils.initSearchForList
  });
  sourceSwaps.loadConfigs();
  
  // Expose to window for legacy compatibility
  (window as any).SourceSwaps = sourceSwaps;
  
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
    initSearchForList: UIUtils.initSearchForList,
    updateTextCyclerMode: window.updateTextCyclerMode,
    updateTransitionMode: window.updateTransitionMode,
    updateBrowserSourceUrlPreview: window.updateBrowserSourceUrlPreview
  });
  textCycler.loadConfigs();
  
  // Expose to window for legacy compatibility
  (window as any).TextCycler = textCycler;
  
  // Initialize Storage Sync (TypeScript module)
  storageSync.init({
    log: (msg: string, type?: string) => {
      if (window.App?.log) {
        window.App.log(msg, type);
      } else {
        console.log(`[${type || 'info'}] ${msg}`);
      }
    },
    isOBSDock: window.isOBSDock || (() => false),
    // Callbacks for getting/setting configs
    getSwapConfigs: () => sourceSwaps.getConfigs(),
    setSwapConfigs: (val) => sourceSwaps.setConfigs(val),
    getTextCyclerConfigs: () => textCycler.getConfigs(),
    setTextCyclerConfigs: (val) => textCycler.setConfigs(val),
    getLayoutPresets: () => (window.Layouts as any)?.layoutPresets || [],
    setLayoutPresets: (val) => { if (window.Layouts) (window.Layouts as any).layoutPresets = val; },
    // Render callbacks
    renderSavedSwaps: () => sourceSwaps.renderSavedSwaps(),
    renderTextCyclerConfigs: () => textCycler.renderTextCyclerConfigs(),
    renderSavedLayouts: window.renderSavedLayouts,
    updateStorageStatus: window.updateStorageStatus
  });
  storageSync.loadAutoSyncPref();
  
  // Expose to window for legacy compatibility
  (window as any).StorageSync = {
    ...storageSync,
    get storageSyncTimer() { return storageSync.getStorageSyncTimer(); },
    set storageSyncTimer(val) { storageSync.setStorageSyncTimer(val); },
    get STORAGE_SYNC_DEBOUNCE() { return storageSync.STORAGE_SYNC_DEBOUNCE; }
  };
  
  // Initialize UI Utils (TypeScript module)
  UIUtils.SplitPanel.init();
  UIUtils.CollapsibleCards.init();
  
  // Expose to window for legacy compatibility
  (window as any).UIUtils = UIUtils;
  
  // Initialize Version (TypeScript module)
  Version.initVersionDisplay();
  
  // Expose to window for legacy compatibility
  (window as any).Version = Version;
  
  // Initialize Script Status (TypeScript module)
  ScriptStatus.updateDockContextUI();
  
  // Expose to window for legacy compatibility
  (window as any).ScriptStatus = ScriptStatus;
  (window as any).isOBSDock = isOBSDock;
  (window as any).openUrlOrCopy = openUrlOrCopy;
  
  // Initialize Sources (TypeScript module)
  Sources.loadSourceOpacityConfigs();
  
  // Expose to window for legacy compatibility
  (window as any).Sources = Sources;
  
  // Initialize Layouts (TypeScript module)
  Layouts.initLayouts();
  
  // Expose to window for legacy compatibility
  (window as any).Layouts = Layouts;
  
  // Initialize Twitch API (TypeScript module)
  // (No initialization needed, functions are called on demand)
  
  // Expose to window for legacy compatibility
  (window as any).TwitchAPI = TwitchAPI;
  
  // Initialize App module (TypeScript module)
  // Setup UI state persistence
  App.setupUIStatePersistence();
  
  // Setup keyboard shortcuts
  App.setupKeyboardShortcuts();
  
  // Expose App functions to window for legacy compatibility
  // (Already done in app.ts, but ensure it's available)
}

/**
 * Complete application initialization
 * This runs after all modules are initialized
 */
export async function completeAppInitialization(): Promise<void> {
  console.log('[Bootstrap] Completing application initialization...');
  
  try {
    // Load source opacity configs
    Sources.loadSourceOpacityConfigs();
    
    // Get config counts for logging
    const swapConfigsCount = (window as any).SourceSwaps ? (window as any).SourceSwaps.getConfigs().length : 0;
    const textCyclerConfigs = (window as any).TextCycler ? (window as any).TextCycler.getConfigs() : [];
    const sourceOpacityConfigs = Sources.sourceOpacityConfigs;
    console.log('[Init] Loaded configs - Swaps:', swapConfigsCount, 
                'TextCycler:', textCyclerConfigs.length, 
                'Opacity:', Object.keys(sourceOpacityConfigs).length);
    
    // Check for recovery if configs are empty
    const totalConfigs = swapConfigsCount + textCyclerConfigs.length;
    if (totalConfigs === 0) {
      const recovered = await App.offerRecovery();
      if (recovered) {
        console.log('[Init] Configs restored from recovery snapshot');
      }
    }
    
    // Start auto-backup system
    startAutoBackup();
    
    // Set dock URL
    const url = window.location.href;
    const dockUrlEl = document.getElementById('dockUrl') as HTMLInputElement | null;
    if (dockUrlEl) dockUrlEl.value = url;
    
    // Render loaded configs
    if ((window as any).SourceSwaps) {
      (window as any).SourceSwaps.renderSavedSwaps();
    }
    App.renderTextCyclerConfigs();
    Layouts.initLayouts();
    
    // Initialize installer (function is global from installer.js module)
    if (typeof (window as any).initScriptsAndInstaller === 'function') {
      (window as any).initScriptsAndInstaller();
    }
    
    // Load UI state
    App.loadUIState();
    
    // Update connection state
    if (typeof updateConnectionState === 'function') {
      updateConnectionState();
    }
    
    // Initialize script status (will show "not connected" banner)
    ScriptStatus.renderStartupBanner();
    ScriptStatus.updateTabStates();
    
    // Restore running text cyclers
    setTimeout(() => {
      App.restoreRunningTextCyclers();
    }, 1000);
    
    // Update UI helpers
    App.updateTransitionMode();
    App.updateStorageStatus();
    
    // Load Twitch settings
    if (typeof TwitchAPI.loadTwitchSettings === 'function') {
      TwitchAPI.loadTwitchSettings();
    }
    
    // Setup credential UI listeners
    const rememberCredsEl = document.getElementById('rememberCreds') as HTMLInputElement | null;
    const passwordEl = document.getElementById('password') as HTMLInputElement | null;
    if (rememberCredsEl && typeof (window as any).updateSecurityWarning === 'function') {
      rememberCredsEl.addEventListener('change', (window as any).updateSecurityWarning);
    }
    if (passwordEl && typeof (window as any).updateSecurityWarning === 'function') {
      passwordEl.addEventListener('input', (window as any).updateSecurityWarning);
    }
    
    // Setup color picker sync for text cycler
    const textColorPicker = document.getElementById('textColorPicker') as HTMLInputElement | null;
    const textColor = document.getElementById('textColor') as HTMLInputElement | null;
    if (textColorPicker && textColor) {
      textColorPicker.addEventListener('input', (e) => {
        textColor.value = (e.target as HTMLInputElement).value;
      });
      textColor.addEventListener('input', (e) => {
        const value = (e.target as HTMLInputElement).value;
        if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
          textColorPicker.value = value;
        }
      });
    }
    
    const textStrokeColorPicker = document.getElementById('textStrokeColorPicker') as HTMLInputElement | null;
    const textStrokeColor = document.getElementById('textStrokeColor') as HTMLInputElement | null;
    if (textStrokeColorPicker && textStrokeColor) {
      textStrokeColorPicker.addEventListener('input', (e) => {
        textStrokeColor.value = (e.target as HTMLInputElement).value;
      });
      textStrokeColor.addEventListener('input', (e) => {
        const value = (e.target as HTMLInputElement).value;
        if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
          textStrokeColorPicker.value = value;
        }
      });
    }
    
    console.log('[Bootstrap] Application initialization complete');
  } catch (error) {
    console.error('[Bootstrap] App initialization error:', error);
  }
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

