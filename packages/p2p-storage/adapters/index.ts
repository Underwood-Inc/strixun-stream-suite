/**
 * Storage Adapters
 * 
 * Export all storage adapter interfaces and implementations.
 */

// Interface and registry
export {
  type StorageAdapter,
  type StorageAdapterFactory,
  adapterRegistry,
  registerAdapter,
  createAdapter,
} from './interface.js';

// Implementations
export { 
  IndexedDBStorageAdapter,
  createIndexedDBAdapter,
} from './indexeddb.js';

export { 
  MemoryStorageAdapter,
  createMemoryAdapter,
} from './memory.js';
