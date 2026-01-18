/**
 * Cloud Storage Wrapper
 * 
 * Adds cloud persistence to local storage for Streamkit configs
 * Implements a "write-through" cache pattern:
 * - Writes: Local storage (immediate) + Cloud API (async)
 * - Reads: Local storage (fast) with periodic cloud sync
 */

import { storage } from './storage';
import * as API from './streamkit-api-client';
import type { TextCyclerConfig, SwapConfig, LayoutPreset } from '../types';

/**
 * Sync status
 */
let isSyncing = false;
let lastSyncTime: Record<string, number> = {};
const SYNC_DEBOUNCE_MS = 2000; // Wait 2s after last write before syncing to cloud

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
    console.warn('[Cloud Storage] Failed to sync text cyclers from cloud:', err);
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
    console.warn('[Cloud Storage] Failed to sync swaps from cloud:', err);
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
    console.warn('[Cloud Storage] Failed to sync layouts from cloud:', err);
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
      console.warn(`[Cloud Storage] Failed to sync ${type} to cloud:`, err);
    });
  }, SYNC_DEBOUNCE_MS);
  
  lastSyncTime[type] = now;
}

/**
 * Sync data to cloud
 */
async function syncToCloud(type: string, data: any[]): Promise<void> {
  if (isSyncing) {
    console.log(`[Cloud Storage] Sync already in progress for ${type}, skipping`);
    return;
  }
  
  isSyncing = true;
  
  try {
    console.log(`[Cloud Storage] Syncing ${data.length} ${type} to cloud...`);
    
    // Get existing cloud configs
    const apiType = type as 'text-cyclers' | 'swaps' | 'layouts';
    const cloudConfigs = await API.listConfigs(apiType);
    
    // Create a map of cloud configs by ID
    const cloudMap = new Map(cloudConfigs.map((c: any) => [c.id, c]));
    
    // Sync each local config to cloud
    for (const item of data) {
      const id = item.id;
      if (!id) continue; // Skip items without IDs
      
      if (cloudMap.has(id)) {
        // Update existing cloud config
        await API.updateConfig(apiType, id, item);
      } else {
        // Create new cloud config
        await API.createConfig(apiType, item);
      }
    }
    
    // Delete cloud configs that don't exist locally
    const localIds = new Set(data.map((item: any) => item.id).filter(Boolean));
    for (const [cloudId, cloudConfig] of cloudMap.entries()) {
      if (!localIds.has(cloudId)) {
        await API.deleteConfig(apiType, cloudId);
      }
    }
    
    console.log(`[Cloud Storage] ✓ Synced ${data.length} ${type} to cloud`);
  } finally {
    isSyncing = false;
  }
}

/**
 * Sync data from cloud (overwrites local if cloud is newer)
 */
async function syncFromCloud(type: string): Promise<void> {
  try {
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
  } catch (err) {
    console.warn(`[Cloud Storage] Failed to sync ${type} from cloud:`, err);
  }
}

/**
 * Force a full sync from cloud (overwrites local)
 */
export async function forceCloudSync(): Promise<void> {
  console.log('[Cloud Storage] Forcing full cloud sync...');
  await Promise.all([
    syncFromCloud('text-cyclers'),
    syncFromCloud('swaps'),
    syncFromCloud('layouts'),
  ]);
  console.log('[Cloud Storage] ✓ Full cloud sync complete');
}
