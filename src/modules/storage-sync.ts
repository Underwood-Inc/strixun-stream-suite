/**
 * Strixun Stream Suite - Storage Sync Module
 * 
 * Handles cross-client storage synchronization via OBS WebSocket:
 * - OBS dock writes to OBS persistent data (source of truth)
 * - Remote clients read from OBS persistent data
 * - Auto-sync on connection (configurable)
 * - Manual sync operations
 * - Handles CustomEvent storage broadcasts
 * - **CRITICAL**: Automatically syncs UI state (resizable zones, panel states) to OBS
 * 
 * UI STATE SYNC PATTERN:
 * - Any storage key starting with 'ui_' is considered UI state
 * - UI state is automatically included in OBS sync via broadcastStorage()
 * - storage.set() automatically triggers OBS sync for 'ui_' keys
 * - This ensures resizable zone sizes and other UI preferences sync to OBS client
 * 
 * @version 2.1.0 (TypeScript)
 */

import { storage } from './storage';
import { connected } from '../stores/connection';
import { request } from './websocket';
import { get } from 'svelte/store';
import type { SwapConfig, TextCyclerConfig, LayoutPreset } from '../types';

// ============ Types ============
interface StorageSyncDependencies {
  log: (msg: string, type?: string) => void;
  isOBSDock: () => boolean;
  // Callbacks for getting/setting configs
  getSwapConfigs?: () => SwapConfig[];
  setSwapConfigs?: (configs: SwapConfig[]) => void;
  getTextCyclerConfigs?: () => TextCyclerConfig[];
  setTextCyclerConfigs?: (configs: TextCyclerConfig[]) => void;
  getLayoutPresets?: () => LayoutPreset[];
  setLayoutPresets?: (presets: LayoutPreset[]) => void;
  // Render callbacks
  renderSavedSwaps?: () => void;
  renderTextCyclerConfigs?: () => void;
  renderSavedLayouts?: () => void;
  updateStorageStatus?: () => void;
}

interface StorageData {
  swapConfigs?: SwapConfig[];
  textCyclerConfigs?: TextCyclerConfig[];
  layoutPresets?: LayoutPreset[];
  uiState?: Record<string, unknown>; // UI state (resizable zone sizes, panel states, etc.)
}

interface CustomEventData {
  type: string;
  clientId?: string;
  requesterId?: string;
  data?: StorageData;
}

// ============ State ============
export const STORAGE_SYNC_DEBOUNCE = 500;
let storageSyncTimer: ReturnType<typeof setTimeout> | null = null;
let lastStorageSyncHash = '';
let lastBroadcastTime = 0;
const MIN_BROADCAST_INTERVAL = 1000; // Minimum 1s between broadcasts
let pendingStorageRequest = false;

// Dependencies (injected)
let dependencies: StorageSyncDependencies = {
  log: (msg: string, type?: string) => console.log(`[${type || 'info'}] ${msg}`),
  isOBSDock: () => false
};

// ============ Initialization ============

/**
 * Initialize the module with required dependencies
 */
export function init(deps: Partial<StorageSyncDependencies>): void {
  dependencies = { ...dependencies, ...deps };
}

// ============ Client ID ============

/**
 * Generate a unique client ID for this session
 */
export function getClientId(): string {
  if (!(window as any)._strixunClientId) {
    (window as any)._strixunClientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
  }
  return (window as any)._strixunClientId;
}

// ============ Storage Operations ============

/**
 * Request storage from OBS dock - OVERWRITES local storage completely
 * This is the "pull" operation - get state from the source of truth
 */
export async function requestStorageFromOBS(): Promise<void> {
  if (!get(connected)) {
    dependencies.log('Connect to OBS first', 'error');
    return;
  }
  
  pendingStorageRequest = true;
  dependencies.log('📥 Pulling storage from OBS persistent data...', 'info');
  
  try {
    // Get persistent data stored in OBS (realm: OBS_WEBSOCKET_DATA_REALM_GLOBAL, slot: strixun_configs)
    const response = await request('GetPersistentData', {
      realm: 'OBS_WEBSOCKET_DATA_REALM_GLOBAL',
      slotName: 'strixun_configs'
    });
    
    const responseData = response as { slotValue?: string };
    if (responseData && responseData.slotValue) {
      const storedConfigs = JSON.parse(responseData.slotValue) as StorageData;
      pendingStorageRequest = false;
      console.log('[Storage Sync] ✅ Retrieved from OBS persistent data:', storedConfigs);
      applyIncomingStorage(storedConfigs);
      dependencies.log('✅ Storage synced from OBS!', 'success');
    } else {
      pendingStorageRequest = false;
      dependencies.log('ℹ️ No shared storage found in OBS (OBS dock may need to save first)', 'info');
    }
  } catch (e) {
    pendingStorageRequest = false;
    console.error('[Storage Sync] Error:', e);
    
    const error = e as Error;
    // If persistent data doesn't exist yet, that's okay
    if (error.toString().includes('does not exist')) {
      dependencies.log('ℹ️ No configs saved to OBS yet. Save something in the OBS dock first.', 'info');
    } else {
      dependencies.log('⚠️ Storage sync failed: ' + error.message, 'error');
    }
  }
}

/**
 * Auto-sync on connection if checkbox is enabled
 * ONLY for remote clients - OBS dock is the source of truth!
 */
export async function requestStorageSync(): Promise<void> {
  if (!get(connected)) return;
  
  // OBS dock should NEVER request storage from itself - it IS the source
  if (dependencies.isOBSDock()) {
    console.log('[Storage Sync] Running as OBS dock - skipping auto-pull (we are the source)');
    return;
  }
  
  const autoSyncEl = document.getElementById('autoSyncOnConnect') as HTMLInputElement | null;
  const autoSync = autoSyncEl?.checked !== false;
  
  if (autoSync) {
    console.log('[Storage Sync] Running as remote client - auto-pulling from OBS dock');
    await requestStorageFromOBS();
  }
}

/**
 * Save storage to OBS persistent data (shared across all WebSocket clients)
 * Only OBS dock should call this - remote clients only read
 */
export async function broadcastStorage(): Promise<void> {
  if (!get(connected)) {
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
  
  // Collect UI state from storage (resizable zones, panel states, etc.)
  // Keys that start with 'ui_' are UI state that should be synced
  const uiState: Record<string, unknown> = {};
  // Known UI state keys that should be synced to OBS
  // CRITICAL: When adding new UI state keys, add them here to ensure OBS sync
  const knownUIKeys = [
    'ui_filter_aside_width',
    'ui_collapsed_cards',
    'ui_split_panel'
  ];
  // Collect all known UI state keys
  for (const key of knownUIKeys) {
    const value = storage.get(key);
    if (value !== null) {
      uiState[key] = value;
    }
  }
  // Note: Resizable zone sizes are stored with their storageKey prop value
  // If storageKey starts with 'ui_', it will be automatically included
  // For custom storage keys, add them to knownUIKeys above
  
  const storageData: StorageData = {
    swapConfigs: swapConfigs || [],
    textCyclerConfigs: textCyclerConfigs || [],
    layoutPresets: layoutPresets || [],
    uiState: Object.keys(uiState).length > 0 ? uiState : undefined
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
    await request('SetPersistentData', {
      realm: 'OBS_WEBSOCKET_DATA_REALM_GLOBAL',
      slotName: 'strixun_configs',
      slotValue: dataStr
    });
    
    console.log('[Storage Sync] ✅ Saved to OBS persistent data', {
      swaps: storageData.swapConfigs?.length || 0,
      texts: storageData.textCyclerConfigs?.length || 0,
      layouts: storageData.layoutPresets?.length || 0,
      uiStateKeys: storageData.uiState ? Object.keys(storageData.uiState).length : 0
    });
  } catch (e) {
    console.warn('[Storage Sync] ⚠️ Failed to write:', e);
    lastBroadcastTime = 0; // Allow retry immediately on next change
  }
}

/**
 * Handle incoming storage broadcast from another client
 * If we explicitly requested it (pendingStorageRequest), OVERWRITE local
 * Otherwise, only auto-accept if our local storage is empty
 */
export function handleStorageBroadcast(data: CustomEventData): void {
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
    dependencies.log('✅ Storage synced from OBS dock!', 'success');
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
    dependencies.log('✅ Storage auto-synced!', 'success');
  }
}

/**
 * Apply incoming storage data - OVERWRITES local completely
 * Uses callbacks to update configs and trigger renders
 */
export function applyIncomingStorage(data: StorageData): void {
  if (data.swapConfigs !== undefined && dependencies.setSwapConfigs) {
    dependencies.setSwapConfigs(data.swapConfigs);
    storage.set('swapConfigs', data.swapConfigs);
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
    storage.set('layoutPresets', data.layoutPresets);
    if (dependencies.renderSavedLayouts) dependencies.renderSavedLayouts();
  }
  
  // Apply UI state (resizable zone sizes, panel states, etc.)
  if (data.uiState) {
    for (const [key, value] of Object.entries(data.uiState)) {
      storage.set(key, value);
    }
    console.log('[Storage Sync] Applied UI state:', Object.keys(data.uiState));
  }
  
  // Update storage status display
  if (dependencies.updateStorageStatus) dependencies.updateStorageStatus();
}

/**
 * Manually trigger storage broadcast (for UI button)
 */
export function manualStorageSync(): void {
  if (!get(connected)) {
    dependencies.log('Connect to OBS first', 'error');
    return;
  }
  broadcastStorage();
  dependencies.log('Storage broadcast triggered', 'success');
}

/**
 * Schedule a debounced storage broadcast
 */
export function scheduleBroadcast(delay: number = STORAGE_SYNC_DEBOUNCE): void {
  if (storageSyncTimer) clearTimeout(storageSyncTimer);
  storageSyncTimer = setTimeout(() => broadcastStorage(), delay);
}

/**
 * Schedule a debounced UI state sync to OBS
 * Call this when UI state (resizable zones, panel states, etc.) changes
 * This ensures UI state is automatically synced to OBS client
 * 
 * CRITICAL: This must be called whenever UI state is saved to ensure
 * resizable zone sizes and other UI preferences are synced to OBS
 */
export function scheduleUISync(delay: number = STORAGE_SYNC_DEBOUNCE): void {
  // Only sync if we're the OBS dock (source of truth)
  if (!dependencies.isOBSDock()) {
    return;
  }
  
  // Schedule a broadcast which will include UI state
  scheduleBroadcast(delay);
}

/**
 * Save auto-sync preference
 */
export function saveAutoSyncPref(): void {
  const checkbox = document.getElementById('autoSyncOnConnect') as HTMLInputElement | null;
  const checked = checkbox?.checked;
  storage.set('autoSyncOnConnect', checked);
}

/**
 * Load auto-sync preference on init
 */
export function loadAutoSyncPref(): void {
  const saved = storage.get('autoSyncOnConnect') as boolean | null;
  const checkbox = document.getElementById('autoSyncOnConnect') as HTMLInputElement | null;
  if (checkbox && saved !== null) {
    checkbox.checked = saved;
  }
}

/**
 * Handle CustomEvent for storage sync
 * Called from main event handler
 */
export function handleCustomEvent(customData: CustomEventData): void {
  if (customData?.type === 'strixun_storage_broadcast') {
    // Ignore our own broadcasts (prevent echo)
    if (customData.clientId === getClientId()) {
      console.log('[Storage Sync] Ignoring own broadcast (echo prevention)');
      return;
    }
    
    dependencies.log('📥 Received storage broadcast from another client', 'info');
    handleStorageBroadcast(customData);
  } else if (customData?.type === 'strixun_storage_request') {
    console.log('[Storage Sync] 🔔 Storage request received!', {
      requesterId: customData.requesterId,
      ourClientId: getClientId(),
      isOurOwn: customData.requesterId === getClientId()
    });
    
    // Ignore our own requests (prevent echo)
    if (customData.requesterId === getClientId()) {
      console.log('[Storage Sync] Ignoring own storage request (echo prevention)');
      return;
    }
    
    console.log('[Storage Sync] 📤 Responding to storage request!');
    dependencies.log('📤 Another client requesting storage - broadcasting...', 'info');
    broadcastStorage();
  }
}

// Getters for state (for compatibility)
export function getStorageSyncTimer(): ReturnType<typeof setTimeout> | null {
  return storageSyncTimer;
}

export function setStorageSyncTimer(val: ReturnType<typeof setTimeout> | null): void {
  storageSyncTimer = val;
}

