/**
 * Application Bootstrap
 * 
 * Initializes all modules and sets up the application
 */

import { navigateTo, restorePage } from '../stores/navigation';
import * as App from './app';
import { Layouts } from './layouts';
import { ScriptStatus, isOBSDock, openUrlOrCopy } from './script-status';
import * as sourceSwaps from './source-swaps';
import { Sources } from './sources';
import { initIndexedDB, loadStorageCache, startAutoBackup } from './storage';
import * as storageSync from './storage-sync';
import * as textCycler from './text-cycler';
import { TwitchAPI } from './twitch-api';
import { UIUtils } from './ui-utils';
import { Version } from './version';
import { loadCredentials, updateConnectionState, connect as wsConnect } from './websocket';

/**
 * Set encryption enabled state in store
 * This allows the App component to reactively check if auth is required
 */
async function setEncryptionState(): Promise<void> {
  const { isEncryptionEnabled } = await import('../core/services/encryption');
  const { encryptionEnabled } = await import('../stores/auth');
  const enabled = await isEncryptionEnabled();
  encryptionEnabled.set(enabled);
}

/**
 * Initialize the application
 */
export async function initializeApp(): Promise<void> {
  // Get the actual addLogEntry function for use in this module
  // window.addLogEntry is already set up in main.ts, so we can use it directly
  const { addLogEntry, clearLogEntries } = await import('../stores/activity-log');
  
  // CRITICAL: Get original console methods BEFORE intercepting (to prevent recursion)
  const originalLog = console.log.bind(console);
  const originalError = console.error.bind(console);
  const originalWarn = console.warn.bind(console);
  const originalDebug = console.debug.bind(console);
  
  // Store originals for use in fallbacks (to avoid recursion)
  (console as any).__originalLog = originalLog;
  (console as any).__originalError = originalError;
  (console as any).__originalWarn = originalWarn;
  (console as any).__originalDebug = originalDebug;
  
  // CRITICAL: Bridge EventBus log:entry events to the activity log store
  // This ensures LoggerService events reach the ActivityLog component
  const { EventBus } = await import('../core/events/EventBus');
  EventBus.on('log:entry', (entry: { message: string; level: 'info' | 'success' | 'error' | 'warning' | 'debug'; flair?: string; icon?: string }) => {
    try {
      addLogEntry(entry.message, entry.level, entry.flair, entry.icon);
    } catch (err) {
      originalError('[EventBus log:entry] Failed to add log entry:', err);
    }
  });
  EventBus.on('log:cleared', () => {
    try {
      clearLogEntries();
    } catch (err) {
      originalError('[EventBus log:cleared] Failed to clear log entries:', err);
    }
  });
  
  // Intercept all console calls to route through the store
  // NOTE: This must happen AFTER window.addLogEntry is set up
  const { interceptConsole } = await import('../utils/logger');
  interceptConsole();
  
  // Test that logging works
  addLogEntry('Starting application initialization...', 'info');
  
  try {
    // CRITICAL: Initialize storage system FIRST
    await initIndexedDB();
    await loadStorageCache();
    addLogEntry('Storage system ready', 'success', 'STORAGE');
    
    // Notes storage is cloud-only, no initialization needed
    
    // Load authentication state (includes cross-domain session restoration)
    const { loadAuthState, isAuthenticated } = await import('../stores/auth');
    await loadAuthState();
    addLogEntry('Authentication state loaded', 'info', 'AUTH');
    
    // Set encryption enabled state in store (for reactive auth checks)
    await setEncryptionState();
    
    // CRITICAL: Mark auth check as complete AFTER determining encryption state
    // This allows the App component to show the correct screen (auth or app)
    const { authCheckComplete } = await import('../stores/auth');
    authCheckComplete.set(true);
    
    // CRITICAL: If encryption is enabled but user is not authenticated, auth is required
    // The App component will reactively show AuthScreen instead of the main app
    // Note: With HttpOnly cookies, we check isAuthenticated store instead of token
    const { isEncryptionEnabled } = await import('../core/services/encryption');
    const encryptionEnabled = await isEncryptionEnabled();
    const { get } = await import('svelte/store');
    const authenticated = get(isAuthenticated);
    
    if (encryptionEnabled && !authenticated) {
      // Encryption is enabled but customer is not authenticated - auth required
      addLogEntry('⚠ AUTH REQUIRED: Encryption enabled but customer not authenticated', 'warning', 'AUTH');
      addLogEntry('Customer must authenticate via email OTP to access the application', 'info', 'AUTH');
      console.warn('[Bootstrap] ⚠ AUTH REQUIRED: Encryption enabled but customer not authenticated');
      console.warn('[Bootstrap] Customer must authenticate via email OTP to access the application');
      
      // Continue initialization anyway - app will show AuthScreen instead of main app
      // Once customer authenticates, everything will be ready
    } else if (!encryptionEnabled) {
      addLogEntry('Encryption disabled - authentication not required', 'info', 'AUTH');
    } else if (authToken) {
      addLogEntry('User authenticated - encryption enabled', 'success', 'AUTH');
    }
    
    // Initialize modules in order (even if auth is required, so app is ready when customer logs in)
    await initializeModules();
    
    // Only complete app initialization if auth is not required
    // When auth is required, the app will show AuthScreen and initialization will continue after login
    if (!(encryptionEnabled && !authToken)) {
      // Complete app initialization (rendering, UI state, etc.)
      await completeAppInitialization();
      
      // Restore saved page
      restorePage();
      
      // Load saved credentials and auto-connect
      await loadCredentialsAndConnect();
      
      addLogEntry('Application initialized', 'success', 'INIT');
    } else {
      addLogEntry('Application ready - waiting for authentication', 'info', 'AUTH');
    }
  } catch (error) {
    addLogEntry(`Initialization error: ${error instanceof Error ? error.message : String(error)}`, 'error', 'ERROR');
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
      } else if ((window as any).addLogEntry) {
        const logType = (type === 'success' || type === 'error' || type === 'warning' || type === 'debug') 
          ? type as 'info' | 'success' | 'error' | 'warning' | 'debug'
          : 'info';
        (window as any).addLogEntry(msg, logType);
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
    get STORAGE_SYNC_DEBOUNCE() { return storageSync.STORAGE_SYNC_DEBOUNCE; },
    scheduleUISync: storageSync.scheduleUISync
  };
  
  // Initialize UI Utils (TypeScript module)
  UIUtils.SplitPanel.init();
  UIUtils.CollapsibleCards.init();
  
  // Expose to window for legacy compatibility
  (window as any).UIUtils = UIUtils;
  
  // Log store functions are already exposed at the start of initializeApp()
  
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

// Track if app initialization has been completed to prevent duplicate execution
let appInitializationCompleted = false;
let appInitializationInProgress = false;

/**
 * Complete application initialization
 * This runs after all modules are initialized
 */
export async function completeAppInitialization(): Promise<void> {
  // Prevent duplicate execution
  if (appInitializationCompleted) {
    return;
  }
  
  // Prevent concurrent execution
  if (appInitializationInProgress) {
    // Wait for the in-progress initialization to complete
    while (appInitializationInProgress) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return;
  }
  
  appInitializationInProgress = true;
  
  try {
    const { addLogEntry } = await import('../stores/activity-log');
    addLogEntry('Completing application initialization...', 'info', 'INIT');
    
    // Load source opacity configs
    Sources.loadSourceOpacityConfigs();
    
    // Get config counts for logging
    const swapConfigsCount = (window as any).SourceSwaps ? (window as any).SourceSwaps.getConfigs().length : 0;
    const textCyclerConfigs = (window as any).TextCycler ? (window as any).TextCycler.getConfigs() : [];
    const sourceOpacityConfigs = Sources.sourceOpacityConfigs;
    addLogEntry(`Loaded configs - Swaps: ${swapConfigsCount}, TextCycler: ${textCyclerConfigs.length}, Opacity: ${Object.keys(sourceOpacityConfigs).length}`, 'info', 'CONFIG');
    
    // Check for recovery if configs are empty
    const totalConfigs = swapConfigsCount + textCyclerConfigs.length;
    if (totalConfigs === 0) {
      const recovered = await App.offerRecovery();
      if (recovered) {
        addLogEntry('Configs restored from recovery snapshot', 'success', 'RECOVERY');
      }
    }
    
    // Start auto-backup system
    startAutoBackup();
    
    // Set dock URL - use EventBus to notify Setup page instead of direct DOM manipulation
    const url = window.location.href;
    // Emit event for Setup page to handle (avoids direct DOM manipulation)
    const { EventBus } = await import('../core/events/EventBus');
    EventBus.emitSync('app:dock-url-ready', { url });
    
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
    
    addLogEntry('Application initialization complete', 'success', 'INIT');
    appInitializationCompleted = true;
  } catch (error) {
    const { addLogEntry } = await import('../stores/activity-log');
    addLogEntry(`App initialization error: ${error instanceof Error ? error.message : String(error)}`, 'error', 'ERROR');
    // Don't set completed flag on error so it can retry if needed
  } finally {
    appInitializationInProgress = false;
  }
}

/**
 * Complete app initialization after authentication
 * This is called when customer successfully authenticates
 */
export async function completeInitializationAfterAuth(): Promise<void> {
  const { addLogEntry } = await import('../stores/activity-log');
  try {
    addLogEntry('Completing initialization after authentication...', 'info', 'AUTH');
    
    // Complete app initialization (rendering, UI state, etc.)
    await completeAppInitialization();
    
    // Restore saved page
    restorePage();
    
    // Load saved credentials and auto-connect
    await loadCredentialsAndConnect();
    
    addLogEntry('Application initialized after authentication', 'success', 'INIT');
  } catch (error) {
    addLogEntry(`Post-auth initialization error: ${error instanceof Error ? error.message : String(error)}`, 'error', 'ERROR');
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
    const { addLogEntry } = await import('../stores/activity-log');
    addLogEntry(`Credential load error: ${error instanceof Error ? error.message : String(error)}`, 'error', 'ERROR');
  }
}

