/**
 * @strixun/chat/core - Framework-agnostic chat core
 * 
 * Provides the core P2P chat functionality without any framework dependencies.
 * Use this directly for vanilla JS or wrap with framework adapters.
 * 
 * Uses @strixun/p2p-storage for blockchain-style message persistence.
 * Uses @strixun/api-framework for encryption.
 * 
 * Includes:
 * - Types for chat messages, rooms, connections
 * - WebRTC peer connections
 * - Signaling service for room coordination
 * - Room manager for message handling
 * - Secure room manager with P2P persistence (recommended)
 */

export * from './types.js';
export * from './webrtc.js';
export * from './signaling.js';
export * from './room-manager.js';
export * from './secure-room-manager.js';

// Re-export commonly used p2p-storage types
export type { 
  IntegrityInfo, 
  IntegrityStatus,
  GapRange,
  GapReason,
  StorageAdapter,
  Block,
} from '@strixun/p2p-storage';