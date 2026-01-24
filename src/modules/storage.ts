/**
 * Strixun Stream Suite - Storage System
 * 
 * OBS Dock Compatible Storage with Multi-Layer Persistence
 * 
 * ARCHITECTURE:
 * - OBS Native Storage (when in OBS) - Uses OBS WebSocket GetPersistentData/SetPersistentData
 * - IndexedDB (PRIMARY for browsers) - Survives most OBS cache clears
 * - localStorage (BACKUP) - Synced on every write
 * - Recovery Snapshot - Separate key for emergency recovery
 * - **AUTOMATIC OBS SYNC** - UI state keys (starting with 'ui_') automatically trigger OBS sync
 * 
 * ENVIRONMENT DETECTION:
 * - When running inside OBS (dock or browser source), uses OBS native storage
 * - When running in a regular browser, uses IndexedDB + localStorage
 * - Detection is done via window.obsstudio object presence
 * 
 * UI STATE PERSISTENCE:
 * - Keys starting with 'ui_' are automatically synced to OBS client
 * - This includes resizable zone sizes, panel states, collapsed cards, etc.
 * - When storage.set() is called with a 'ui_' key, it automatically schedules OBS sync
 * - This ensures UI preferences persist across sessions and sync to remote clients
 * 
 * @version 2.2.0 (TypeScript)
 */

import { obsStorage, isInOBS } from './obs-storage.js';

// ============ Types ============
interface StorageItem {
  key: string;
  value: unknown;
}

interface RecoverySnapshot {
  version: number;
  timestamp: string;
  type: string;
  swapConfigs?: unknown[];
  layoutPresets?: unknown[];
  textCyclerConfigs?: unknown[];
  clipsConfigs?: unknown[];
}

interface StorageInterface {
  get(key: string): unknown | null;
  set(key: string, value: unknown): boolean;
  remove(key: string): void;
  getRaw(key: string): unknown;
  setRaw(key: string, value: string): void;
  flush(): Promise<void>;
  isReady(): boolean;
  clear(): void;
  has(key: string): boolean;
  keys(): string[];
  _snapshotDebounce: ReturnType<typeof setTimeout> | null;
}

// ============ Constants ============
const STORAGE_PREFIX = 'sss_'; // Strixun Stream Suite prefix
const IDB_NAME = 'StrixunStreamSuite';
const IDB_STORE = 'settings';
const IDB_VERSION = 1;
const AUTO_BACKUP_KEY = 'sss_recovery_snapshot';
const AUTO_BACKUP_INTERVAL = 60000; // Every minute when changes detected
// const CONFIG_KEYS = ['swapConfigs', 'layoutPresets', 'textCyclerConfigs', 'clipsConfigs'] as const;

// ============ State ============
let storageCache: Record<string, unknown> = {};
let idbReady = false;
let idbInstance: IDBDatabase | null = null;
let autoBackupTimer: ReturnType<typeof setInterval> | null = null;
let lastDataHash = '';

// ============ IndexedDB Functions ============

/**
 * Initialize IndexedDB connection
 * @returns Promise resolving to database instance or null if unavailable
 * 
 * CRITICAL: Has timeout to prevent browser lockup if IndexedDB is blocked/corrupted
 */
export function initIndexedDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (!window.indexedDB) {
      console.warn('[Storage] IndexedDB not available, using localStorage only');
      resolve(null);
      return;
    }
    
    // Add timeout to prevent browser lockup (3 seconds max)
    const timeoutId = setTimeout(() => {
      console.warn('[Storage] IndexedDB initialization timed out after 3 seconds, using localStorage only');
      resolve(null); // Fall back to localStorage
    }, 3000);
    
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);
    
    request.onerror = () => {
      clearTimeout(timeoutId);
      console.error('[Storage] IndexedDB open error:', request.error);
      resolve(null); // Fall back to localStorage
    };
    
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'key' });
      }
    };
    
    request.onsuccess = () => {
      clearTimeout(timeoutId);
      idbInstance = request.result;
      idbReady = true;
      console.log('[Storage] IndexedDB ready');
      resolve(idbInstance);
    };
  });
}

/**
 * Load all data from IndexedDB into memory cache
 * Falls back to localStorage for any missing keys
 */
export async function loadStorageCache(): Promise<void> {
  // First, try to load from IndexedDB (primary)
  if (idbInstance) {
    try {
      const tx = idbInstance.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const request = store.getAll();
      
      // Add timeout to prevent browser lockup (3 seconds max)
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          console.warn('[Storage] IndexedDB load timed out after 3 seconds, using localStorage only');
          resolve(); // Resolve to continue with localStorage fallback
        }, 3000);
      });
      
      const loadPromise = new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          const items = (request.result || []) as StorageItem[];
          items.forEach(item => {
            storageCache[item.key] = item.value;
          });
          console.log('[Storage] Loaded', items.length, 'items from IndexedDB');
          resolve();
        };
        request.onerror = () => {
          console.error('[Storage] Failed to load from IndexedDB');
          reject(request.error);
        };
      });
      
      // Race between load and timeout - whichever finishes first wins
      try {
        await Promise.race([loadPromise, timeoutPromise]);
      } catch (e) {
        // If IndexedDB fails, continue with localStorage fallback
        // Error already logged above
      }
    } catch (e) {
      console.error('[Storage] IndexedDB load error:', e);
    }
  }
  
  // Then merge with localStorage (fallback/sync)
  // localStorage values fill in any gaps from IndexedDB
  // CRITICAL: Wrap in try-catch with timeout to prevent browser lockup if localStorage is corrupted
  try {
    // Add timeout protection for localStorage access (some browsers can hang if localStorage is corrupted)
    const localStoragePromise = new Promise<void>((resolve) => {
      try {
        const length = localStorage.length;
        for (let i = 0; i < length; i++) {
          try {
            const fullKey = localStorage.key(i);
            if (fullKey && fullKey.startsWith(STORAGE_PREFIX)) {
              const key = fullKey.substring(STORAGE_PREFIX.length);
              // Only use localStorage value if not already in cache from IDB
              if (storageCache[key] === undefined) {
                try {
                  const raw = localStorage.getItem(fullKey);
                  if (raw) {
                    storageCache[key] = JSON.parse(raw);
                    console.log('[Storage] Recovered from localStorage:', key);
                    // Sync back to IndexedDB
                    if (idbInstance) {
                      saveToIDB(key, storageCache[key]);
                    }
                  }
                } catch (e) {
                  // Raw string value (credentials etc)
                  storageCache[key] = localStorage.getItem(fullKey);
                }
              }
            }
          } catch (e) {
            // Skip corrupted keys
            console.warn('[Storage] Skipping corrupted localStorage key at index', i);
          }
        }
        resolve();
      } catch (e) {
        console.error('[Storage] localStorage scan error:', e);
        resolve(); // Resolve anyway to continue
      }
    });
    
    // Timeout after 2 seconds - if localStorage is corrupted, don't wait forever
    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        console.warn('[Storage] localStorage scan timed out, continuing without localStorage data');
        resolve();
      }, 2000);
    });
    
    await Promise.race([localStoragePromise, timeoutPromise]);
  } catch (e) {
    console.error('[Storage] localStorage scan error:', e);
  }
  
  console.log('[Storage] Cache ready with keys:', Object.keys(storageCache));
}

/**
 * Save a value to IndexedDB (async, fire-and-forget)
 */
function saveToIDB(key: string, value: unknown): void {
  if (!idbInstance) return;
  try {
    const tx = idbInstance.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put({ key, value });
  } catch (e) {
    console.error('[Storage] IDB write error:', key, e);
  }
}

/**
 * Delete a value from IndexedDB
 */
function deleteFromIDB(key: string): void {
  if (!idbInstance) return;
  try {
    const tx = idbInstance.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.delete(key);
  } catch (e) {
    console.error('[Storage] IDB delete error:', key, e);
  }
}

// ============ Storage Wrapper ============

/**
 * Main storage interface
 * Uses memory cache for reads, writes to both IDB and localStorage
 * CRITICAL: When running inside OBS, delegates to OBS native storage
 */
export const storage: StorageInterface = {
  /**
   * Get a value from storage
   * When in OBS: prefers OBS storage if ready, falls back to local cache
   * When not in OBS: uses local cache (localStorage/IndexedDB backed)
   */
  get(key: string): unknown | null {
    // When in OBS and OBS storage is ready, prefer OBS storage
    // But still fall back to local cache if key not found in OBS storage
    if (isInOBS() && obsStorage.isReady()) {
      const obsValue = obsStorage.get(key);
      if (obsValue !== null) {
        return obsValue;
      }
    }
    
    // Fall back to local cache (backed by localStorage/IndexedDB)
    const value = storageCache[key];
    return value !== undefined ? value : null;
  },
  
  /**
   * Set a value in storage (writes to IDB + localStorage)
   * Uses OBS storage when running inside OBS (ALSO writes to localStorage for bootstrap)
   * 
   * CRITICAL: UI state keys (starting with 'ui_') automatically trigger OBS sync
   * This ensures resizable zone sizes and other UI preferences are synced to OBS client
   */
  set(key: string, value: unknown): boolean {
    try {
      // Update memory cache (always)
      storageCache[key] = value;
      
      // Write to IndexedDB (primary, async)
      saveToIDB(key, value);
      
      // Write to localStorage (backup, sync) - ALWAYS do this for bootstrap before OBS storage is ready
      try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      } catch (e) {
        console.warn('[Storage] localStorage write failed:', key, e);
      }
      
      // ALSO write to OBS storage when running inside OBS and connected
      // This ensures data persists in OBS across restarts
      if (isInOBS() && obsStorage.isReady()) {
        obsStorage.set(key, value);
      }
      
      // Trigger auto-backup snapshot for config keys (debounced)
      if (['swapConfigs', 'layoutPresets', 'textCyclerConfigs', 'clipsConfigs'].includes(key)) {
        if (typeof createRecoverySnapshot === 'function') {
          clearTimeout(storage._snapshotDebounce as ReturnType<typeof setTimeout>);
          storage._snapshotDebounce = setTimeout(createRecoverySnapshot, 2000);
        }
      }
      
      // CRITICAL: Automatically trigger OBS sync for UI state keys
      // This ensures resizable zone sizes and other UI preferences are synced to OBS
      // Pattern: Any key starting with 'ui_' is considered UI state
      if (key.startsWith('ui_')) {
        // Schedule OBS sync (debounced, only if OBS dock)
        if (typeof (window as any).StorageSync?.scheduleUISync === 'function') {
          (window as any).StorageSync.scheduleUISync();
        }
      }
      
      return true;
    } catch (e) {
      console.error('[Storage] Write error:', key, e);
      return false;
    }
  },
  
  /**
   * Remove a value from storage
   * Removes from ALL storage layers (local cache, IndexedDB, localStorage, OBS storage)
   */
  remove(key: string): void {
    try {
      // Remove from local cache
      delete storageCache[key];
      
      // Remove from IndexedDB
      deleteFromIDB(key);
      
      // Remove from localStorage
      localStorage.removeItem(STORAGE_PREFIX + key);
      
      // Also remove from OBS storage when in OBS and connected
      if (isInOBS() && obsStorage.isReady()) {
        obsStorage.remove(key);
      }
    } catch (e) {
      console.error('[Storage] Remove error:', key, e);
    }
  },
  
  /**
   * Get a raw string value (for credentials, etc)
   * When in OBS: prefers OBS storage if ready, falls back to local cache
   */
  getRaw(key: string): unknown {
    // When in OBS and OBS storage is ready, prefer OBS storage
    if (isInOBS() && obsStorage.isReady()) {
      const obsValue = obsStorage.getRaw(key);
      if (obsValue !== null) {
        return obsValue;
      }
    }
    
    // Fall back to local cache
    const value = storageCache[key];
    return value !== undefined ? value : null;
  },
  
  /**
   * Set a raw string value (not JSON-stringified)
   * ALWAYS writes to localStorage for bootstrap, ALSO to OBS storage when ready
   */
  setRaw(key: string, value: string): void {
    try {
      // Always update local cache
      storageCache[key] = value;
      
      // Always write to IndexedDB
      saveToIDB(key, value);
      
      // Always write to localStorage (for bootstrap before OBS storage is ready)
      try {
        localStorage.setItem(STORAGE_PREFIX + key, value);
      } catch (e) {
        // Ignore localStorage errors
      }
      
      // ALSO write to OBS storage when in OBS and connected
      if (isInOBS() && obsStorage.isReady()) {
        obsStorage.setRaw(key, value);
      }
    } catch (e) {
      // Ignore errors
    }
  },
  
  /**
   * Force sync all cached data to all storage layers
   */
  async flush(): Promise<void> {
    // Flush to local storage layers
    for (const [key, value] of Object.entries(storageCache)) {
      saveToIDB(key, value);
      try {
        const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(STORAGE_PREFIX + key, jsonValue);
      } catch (e) {
        // Ignore errors
      }
    }
    
    // Also flush to OBS storage when in OBS and connected
    if (isInOBS() && obsStorage.isReady()) {
      await obsStorage.flush();
    }
  },
  
  /**
   * Check if storage system is ready
   * Local storage is always ready, OBS storage requires connection
   */
  isReady(): boolean {
    // Local storage (cache/localStorage/IndexedDB) is always ready after init
    // OBS storage readiness is additional, not required for basic operation
    return true;
  },
  
  /**
   * Clear all storage (all layers)
   */
  clear(): void {
    try {
      // Clear local cache
      storageCache = {};
      
      // Clear IndexedDB
      if (idbInstance) {
        const tx = idbInstance.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        store.clear();
      }
      
      // Clear localStorage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Also clear OBS storage when in OBS and connected
      if (isInOBS() && obsStorage.isReady()) {
        obsStorage.clear();
      }
    } catch (e) {
      console.error('[Storage] Clear error:', e);
    }
  },
  
  /**
   * Check if a key exists in storage (checks local cache and OBS storage)
   */
  has(key: string): boolean {
    // Check local cache first
    if (key in storageCache) {
      return true;
    }
    // Also check OBS storage when in OBS and connected
    if (isInOBS() && obsStorage.isReady()) {
      return obsStorage.has(key);
    }
    return false;
  },
  
  /**
   * Get all storage keys (combines local cache and OBS storage)
   */
  keys(): string[] {
    const localKeys = Object.keys(storageCache);
    
    // Also include OBS storage keys when in OBS and connected
    if (isInOBS() && obsStorage.isReady()) {
      const obsKeys = obsStorage.keys();
      // Merge and deduplicate
      const allKeys = new Set([...localKeys, ...obsKeys]);
      return Array.from(allKeys);
    }
    
    return localKeys;
  },
  
  // Internal debounce timer
  _snapshotDebounce: null
};

// ============ Auto-Backup System ============

/**
 * Generate a simple hash of current data state
 */
function getDataHash(): string {
  const data = JSON.stringify({
    s: (typeof (window as any).swapConfigs !== 'undefined' ? (window as any).swapConfigs?.length : 0) || 0,
    l: (typeof (window as any).layoutPresets !== 'undefined' ? (window as any).layoutPresets?.length : 0) || 0,
    t: (typeof (window as any).textCyclerConfigs !== 'undefined' ? (window as any).textCyclerConfigs?.length : 0) || 0,
    c: (typeof (window as any).clipsConfigs !== 'undefined' ? (window as any).clipsConfigs?.length : 0) || 0
  });
  return data;
}

/**
 * Create a recovery snapshot in localStorage
 * Separate from main storage for redundancy
 */
export function createRecoverySnapshot(): void {
  const currentHash = getDataHash();
  if (currentHash === lastDataHash) return;
  
  const snapshot: RecoverySnapshot = {
    version: 2,
    timestamp: new Date().toISOString(),
    type: 'auto-recovery',
    swapConfigs: ((typeof (window as any).swapConfigs !== 'undefined' ? (window as any).swapConfigs : []) || []) as unknown[],
    layoutPresets: ((typeof (window as any).layoutPresets !== 'undefined' ? (window as any).layoutPresets : []) || []) as unknown[],
    textCyclerConfigs: ((typeof (window as any).textCyclerConfigs !== 'undefined' ? (window as any).textCyclerConfigs : []) || []) as unknown[],
    clipsConfigs: ((typeof (window as any).clipsConfigs !== 'undefined' ? (window as any).clipsConfigs : []) || []) as unknown[]
  };
  
  try {
    localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(snapshot));
    lastDataHash = currentHash;
    console.log('[AutoBackup] Recovery snapshot saved');
  } catch (e) {
    console.warn('[AutoBackup] Failed to save recovery snapshot:', e);
  }
}

/**
 * Check for recovery snapshot
 * @returns Recovery data or null
 */
export function checkForRecoverySnapshot(): RecoverySnapshot | null {
  try {
    const snapshot = localStorage.getItem(AUTO_BACKUP_KEY);
    if (!snapshot) return null;
    
    const data = JSON.parse(snapshot) as RecoverySnapshot;
    if (!data.version || !data.timestamp) return null;
    
    const currentTotal = ((typeof (window as any).swapConfigs !== 'undefined' ? (window as any).swapConfigs?.length : 0) || 0) + 
                        ((typeof (window as any).layoutPresets !== 'undefined' ? (window as any).layoutPresets?.length : 0) || 0) + 
                        ((typeof (window as any).textCyclerConfigs !== 'undefined' ? (window as any).textCyclerConfigs?.length : 0) || 0) + 
                        ((typeof (window as any).clipsConfigs !== 'undefined' ? (window as any).clipsConfigs?.length : 0) || 0);
    const recoveryTotal = (data.swapConfigs?.length || 0) + 
                         (data.layoutPresets?.length || 0) + 
                         (data.textCyclerConfigs?.length || 0) + 
                         (data.clipsConfigs?.length || 0);
    
    if (currentTotal === 0 && recoveryTotal > 0) {
      return data;
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Start the auto-backup timer
 */
export function startAutoBackup(): void {
  if (autoBackupTimer) clearInterval(autoBackupTimer);
  
  // Initial snapshot
  createRecoverySnapshot();
  
  // Periodic snapshots
  autoBackupTimer = setInterval(createRecoverySnapshot, AUTO_BACKUP_INTERVAL);
  console.log('[AutoBackup] Auto-backup system started');
}

/**
 * Check if IndexedDB is ready
 */
export function isIdbReady(): boolean {
  return idbReady;
}

// Export STORAGE_PREFIX for use in other modules
export { STORAGE_PREFIX };

