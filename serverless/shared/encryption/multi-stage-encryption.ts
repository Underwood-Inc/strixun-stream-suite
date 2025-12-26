/**
 * Multi-Stage Encryption System
 * 
 * Provides multi-party encryption where ALL parties' keys are required to decrypt.
 * This is a generalization of two-stage encryption to support N parties.
 * 
 * Architecture:
 * - Each party adds an encryption layer (stage)
 * - Data is encrypted: Party1 → Party2 → Party3 → ... → PartyN
 * - To decrypt: Need ALL parties' keys in reverse order (PartyN → ... → Party3 → Party2 → Party1)
 * 
 * Use Cases:
 * - Two-stage: Owner's JWT + Request key (2 parties)
 * - Multi-party: Owner + Requester + Auditor + ... (N parties)
 * 
 * IMPORTANT:
 * - All parties must be known at encryption time
 * - All parties' keys are required for decryption
 * - Order matters: encryption order is reversed for decryption
 * - Each party can use JWT token, request key, or custom key
 */

import type { MultiStageEncryptedData, TwoStageEncryptedData, EncryptionParty } from './types.js';
import { encryptWithJWT, decryptWithJWT } from './jwt-encryption.js';

// ============ Constants ============

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

// ============ Helper Functions ============

/**
 * Hash key for verification
 */
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derive encryption key from request key or custom key using PBKDF2
 */
async function deriveKeyFromKey(key: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );

  return derivedKey;
}

/**
 * Convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Encrypt data with a single key (JWT, request key, or custom)
 */
async function encryptWithKey(
  data: unknown,
  key: string,
  keyType: 'jwt' | 'request-key' | 'custom'
): Promise<{ encrypted: string; iv: string; salt: string; keyHash: string }> {
  if (keyType === 'jwt') {
    // Use JWT encryption
    const encrypted = await encryptWithJWT(data, key);
    return {
      encrypted: encrypted.data,
      iv: encrypted.iv,
      salt: encrypted.salt,
      keyHash: encrypted.tokenHash || '',
    };
  } else {
    // Use PBKDF2 key derivation for request-key or custom
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const derivedKey = await deriveKeyFromKey(key, salt);
    const keyHash = await hashKey(key);

    const encoder = new TextEncoder();
    const dataStr = JSON.stringify(data);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      derivedKey,
      encoder.encode(dataStr)
    );

    return {
      encrypted: arrayBufferToBase64(encrypted),
      iv: arrayBufferToBase64(iv),
      salt: arrayBufferToBase64(salt),
      keyHash: keyHash,
    };
  }
}

/**
 * Decrypt data with a single key (JWT, request key, or custom)
 */
async function decryptWithKey(
  encryptedData: string,
  iv: string,
  salt: string,
  key: string,
  keyType: 'jwt' | 'request-key' | 'custom'
): Promise<unknown> {
  if (keyType === 'jwt') {
    // Use JWT decryption
    const encrypted = {
      version: 3,
      encrypted: true,
      algorithm: 'AES-GCM-256',
      iv: iv,
      salt: salt,
      data: encryptedData,
    };
    return await decryptWithJWT(encrypted, key);
  } else {
    // Use PBKDF2 key derivation for request-key or custom
    const saltBuffer = base64ToArrayBuffer(salt);
    const ivBuffer = base64ToArrayBuffer(iv);
    const encryptedBuffer = base64ToArrayBuffer(encryptedData);
    const derivedKey = await deriveKeyFromKey(key, new Uint8Array(saltBuffer));

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
      derivedKey,
      encryptedBuffer
    );

    const decoder = new TextDecoder();
    const dataStr = decoder.decode(decrypted);
    return JSON.parse(dataStr);
  }
}

// ============ Public API ============

/**
 * Encrypt data with multi-stage encryption (N parties)
 * 
 * @param data - Data to encrypt
 * @param parties - Array of parties, each with a key. Order matters: encryption happens in array order
 * @returns Multi-stage encrypted data
 * 
 * @example
 * // Two-party encryption (backward compatible with two-stage)
 * const encrypted = await encryptMultiStage(data, [
 *   { id: 'owner', key: ownerJWT, keyType: 'jwt' },
 *   { id: 'requester', key: requestKey, keyType: 'request-key' }
 * ]);
 * 
 * @example
 * // Three-party encryption
 * const encrypted = await encryptMultiStage(data, [
 *   { id: 'owner', key: ownerJWT, keyType: 'jwt' },
 *   { id: 'requester', key: requesterJWT, keyType: 'jwt' },
 *   { id: 'auditor', key: auditorKey, keyType: 'custom' }
 * ]);
 */
export async function encryptMultiStage(
  data: unknown,
  parties: EncryptionParty[]
): Promise<MultiStageEncryptedData> {
  if (!parties || parties.length < 2) {
    throw new Error('Multi-stage encryption requires at least 2 parties');
  }

  if (parties.length > 10) {
    throw new Error('Multi-stage encryption supports maximum 10 parties for security reasons');
  }

  // Validate all parties have valid keys
  for (const party of parties) {
    if (!party.key || party.key.length < 10) {
      throw new Error(`Invalid key for party ${party.id}: key must be at least 10 characters`);
    }
    if (!party.id) {
      throw new Error('All parties must have an id');
    }
  }

  const stages: MultiStageEncryptedData['stages'] = [];
  let currentData: unknown = data;

  // Encrypt in order: Party1 → Party2 → Party3 → ... → PartyN
  for (let i = 0; i < parties.length; i++) {
    const party = parties[i];
    const stageNumber = i + 1;

    // Encrypt current data with this party's key
    const encrypted = await encryptWithKey(currentData, party.key, party.keyType);

    // Store stage information
    stages.push({
      stage: stageNumber,
      encrypted: true,
      algorithm: 'AES-GCM-256',
      iv: encrypted.iv,
      salt: encrypted.salt,
      keyHash: encrypted.keyHash,
      keyType: party.keyType,
      data: encrypted.encrypted,
    });

    // Next stage encrypts the encrypted data from this stage
    currentData = {
      encrypted: true,
      data: encrypted.encrypted,
      iv: encrypted.iv,
      salt: encrypted.salt,
    };
  }

  return {
    version: 2,
    multiEncrypted: true,
    stageCount: parties.length,
    stages: stages,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Decrypt multi-stage encrypted data
 * 
 * @param encryptedData - Multi-stage encrypted data
 * @param parties - Array of parties with keys. Order must match encryption order (same order as encryption)
 * @returns Decrypted data
 * 
 * @example
 * // Decrypt two-party encryption
 * const decrypted = await decryptMultiStage(encrypted, [
 *   { id: 'owner', key: ownerJWT, keyType: 'jwt' },
 *   { id: 'requester', key: requestKey, keyType: 'request-key' }
 * ]);
 */
export async function decryptMultiStage(
  encryptedData: MultiStageEncryptedData,
  parties: EncryptionParty[]
): Promise<unknown> {
  if (!encryptedData.multiEncrypted) {
    // Not multi-encrypted, try single-stage decryption with first party's key
    if (parties.length > 0 && parties[0].keyType === 'jwt') {
      return await decryptWithJWT(encryptedData as any, parties[0].key);
    }
    throw new Error('Data is not multi-encrypted');
  }

  if (parties.length !== encryptedData.stageCount) {
    throw new Error(
      `Decryption requires exactly ${encryptedData.stageCount} parties, but ${parties.length} provided`
    );
  }

  // Decrypt in reverse order: PartyN → ... → Party3 → Party2 → Party1
  let currentData: unknown = encryptedData;

  for (let i = encryptedData.stages.length - 1; i >= 0; i--) {
    const stage = encryptedData.stages[i];
    const party = parties[i];

    // Verify key hash matches
    let expectedKeyHash: string;
    if (party.keyType === 'jwt') {
      // For JWT, we need to hash the token
      // Since hashToken is not exported, we'll use the same logic
      const encoder = new TextEncoder();
      const data = encoder.encode(party.key);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      expectedKeyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      expectedKeyHash = await hashKey(party.key);
    }

    if (stage.keyHash !== expectedKeyHash) {
      throw new Error(
        `Decryption failed - key for party ${party.id} (stage ${stage.stage}) does not match. ` +
        'All parties must provide the correct keys in the correct order.'
      );
    }

    // Decrypt this stage
    if (i === encryptedData.stages.length - 1) {
      // Last stage: decrypt the encrypted data
      currentData = await decryptWithKey(
        stage.data,
        stage.iv,
        stage.salt,
        party.key,
        party.keyType
      );
    } else {
      // Intermediate stages: decrypt the previous stage's encrypted data
      const previousStageData = currentData as { encrypted: boolean; data: string; iv: string; salt: string };
      currentData = await decryptWithKey(
        previousStageData.data,
        previousStageData.iv || stage.iv,
        previousStageData.salt || stage.salt,
        party.key,
        party.keyType
      );
    }
  }

  return currentData;
}

/**
 * Encrypt data with two-stage encryption (backward compatibility)
 * 
 * This is a convenience wrapper around encryptMultiStage for the common two-party case.
 * 
 * @param data - Data to encrypt
 * @param userToken - First party's JWT token (typically data owner)
 * @param requestKey - Second party's key (typically request key)
 * @returns Two-stage encrypted data (backward compatible format)
 */
export async function encryptTwoStage(
  data: unknown,
  userToken: string,
  requestKey: string
): Promise<TwoStageEncryptedData> {
  const multiEncrypted = await encryptMultiStage(data, [
    { id: 'owner', key: userToken, keyType: 'jwt', label: 'Data Owner' },
    { id: 'requester', key: requestKey, keyType: 'request-key', label: 'Requester' },
  ]);

  // Convert to backward-compatible two-stage format
  const stage1 = multiEncrypted.stages[0];
  const stage2 = multiEncrypted.stages[1];

  // For stage1, we need to get the actual JWT-encrypted data
  // Stage1 data is the first encryption layer
  const stage1Data = await encryptWithJWT(data, userToken);

  return {
    version: 1,
    doubleEncrypted: true,
    stage1: {
      encrypted: true,
      algorithm: 'AES-GCM-256',
      iv: stage1Data.iv,
      salt: stage1Data.salt,
      tokenHash: stage1Data.tokenHash || '',
      data: stage1Data.data,
    },
    stage2: {
      encrypted: true,
      algorithm: 'AES-GCM-256',
      iv: stage2.iv,
      salt: stage2.salt,
      keyHash: stage2.keyHash,
      data: stage2.data,
    },
    timestamp: multiEncrypted.timestamp,
  };
}

/**
 * Decrypt two-stage encrypted data (backward compatibility)
 * 
 * This is a convenience wrapper around decryptMultiStage for the common two-party case.
 * 
 * @param encryptedData - Two-stage encrypted data
 * @param userToken - First party's JWT token (typically data owner)
 * @param requestKey - Second party's key (typically request key)
 * @returns Decrypted data
 */
export async function decryptTwoStage(
  encryptedData: TwoStageEncryptedData,
  userToken: string,
  requestKey: string
): Promise<unknown> {
  if (!encryptedData.doubleEncrypted) {
    // Not double-encrypted, try single-stage decryption
    return await decryptWithJWT(encryptedData as any, userToken);
  }

  // Convert to multi-stage format for decryption
  const multiEncrypted: MultiStageEncryptedData = {
    version: 2,
    multiEncrypted: true,
    stageCount: 2,
    stages: [
      {
        stage: 1,
        encrypted: true,
        algorithm: 'AES-GCM-256',
        iv: encryptedData.stage1.iv,
        salt: encryptedData.stage1.salt,
        keyHash: encryptedData.stage1.tokenHash,
        keyType: 'jwt',
        data: encryptedData.stage1.data,
      },
      {
        stage: 2,
        encrypted: true,
        algorithm: 'AES-GCM-256',
        iv: encryptedData.stage2.iv,
        salt: encryptedData.stage2.salt,
        keyHash: encryptedData.stage2.keyHash,
        keyType: 'request-key',
        data: encryptedData.stage2.data,
      },
    ],
    timestamp: encryptedData.timestamp,
  };

  return await decryptMultiStage(multiEncrypted, [
    { id: 'owner', key: userToken, keyType: 'jwt' },
    { id: 'requester', key: requestKey, keyType: 'request-key' },
  ]);
}

/**
 * Generate a secure request key
 * 
 * @returns Random request key (base64 encoded)
 */
export function generateRequestKey(): string {
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  return arrayBufferToBase64(keyBytes.buffer);
}

/**
 * Check if data is multi-encrypted
 */
export function isMultiEncrypted(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    'multiEncrypted' in data &&
    (data as any).multiEncrypted === true
  );
}

/**
 * Check if data is double-encrypted (two-stage)
 */
export function isDoubleEncrypted(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    'doubleEncrypted' in data &&
    (data as any).doubleEncrypted === true
  );
}

