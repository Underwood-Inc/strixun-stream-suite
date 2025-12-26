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
} from './jwt-encryption.js';

// Multi-stage encryption
export {
  encryptMultiStage,
  decryptMultiStage,
  encryptTwoStage,
  decryptTwoStage,
  generateRequestKey,
  isMultiEncrypted,
  isDoubleEncrypted,
} from './multi-stage-encryption.js';

// Router middleware
export {
  createEncryptionWrapper,
  wrapWithEncryption,
} from './middleware.js';

// Types
export type {
  EncryptedData,
  MultiStageEncryptedData,
  TwoStageEncryptedData,
  EncryptionParty,
  E2EEncryptionConfig,
  EncryptionWrapperOptions,
} from './types.js';

// Re-export RouteResult and AuthResult for convenience
export type {
  RouteResult,
  AuthResult,
} from './middleware.js';

