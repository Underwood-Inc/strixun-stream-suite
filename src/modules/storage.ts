/**
 * Strixun Stream Suite - Storage System
 * 
 * OBS Dock Compatible Storage with Multi-Layer Persistence
 * 
 * ARCHITECTURE:
 * - IndexedDB (PRIMARY) - Survives most OBS cache clears
 * - localStorage (BACKUP) - Synced on every write
 * - Recovery Snapshot - Separate key for emergency recovery
 * - **AUTOMATIC OBS SYNC** - UI state keys (starting with 'ui_') automatically trigger OBS sync
 * 
 * UI STATE PERSISTENCE:
 * - Keys starting with 'ui_' are automatically synced to OBS client
 * - This includes resizable zone sizes, panel states, collapsed cards, etc.
 * - When storage.set() is called with a 'ui_' key, it automatically schedules OBS sync
 * - This ensures UI preferences persist across sessions and sync to remote clients
 * 
 * @version 2.1.0 (TypeScript)
 */

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
 */
export const storage: StorageInterface = {
  /**
   * Get a value from storage
   */
  get(key: string): unknown | null {
    const value = storageCache[key];
    return value !== undefined ? value : null;
  },
  
  /**
   * Set a value in storage (writes to IDB + localStorage)
   * 
   * CRITICAL: UI state keys (starting with 'ui_') automatically trigger OBS sync
   * This ensures resizable zone sizes and other UI preferences are synced to OBS client
   */
  set(key: string, value: unknown): boolean {
    try {
      // Update memory cache
      storageCache[key] = value;
      
      // Write to IndexedDB (primary, async)
      saveToIDB(key, value);
      
      // Write to localStorage (backup, sync)
      try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
      } catch (e) {
        console.warn('[Storage] localStorage write failed:', key, e);
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
   */
  remove(key: string): void {
    try {
      delete storageCache[key];
      deleteFromIDB(key);
      localStorage.removeItem(STORAGE_PREFIX + key);
    } catch (e) {
      console.error('[Storage] Remove error:', key, e);
    }
  },
  
  /**
   * Get a raw string value (for credentials, etc)
   */
  getRaw(key: string): unknown {
    const value = storageCache[key];
    return value !== undefined ? value : null;
  },
  
  /**
   * Set a raw string value (not JSON-stringified)
   */
  setRaw(key: string, value: string): void {
    try {
      storageCache[key] = value;
      saveToIDB(key, value);
      try {
        localStorage.setItem(STORAGE_PREFIX + key, value);
      } catch (e) {
        // Ignore localStorage errors
      }
    } catch (e) {
      // Ignore errors
    }
  },
  
  /**
   * Force sync all cached data to both storages
   */
  async flush(): Promise<void> {
    for (const [key, value] of Object.entries(storageCache)) {
      saveToIDB(key, value);
      try {
        const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
        localStorage.setItem(STORAGE_PREFIX + key, jsonValue);
      } catch (e) {
        // Ignore errors
      }
    }
  },
  
  /**
   * Check if storage system is ready
   */
  isReady(): boolean {
    return true; // Always ready after init, may be using fallback
  },
  
  /**
   * Clear all storage
   */
  clear(): void {
    try {
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
    } catch (e) {
      console.error('[Storage] Clear error:', e);
    }
  },
  
  /**
   * Check if a key exists in storage
   */
  has(key: string): boolean {
    return key in storageCache;
  },
  
  /**
   * Get all storage keys
   */
  keys(): string[] {
    return Object.keys(storageCache);
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

