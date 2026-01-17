/**
 * Sync Protocol
 * 
 * Types and utilities for P2P synchronization.
 * Transport-agnostic - works with WebRTC, WebSocket, etc.
 */

import type { 
  Block, 
  SyncRequest, 
  SyncResponse, 
  PeerInfo,
  P2PMessage,
  IntegrityInfo,
} from './types.js';
import { generateHash, calculateMerkleRoot } from './integrity.js';

// ============ Sync Configuration ============

export interface SyncConfig {
  /** Max blocks per sync response */
  batchSize: number;
  /** Sync request timeout (ms) */
  timeout: number;
  /** Min time between syncs (ms) */
  minSyncInterval: number;
}

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  batchSize: 50,
  timeout: 30000,
  minSyncInterval: 5000,
};

// ============ Message Factories ============

/**
 * Create a sync request message
 */
export function createSyncRequest(
  chainId: string,
  requesterId: string,
  lastBlockNumber: number,
  lastTimestamp: number
): SyncRequest {
  return {
    type: 'sync_request',
    chainId,
    lastBlockNumber,
    lastTimestamp,
    requesterId,
  };
}

/**
 * Create a sync response message
 */
export async function createSyncResponse<T>(
  chainId: string,
  responderId: string,
  blocks: Block<T>[],
  hasMore: boolean
): Promise<SyncResponse<T>> {
  const hashes = blocks.map(b => b.blockHash);
  const batchHash = await calculateMerkleRoot(hashes);
  
  return {
    type: 'sync_response',
    chainId,
    blocks,
    batchHash,
    fromBlock: blocks.length > 0 ? blocks[0].blockNumber : -1,
    toBlock: blocks.length > 0 ? blocks[blocks.length - 1].blockNumber : -1,
    hasMore,
    responderId,
  };
}

/**
 * Create a peer info message
 */
export function createPeerInfoMessage(peer: PeerInfo): P2PMessage {
  return {
    type: 'peer_info',
    peer,
  };
}

// ============ Sync Helpers ============

/**
 * Verify a sync response integrity
 */
export async function verifySyncResponse<T>(response: SyncResponse<T>): Promise<boolean> {
  if (response.blocks.length === 0) return true;
  
  const hashes = response.blocks.map(b => b.blockHash);
  const actualHash = await calculateMerkleRoot(hashes);
  
  return actualHash === response.batchHash;
}

/**
 * Calculate what blocks are needed from peers
 */
export function calculateNeededBlocks(
  localLatestBlock: number,
  peerLatestBlock: number,
  batchSize: number
): { start: number; end: number } | null {
  if (peerLatestBlock <= localLatestBlock) {
    return null; // Peer has nothing new
  }
  
  const start = localLatestBlock + 1;
  const end = Math.min(start + batchSize - 1, peerLatestBlock);
  
  return { start, end };
}

// ============ Peer Management ============

/**
 * Simple peer tracker
 */
export class PeerTracker {
  private peers = new Map<string, PeerInfo>();
  
  /**
   * Add or update a peer
   */
  updatePeer(peer: PeerInfo): void {
    this.peers.set(peer.peerId, {
      ...peer,
      lastSeen: Date.now(),
      online: true,
    });
  }
  
  /**
   * Mark a peer as offline
   */
  markOffline(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      this.peers.set(peerId, {
        ...peer,
        online: false,
        lastSeen: Date.now(),
      });
    }
  }
  
  /**
   * Remove a peer
   */
  removePeer(peerId: string): void {
    this.peers.delete(peerId);
  }
  
  /**
   * Get all peers
   */
  getAllPeers(): PeerInfo[] {
    return Array.from(this.peers.values());
  }
  
  /**
   * Get online peers
   */
  getOnlinePeers(): PeerInfo[] {
    return this.getAllPeers().filter(p => p.online);
  }
  
  /**
   * Get peer count
   */
  getPeerCount(): number {
    return this.getOnlinePeers().length;
  }
  
  /**
   * Find peers that have specific blocks
   */
  findPeersWithBlocks(blockNumbers: number[]): PeerInfo[] {
    return this.getOnlinePeers().filter(peer => {
      return blockNumbers.some(
        n => n >= peer.blockRange.start && n <= peer.blockRange.end
      );
    });
  }
  
  /**
   * Find best peer to sync from
   */
  findBestSyncPeer(localLatestBlock: number): PeerInfo | null {
    const candidates = this.getOnlinePeers()
      .filter(p => p.blockRange.end > localLatestBlock)
      .sort((a, b) => b.blockRange.end - a.blockRange.end);
    
    return candidates[0] || null;
  }
}

// ============ Sync State Machine ============

export type SyncState = 'idle' | 'syncing' | 'waiting' | 'error';

export interface SyncStatus {
  state: SyncState;
  lastSync: number;
  currentPeer: string | null;
  blocksReceived: number;
  errors: string[];
}

/**
 * Sync state manager
 */
export class SyncManager {
  private status: SyncStatus = {
    state: 'idle',
    lastSync: 0,
    currentPeer: null,
    blocksReceived: 0,
    errors: [],
  };
  
  private config: SyncConfig;
  
  constructor(config: Partial<SyncConfig> = {}) {
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
  }
  
  getStatus(): SyncStatus {
    return { ...this.status };
  }
  
  canSync(): boolean {
    if (this.status.state === 'syncing') return false;
    
    const timeSinceLastSync = Date.now() - this.status.lastSync;
    return timeSinceLastSync >= this.config.minSyncInterval;
  }
  
  startSync(peerId: string): void {
    this.status = {
      ...this.status,
      state: 'syncing',
      currentPeer: peerId,
      blocksReceived: 0,
      errors: [],
    };
  }
  
  recordBlocksReceived(count: number): void {
    this.status.blocksReceived += count;
  }
  
  completeSync(): void {
    this.status = {
      ...this.status,
      state: 'idle',
      lastSync: Date.now(),
      currentPeer: null,
    };
  }
  
  failSync(error: string): void {
    this.status = {
      ...this.status,
      state: 'error',
      errors: [...this.status.errors, error],
      currentPeer: null,
    };
  }
  
  reset(): void {
    this.status = {
      state: 'idle',
      lastSync: 0,
      currentPeer: null,
      blocksReceived: 0,
      errors: [],
    };
  }
}
