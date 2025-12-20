/**
 * Strixun Stream Suite - Storage System
 * 
 * OBS Dock Compatible Storage with Multi-Layer Persistence
 * 
 * ARCHITECTURE:
 * - IndexedDB (PRIMARY) - Survives most OBS cache clears
 * - localStorage (BACKUP) - Synced on every write
 * - Recovery Snapshot - Separate key for emergency recovery
 * 
 * USAGE:
 *   await initIndexedDB();
 *   await loadStorageCache();
 *   storage.set('key', value);
 *   const value = storage.get('key');
 * 
 * @version 1.0.0
 */

// ============ Constants ============
const STORAGE_PREFIX = 'sss_'; // Strixun Stream Suite prefix
const IDB_NAME = 'StrixunStreamSuite';
const IDB_STORE = 'settings';
const IDB_VERSION = 1;

// ============ State ============
let storageCache = {};
let idbReady = false;
let idbInstance = null;

// ============ IndexedDB Functions ============

/**
 * Initialize IndexedDB connection
 * @returns {Promise<IDBDatabase|null>} Database instance or null if unavailable
 */
function initIndexedDB() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            console.warn('[Storage] IndexedDB not available, using localStorage only');
            resolve(null);
            return;
        }
        
        const request = indexedDB.open(IDB_NAME, IDB_VERSION);
        
        request.onerror = (e) => {
            console.error('[Storage] IndexedDB open error:', e.target.error);
            resolve(null); // Fall back to localStorage
        };
        
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
                db.createObjectStore(IDB_STORE, { keyPath: 'key' });
            }
        };
        
        request.onsuccess = (e) => {
            idbInstance = e.target.result;
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
async function loadStorageCache() {
    // First, try to load from IndexedDB (primary)
    if (idbInstance) {
        try {
            const tx = idbInstance.transaction(IDB_STORE, 'readonly');
            const store = tx.objectStore(IDB_STORE);
            const request = store.getAll();
            
            await new Promise((resolve, reject) => {
                request.onsuccess = () => {
                    const items = request.result || [];
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
        } catch (e) {
            console.error('[Storage] IndexedDB load error:', e);
        }
    }
    
    // Then merge with localStorage (fallback/sync)
    // localStorage values fill in any gaps from IndexedDB
    try {
        for (let i = 0; i < localStorage.length; i++) {
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
        }
    } catch (e) {
        console.error('[Storage] localStorage scan error:', e);
    }
    
    console.log('[Storage] Cache ready with keys:', Object.keys(storageCache));
}

/**
 * Save a value to IndexedDB (async, fire-and-forget)
 * @param {string} key 
 * @param {*} value 
 */
function saveToIDB(key, value) {
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
 * @param {string} key 
 */
function deleteFromIDB(key) {
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
const storage = {
    /**
     * Get a value from storage
     * @param {string} key 
     * @returns {*} Value or null
     */
    get(key) {
        const value = storageCache[key];
        return value !== undefined ? value : null;
    },
    
    /**
     * Set a value in storage (writes to IDB + localStorage)
     * @param {string} key 
     * @param {*} value 
     * @returns {boolean} Success
     */
    set(key, value) {
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
            if (['swapConfigs', 'textCyclerConfigs', 'clipsConfigs'].includes(key)) {
                if (typeof createRecoverySnapshot === 'function') {
                    clearTimeout(this._snapshotDebounce);
                    this._snapshotDebounce = setTimeout(createRecoverySnapshot, 2000);
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
     * @param {string} key 
     */
    remove(key) {
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
     * @param {string} key 
     * @returns {string|null}
     */
    getRaw(key) {
        const value = storageCache[key];
        return value !== undefined ? value : null;
    },
    
    /**
     * Set a raw string value (not JSON-stringified)
     * @param {string} key 
     * @param {string} value 
     */
    setRaw(key, value) {
        try {
            storageCache[key] = value;
            saveToIDB(key, value);
            try {
                localStorage.setItem(STORAGE_PREFIX + key, value);
            } catch (e) {}
        } catch (e) {}
    },
    
    /**
     * Force sync all cached data to both storages
     */
    async flush() {
        for (const [key, value] of Object.entries(storageCache)) {
            saveToIDB(key, value);
            try {
                const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);
                localStorage.setItem(STORAGE_PREFIX + key, jsonValue);
            } catch (e) {}
        }
    },
    
    /**
     * Check if storage system is ready
     * @returns {boolean}
     */
    isReady() {
        return true; // Always ready after init, may be using fallback
    },
    
    // Internal debounce timer
    _snapshotDebounce: null
};

// ============ Auto-Backup System ============
const AUTO_BACKUP_KEY = 'sss_recovery_snapshot';
const AUTO_BACKUP_INTERVAL = 60000; // Every minute when changes detected
let autoBackupTimer = null;
let lastDataHash = '';

/**
 * Generate a simple hash of current data state
 * @returns {string}
 */
function getDataHash() {
    const data = JSON.stringify({
        s: (typeof swapConfigs !== 'undefined' ? swapConfigs?.length : 0) || 0,
        t: (typeof textCyclerConfigs !== 'undefined' ? textCyclerConfigs?.length : 0) || 0,
        c: (typeof clipsConfigs !== 'undefined' ? clipsConfigs?.length : 0) || 0
    });
    return data;
}

/**
 * Create a recovery snapshot in localStorage
 * Separate from main storage for redundancy
 */
function createRecoverySnapshot() {
    const currentHash = getDataHash();
    if (currentHash === lastDataHash) return;
    
    const snapshot = {
        version: 2,
        timestamp: new Date().toISOString(),
        type: 'auto-recovery',
        swapConfigs: (typeof swapConfigs !== 'undefined' ? swapConfigs : []) || [],
        textCyclerConfigs: (typeof textCyclerConfigs !== 'undefined' ? textCyclerConfigs : []) || [],
        clipsConfigs: (typeof clipsConfigs !== 'undefined' ? clipsConfigs : []) || []
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
 * @returns {Object|null} Recovery data or null
 */
function checkForRecoverySnapshot() {
    try {
        const snapshot = localStorage.getItem(AUTO_BACKUP_KEY);
        if (!snapshot) return null;
        
        const data = JSON.parse(snapshot);
        if (!data.version || !data.timestamp) return null;
        
        const currentTotal = ((typeof swapConfigs !== 'undefined' ? swapConfigs?.length : 0) || 0) + 
                            ((typeof textCyclerConfigs !== 'undefined' ? textCyclerConfigs?.length : 0) || 0) + 
                            ((typeof clipsConfigs !== 'undefined' ? clipsConfigs?.length : 0) || 0);
        const recoveryTotal = (data.swapConfigs?.length || 0) + 
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
function startAutoBackup() {
    if (autoBackupTimer) clearInterval(autoBackupTimer);
    
    // Initial snapshot
    createRecoverySnapshot();
    
    // Periodic snapshots
    autoBackupTimer = setInterval(createRecoverySnapshot, AUTO_BACKUP_INTERVAL);
    console.log('[AutoBackup] Auto-backup system started');
}

// ============ Exports (for non-module usage) ============
// These are available as globals when this script is loaded
if (typeof window !== 'undefined') {
    window.SSS_Storage = {
        storage,
        initIndexedDB,
        loadStorageCache,
        createRecoverySnapshot,
        checkForRecoverySnapshot,
        startAutoBackup,
        STORAGE_PREFIX,
        idbReady: () => idbReady
    };
}

