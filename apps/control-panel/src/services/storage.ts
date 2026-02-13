/**
 * Storage Service Adapter
 * 
 * This wraps the existing storage system from the legacy control panel.
 * The actual storage implementation remains in the global scope to maintain
 * OBS dock compatibility.
 * 
 * IMPORTANT: Do NOT modify the underlying storage mechanism.
 * It must remain compatible with the OBS browser dock environment.
 */

// Type definitions for the legacy storage interface
export interface StorageInterface {
  get<T = unknown>(key: string): T | null;
  set<T = unknown>(key: string, value: T): boolean;
  remove(key: string): void;
  getRaw(key: string): string | null;
  setRaw(key: string, value: string): void;
  flush(): Promise<void>;
  isReady(): boolean;
}

// Type definitions for the legacy backup interface
export interface BackupInterface {
  createRecoverySnapshot(): void;
  checkForRecoverySnapshot(): object | null;
  startAutoBackup(): void;
}

/**
 * Access the global storage instance.
 * This is initialized by the legacy storage.js script.
 */
export function getStorage(): StorageInterface {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;
  
  // Check for the new SSS_Storage export
  if (win.SSS_Storage?.storage) {
    return win.SSS_Storage.storage;
  }
  
  // Fallback to direct storage global
  if (win.storage) {
    return win.storage;
  }
  
  // Return a mock storage for development
  console.warn('[Storage] No storage instance found, using in-memory mock');
  return createMockStorage();
}

/**
 * Initialize the storage system.
 * This should be called early in the app lifecycle.
 */
export async function initializeStorage(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;
  
  if (win.SSS_Storage) {
    await win.SSS_Storage.initIndexedDB();
    await win.SSS_Storage.loadStorageCache();
    win.SSS_Storage.startAutoBackup();
  } else if (win.initIndexedDB) {
    await win.initIndexedDB();
    await win.loadStorageCache();
    if (win.startAutoBackup) {
      win.startAutoBackup();
    }
  }
}

/**
 * Create a mock storage for development/testing.
 */
function createMockStorage(): StorageInterface {
  const cache: Record<string, unknown> = {};
  
  return {
    get<T>(key: string): T | null {
      return (cache[key] as T) ?? null;
    },
    set<T>(key: string, value: T): boolean {
      cache[key] = value;
      return true;
    },
    remove(key: string): void {
      delete cache[key];
    },
    getRaw(key: string): string | null {
      const val = cache[key];
      return typeof val === 'string' ? val : null;
    },
    setRaw(key: string, value: string): void {
      cache[key] = value;
    },
    async flush(): Promise<void> {
      // No-op for mock
    },
    isReady(): boolean {
      return true;
    },
  };
}

// Storage keys used by the application
export const STORAGE_KEYS = {
  SWAP_CONFIGS: 'swapConfigs',
  TEXT_CYCLER_CONFIGS: 'textCyclerConfigs',
  CLIPS_CONFIGS: 'clipsConfigs',
  OPACITY_CONFIGS: 'sourceOpacityConfigs',
  UI_STATE: 'ui_state',
  ACTIVE_TAB: 'active_tab',
  CONNECTION: 'obs_connection',
  SCROLLBAR_CUSTOMIZER: 'scrollbarCustomizerConfig',
} as const;

