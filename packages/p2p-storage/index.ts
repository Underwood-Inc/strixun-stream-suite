/**
 * @strixun/p2p-storage
 * 
 * Framework-agnostic P2P blockchain-style storage with integrity verification.
 * 
 * Features:
 * - Blockchain-style hash chains for data integrity
 * - Merkle tree chunk verification
 * - Gap detection and UX messaging
 * - Storage adapter pattern (IndexedDB, Memory, Custom)
 * - P2P sync protocol helpers
 * - React UI components
 * 
 * @example
 * ```typescript
 * import { BlockchainManager, createIndexedDBAdapter } from '@strixun/p2p-storage';
 * 
 * const adapter = createIndexedDBAdapter();
 * const blockchain = new BlockchainManager({
 *   chainId: 'my-chain',
 *   signingKey: 'my-secret',
 *   peerId: 'peer-123',
 *   adapter,
 * });
 * 
 * await blockchain.initialize();
 * await blockchain.addBlock({ message: 'Hello, World!' });
 * ```
 */

// Core exports
export * from './core/index.js';

// Adapter exports
export * from './adapters/index.js';
