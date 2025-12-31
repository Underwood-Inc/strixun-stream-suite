/**
 * Strixun Stream Suite - Cloud Storage Client
 * 
 * Integrates with Cloudflare Worker API for cloud saves
 * 
 * Features:
 * - Automatic device ID generation
 * - Save/Load/List/Delete cloud saves
 * - Conflict detection and resolution
 * - Auto-sync on changes (optional)
 * 
 * @version 1.0.0
 */

// ============ Configuration ============
const CLOUD_API_URL = 'https://strixun-twitch-api.YOUR_SUBDOMAIN.workers.dev'; // UPDATE THIS
const DEVICE_ID_KEY = 'sss_device_id';
const SHARED_KEY_KEY = 'sss_shared_key';
const AUTO_SYNC_ENABLED_KEY = 'sss_auto_sync_enabled';
const LAST_CLOUD_SYNC_KEY = 'sss_last_cloud_sync';
const AUTO_SYNC_INTERVAL = 300000; // 5 minutes

// ============ State ============
let deviceId = null;
let autoSyncTimer = null;
let isSyncing = false;
let lastSyncTime = null;

// ============ Device ID Management ============

/**
 * Generate a unique device ID
 * Format: sss_<timestamp>_<random>
 * @returns {string}
 */
function generateDeviceId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `sss_${timestamp}_${random}`;
}

/**
 * Get or create device ID
 * @returns {string}
 */
function getDeviceId() {
    if (deviceId) return deviceId;
    
    // Try to load from storage
    if (typeof storage !== 'undefined') {
        deviceId = storage.getRaw(DEVICE_ID_KEY);
    }
    
    // Fallback to localStorage
    if (!deviceId && typeof localStorage !== 'undefined') {
        deviceId = localStorage.getItem(DEVICE_ID_KEY);
    }
    
    // Generate new if not found
    if (!deviceId) {
        deviceId = generateDeviceId();
        
        // Save to storage
        if (typeof storage !== 'undefined') {
            storage.setRaw(DEVICE_ID_KEY, deviceId);
        }
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(DEVICE_ID_KEY, deviceId);
        }
        
        console.log('[CloudStorage] Generated new device ID:', deviceId);
    } else {
        console.log('[CloudStorage] Loaded device ID:', deviceId);
    }
    
    return deviceId;
}

/**
 * Reset device ID (for testing or device transfer)
 */
function resetDeviceId() {
    deviceId = generateDeviceId();
    if (typeof storage !== 'undefined') {
        storage.setRaw(DEVICE_ID_KEY, deviceId);
    }
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    console.log('[CloudStorage] Reset device ID:', deviceId);
    return deviceId;
}

/**
 * Import device ID from another device (for cross-device access)
 * This allows accessing cloud saves from different devices
 * @param {string} importedDeviceId - Device ID from another device
 * @returns {string} The imported device ID
 */
function importDeviceId(importedDeviceId) {
    if (!importedDeviceId || !isValidDeviceId(importedDeviceId)) {
        throw new Error('Invalid device ID format');
    }
    
    deviceId = importedDeviceId;
    
    // Save to storage
    if (typeof storage !== 'undefined') {
        storage.setRaw(DEVICE_ID_KEY, deviceId);
    }
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    
    console.log('[CloudStorage] Imported device ID:', deviceId);
    return deviceId;
}

/**
 * Validate device ID format
 * @param {string} id
 * @returns {boolean}
 */
function isValidDeviceId(id) {
    return /^[a-zA-Z0-9_-]{8,64}$/.test(id);
}

/**
 * Export device ID for transfer to another device
 * Returns an object with multiple export formats
 * @returns {object}
 */
function exportDeviceId() {
    const devId = getDeviceId();
    
    return {
        deviceId: devId,
        plainText: devId,
        url: `${window.location.origin}${window.location.pathname}?import_device=${encodeURIComponent(devId)}`,
        qrCodeData: devId, // Can be used with a QR code library
        copyToClipboard: async function() {
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(devId);
                return true;
            }
            return false;
        }
    };
}

// ============ Shared Access Key System ============

/**
 * Generate a device ID from a shared access key
 * This allows multiple devices to share the same saves using a memorable key
 * @param {string} sharedKey - User-friendly shared key (e.g., "mystream2025")
 * @returns {string} Device ID derived from the shared key
 */
function generateDeviceIdFromSharedKey(sharedKey) {
    // Simple hash function to create consistent device ID from shared key
    let hash = 'sss_shared_';
    for (let i = 0; i < sharedKey.length; i++) {
        const char = sharedKey.charCodeAt(i);
        hash += char.toString(36);
    }
    // Pad or truncate to valid length (8-64 chars)
    hash = hash.substring(0, 64);
    if (hash.length < 8) {
        hash += '_' + Date.now().toString(36);
    }
    return hash;
}

/**
 * Set up shared access key
 * This allows easy cross-device access with a memorable key
 * @param {string} sharedKey - Memorable shared key (e.g., "mystreamsetup")
 * @returns {string} The device ID generated from the key
 */
function setSharedAccessKey(sharedKey) {
    if (!sharedKey || sharedKey.length < 3) {
        throw new Error('Shared key must be at least 3 characters');
    }
    
    // Generate consistent device ID from shared key
    const derivedDeviceId = generateDeviceIdFromSharedKey(sharedKey);
    
    // Import this device ID
    deviceId = derivedDeviceId;
    
    // Save both the key and the device ID
    if (typeof storage !== 'undefined') {
        storage.setRaw(DEVICE_ID_KEY, deviceId);
        storage.setRaw(SHARED_KEY_KEY, sharedKey);
    }
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
        localStorage.setItem(SHARED_KEY_KEY, sharedKey);
    }
    
    console.log('[CloudStorage] Shared access key set. Device ID:', deviceId);
    return deviceId;
}

/**
 * Get the current shared access key (if set)
 * @returns {string|null}
 */
function getSharedAccessKey() {
    let sharedKey = null;
    
    if (typeof storage !== 'undefined') {
        sharedKey = storage.getRaw(SHARED_KEY_KEY);
    }
    
    if (!sharedKey && typeof localStorage !== 'undefined') {
        sharedKey = localStorage.getItem(SHARED_KEY_KEY);
    }
    
    return sharedKey;
}

/**
 * Clear shared access key and generate new unique device ID
 */
function clearSharedAccessKey() {
    if (typeof storage !== 'undefined') {
        storage.remove(SHARED_KEY_KEY);
    }
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(SHARED_KEY_KEY);
    }
    
    return resetDeviceId();
}

// ============ Cloud API Functions ============

/**
 * Make a request to the cloud API
 * @param {string} endpoint - API endpoint (e.g., '/cloud/save')
 * @param {object} options - Fetch options
 * @returns {Promise<object>}
 */
async function cloudRequest(endpoint, options = {}) {
    const devId = getDeviceId();
    
    const headers = {
        'Content-Type': 'application/json',
        'X-Device-ID': devId,
        ...(options.headers || {}),
    };
    
    const response = await fetch(CLOUD_API_URL + endpoint, {
        ...options,
        headers,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error || `Cloud API error: ${response.status}`);
    }
    
    return data;
}

/**
 * Save current configs to cloud
 * @param {string} slot - Save slot name (default, backup1, backup2, etc.)
 * @param {object} metadata - Optional metadata
 * @param {string} passphrase - Optional passphrase for encryption
 * @returns {Promise<object>}
 */
async function saveToCloud(slot = 'default', metadata = {}, passphrase = null) {
    if (isSyncing) {
        throw new Error('Sync already in progress');
    }
    
    isSyncing = true;
    
    try {
        // Gather all configs from global scope or storage
        let configs = {
            swapConfigs: (typeof swapConfigs !== 'undefined' ? swapConfigs : []) || [],
            layoutPresets: (typeof layoutPresets !== 'undefined' ? layoutPresets : []) || [],
            textCyclerConfigs: (typeof textCyclerConfigs !== 'undefined' ? textCyclerConfigs : []) || [],
            clipsConfigs: (typeof clipsConfigs !== 'undefined' ? clipsConfigs : []) || [],
            sourceOpacityConfigs: (typeof sourceOpacityConfigs !== 'undefined' ? sourceOpacityConfigs : {}) || {},
        };
        
        // Add metadata
        metadata.hostname = window.location.hostname;
        metadata.userAgent = navigator.userAgent;
        metadata.configCounts = {
            swaps: configs.swapConfigs.length,
            layouts: configs.layoutPresets.length,
            textCyclers: configs.textCyclerConfigs.length,
            clips: configs.clipsConfigs.length,
            opacity: Object.keys(configs.sourceOpacityConfigs).length,
        };
        
        // Encrypt if passphrase provided
        if (passphrase && typeof CloudEncryption !== 'undefined') {
            metadata.encrypted = true;
            configs = await CloudEncryption.encryptData(configs, passphrase);
            console.log('[CloudStorage] [EMOJI] Data encrypted before upload');
        }
        
        const result = await cloudRequest('/cloud/save?slot=' + encodeURIComponent(slot), {
            method: 'POST',
            body: JSON.stringify({ configs, metadata }),
        });
        
        lastSyncTime = new Date().toISOString();
        if (typeof storage !== 'undefined') {
            storage.setRaw(LAST_CLOUD_SYNC_KEY, lastSyncTime);
        }
        
        console.log('[CloudStorage] [OK] Saved to cloud:', slot, result);
        return result;
    } finally {
        isSyncing = false;
    }
}

/**
 * Load configs from cloud
 * @param {string} slot - Save slot name
 * @param {string} passphrase - Optional passphrase for decryption
 * @returns {Promise<object>}
 */
async function loadFromCloud(slot = 'default', passphrase = null) {
    if (isSyncing) {
        throw new Error('Sync already in progress');
    }
    
    isSyncing = true;
    
    try {
        const result = await cloudRequest('/cloud/load?slot=' + encodeURIComponent(slot), {
            method: 'GET',
        });
        
        if (!result.success || !result.data) {
            throw new Error('Invalid cloud save data');
        }
        
        let saveData = result.data;
        
        // Decrypt if encrypted and passphrase provided
        if (saveData.metadata?.encrypted && passphrase && typeof CloudEncryption !== 'undefined') {
            console.log('[CloudStorage]  Decrypting data...');
            saveData.configs = await CloudEncryption.decryptData(saveData.configs, passphrase);
        } else if (saveData.metadata?.encrypted && !passphrase) {
            throw new Error('This save is encrypted. Passphrase required.');
        }
        
        console.log('[CloudStorage] [OK] Loaded from cloud:', slot);
        
        return saveData;
    } finally {
        isSyncing = false;
    }
}

/**
 * Apply loaded cloud save to current session
 * @param {object} saveData - Save data from loadFromCloud()
 * @param {boolean} merge - Merge with existing or replace
 */
function applyCloudSave(saveData, merge = false) {
    if (!saveData || !saveData.configs) {
        throw new Error('Invalid save data');
    }
    
    const configs = saveData.configs;
    
    // Apply each config type
    if (configs.swapConfigs !== undefined) {
        if (typeof swapConfigs !== 'undefined') {
            swapConfigs = merge ? [...swapConfigs, ...configs.swapConfigs] : configs.swapConfigs;
            if (typeof storage !== 'undefined') {
                storage.set('swapConfigs', swapConfigs);
            }
        }
    }
    
    if (configs.layoutPresets !== undefined) {
        if (typeof layoutPresets !== 'undefined') {
            layoutPresets = merge ? [...layoutPresets, ...configs.layoutPresets] : configs.layoutPresets;
            if (typeof storage !== 'undefined') {
                storage.set('layoutPresets', layoutPresets);
            }
        }
    }
    
    if (configs.textCyclerConfigs !== undefined) {
        if (typeof textCyclerConfigs !== 'undefined') {
            textCyclerConfigs = merge ? [...textCyclerConfigs, ...configs.textCyclerConfigs] : configs.textCyclerConfigs;
            if (typeof storage !== 'undefined') {
                storage.set('textCyclerConfigs', textCyclerConfigs);
            }
        }
    }
    
    if (configs.clipsConfigs !== undefined) {
        if (typeof clipsConfigs !== 'undefined') {
            clipsConfigs = merge ? [...clipsConfigs, ...configs.clipsConfigs] : configs.clipsConfigs;
            if (typeof storage !== 'undefined') {
                storage.set('clipsConfigs', clipsConfigs);
            }
        }
    }
    
    if (configs.sourceOpacityConfigs !== undefined) {
        if (typeof sourceOpacityConfigs !== 'undefined') {
            sourceOpacityConfigs = merge ? 
                { ...sourceOpacityConfigs, ...configs.sourceOpacityConfigs } : 
                configs.sourceOpacityConfigs;
            if (typeof storage !== 'undefined') {
                storage.set('sourceOpacityConfigs', sourceOpacityConfigs);
            }
        }
    }
    
    console.log('[CloudStorage] [OK] Applied cloud save to session');
    
    // Refresh UI if available
    if (typeof refreshAllTables === 'function') {
        refreshAllTables();
    }
}

/**
 * List all cloud saves for this device
 * @returns {Promise<Array>}
 */
async function listCloudSaves() {
    const result = await cloudRequest('/cloud/list', {
        method: 'GET',
    });
    
    if (!result.success) {
        throw new Error('Failed to list cloud saves');
    }
    
    return result.saves || [];
}

/**
 * Delete a cloud save
 * @param {string} slot - Save slot name
 * @returns {Promise<object>}
 */
async function deleteCloudSave(slot) {
    const result = await cloudRequest('/cloud/delete?slot=' + encodeURIComponent(slot), {
        method: 'DELETE',
    });
    
    console.log('[CloudStorage] [OK] Deleted cloud save:', slot);
    return result;
}

// ============ Auto-Sync System ============

/**
 * Check if auto-sync is enabled
 * @returns {boolean}
 */
function isAutoSyncEnabled() {
    if (typeof storage !== 'undefined') {
        const enabled = storage.get(AUTO_SYNC_ENABLED_KEY);
        return enabled === true;
    }
    return false;
}

/**
 * Enable auto-sync (saves to cloud every 5 minutes if changes detected)
 */
function enableAutoSync() {
    if (typeof storage !== 'undefined') {
        storage.set(AUTO_SYNC_ENABLED_KEY, true);
    }
    
    if (autoSyncTimer) clearInterval(autoSyncTimer);
    
    // DISABLED: Auto-sync removed to prevent automatic API calls
    // Auto-sync timer is disabled - users must manually save to cloud
    // This prevents expensive API calls without user action
    // autoSyncTimer = setInterval(async () => {
    //     if (!isAutoSyncEnabled()) {
    //         disableAutoSync();
    //         return;
    //     }
    //     
    //     try {
    //         console.log('[CloudStorage] Auto-sync triggered...');
    //         await saveToCloud('autosave', { type: 'auto' });
    //     } catch (e) {
    //         console.warn('[CloudStorage] Auto-sync failed:', e.message);
    //     }
    // }, AUTO_SYNC_INTERVAL);
    
    console.log('[CloudStorage] [OK] Auto-sync enabled (every 5 minutes)');
}

/**
 * Disable auto-sync
 */
function disableAutoSync() {
    if (typeof storage !== 'undefined') {
        storage.set(AUTO_SYNC_ENABLED_KEY, false);
    }
    
    if (autoSyncTimer) {
        clearInterval(autoSyncTimer);
        autoSyncTimer = null;
    }
    
    console.log('[CloudStorage] [ERROR] Auto-sync disabled');
}

/**
 * Get last sync time
 * @returns {string|null}
 */
function getLastSyncTime() {
    if (lastSyncTime) return lastSyncTime;
    
    if (typeof storage !== 'undefined') {
        lastSyncTime = storage.getRaw(LAST_CLOUD_SYNC_KEY);
    }
    
    return lastSyncTime;
}

// ============ Conflict Resolution ============

/**
 * Compare local and cloud save, return conflict info
 * @param {object} cloudSave - Cloud save data
 * @returns {object} Conflict info { hasConflict, localNewer, cloudNewer, recommendation }
 */
function checkForConflicts(cloudSave) {
    const localTimestamp = getLastSyncTime();
    const cloudTimestamp = cloudSave.timestamp;
    
    if (!localTimestamp) {
        return {
            hasConflict: false,
            recommendation: 'load',
            reason: 'No local sync history',
        };
    }
    
    const localDate = new Date(localTimestamp);
    const cloudDate = new Date(cloudTimestamp);
    
    if (cloudDate > localDate) {
        return {
            hasConflict: true,
            localNewer: false,
            cloudNewer: true,
            recommendation: 'load',
            reason: 'Cloud save is newer',
        };
    } else {
        return {
            hasConflict: true,
            localNewer: true,
            cloudNewer: false,
            recommendation: 'save',
            reason: 'Local changes are newer',
        };
    }
}

// ============ Exports ============
if (typeof window !== 'undefined') {
    window.CloudStorage = {
        // Device ID
        getDeviceId,
        resetDeviceId,
        importDeviceId,
        exportDeviceId,
        
        // Shared Access Key (easier multi-device access)
        setSharedAccessKey,
        getSharedAccessKey,
        clearSharedAccessKey,
        
        // Cloud operations
        saveToCloud,
        loadFromCloud,
        applyCloudSave,
        listCloudSaves,
        deleteCloudSave,
        
        // Auto-sync
        enableAutoSync,
        disableAutoSync,
        isAutoSyncEnabled,
        getLastSyncTime,
        
        // Conflict resolution
        checkForConflicts,
        
        // Status
        isSyncing: () => isSyncing,
        
        // Config (for changing API URL)
        setApiUrl: (url) => { CLOUD_API_URL = url; },
        getApiUrl: () => CLOUD_API_URL,
    };
    
    // Auto-initialize device ID
    getDeviceId();
    
    // Check for device ID import in URL (for easy cross-device setup)
    const urlParams = new URLSearchParams(window.location.search);
    const importDevice = urlParams.get('import_device');
    if (importDevice) {
        try {
            importDeviceId(importDevice);
            console.log('[CloudStorage] [OK] Imported device ID from URL');
            // Clean URL
            if (window.history && window.history.replaceState) {
                const cleanUrl = window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
            }
        } catch (e) {
            console.warn('[CloudStorage] Failed to import device ID from URL:', e);
        }
    }
    
    // DISABLED: Auto-enable sync removed to prevent automatic API calls
    // Users must manually enable auto-sync if desired (via GUI)
    // This prevents expensive API calls without user action
    // if (isAutoSyncEnabled()) {
    //     enableAutoSync();
    // }
}

