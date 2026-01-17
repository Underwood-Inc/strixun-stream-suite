/**
 * P2P Storage Types
 * 
 * Core type definitions for blockchain-style distributed storage.
 * These types are framework-agnostic and can be used in any application.
 */

// ============ Block Types ============

/**
 * A single block in the chain
 */
export interface Block<T = unknown> {
  /** Unique block identifier (hash of content + metadata) */
  blockHash: string;
  /** Previous block hash (null for genesis) */
  previousHash: string | null;
  /** Block sequence number in the chain */
  blockNumber: number;
  /** Chunk this block belongs to */
  chunkId: number;
  /** The data payload */
  data: T;
  /** HMAC-SHA256 signature for authenticity */
  signature: string;
  /** Timestamp when block was created */
  createdAt: number;
  /** Peers that have confirmed this block */
  confirmedBy: string[];
}

/**
 * A chunk of blocks (for efficient sync)
 */
export interface Chunk {
  /** Chunk identifier */
  chunkId: number;
  /** Chain/namespace this chunk belongs to */
  chainId: string;
  /** First block number in chunk */
  startBlock: number;
  /** Last block number in chunk */
  endBlock: number;
  /** Block count in chunk */
  blockCount: number;
  /** Merkle root of all block hashes */
  merkleRoot: string;
  /** Timestamp of last block */
  lastUpdated: number;
  /** Peers that have this complete chunk */
  replicatedOn: string[];
}

/**
 * Current state of a chain
 */
export interface ChainState {
  /** Chain/namespace identifier */
  chainId: string;
  /** Latest block number */
  latestBlock: number;
  /** Total chunks */
  totalChunks: number;
  /** Hash of latest block */
  latestHash: string;
  /** Genesis block hash */
  genesisHash: string;
  /** Gap ranges (missing block sequences) */
  gaps: GapRange[];
  /** Peer count currently holding data */
  peerCount: number;
  /** Last sync timestamp */
  lastSync: number;
}

// ============ Gap Types ============

/**
 * A range of missing blocks
 */
export interface GapRange {
  /** Start of gap (inclusive) */
  start: number;
  /** End of gap (inclusive) */
  end: number;
  /** Possible reasons for gap */
  reasons: GapReason[];
  /** Detected timestamp */
  detectedAt: number;
}

/**
 * Why blocks might be missing
 */
export type GapReason = 
  | 'peer_offline'
  | 'network_partition'
  | 'late_join'
  | 'storage_corruption'
  | 'sync_timeout'
  | 'unknown';

// ============ Peer Types ============

/**
 * Information about a peer
 */
export interface PeerInfo {
  peerId: string;
  displayName: string;
  /** Blocks this peer holds */
  blockRange: { start: number; end: number };
  /** Chunks this peer has complete */
  completeChunks: number[];
  /** Last seen timestamp */
  lastSeen: number;
  /** Is currently online */
  online: boolean;
  /** Storage location preference */
  storageLocation?: StorageLocation;
}

// ============ Storage Types ============

/**
 * Where data is stored locally
 */
export type StorageLocation = 'indexeddb' | 'filesystem' | 'custom';

/**
 * Storage configuration
 */
export interface StorageConfig {
  location: StorageLocation;
  /** Custom path for filesystem storage */
  customPath?: string;
  /** Max storage size in MB */
  maxSize?: number;
  /** Auto-cleanup old chunks */
  autoCleanup?: boolean;
  /** Cleanup threshold (days) */
  cleanupAfterDays?: number;
}

// ============ Integrity Types ============

/**
 * Integrity verification status
 */
export type IntegrityStatus = 'verified' | 'partial' | 'degraded' | 'unverified';

/**
 * Integrity information for display
 */
export interface IntegrityInfo {
  score: number;
  status: IntegrityStatus;
  description: string;
  peerCount: number;
  totalBlocks: number;
  gaps: GapRange[];
  chunks: Chunk[];
}

// ============ Sync Types ============

/**
 * Sync request message
 */
export interface SyncRequest {
  type: 'sync_request';
  chainId: string;
  lastBlockNumber: number;
  lastTimestamp: number;
  requesterId: string;
}

/**
 * Sync response message
 */
export interface SyncResponse<T = unknown> {
  type: 'sync_response';
  chainId: string;
  blocks: Block<T>[];
  batchHash: string;
  fromBlock: number;
  toBlock: number;
  hasMore: boolean;
  responderId: string;
}

/**
 * Generic P2P protocol message
 */
export type P2PMessage<T = unknown> = 
  | SyncRequest
  | SyncResponse<T>
  | { type: 'peer_info'; peer: PeerInfo }
  | { type: 'chunk_request'; chunkId: number; requesterId: string }
  | { type: 'chunk_response'; chunk: Chunk; blocks: Block<T>[]; responderId: string };

// ============ Encrypted Data ============

/**
 * Encrypted data envelope (compatible with @strixun/api-framework)
 */
export interface EncryptedData {
  version: number;
  encrypted: boolean;
  algorithm: string;
  iv: string;
  salt: string;
  tokenHash?: string;
  passwordProtected: boolean;
  data: string;
  timestamp: string;
}
