/**
 * Storage Sync Module
 * 
 * Handles cross-client storage synchronization via OBS WebSocket:
 * - OBS dock writes to OBS persistent data (source of truth)
 * - Remote clients read from OBS persistent data
 * - Auto-sync on connection (configurable)
 * - Manual sync operations
 * - Handles CustomEvent storage broadcasts
 * 
 * @module StorageSync
 */

(function() {
    'use strict';

    // ============ Dependencies (injected) ============
    let dependencies = {
        storage: null,
        log: null,
        get connected() { return false; },
        isOBSDock: null,
        request: null,
        // Callbacks for getting/setting configs
        getSwapConfigs: null,
        setSwapConfigs: null,
        getTextCyclerConfigs: null,
        setTextCyclerConfigs: null,
        getLayoutPresets: null,
        setLayoutPresets: null,
        // Render callbacks
        renderSavedSwaps: null,
        renderTextCyclerConfigs: null,
        renderSavedLayouts: null,
        updateStorageStatus: null
    };

    /**
     * Initialize the module with required dependencies
     * @param {Object} deps - Dependency object
     */
    function init(deps) {
        dependencies = { ...dependencies, ...deps };
    }

    // ============ State ============
    const STORAGE_SYNC_DEBOUNCE = 500;
    let storageSyncTimer = null;
    let lastStorageSyncHash = '';
    let lastBroadcastTime = 0;
    const MIN_BROADCAST_INTERVAL = 1000; // Minimum 1s between broadcasts
    let pendingStorageRequest = false;

    // ============ Client ID ============

    /**
     * Generate a unique client ID for this session
     * @returns {string}
     */
    function getClientId() {
        if (!window._strixunClientId) {
            window._strixunClientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
        return window._strixunClientId;
    }

    // ============ Storage Operations ============

    /**
     * Request storage from OBS dock - OVERWRITES local storage completely
     * This is the "pull" operation - get state from the source of truth
     */
    async function requestStorageFromOBS() {
        if (!dependencies.connected) {
            dependencies.log('Connect to OBS first', 'error');
            return;
        }
        
        pendingStorageRequest = true;
        dependencies.log(' Pulling storage from OBS persistent data...', 'info');
        
        try {
            // Get persistent data stored in OBS (realm: OBS_WEBSOCKET_DATA_REALM_GLOBAL, slot: strixun_configs)
            const response = await dependencies.request('GetPersistentData', {
                realm: 'OBS_WEBSOCKET_DATA_REALM_GLOBAL',
                slotName: 'strixun_configs'
            });
            
            if (response && response.slotValue) {
                const storedConfigs = JSON.parse(response.slotValue);
                pendingStorageRequest = false;
                console.log('[Storage Sync] ✓ Retrieved from OBS persistent data:', storedConfigs);
                applyIncomingStorage(storedConfigs);
                dependencies.log('✓ Storage synced from OBS!', 'success');
            } else {
                pendingStorageRequest = false;
                dependencies.log('ℹ No shared storage found in OBS (OBS dock may need to save first)', 'info');
            }
        } catch (e) {
            pendingStorageRequest = false;
            console.error('[Storage Sync] Error:', e);
            
            // If persistent data doesn't exist yet, that's okay
            if (e.toString().includes('does not exist')) {
                dependencies.log('ℹ No configs saved to OBS yet. Save something in the OBS dock first.', 'info');
            } else {
                dependencies.log('⚠ Storage sync failed: ' + e.message, 'error');
            }
        }
    }

    /**
     * Auto-sync on connection if checkbox is enabled
     * ONLY for remote clients - OBS dock is the source of truth!
     */
    async function requestStorageSync() {
        if (!dependencies.connected) return;
        
        // OBS dock should NEVER request storage from itself - it IS the source
        if (dependencies.isOBSDock()) {
            console.log('[Storage Sync] Running as OBS dock - skipping auto-pull (we are the source)');
            return;
        }
        
        const autoSync = document.getElementById('autoSyncOnConnect')?.checked !== false;
        
        if (autoSync) {
            console.log('[Storage Sync] Running as remote client - auto-pulling from OBS dock');
            await requestStorageFromOBS();
        }
    }

    /**
     * Save storage to OBS persistent data (shared across all WebSocket clients)
     * Only OBS dock should call this - remote clients only read
     */
    async function broadcastStorage() {
        if (!dependencies.connected) {
            console.log('[Storage Sync] Skipped - not connected');
            return;
        }
        
        // Only OBS dock should write to persistent storage
        // Remote clients only read from it
        if (!dependencies.isOBSDock()) {
            console.log('[Storage Sync] Skipped - only OBS dock writes to persistent storage');
            return;
        }
        
        // Rate limiting: don't write more than once per second
        const now = Date.now();
        if (now - lastBroadcastTime < MIN_BROADCAST_INTERVAL) {
            console.log('[Storage Sync] Rate limited, scheduling retry...');
            // Schedule retry after interval
            if (storageSyncTimer) clearTimeout(storageSyncTimer);
            storageSyncTimer = setTimeout(() => broadcastStorage(), MIN_BROADCAST_INTERVAL);
            return;
        }
        
        // Get current configs from callbacks
        const swapConfigs = dependencies.getSwapConfigs ? dependencies.getSwapConfigs() : [];
        const textCyclerConfigs = dependencies.getTextCyclerConfigs ? dependencies.getTextCyclerConfigs() : [];
        const layoutPresets = dependencies.getLayoutPresets ? dependencies.getLayoutPresets() : [];
        
        const storageData = {
            swapConfigs: swapConfigs || [],
            textCyclerConfigs: textCyclerConfigs || [],
            layoutPresets: layoutPresets || []
        };
        
        // Create hash to avoid duplicate writes
        const dataStr = JSON.stringify(storageData);
        const hash = dataStr.length + '_' + dataStr.substring(0, 50);
        if (hash === lastStorageSyncHash) {
            console.log('[Storage Sync] Skipped - no changes detected');
            return;
        }
        lastStorageSyncHash = hash;
        lastBroadcastTime = now;
        
        try {
            // Write to OBS persistent data (global realm, accessible by all clients)
            await dependencies.request('SetPersistentData', {
                realm: 'OBS_WEBSOCKET_DATA_REALM_GLOBAL',
                slotName: 'strixun_configs',
                slotValue: dataStr
            });
            
            console.log('[Storage Sync] ✓ Saved to OBS persistent data', {
                swaps: storageData.swapConfigs.length,
                texts: storageData.textCyclerConfigs.length,
                layouts: storageData.layoutPresets.length
            });
        } catch (e) {
            console.warn('[Storage Sync] ⚠ Failed to write:', e);
            lastBroadcastTime = 0; // Allow retry immediately on next change
        }
    }

    /**
     * Handle incoming storage broadcast from another client
     * If we explicitly requested it (pendingStorageRequest), OVERWRITE local
     * Otherwise, only auto-accept if our local storage is empty
     * @param {Object} data - Broadcast data
     */
    function handleStorageBroadcast(data) {
        if (!data?.data) return;
        
        const incomingTotal = (data.data.swapConfigs?.length || 0) + 
                              (data.data.textCyclerConfigs?.length || 0) + 
                              (data.data.layoutPresets?.length || 0);
        
        // If we explicitly requested storage, always overwrite local
        if (pendingStorageRequest) {
            pendingStorageRequest = false;
            
            if (incomingTotal === 0) {
                dependencies.log('OBS dock has no configs saved', 'warning');
                return;
            }
            
            dependencies.log(`Received ${incomingTotal} configs from OBS dock - applying...`, 'info');
            applyIncomingStorage(data.data);
            dependencies.log('✓ Storage synced from OBS dock!', 'success');
            return;
        }
        
        // Auto-accept only if local is completely empty and incoming has data
        const swapCount = dependencies.getSwapConfigs ? dependencies.getSwapConfigs().length : 0;
        const textCount = dependencies.getTextCyclerConfigs ? dependencies.getTextCyclerConfigs().length : 0;
        const layoutCount = dependencies.getLayoutPresets ? dependencies.getLayoutPresets().length : 0;
        const localTotal = swapCount + textCount + layoutCount;
        
        if (localTotal === 0 && incomingTotal > 0) {
            dependencies.log(`Auto-syncing ${incomingTotal} configs from connected client...`, 'info');
            applyIncomingStorage(data.data);
            dependencies.log('✓ Storage auto-synced!', 'success');
        }
    }

    /**
     * Apply incoming storage data - OVERWRITES local completely
     * Uses callbacks to update configs and trigger renders
     * @param {Object} data - Storage data object
     */
    function applyIncomingStorage(data) {
        if (data.swapConfigs !== undefined && dependencies.setSwapConfigs) {
            dependencies.setSwapConfigs(data.swapConfigs);
            dependencies.storage.set('swapConfigs', data.swapConfigs);
            if (dependencies.renderSavedSwaps) dependencies.renderSavedSwaps();
        }
        if (data.textCyclerConfigs !== undefined) {
            if (dependencies.setTextCyclerConfigs) {
                dependencies.setTextCyclerConfigs(data.textCyclerConfigs);
            }
            if (dependencies.renderTextCyclerConfigs) dependencies.renderTextCyclerConfigs();
        }
        if (data.layoutPresets !== undefined && dependencies.setLayoutPresets) {
            dependencies.setLayoutPresets(data.layoutPresets);
            dependencies.storage.set('layoutPresets', data.layoutPresets);
            if (dependencies.renderSavedLayouts) dependencies.renderSavedLayouts();
        }
        
        // Update storage status display
        if (dependencies.updateStorageStatus) dependencies.updateStorageStatus();
    }

    /**
     * Manually trigger storage broadcast (for UI button)
     */
    function manualStorageSync() {
        if (!dependencies.connected) {
            dependencies.log('Connect to OBS first', 'error');
            return;
        }
        broadcastStorage();
        dependencies.log('Storage broadcast triggered', 'success');
    }

    /**
     * Schedule a debounced storage broadcast
     * @param {number} delay - Delay in ms (defaults to STORAGE_SYNC_DEBOUNCE)
     */
    function scheduleBroadcast(delay = STORAGE_SYNC_DEBOUNCE) {
        if (storageSyncTimer) clearTimeout(storageSyncTimer);
        storageSyncTimer = setTimeout(() => broadcastStorage(), delay);
    }

    /**
     * Save auto-sync preference
     */
    function saveAutoSyncPref() {
        const checked = document.getElementById('autoSyncOnConnect')?.checked;
        dependencies.storage.set('autoSyncOnConnect', checked);
    }

    /**
     * Load auto-sync preference on init
     */
    function loadAutoSyncPref() {
        const saved = dependencies.storage.get('autoSyncOnConnect');
        const checkbox = document.getElementById('autoSyncOnConnect');
        if (checkbox && saved !== null) {
            checkbox.checked = saved;
        }
    }

    /**
     * Handle CustomEvent for storage sync
     * Called from main event handler
     * @param {Object} customData - Custom event data
     */
    function handleCustomEvent(customData) {
        if (customData?.type === 'strixun_storage_broadcast') {
            // Ignore our own broadcasts (prevent echo)
            if (customData.clientId === getClientId()) {
                console.log('[Storage Sync] Ignoring own broadcast (echo prevention)');
                return;
            }
            
            dependencies.log(' Received storage broadcast from another client', 'info');
            handleStorageBroadcast(customData);
        } else if (customData?.type === 'strixun_storage_request') {
            console.log('[Storage Sync] ★ Storage request received!', {
                requesterId: customData.requesterId,
                ourClientId: getClientId(),
                isOurOwn: customData.requesterId === getClientId()
            });
            
            // Ignore our own requests (prevent echo)
            if (customData.requesterId === getClientId()) {
                console.log('[Storage Sync] Ignoring own storage request (echo prevention)');
                return;
            }
            
            console.log('[Storage Sync]  Responding to storage request!');
            dependencies.log(' Another client requesting storage - broadcasting...', 'info');
            broadcastStorage();
        }
    }

    // ============ Public API ============
    window.StorageSync = {
        init,
        getClientId,
        requestStorageFromOBS,
        requestStorageSync,
        broadcastStorage,
        handleStorageBroadcast,
        applyIncomingStorage,
        manualStorageSync,
        scheduleBroadcast,
        saveAutoSyncPref,
        loadAutoSyncPref,
        handleCustomEvent,
        // Getters for state
        get storageSyncTimer() { return storageSyncTimer; },
        set storageSyncTimer(val) { storageSyncTimer = val; },
        get STORAGE_SYNC_DEBOUNCE() { return STORAGE_SYNC_DEBOUNCE; }
    };

})();

