/**
 * Blockchain Manager
 * 
 * Core blockchain logic that uses storage adapters.
 * Manages blocks, chunks, chain state, and integrity.
 */

import type { 
  Block, 
  Chunk, 
  ChainState, 
  GapRange,
  IntegrityInfo,
} from './types.js';
import type { StorageAdapter } from '../adapters/interface.js';
import { 
  generateHash,
  generateSignature,
  generateBlockHash,
  calculateMerkleRoot,
  detectGaps,
  createIntegrityInfo,
  CHUNK_SIZE,
} from './integrity.js';

// ============ Configuration ============

export interface BlockchainConfig {
  /** Chain identifier (e.g., room ID for chat) */
  chainId: string;
  /** Secret key for signing blocks */
  signingKey: string;
  /** Local peer ID */
  peerId: string;
  /** Storage adapter to use */
  adapter: StorageAdapter;
  /** Blocks per chunk */
  chunkSize?: number;
}

// ============ Blockchain Manager ============

/**
 * Manages a blockchain with storage adapter
 */
export class BlockchainManager<T = unknown> {
  private chainId: string;
  private signingKey: string;
  private peerId: string;
  private adapter: StorageAdapter;
  private chunkSize: number;
  private initialized = false;
  
  constructor(config: BlockchainConfig) {
    this.chainId = config.chainId;
    this.signingKey = config.signingKey;
    this.peerId = config.peerId;
    this.adapter = config.adapter;
    this.chunkSize = config.chunkSize || CHUNK_SIZE;
  }
  
  /**
   * Initialize the blockchain manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await this.adapter.initialize();
    
    // Ensure chain state exists
    const state = await this.adapter.getChainState(this.chainId);
    if (!state) {
      const initialState: ChainState = {
        chainId: this.chainId,
        latestBlock: -1,
        totalChunks: 0,
        latestHash: '',
        genesisHash: '',
        gaps: [],
        peerCount: 1,
        lastSync: Date.now(),
      };
      await this.adapter.storeChainState(initialState);
    }
    
    this.initialized = true;
  }
  
  /**
   * Add data to the chain
   */
  async addBlock(data: T): Promise<Block<T>> {
    this.ensureInitialized();
    
    const state = await this.getChainState();
    const previousBlock = await this.adapter.getLatestBlock<T>(this.chainId);
    
    const blockNumber = state.latestBlock + 1;
    const previousHash = previousBlock?.blockHash || null;
    const chunkId = Math.floor(blockNumber / this.chunkSize);
    
    // Generate block hash
    const blockHash = await generateBlockHash(data, previousHash, blockNumber);
    
    // Generate signature
    const signatureData = JSON.stringify({ blockHash, data, blockNumber });
    const signature = await generateSignature(signatureData, this.signingKey);
    
    const block: Block<T> = {
      blockHash,
      previousHash,
      blockNumber,
      chunkId,
      data,
      signature,
      createdAt: Date.now(),
      confirmedBy: [this.peerId],
    };
    
    // Store block
    await this.adapter.storeBlock(this.chainId, block);
    
    // Update chain state
    const newState: ChainState = {
      ...state,
      latestBlock: blockNumber,
      latestHash: blockHash,
      genesisHash: state.genesisHash || blockHash,
      lastSync: Date.now(),
    };
    await this.adapter.storeChainState(newState);
    
    // Update chunk if needed
    await this.updateChunk(chunkId);
    
    return block;
  }
  
  /**
   * Import blocks from peers (for sync)
   */
  async importBlocks(blocks: Block<T>[]): Promise<{ imported: number; errors: string[] }> {
    this.ensureInitialized();
    
    let imported = 0;
    const errors: string[] = [];
    
    for (const block of blocks) {
      try {
        // Check if block already exists
        const exists = await this.adapter.blockExists(block.blockHash);
        if (exists) continue;
        
        // Verify block integrity
        const expectedHash = await generateBlockHash(
          block.data,
          block.previousHash,
          block.blockNumber
        );
        
        if (expectedHash !== block.blockHash) {
          errors.push(`Block ${block.blockNumber}: hash mismatch`);
          continue;
        }
        
        // Store block
        await this.adapter.storeBlock(this.chainId, block);
        imported++;
        
        // Update chunk
        await this.updateChunk(block.chunkId);
      } catch (err) {
        errors.push(`Block ${block.blockNumber}: ${(err as Error).message}`);
      }
    }
    
    // Recalculate gaps after import
    await this.recalculateGaps();
    
    return { imported, errors };
  }
  
  /**
   * Get blocks after a specific block number
   */
  async getBlocksAfter(afterBlock: number, limit?: number): Promise<Block<T>[]> {
    this.ensureInitialized();
    return this.adapter.getBlocks<T>(this.chainId, afterBlock, limit);
  }
  
  /**
   * Get all blocks
   */
  async getAllBlocks(): Promise<Block<T>[]> {
    this.ensureInitialized();
    return this.adapter.getAllBlocks<T>(this.chainId);
  }
  
  /**
   * Get latest block
   */
  async getLatestBlock(): Promise<Block<T> | null> {
    this.ensureInitialized();
    return this.adapter.getLatestBlock<T>(this.chainId);
  }
  
  /**
   * Get chain state
   */
  async getChainState(): Promise<ChainState> {
    this.ensureInitialized();
    const state = await this.adapter.getChainState(this.chainId);
    if (!state) {
      throw new Error('Chain state not found');
    }
    return state;
  }
  
  /**
   * Get integrity information
   */
  async getIntegrityInfo(totalPeers: number): Promise<IntegrityInfo> {
    this.ensureInitialized();
    
    const state = await this.getChainState();
    const chunks = await this.adapter.getChunks(this.chainId);
    
    return createIntegrityInfo(state, chunks, totalPeers);
  }
  
  /**
   * Get all chunks
   */
  async getChunks(): Promise<Chunk[]> {
    this.ensureInitialized();
    return this.adapter.getChunks(this.chainId);
  }
  
  /**
   * Update peer count
   */
  async updatePeerCount(count: number): Promise<void> {
    this.ensureInitialized();
    const state = await this.getChainState();
    await this.adapter.storeChainState({
      ...state,
      peerCount: count,
    });
  }
  
  /**
   * Confirm a block (add peer to confirmedBy)
   */
  async confirmBlock(blockHash: string, peerId: string): Promise<void> {
    this.ensureInitialized();
    
    const block = await this.adapter.getBlock<T>(blockHash);
    if (!block) return;
    
    if (!block.confirmedBy.includes(peerId)) {
      block.confirmedBy.push(peerId);
      await this.adapter.storeBlock(this.chainId, block);
    }
  }
  
  /**
   * Delete all chain data
   */
  async destroy(): Promise<void> {
    await this.adapter.deleteChain(this.chainId);
    await this.adapter.destroy();
    this.initialized = false;
  }
  
  // ========== Private Methods ==========
  
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('BlockchainManager not initialized. Call initialize() first.');
    }
  }
  
  private async updateChunk(chunkId: number): Promise<void> {
    // Get all blocks in this chunk
    const startBlock = chunkId * this.chunkSize;
    const endBlock = startBlock + this.chunkSize - 1;
    
    const allBlocks = await this.adapter.getAllBlocks<T>(this.chainId);
    const chunkBlocks = allBlocks.filter(
      b => b.blockNumber >= startBlock && b.blockNumber <= endBlock
    );
    
    if (chunkBlocks.length === 0) return;
    
    // Calculate Merkle root
    const hashes = chunkBlocks.map(b => b.blockHash);
    const merkleRoot = await calculateMerkleRoot(hashes);
    
    const chunk: Chunk = {
      chunkId,
      chainId: this.chainId,
      startBlock,
      endBlock: Math.max(...chunkBlocks.map(b => b.blockNumber)),
      blockCount: chunkBlocks.length,
      merkleRoot,
      lastUpdated: Date.now(),
      replicatedOn: [this.peerId],
    };
    
    await this.adapter.storeChunk(chunk);
    
    // Update total chunks in state
    const state = await this.getChainState();
    const chunks = await this.adapter.getChunks(this.chainId);
    await this.adapter.storeChainState({
      ...state,
      totalChunks: chunks.length,
    });
  }
  
  private async recalculateGaps(): Promise<void> {
    const state = await this.getChainState();
    const blocks = await this.adapter.getAllBlocks<T>(this.chainId);
    
    const gaps = detectGaps(blocks as Block[], state.latestBlock);
    
    await this.adapter.storeChainState({
      ...state,
      gaps,
    });
  }
}

/**
 * Create a blockchain manager with default IndexedDB adapter
 */
export async function createBlockchain<T>(
  config: Omit<BlockchainConfig, 'adapter'> & { adapter?: StorageAdapter }
): Promise<BlockchainManager<T>> {
  // Import IndexedDB adapter if not provided
  if (!config.adapter) {
    const { createIndexedDBAdapter } = await import('../adapters/indexeddb.js');
    config.adapter = createIndexedDBAdapter();
  }
  
  const manager = new BlockchainManager<T>(config as BlockchainConfig);
  await manager.initialize();
  return manager;
}
