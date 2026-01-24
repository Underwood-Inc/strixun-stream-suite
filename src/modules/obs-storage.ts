/**
 * Strixun Stream Suite - OBS Native Storage Service
 * 
 * Provides persistent storage for OBS docks and browser sources using
 * the OBS WebSocket GetPersistentData/SetPersistentData API.
 * 
 * ARCHITECTURE:
 * - Uses OBS WebSocket persistent data API (realm: OBS_WEBSOCKET_DATA_REALM_GLOBAL)
 * - Each storage key maps to a slot in OBS persistent storage
 * - Maintains an in-memory cache for synchronous reads
 * - Async writes to OBS with debouncing to prevent API spam
 * 
 * USAGE:
 * - Call initOBSStorage() after WebSocket connection is established
 * - Use obsStorage.get/set/remove like regular storage
 * - Data persists across OBS restarts and is shared between all connected clients
 * 
 * @version 1.0.0 (TypeScript)
 */

import { connected } from '../stores/connection.js';
import { get } from 'svelte/store';

// ============ Types ============
interface OBSStorageInterface {
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
  loadAll(): Promise<void>;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: string) => void;
}

// ============ Constants ============
const OBS_STORAGE_REALM = 'OBS_WEBSOCKET_DATA_REALM_GLOBAL';
const OBS_STORAGE_SLOT_PREFIX = 'strixun_';
const OBS_STORAGE_MASTER_SLOT = 'strixun_storage_master';
const WRITE_DEBOUNCE_MS = 500;

// ============ State ============
let obsStorageCache: Record<string, unknown> = {};
let obsStorageReady = false;
let pendingWrites: Record<string, ReturnType<typeof setTimeout>> = {};
let wsInstance: WebSocket | null = null;
let msgId = 1;
let pendingRequests: Record<string, PendingRequest> = {};

// ============ WebSocket Communication ============

/**
 * Set the WebSocket instance for OBS storage to use
 * Must be called after WebSocket connection is established
 */
export function setWebSocket(ws: WebSocket): void {
  wsInstance = ws;
}

/**
 * Send a request to OBS WebSocket and wait for response
 */
function obsRequest(type: string, data: Record<string, unknown> = {}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (!wsInstance || wsInstance.readyState !== WebSocket.OPEN) {
      reject('WebSocket not connected');
      return;
    }
    
    const id = 'obs_storage_' + (msgId++);
    pendingRequests[id] = { resolve, reject };
    
    wsInstance.send(JSON.stringify({
      op: 6,
      d: { requestType: type, requestId: id, requestData: data }
    }));
    
    // Timeout after 5 seconds
    setTimeout(() => {
      if (pendingRequests[id]) {
        delete pendingRequests[id];
        reject('Timeout');
      }
    }, 5000);
  });
}

/**
 * Handle WebSocket message responses for OBS storage requests
 * Call this from the main WebSocket message handler
 */
export function handleOBSStorageResponse(data: { op: number; d?: { requestId?: string; requestStatus?: { result: boolean; comment?: string }; responseData?: unknown } }): boolean {
  if (data.op !== 7) return false; // Not a response
  
  const requestId = data.d?.requestId;
  if (!requestId || !requestId.startsWith('obs_storage_')) return false;
  
  const req = pendingRequests[requestId];
  if (!req) return false;
  
  if (data.d?.requestStatus?.result) {
    req.resolve(data.d.responseData);
  } else {
    req.reject(data.d?.requestStatus?.comment || 'Request failed');
  }
  delete pendingRequests[requestId];
  return true;
}

// ============ OBS Persistent Storage Operations ============

// Storage prefix must match the main storage module
const LOCAL_STORAGE_PREFIX = 'sss_';

/**
 * Migrate localStorage data to OBS storage
 * This ensures any data saved before OBS connection is available in OBS storage
 */
function migrateFromLocalStorage(): void {
  try {
    let migratedCount = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const fullKey = localStorage.key(i);
      if (fullKey && fullKey.startsWith(LOCAL_STORAGE_PREFIX)) {
        const key = fullKey.substring(LOCAL_STORAGE_PREFIX.length);
        // Only migrate if not already in OBS storage
        if (!(key in obsStorageCache)) {
          try {
            const raw = localStorage.getItem(fullKey);
            if (raw) {
              try {
                obsStorageCache[key] = JSON.parse(raw);
              } catch {
                // Raw string value
                obsStorageCache[key] = raw;
              }
              migratedCount++;
            }
          } catch (e) {
            // Skip corrupted keys
          }
        }
      }
    }
    if (migratedCount > 0) {
      console.log('[OBS Storage] Migrated', migratedCount, 'keys from localStorage');
      // Schedule save to persist migrated data
      scheduleSave('_migrate');
    }
  } catch (e) {
    console.error('[OBS Storage] Migration error:', e);
  }
}

/**
 * Load all storage data from OBS persistent storage
 * Should be called after WebSocket connection is established
 * Also migrates localStorage data to OBS storage
 */
async function loadFromOBS(): Promise<void> {
  if (!get(connected)) {
    console.log('[OBS Storage] Not connected, skipping load');
    return;
  }
  
  try {
    const response = await obsRequest('GetPersistentData', {
      realm: OBS_STORAGE_REALM,
      slotName: OBS_STORAGE_MASTER_SLOT
    });
    
    const responseData = response as { slotValue?: string };
    if (responseData?.slotValue) {
      try {
        const storedData = JSON.parse(responseData.slotValue) as Record<string, unknown>;
        obsStorageCache = { ...storedData };
        console.log('[OBS Storage] Loaded', Object.keys(obsStorageCache).length, 'keys from OBS');
      } catch (e) {
        console.error('[OBS Storage] Failed to parse stored data:', e);
      }
    } else {
      console.log('[OBS Storage] No existing data in OBS storage');
    }
    
    obsStorageReady = true;
    
    // Migrate any localStorage data that isn't in OBS storage yet
    // This ensures credentials saved before connection are migrated
    migrateFromLocalStorage();
  } catch (e) {
    const error = e as Error | string;
    const errorStr = typeof error === 'string' ? error : error.message || String(error);
    
    // "does not exist" is expected for first-time use
    if (errorStr.includes('does not exist')) {
      console.log('[OBS Storage] No existing storage slot (first time use)');
      obsStorageReady = true;
      // Migrate localStorage data for first-time OBS storage
      migrateFromLocalStorage();
    } else {
      console.error('[OBS Storage] Failed to load from OBS:', errorStr);
    }
  }
}

/**
 * Save all storage data to OBS persistent storage
 * Debounced to prevent API spam
 */
async function saveToOBS(): Promise<void> {
  if (!get(connected)) {
    console.log('[OBS Storage] Not connected, skipping save');
    return;
  }
  
  try {
    const dataStr = JSON.stringify(obsStorageCache);
    
    await obsRequest('SetPersistentData', {
      realm: OBS_STORAGE_REALM,
      slotName: OBS_STORAGE_MASTER_SLOT,
      slotValue: dataStr
    });
    
    console.log('[OBS Storage] Saved', Object.keys(obsStorageCache).length, 'keys to OBS');
  } catch (e) {
    console.error('[OBS Storage] Failed to save to OBS:', e);
  }
}

/**
 * Schedule a debounced save to OBS
 */
function scheduleSave(key: string): void {
  // Clear any existing pending write for this key
  if (pendingWrites[key]) {
    clearTimeout(pendingWrites[key]);
  }
  
  // Schedule new write
  pendingWrites[key] = setTimeout(() => {
    delete pendingWrites[key];
    saveToOBS();
  }, WRITE_DEBOUNCE_MS);
}

// ============ OBS Storage Interface ============

/**
 * OBS Storage interface - matches the main storage interface
 * Use this when running inside OBS (dock or browser source)
 */
export const obsStorage: OBSStorageInterface = {
  /**
   * Get a value from OBS storage (synchronous from cache)
   */
  get(key: string): unknown | null {
    const value = obsStorageCache[key];
    return value !== undefined ? value : null;
  },
  
  /**
   * Set a value in OBS storage
   */
  set(key: string, value: unknown): boolean {
    try {
      obsStorageCache[key] = value;
      scheduleSave(key);
      return true;
    } catch (e) {
      console.error('[OBS Storage] Set error:', key, e);
      return false;
    }
  },
  
  /**
   * Remove a value from OBS storage
   */
  remove(key: string): void {
    try {
      delete obsStorageCache[key];
      scheduleSave(key);
    } catch (e) {
      console.error('[OBS Storage] Remove error:', key, e);
    }
  },
  
  /**
   * Get a raw value (same as get for OBS storage)
   */
  getRaw(key: string): unknown {
    return obsStorageCache[key] ?? null;
  },
  
  /**
   * Set a raw string value
   */
  setRaw(key: string, value: string): void {
    obsStorageCache[key] = value;
    scheduleSave(key);
  },
  
  /**
   * Force immediate save to OBS
   */
  async flush(): Promise<void> {
    // Clear all pending writes
    for (const key of Object.keys(pendingWrites)) {
      clearTimeout(pendingWrites[key]);
      delete pendingWrites[key];
    }
    // Save immediately
    await saveToOBS();
  },
  
  /**
   * Check if OBS storage is ready
   */
  isReady(): boolean {
    return obsStorageReady && get(connected);
  },
  
  /**
   * Clear all OBS storage
   */
  clear(): void {
    obsStorageCache = {};
    scheduleSave('_clear');
  },
  
  /**
   * Check if a key exists
   */
  has(key: string): boolean {
    return key in obsStorageCache;
  },
  
  /**
   * Get all storage keys
   */
  keys(): string[] {
    return Object.keys(obsStorageCache);
  },
  
  /**
   * Load all data from OBS storage
   * Call this after WebSocket connection is established
   */
  async loadAll(): Promise<void> {
    await loadFromOBS();
  }
};

// ============ Initialization ============

/**
 * Initialize OBS storage system
 * Call this after WebSocket connection is established
 * 
 * @param ws - The WebSocket instance to use for OBS communication
 */
export async function initOBSStorage(ws: WebSocket): Promise<void> {
  setWebSocket(ws);
  await loadFromOBS();
  console.log('[OBS Storage] Initialized with', Object.keys(obsStorageCache).length, 'keys');
}

/**
 * Check if we're running inside OBS (dock or browser source)
 */
export function isInOBS(): boolean {
  return typeof (window as any).obsstudio !== 'undefined';
}

/**
 * Check if we're running as an OBS dock (not a browser source)
 */
export function isOBSDock(): boolean {
  const hasObsStudio = typeof (window as any).obsstudio !== 'undefined';
  if (!hasObsStudio) return false;
  
  // Browser sources for display routes have specific hash patterns
  const hash = window.location.hash || '';
  const isDisplayRoute = hash.includes('/text-cycler-display');
  
  // If in OBS and NOT on a display route, this is the dock
  return !isDisplayRoute;
}

/**
 * Check if we're running as an OBS browser source
 */
export function isOBSBrowserSource(): boolean {
  return isInOBS() && !isOBSDock();
}

// ============ Export for external access ============
export { obsStorageCache as _cache };
