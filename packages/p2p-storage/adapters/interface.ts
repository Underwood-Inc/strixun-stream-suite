/**
 * Storage Adapter Interface
 * 
 * Abstract contract for any storage backend.
 * Implementations can be:
 * - IndexedDB (default for browser)
 * - File System Access API
 * - In-memory (for testing)
 * - Custom remote storage
 * - etc.
 */

import type { Block, Chunk, ChainState, StorageConfig } from '../core/types.js';

/**
 * Storage adapter interface
 * All storage backends must implement this
 */
export interface StorageAdapter {
  /** Unique identifier for this adapter type */
  readonly type: string;
  
  /** Initialize the storage (open connections, create tables, etc.) */
  initialize(): Promise<void>;
  
  /** Clean up resources (close connections) */
  destroy(): Promise<void>;
  
  // ========== Block Operations ==========
  
  /** Store a single block */
  storeBlock<T>(chainId: string, block: Block<T>): Promise<void>;
  
  /** Store multiple blocks in a batch */
  storeBlocks<T>(chainId: string, blocks: Block<T>[]): Promise<void>;
  
  /** Get a block by its hash */
  getBlock<T>(blockHash: string): Promise<Block<T> | null>;
  
  /** Get blocks for a chain, optionally after a specific block number */
  getBlocks<T>(chainId: string, afterBlock?: number, limit?: number): Promise<Block<T>[]>;
  
  /** Get all blocks for a chain */
  getAllBlocks<T>(chainId: string): Promise<Block<T>[]>;
  
  /** Get the latest block for a chain */
  getLatestBlock<T>(chainId: string): Promise<Block<T> | null>;
  
  /** Check if a block exists */
  blockExists(blockHash: string): Promise<boolean>;
  
  // ========== Chunk Operations ==========
  
  /** Store a chunk */
  storeChunk(chunk: Chunk): Promise<void>;
  
  /** Get a chunk */
  getChunk(chainId: string, chunkId: number): Promise<Chunk | null>;
  
  /** Get all chunks for a chain */
  getChunks(chainId: string): Promise<Chunk[]>;
  
  // ========== Chain State Operations ==========
  
  /** Store chain state */
  storeChainState(state: ChainState): Promise<void>;
  
  /** Get chain state */
  getChainState(chainId: string): Promise<ChainState | null>;
  
  // ========== Cleanup Operations ==========
  
  /** Delete all data for a chain */
  deleteChain(chainId: string): Promise<void>;
  
  /** Clear all data */
  clearAllData(): Promise<void>;
}

/**
 * Factory function type for creating storage adapters
 */
export type StorageAdapterFactory = (config?: StorageConfig) => StorageAdapter;

/**
 * Registry for storage adapter factories
 */
export const adapterRegistry = new Map<string, StorageAdapterFactory>();

/**
 * Register a storage adapter factory
 */
export function registerAdapter(type: string, factory: StorageAdapterFactory): void {
  adapterRegistry.set(type, factory);
}

/**
 * Create a storage adapter by type
 */
export function createAdapter(type: string, config?: StorageConfig): StorageAdapter {
  const factory = adapterRegistry.get(type);
  if (!factory) {
    throw new Error(`Unknown storage adapter type: ${type}`);
  }
  return factory(config);
}
