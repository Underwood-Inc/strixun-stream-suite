/**
 * Shared API Framework - Main Export
 * 
 * Re-exports the full API framework from src/core/api for use in all workers and apps
 * 
 * This package makes the API framework available to:
 * - All Cloudflare Workers (mods-api, game-api, otp-auth-service, etc.)
 * - All frontend apps (mods-hub, control-panel, etc.)
 * 
 * Usage in Workers:
 * ```typescript
 * import { createEnhancedHandler, createWorkerHandler } from '@strixun/api-framework/enhanced';
 * ```
 * 
 * Usage in Frontend:
 * ```typescript
 * import { getAPIClient, createAPIClient } from '@strixun/api-framework/client';
 * ```
 */

// Re-export everything from the base API framework
export * from '../../../src/core/api/index.js';

// Re-export enhanced framework
export * from '../../../src/core/api/enhanced/index.js';

// Re-export client factory for convenience
export {
  createAPIClient, getAPIClient, resetAPIClient, setAPIClient
} from '../../../src/core/api/factory.js';

// Re-export encryption utilities
export {
  createEncryptionWrapper, decryptMultiStage, decryptTwoStage, decryptWithJWT,
  encryptMultiStage, encryptTwoStage, encryptWithJWT, generateRequestKey, isDoubleEncrypted, isMultiEncrypted, wrapWithEncryption
} from '../encryption/index.js';

// Re-export encryption types
export type {
  AuthResult, E2EEncryptionConfig, EncryptedData, EncryptionParty, EncryptionWrapperOptions, MultiStageEncryptedData, RouteResult, TwoStageEncryptedData
} from '../encryption/index.js';

