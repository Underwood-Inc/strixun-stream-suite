/**
 * Cloud Storage Wrapper
 * 
 * Adds cloud persistence to local storage for Streamkit configs
 * Implements a "write-through" cache pattern:
 * - Writes: Local storage (immediate) + Cloud API (async)
 * - Reads: Local storage (fast) with periodic cloud sync
 * 
 * Cloud sync only happens when:
 * - User is authenticated
 * - API URL is configured (not localhost in dev unless servers are running)
 * 
 * AUTOMATIC SYNC ON LOGIN:
 * - Subscribes to auth state changes
 * - When user logs in, automatically syncs configs from cloud
 * - Emits 'cloud-sync-complete' event for stores to refresh
 * 
 * ERROR HANDLING:
 * - Errors are surfaced via toast notifications (showWarning) and activity log
 * - Local storage operations are never blocked by cloud failures
 * - Cooldown prevents toast spam for repeated errors
 */

import { storage } from './storage';
import * as API from './streamkit-api-client';
import { isAuthenticated } from '../stores/auth';
import { get } from 'svelte/store';
import type { TextCyclerConfig, SwapConfig, LayoutPreset } from '../types';
import { showWarning } from '../stores/toast-queue';

/**
 * Event emitter for cloud sync events
 * Stores can listen to 'cloud-sync-complete' to refresh their data
 */
type CloudSyncEventCallback = (type?: string) => void;
const syncEventListeners: CloudSyncEventCallback[] = [];

export function onCloudSyncComplete(callback: CloudSyncEventCallback): () => void {
  syncEventListeners.push(callback);
  return () => {
    const index = syncEventListeners.indexOf(callback);
    if (index > -1) syncEventListeners.splice(index, 1);
  };
}

function emitCloudSyncComplete(type?: string): void {
  syncEventListeners.forEach(cb => cb(type));
}

/**
 * Error cooldown tracking to prevent toast spam
 */
const errorCooldowns: Record<string, number> = {};
const ERROR_COOLDOWN_MS = 30000; // 30 seconds between repeat error toasts

/**
 * Log to activity log if available
 */
function logToActivity(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
  if (typeof window !== 'undefined' && (window as any).addLogEntry) {
    (window as any).addLogEntry(message, type, 'CLOUD');
  }
}

/**
 * Handle cloud sync error with user notification (with cooldown to prevent spam)
 */
function handleSyncError(errorKey: string, userMessage: string, error?: unknown): void {
  const now = Date.now();
  const lastError = errorCooldowns[errorKey] || 0;
  
  // Always log to console and activity log
  console.warn(`[Cloud Storage] ${userMessage}:`, error);
  logToActivity(`${userMessage}: ${error instanceof Error ? error.message : String(error)}`, 'warning');
  
  // Only show toast if outside cooldown period (prevents spam)
  if (now - lastError > ERROR_COOLDOWN_MS) {
    errorCooldowns[errorKey] = now;
    showWarning(userMessage);
  }
}

/**
 * Sync status - tracked per config type so parallel syncs don't block each other
 */
const syncingTypes: Set<string> = new Set();
let lastSyncTime: Record<string, number> = {};
const SYNC_DEBOUNCE_MS = 2000;

/**
 * Check if cloud sync should be attempted
 * Skip if not authenticated or no API configured
 */
function shouldSyncToCloud(): boolean {
  // Must be authenticated
  if (!get(isAuthenticated)) {
    return false;
  }
  return true;
}

/**
 * Save text cycler configs (local + cloud)
 */
export async function saveTextCyclerConfigs(configs: TextCyclerConfig[]): Promise<void> {
  // Write to local storage immediately
  storage.set('textCyclerConfigs', configs);
  
  // Schedule cloud sync (debounced)
  scheduleCloudSync('text-cyclers', configs);
}

/**
 * Load text cycler configs (local first, then sync from cloud)
 */
export async function loadTextCyclerConfigs(): Promise<TextCyclerConfig[]> {
  // Get from local storage first (fast)
  const local = (storage.get('textCyclerConfigs') as TextCyclerConfig[]) || [];
  
  // Try to sync from cloud in background (don't block)
  syncFromCloud('text-cyclers').catch(err => {
    handleSyncError('load-text-cyclers', 'Failed to load text cyclers from cloud', err);
  });
  
  return local;
}

/**
 * Save swap configs (local + cloud)
 */
export async function saveSwapConfigs(configs: SwapConfig[]): Promise<void> {
  storage.set('swapConfigs', configs);
  scheduleCloudSync('swaps', configs);
}

/**
 * Load swap configs (local first, then sync from cloud)
 */
export async function loadSwapConfigs(): Promise<SwapConfig[]> {
  const local = (storage.get('swapConfigs') as SwapConfig[]) || [];
  syncFromCloud('swaps').catch(err => {
    handleSyncError('load-swaps', 'Failed to load swap configs from cloud', err);
  });
  return local;
}

/**
 * Save layout presets (local + cloud)
 */
export async function saveLayoutPresets(presets: LayoutPreset[]): Promise<void> {
  storage.set('layoutPresets', presets);
  scheduleCloudSync('layouts', presets);
}

/**
 * Load layout presets (local first, then sync from cloud)
 */
export async function loadLayoutPresets(): Promise<LayoutPreset[]> {
  const local = (storage.get('layoutPresets') as LayoutPreset[]) || [];
  syncFromCloud('layouts').catch(err => {
    handleSyncError('load-layouts', 'Failed to load layouts from cloud', err);
  });
  return local;
}

/**
 * Schedule a cloud sync (debounced)
 */
function scheduleCloudSync(type: string, data: any[]): void {
  const now = Date.now();
  const lastSync = lastSyncTime[type] || 0;
  
  // Debounce: only sync if it's been at least SYNC_DEBOUNCE_MS since last write
  if (now - lastSync < SYNC_DEBOUNCE_MS) {
    // Cancel previous timeout and reschedule
    const timerId = (window as any)[`__cloudSyncTimer_${type}`];
    if (timerId) clearTimeout(timerId);
  }
  
  (window as any)[`__cloudSyncTimer_${type}`] = setTimeout(() => {
    syncToCloud(type, data).catch(err => {
      handleSyncError(`save-${type}`, `Failed to save ${type} to cloud`, err);
    });
  }, SYNC_DEBOUNCE_MS);
  
  lastSyncTime[type] = now;
}

/**
 * Sync data to cloud
 * Only syncs if authenticated
 */
async function syncToCloud(type: string, data: any[]): Promise<void> {
  if (!shouldSyncToCloud()) {
    return;
  }
  
  if (syncingTypes.has(type)) {
    console.log(`[Cloud Storage] Sync already in progress for ${type}, skipping`);
    return;
  }
  
  syncingTypes.add(type);
  
  try {
    console.log(`[Cloud Storage] Syncing ${data.length} ${type} to cloud...`);
    
    const apiType = type as 'text-cyclers' | 'swaps' | 'layouts';
    const cloudConfigs = await API.listConfigs(apiType);
    
    const cloudMap = new Map(cloudConfigs.map((c: any) => [c.id, c]));
    
    for (const item of data) {
      const id = item.id;
      if (!id) continue;
      
      if (cloudMap.has(id)) {
        await API.updateConfig(apiType, id, item);
      } else {
        await API.createConfig(apiType, item);
      }
    }
    
    const localIds = new Set(data.map((item: any) => item.id).filter(Boolean));
    for (const [cloudId] of cloudMap.entries()) {
      if (!localIds.has(cloudId)) {
        await API.deleteConfig(apiType, cloudId);
      }
    }
    
    console.log(`[Cloud Storage] Synced ${data.length} ${type} to cloud`);
    logToActivity(`Saved ${data.length} ${type} to cloud`, 'success');
  } finally {
    syncingTypes.delete(type);
  }
}

/**
 * Sync data from cloud (overwrites local if cloud is newer)
 * Only syncs if authenticated
 * Throws errors to caller for proper handling
 */
async function syncFromCloud(type: string): Promise<void> {
  // Skip if not authenticated
  if (!shouldSyncToCloud()) {
    return;
  }
  
  const apiType = type as 'text-cyclers' | 'swaps' | 'layouts';
  const cloudConfigs = await API.listConfigs(apiType);
  
  if (cloudConfigs.length > 0) {
    console.log(`[Cloud Storage] Fetched ${cloudConfigs.length} ${type} from cloud`);
    
    // Map API type to storage key
    const storageKey = type === 'text-cyclers' ? 'textCyclerConfigs' : 
                       type === 'swaps' ? 'swapConfigs' :
                       'layoutPresets';
    
    // Update local storage with cloud data
    storage.set(storageKey, cloudConfigs);
  }
}

/**
 * Force a full sync from cloud (overwrites local)
 * Only syncs if authenticated
 * Emits 'cloud-sync-complete' event when done for stores to refresh
 */
export async function forceCloudSync(): Promise<void> {
  if (!shouldSyncToCloud()) {
    console.log('[Cloud Storage] Skipping cloud sync - not authenticated');
    return;
  }
  
  console.log('[Cloud Storage] Forcing full cloud sync...');
  
  // Sync all config types, collecting any errors
  const results = await Promise.allSettled([
    syncFromCloud('text-cyclers'),
    syncFromCloud('swaps'),
    syncFromCloud('layouts'),
  ]);
  
  // Check for failures
  const failures = results.filter(r => r.status === 'rejected');
  if (failures.length > 0) {
    const errorMessages = failures.map(f => (f as PromiseRejectedResult).reason?.message || 'Unknown error');
    handleSyncError('force-sync', `Cloud sync partially failed: ${errorMessages.join(', ')}`, errorMessages);
  } else {
    console.log('[Cloud Storage] ✓ Full cloud sync complete');
    logToActivity('Configs synced from cloud', 'success');
  }
  
  // Emit event for stores to refresh their data (even on partial success)
  emitCloudSyncComplete();
}

/**
 * Track previous auth state to detect login
 */
let wasAuthenticated = false;
let authSubscriptionInitialized = false;

/**
 * Initialize cloud storage and subscribe to auth changes
 * Call this once during app bootstrap
 */
export function initCloudStorage(): void {
  if (authSubscriptionInitialized) return;
  authSubscriptionInitialized = true;
  
  // Subscribe to auth state changes
  isAuthenticated.subscribe((authenticated) => {
    // Detect login (transition from not authenticated to authenticated)
    if (authenticated && !wasAuthenticated) {
      console.log('[Cloud Storage] User logged in - syncing configs from cloud...');
      logToActivity('Syncing configs from cloud...', 'info');
      
      // Sync from cloud when user logs in
      forceCloudSync().catch(err => {
        handleSyncError('login-sync', 'Failed to sync configs on login', err);
      });
    }
    wasAuthenticated = authenticated;
  });
  
  console.log('[Cloud Storage] Initialized with auth state subscription');
}
