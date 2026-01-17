/**
 * P2P Storage Core
 * 
 * Framework-agnostic blockchain-style storage.
 */

// Types
export * from './types.js';

// Integrity utilities
export {
  CHUNK_SIZE,
  generateHash,
  generateSignature,
  verifySignature,
  generateBlockHash,
  calculateMerkleRoot,
  verifyMerkleRoot,
  detectGaps,
  getGapReasonDescription,
  calculateIntegrityScore,
  createIntegrityInfo,
} from './integrity.js';

// Blockchain manager
export {
  BlockchainManager,
  createBlockchain,
  type BlockchainConfig,
} from './blockchain.js';

// Sync protocol
export {
  DEFAULT_SYNC_CONFIG,
  createSyncRequest,
  createSyncResponse,
  createPeerInfoMessage,
  verifySyncResponse,
  calculateNeededBlocks,
  PeerTracker,
  SyncManager,
  type SyncConfig,
  type SyncState,
  type SyncStatus,
} from './sync.js';
