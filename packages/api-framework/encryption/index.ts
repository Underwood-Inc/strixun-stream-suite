/**
 * Shared Encryption Suite - Main Export
 * 
 * Unified encryption utilities for all Strixun Stream Suite services
 * 
 * Features:
 * - Universal JWT encryption (works in Workers and browser)
 * - Multi-stage encryption (2+ parties)
 * - Two-stage encryption (backward compatible)
 * - Router middleware for automatic encryption
 * 
 * Usage in Workers:
 * ```typescript
 * import { encryptWithJWT, decryptWithJWT, wrapWithEncryption } from '@strixun/shared-utils/encryption';
 * ```
 * 
 * Usage in Client:
 * ```typescript
 * import { decryptWithJWT } from '@strixun/shared-utils/encryption';
 * ```
 */

// Core JWT encryption
export {
  encryptWithJWT,
  decryptWithJWT,
  encryptBinaryWithJWT,
  decryptBinaryWithJWT,
} from './jwt-encryption';

// Shared key encryption (for mod files)
export {
  encryptBinaryWithSharedKey,
  decryptBinaryWithSharedKey,
} from './shared-key-encryption';

// Multi-stage encryption
export {
  encryptMultiStage,
  decryptMultiStage,
  encryptTwoStage,
  decryptTwoStage,
  generateRequestKey,
  isMultiEncrypted,
  isDoubleEncrypted,
} from './multi-stage-encryption';

// Router middleware
export {
  createEncryptionWrapper,
  wrapWithEncryption,
} from './middleware';

// Per-route encryption system (industry standard)
export {
  encryptResponse,
  createEncryptionContext,
  extractJWTToken,
  findMatchingPolicy,
  DEFAULT_ENCRYPTION_POLICIES,
} from './route-encryption';

// Centralized encryption middleware
export {
  applyEncryptionMiddleware,
  withEncryption,
  createServicePolicies,
} from './encryption-middleware';

// Types
export type {
  EncryptedData,
  MultiStageEncryptedData,
  TwoStageEncryptedData,
  EncryptionParty,
  E2EEncryptionConfig,
  EncryptionWrapperOptions,
} from './types';

// Route encryption types
export type {
  EncryptionStrategy,
  RouteEncryptionPolicy,
  EncryptionContext,
  EncryptionResult,
} from './route-encryption';

export type {
  EncryptionMiddlewareOptions,
} from './encryption-middleware';

// Re-export RouteResult and AuthResult for convenience
export type {
  RouteResult,
  AuthResult,
} from './middleware';

