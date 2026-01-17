/**
 * In-Memory Storage Adapter
 * 
 * Simple in-memory implementation for testing and development.
 * Data is lost on page refresh.
 */

import type { Block, Chunk, ChainState, StorageConfig } from '../core/types.js';
import type { StorageAdapter } from './interface.js';
import { registerAdapter } from './interface.js';

interface StoredBlock<T = unknown> extends Block<T> {
  chainId: string;
}

/**
 * In-memory storage adapter
 */
export class MemoryStorageAdapter implements StorageAdapter {
  readonly type = 'memory';
  
  private blocks = new Map<string, StoredBlock>();
  private chunks = new Map<string, Chunk>();
  private chains = new Map<string, ChainState>();
  
  async initialize(): Promise<void> {
    // Nothing to initialize
  }
  
  async destroy(): Promise<void> {
    this.blocks.clear();
    this.chunks.clear();
    this.chains.clear();
  }
  
  // ========== Block Operations ==========
  
  async storeBlock<T>(chainId: string, block: Block<T>): Promise<void> {
    this.blocks.set(block.blockHash, { ...block, chainId } as StoredBlock);
  }
  
  async storeBlocks<T>(chainId: string, blocks: Block<T>[]): Promise<void> {
    for (const block of blocks) {
      await this.storeBlock(chainId, block);
    }
  }
  
  async getBlock<T>(blockHash: string): Promise<Block<T> | null> {
    const stored = this.blocks.get(blockHash);
    if (!stored) return null;
    const { chainId: _, ...block } = stored;
    return block as Block<T>;
  }
  
  async getBlocks<T>(chainId: string, afterBlock?: number, limit?: number): Promise<Block<T>[]> {
    const allBlocks = Array.from(this.blocks.values())
      .filter(b => b.chainId === chainId)
      .filter(b => afterBlock === undefined || b.blockNumber > afterBlock)
      .sort((a, b) => a.blockNumber - b.blockNumber);
    
    const limited = limit ? allBlocks.slice(0, limit) : allBlocks;
    return limited.map(({ chainId: _, ...block }) => block as Block<T>);
  }
  
  async getAllBlocks<T>(chainId: string): Promise<Block<T>[]> {
    return this.getBlocks<T>(chainId);
  }
  
  async getLatestBlock<T>(chainId: string): Promise<Block<T> | null> {
    const blocks = await this.getAllBlocks<T>(chainId);
    if (blocks.length === 0) return null;
    return blocks[blocks.length - 1];
  }
  
  async blockExists(blockHash: string): Promise<boolean> {
    return this.blocks.has(blockHash);
  }
  
  // ========== Chunk Operations ==========
  
  private chunkKey(chainId: string, chunkId: number): string {
    return `${chainId}:${chunkId}`;
  }
  
  async storeChunk(chunk: Chunk): Promise<void> {
    this.chunks.set(this.chunkKey(chunk.chainId, chunk.chunkId), chunk);
  }
  
  async getChunk(chainId: string, chunkId: number): Promise<Chunk | null> {
    return this.chunks.get(this.chunkKey(chainId, chunkId)) || null;
  }
  
  async getChunks(chainId: string): Promise<Chunk[]> {
    return Array.from(this.chunks.values())
      .filter(c => c.chainId === chainId)
      .sort((a, b) => a.chunkId - b.chunkId);
  }
  
  // ========== Chain State Operations ==========
  
  async storeChainState(state: ChainState): Promise<void> {
    this.chains.set(state.chainId, state);
  }
  
  async getChainState(chainId: string): Promise<ChainState | null> {
    return this.chains.get(chainId) || null;
  }
  
  // ========== Cleanup Operations ==========
  
  async deleteChain(chainId: string): Promise<void> {
    // Delete blocks
    for (const [hash, block] of this.blocks) {
      if (block.chainId === chainId) {
        this.blocks.delete(hash);
      }
    }
    
    // Delete chunks
    for (const [key, chunk] of this.chunks) {
      if (chunk.chainId === chainId) {
        this.chunks.delete(key);
      }
    }
    
    // Delete chain state
    this.chains.delete(chainId);
  }
  
  async clearAllData(): Promise<void> {
    this.blocks.clear();
    this.chunks.clear();
    this.chains.clear();
  }
}

/**
 * Create a memory storage adapter
 */
export function createMemoryAdapter(_config?: StorageConfig): MemoryStorageAdapter {
  return new MemoryStorageAdapter();
}

// Register the adapter
registerAdapter('memory', createMemoryAdapter);
