/**
 * Enhanced API Framework - E2E Encryption
 * 
 * CRITICAL: Only export the middleware, NOT the encryption functions
 * to avoid circular dependency. Users should import encryptWithJWT/decryptWithJWT
 * directly from @strixun/api-framework (which exports from encryption/index.js)
 */

// Only export the middleware, not the re-exports
export { createE2EEncryptionMiddleware } from './jwt-encryption';
export type { E2EEncryptionConfig, EncryptedData } from '../types';

