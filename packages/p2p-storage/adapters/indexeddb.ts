/**
 * IndexedDB Storage Adapter
 * 
 * Default browser storage using IndexedDB.
 * Persistent storage that survives page refreshes.
 */

import type { Block, Chunk, ChainState, StorageConfig } from '../core/types.js';
import type { StorageAdapter } from './interface.js';
import { registerAdapter } from './interface.js';

// ============ Constants ============

const DB_NAME = 'strixun-p2p-storage';
const DB_VERSION = 1;

const STORES = {
  blocks: 'blocks',
  chunks: 'chunks',
  chains: 'chains',
} as const;

// ============ Stored Types ============

interface StoredBlock<T = unknown> extends Block<T> {
  chainId: string;
}

// ============ IndexedDB Adapter ============

/**
 * IndexedDB storage adapter implementation
 */
export class IndexedDBStorageAdapter implements StorageAdapter {
  readonly type = 'indexeddb';
  
  private db: IDBDatabase | null = null;
  private config: StorageConfig;
  
  constructor(config?: StorageConfig) {
    this.config = config || { location: 'indexeddb' };
  }
  
  async initialize(): Promise<void> {
    if (this.db) return;
    
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error?.message}`));
      };
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const database = (event.target as IDBOpenDBRequest).result;
        
        // Blocks store
        if (!database.objectStoreNames.contains(STORES.blocks)) {
          const blocksStore = database.createObjectStore(STORES.blocks, { keyPath: 'blockHash' });
          blocksStore.createIndex('chainId', 'chainId', { unique: false });
          blocksStore.createIndex('blockNumber', 'blockNumber', { unique: false });
          blocksStore.createIndex('chainId_blockNumber', ['chainId', 'blockNumber'], { unique: true });
          blocksStore.createIndex('chunkId', 'chunkId', { unique: false });
        }
        
        // Chunks store
        if (!database.objectStoreNames.contains(STORES.chunks)) {
          const chunksStore = database.createObjectStore(STORES.chunks, { keyPath: ['chainId', 'chunkId'] });
          chunksStore.createIndex('chainId', 'chainId', { unique: false });
        }
        
        // Chains store
        if (!database.objectStoreNames.contains(STORES.chains)) {
          database.createObjectStore(STORES.chains, { keyPath: 'chainId' });
        }
      };
    });
  }
  
  async destroy(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
  
  private getDb(): IDBDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }
  
  // ========== Block Operations ==========
  
  async storeBlock<T>(chainId: string, block: Block<T>): Promise<void> {
    const db = this.getDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.blocks, 'readwrite');
      const store = transaction.objectStore(STORES.blocks);
      
      const storedBlock: StoredBlock<T> = { ...block, chainId };
      const request = store.put(storedBlock);
      
      request.onerror = () => reject(new Error(`Failed to store block: ${request.error?.message}`));
      request.onsuccess = () => resolve();
    });
  }
  
  async storeBlocks<T>(chainId: string, blocks: Block<T>[]): Promise<void> {
    if (blocks.length === 0) return;
    
    const db = this.getDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.blocks, 'readwrite');
      const store = transaction.objectStore(STORES.blocks);
      
      for (const block of blocks) {
        const storedBlock: StoredBlock<T> = { ...block, chainId };
        store.put(storedBlock);
      }
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error(`Failed to store blocks: ${transaction.error?.message}`));
    });
  }
  
  async getBlock<T>(blockHash: string): Promise<Block<T> | null> {
    const db = this.getDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.blocks, 'readonly');
      const store = transaction.objectStore(STORES.blocks);
      const request = store.get(blockHash);
      
      request.onerror = () => reject(new Error(`Failed to get block: ${request.error?.message}`));
      request.onsuccess = () => {
        const stored = request.result as StoredBlock<T> | undefined;
        if (stored) {
          const { chainId: _, ...block } = stored;
          resolve(block as Block<T>);
        } else {
          resolve(null);
        }
      };
    });
  }
  
  async getBlocks<T>(chainId: string, afterBlock?: number, limit?: number): Promise<Block<T>[]> {
    const db = this.getDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.blocks, 'readonly');
      const store = transaction.objectStore(STORES.blocks);
      const index = store.index('chainId_blockNumber');
      
      const start = afterBlock !== undefined ? afterBlock + 1 : 0;
      const range = IDBKeyRange.bound([chainId, start], [chainId, Infinity]);
      
      const request = index.openCursor(range);
      const blocks: Block<T>[] = [];
      
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && (!limit || blocks.length < limit)) {
          const { chainId: _, ...block } = cursor.value as StoredBlock<T>;
          blocks.push(block as Block<T>);
          cursor.continue();
        } else {
          resolve(blocks);
        }
      };
      
      request.onerror = () => reject(new Error(`Failed to get blocks: ${request.error?.message}`));
    });
  }
  
  async getAllBlocks<T>(chainId: string): Promise<Block<T>[]> {
    return this.getBlocks<T>(chainId);
  }
  
  async getLatestBlock<T>(chainId: string): Promise<Block<T> | null> {
    const db = this.getDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.blocks, 'readonly');
      const store = transaction.objectStore(STORES.blocks);
      const index = store.index('chainId_blockNumber');
      
      const range = IDBKeyRange.bound([chainId, 0], [chainId, Infinity]);
      const request = index.openCursor(range, 'prev');
      
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const { chainId: _, ...block } = cursor.value as StoredBlock<T>;
          resolve(block as Block<T>);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => reject(new Error(`Failed to get latest block: ${request.error?.message}`));
    });
  }
  
  async blockExists(blockHash: string): Promise<boolean> {
    const block = await this.getBlock(blockHash);
    return block !== null;
  }
  
  // ========== Chunk Operations ==========
  
  async storeChunk(chunk: Chunk): Promise<void> {
    const db = this.getDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.chunks, 'readwrite');
      const store = transaction.objectStore(STORES.chunks);
      const request = store.put(chunk);
      
      request.onerror = () => reject(new Error(`Failed to store chunk: ${request.error?.message}`));
      request.onsuccess = () => resolve();
    });
  }
  
  async getChunk(chainId: string, chunkId: number): Promise<Chunk | null> {
    const db = this.getDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.chunks, 'readonly');
      const store = transaction.objectStore(STORES.chunks);
      const request = store.get([chainId, chunkId]);
      
      request.onerror = () => reject(new Error(`Failed to get chunk: ${request.error?.message}`));
      request.onsuccess = () => resolve(request.result || null);
    });
  }
  
  async getChunks(chainId: string): Promise<Chunk[]> {
    const db = this.getDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.chunks, 'readonly');
      const store = transaction.objectStore(STORES.chunks);
      const index = store.index('chainId');
      const request = index.getAll(chainId);
      
      request.onerror = () => reject(new Error(`Failed to get chunks: ${request.error?.message}`));
      request.onsuccess = () => resolve(request.result || []);
    });
  }
  
  // ========== Chain State Operations ==========
  
  async storeChainState(state: ChainState): Promise<void> {
    const db = this.getDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.chains, 'readwrite');
      const store = transaction.objectStore(STORES.chains);
      const request = store.put(state);
      
      request.onerror = () => reject(new Error(`Failed to store chain state: ${request.error?.message}`));
      request.onsuccess = () => resolve();
    });
  }
  
  async getChainState(chainId: string): Promise<ChainState | null> {
    const db = this.getDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.chains, 'readonly');
      const store = transaction.objectStore(STORES.chains);
      const request = store.get(chainId);
      
      request.onerror = () => reject(new Error(`Failed to get chain state: ${request.error?.message}`));
      request.onsuccess = () => resolve(request.result || null);
    });
  }
  
  // ========== Cleanup Operations ==========
  
  async deleteChain(chainId: string): Promise<void> {
    const db = this.getDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [STORES.blocks, STORES.chunks, STORES.chains],
        'readwrite'
      );
      
      // Delete blocks
      const blocksStore = transaction.objectStore(STORES.blocks);
      const blocksIndex = blocksStore.index('chainId');
      const blocksRequest = blocksIndex.openCursor(IDBKeyRange.only(chainId));
      
      blocksRequest.onsuccess = () => {
        const cursor = blocksRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      
      // Delete chunks
      const chunksStore = transaction.objectStore(STORES.chunks);
      const chunksIndex = chunksStore.index('chainId');
      const chunksRequest = chunksIndex.openCursor(IDBKeyRange.only(chainId));
      
      chunksRequest.onsuccess = () => {
        const cursor = chunksRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      
      // Delete chain state
      transaction.objectStore(STORES.chains).delete(chainId);
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error(`Failed to delete chain: ${transaction.error?.message}`));
    });
  }
  
  async clearAllData(): Promise<void> {
    const db = this.getDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [STORES.blocks, STORES.chunks, STORES.chains],
        'readwrite'
      );
      
      transaction.objectStore(STORES.blocks).clear();
      transaction.objectStore(STORES.chunks).clear();
      transaction.objectStore(STORES.chains).clear();
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error(`Failed to clear data: ${transaction.error?.message}`));
    });
  }
}

/**
 * Create an IndexedDB storage adapter
 */
export function createIndexedDBAdapter(config?: StorageConfig): IndexedDBStorageAdapter {
  return new IndexedDBStorageAdapter(config);
}

// Register the adapter as default
registerAdapter('indexeddb', createIndexedDBAdapter);
