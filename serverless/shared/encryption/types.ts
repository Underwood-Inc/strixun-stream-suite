/**
 * Shared Encryption Types
 * 
 * Type definitions for the unified encryption suite
 */

/**
 * Encrypted data structure (single-stage JWT encryption)
 */
export interface EncryptedData {
  version: number;
  encrypted: boolean;
  algorithm: string;
  iv: string; // Base64 encoded
  salt: string; // Base64 encoded
  tokenHash?: string; // SHA-256 hash of the JWT token used for encryption (for verification, version 3+)
  data: string; // Base64 encoded encrypted data
  timestamp?: string;
}

/**
 * Multi-stage encrypted data structure
 * Supports 2+ parties, where all parties' keys are required to decrypt
 */
export interface MultiStageEncryptedData {
  version: number;
  multiEncrypted: boolean;
  stageCount: number; // Number of encryption stages (parties)
  stages: Array<{
    // Each stage represents one party's encryption of the master key
    stage: number; // Stage number (1, 2, 3, ...)
    encrypted: boolean;
    algorithm: string;
    iv: string; // Base64 encoded
    salt: string; // Base64 encoded
    keyHash: string; // Hash of the key used for this stage (for verification)
    keyType: 'jwt' | 'request-key' | 'custom'; // Type of key used
    data: string; // Base64 encoded encrypted master key
  }>;
  data?: string; // Base64 encoded JSON containing encrypted data + master IV/salt (version 3+)
  timestamp: string;
}

/**
 * Two-stage encrypted data structure (backward compatibility)
 * This is a special case of multi-stage encryption with exactly 2 parties
 */
export interface TwoStageEncryptedData {
  version: number;
  doubleEncrypted: boolean;
  stage1: {
    // Stage 1: Encrypted with first party's key (typically data owner's JWT)
    encrypted: boolean;
    algorithm: string;
    iv: string;
    salt: string;
    tokenHash: string; // Hash of JWT token for Stage 1
    data: string; // Base64 encrypted data
  };
  stage2: {
    // Stage 2: Encrypted with second party's key (typically request key)
    encrypted: boolean;
    algorithm: string;
    iv: string;
    salt: string;
    keyHash: string; // Hash of request key for Stage 2
    data: string; // Base64 encrypted data (contains stage1 encrypted data)
  };
  timestamp: string;
}

/**
 * Party information for multi-stage encryption
 * Each party must provide a key and identifier
 */
export interface EncryptionParty {
  /** Unique identifier for this party (e.g., userId, email, requestId) */
  id: string;
  /** The key to use for encryption (JWT token, request key, or custom key) */
  key: string;
  /** Type of key being used */
  keyType: 'jwt' | 'request-key' | 'custom';
  /** Optional label/description for this party */
  label?: string;
}

/**
 * E2E Encryption Middleware Configuration
 */
export interface E2EEncryptionConfig {
  enabled: boolean;
  tokenGetter: () => string | null | Promise<string | null>;
  algorithm?: 'AES-GCM-256';
  encryptCondition?: (request: Request, response: Response) => boolean;
}

/**
 * Encryption wrapper options for router middleware
 */
export interface EncryptionWrapperOptions {
  /** Whether to encrypt responses (default: true if JWT token present) */
  enabled?: boolean;
  /** Custom condition for when to encrypt */
  shouldEncrypt?: (response: Response) => boolean;
}

