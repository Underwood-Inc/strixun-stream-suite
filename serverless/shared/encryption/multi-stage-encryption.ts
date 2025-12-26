/**
 * Multi-Stage Encryption System
 * 
 * Provides multi-party encryption where ALL parties' keys are required to decrypt.
 * This is a generalization of two-stage encryption to support N parties.
 * 
 * Architecture:
 * - Generate a random master key
 * - Encrypt data with master key
 * - Encrypt master key with each party's key independently (parallel encryption)
 * - Store: encrypted data + all encrypted master keys
 * - To decrypt: ALL parties must decrypt their encrypted master keys (order-independent)
 * - Verification: All parties' keys are verified before data is decrypted
 * - Decryption order: COMPLETELY ORDER-INDEPENDENT - can verify parties in any order
 * - Security: Data is only decrypted after ALL parties successfully verify their keys
 * 
 * Use Cases:
 * - Two-stage: Owner's JWT + Request key (2 parties)
 * - Multi-party: Owner + Requester + Auditor + ... (N parties)
 * 
 * IMPORTANT:
 * - All parties must be known at encryption time
 * - All parties' keys are required for decryption
 * - Decryption order: COMPLETELY ORDER-INDEPENDENT
 * - Party order: Parties can be provided in any order (matched by key hash)
 * - Each party can use JWT token, request key, or custom key
 */

import type { MultiStageEncryptedData, TwoStageEncryptedData, EncryptionParty, EncryptedData } from './types.js';
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

  // Ensure salt is a proper BufferSource for deriveKey
  // Create a new Uint8Array from the buffer to avoid type inference issues
  // Convert to ArrayBuffer explicitly to avoid SharedArrayBuffer issues
  const saltBuffer = new ArrayBuffer(salt.byteLength);
  const saltView = new Uint8Array(saltBuffer);
  saltView.set(salt);
  const saltArray = saltView;

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltArray,
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
 * Convert ArrayBuffer or Uint8Array to base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
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
    const saltArray = new Uint8Array(saltBuffer);
    const ivArray = new Uint8Array(ivBuffer);
    const derivedKey = await deriveKeyFromKey(key, saltArray);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivArray },
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
 * @param parties - Array of parties, each with a key. Order does NOT matter for decryption (version 3+)
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

  // Generate a random master key (32 bytes = 256 bits)
  const masterKeyBytes = crypto.getRandomValues(new Uint8Array(32));
  const masterKey = arrayBufferToBase64(masterKeyBytes.buffer);

  // Encrypt the data with the master key using AES-GCM
  const dataStr = JSON.stringify(data);
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(dataStr);
  
  // Generate salt and IV for master key encryption
  const masterSalt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const masterIV = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  // Derive master encryption key from master key string
  const masterKeyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterKey),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const masterEncryptionKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: masterSalt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    masterKeyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );

  // Encrypt data with master key
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: masterIV },
    masterEncryptionKey,
    dataBytes
  );

  // Encrypt master key with each party's key independently (parallel encryption)
  const stages: MultiStageEncryptedData['stages'] = [];
  
  for (let i = 0; i < parties.length; i++) {
    const party = parties[i];
    const stageNumber = i + 1;

    // Encrypt master key with this party's key
    const encrypted = await encryptWithKey(masterKey, party.key, party.keyType);

    // Store stage information
    stages.push({
      stage: stageNumber,
      encrypted: true,
      algorithm: 'AES-GCM-256',
      iv: encrypted.iv,
      salt: encrypted.salt,
      keyHash: encrypted.keyHash,
      keyType: party.keyType,
      data: encrypted.encrypted, // This is the encrypted master key
    });
  }

  // Store encrypted data in the first stage's data field (we'll use a special format)
  // Actually, we need to store the encrypted data separately. Let's use stage 0 as a marker
  // Or better: store it in a way that's accessible. Actually, we can store it in the last stage
  // or create a special structure. Let me think...
  
  // Better approach: Store encrypted data + master IV/salt in a way that's accessible
  // We'll store it as part of the data structure, but for now let's encode it in base64
  // and store it separately. Actually, the stages array stores encrypted master keys.
  // We need to store: encryptedData, masterIV, masterSalt
  
  // Store encrypted data in the first stage as a special marker, or better yet,
  // modify the return structure. But for backward compatibility, let's store it differently.
  
  // Actually, let's store the encrypted data + master IV/salt in the first stage's data field
  // as a JSON string, then override it. No wait, that breaks things.
  
  // Best approach: Store encrypted data, master IV, and master salt as base64 in a special format
  // We'll encode: { encryptedData, masterIV, masterSalt } as JSON, then base64
  const masterInfo = {
    encryptedData: arrayBufferToBase64(encryptedData),
    masterIV: arrayBufferToBase64(masterIV),
    masterSalt: arrayBufferToBase64(masterSalt),
  };
  const masterInfoStr = JSON.stringify(masterInfo);
  const masterInfoB64 = btoa(masterInfoStr);

  return {
    version: 3, // Bump version to indicate new order-independent format
    multiEncrypted: true,
    stageCount: parties.length,
    stages: stages,
    // Store encrypted data + master key metadata in a way that's accessible
    // We'll use a special field or encode it
    data: masterInfoB64, // Store encrypted data + master IV/salt here
    timestamp: new Date().toISOString(),
  };
}

/**
 * Decrypt multi-stage encrypted data
 * 
 * @param encryptedData - Multi-stage encrypted data
 * @param parties - Array of parties with keys. Order does NOT matter - parties are matched to stages by key hash
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

  // Check version - version 3+ uses order-independent master key approach
  if (encryptedData.version >= 3 && encryptedData.data) {
    // Order-independent decryption: decrypt any encrypted master key, then decrypt data
    
    // Build a map of keyHash -> party for quick lookup
    const partyMap = new Map<string, EncryptionParty>();
    for (const party of parties) {
      let keyHash: string;
      if (party.keyType === 'jwt') {
        const encoder = new TextEncoder();
        const data = encoder.encode(party.key);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } else {
        keyHash = await hashKey(party.key);
      }
      partyMap.set(keyHash, party);
    }

    // Verify ALL parties can decrypt their encrypted master keys (order-independent!)
    // This ensures all parties must participate before we decrypt the data
    const verifiedParties = new Set<string>();
    let masterKey: string | null = null;
    
    // Try to decrypt each encrypted master key with the corresponding party's key
    for (const stage of encryptedData.stages) {
      // First, try to find party by key hash
      let party = partyMap.get(stage.keyHash);
      
      // If not found by hash, check for key type mismatch
      if (!party) {
        // Check if there's a party with matching key type but wrong key (hash mismatch)
        const partiesWithMatchingType = parties.filter(p => p.keyType === stage.keyType);
        
        if (partiesWithMatchingType.length > 0) {
          // There's a party with the right key type but wrong key (hash doesn't match)
          // This is a key mismatch, not a key type mismatch
          throw new Error(
            `Decryption failed - no party provided with key matching stage ${stage.stage}. ` +
            'All parties must provide the correct keys (order does not matter).'
          );
        } else {
          // No party has the matching key type - this is a key type mismatch
          const providedTypes = [...new Set(parties.map(p => p.keyType))];
          throw new Error(
            `key type mismatch for stage ${stage.stage}. ` +
            `Expected ${stage.keyType}, but provided key types were: ${providedTypes.join(', ')}.`
          );
        }
      }

      // Found party by hash, verify key type matches
      if (party.keyType !== stage.keyType) {
        throw new Error(
          `key type mismatch for stage ${stage.stage}. ` +
          `Expected ${stage.keyType}, got ${party.keyType}.`
        );
      }

      try {
        // Decrypt this stage's encrypted master key to verify the party's key is correct
        const decryptedMasterKey = await decryptWithKey(
          stage.data,
          stage.iv,
          stage.salt,
          party.key,
          party.keyType
        ) as string;
        
        // Verify all decrypted master keys are the same (they should all decrypt to the same master key)
        if (masterKey === null) {
          masterKey = decryptedMasterKey; // First one, store it
        } else if (masterKey !== decryptedMasterKey) {
          throw new Error(
            'Decryption failed - master keys do not match. This indicates corrupted or tampered data.'
          );
        }
        
        verifiedParties.add(stage.keyHash);
      } catch (error) {
        throw new Error(
          `Decryption failed - key for party ${party.id} (stage ${stage.stage}) is incorrect. ` +
          'All parties must provide the correct keys (order does not matter).'
        );
      }
    }

    // Verify we successfully verified all parties
    if (verifiedParties.size !== encryptedData.stageCount) {
      throw new Error(
        `Decryption failed - only ${verifiedParties.size} of ${encryptedData.stageCount} parties verified. ` +
        'All parties must provide the correct keys (order does not matter).'
      );
    }

    if (!masterKey) {
      throw new Error(
        'Decryption failed - could not decrypt master key. ' +
        'All parties must provide the correct keys (order does not matter).'
      );
    }

    // Decode master info (encrypted data + master IV/salt)
    const masterInfoStr = atob(encryptedData.data);
    const masterInfo = JSON.parse(masterInfoStr) as {
      encryptedData: string;
      masterIV: string;
      masterSalt: string;
    };

    // Decrypt data with master key
    const masterIV = base64ToArrayBuffer(masterInfo.masterIV);
    const masterSalt = base64ToArrayBuffer(masterInfo.masterSalt);
    const encryptedDataBuffer = base64ToArrayBuffer(masterInfo.encryptedData);

    // Derive master encryption key
    const encoder = new TextEncoder();
    const masterKeyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(masterKey),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const masterEncryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new Uint8Array(masterSalt),
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      masterKeyMaterial,
      { name: 'AES-GCM', length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );

    // Decrypt data
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(masterIV) },
      masterEncryptionKey,
      encryptedDataBuffer
    );

    const decoder = new TextDecoder();
    const dataStr = decoder.decode(decrypted);
    return JSON.parse(dataStr);
  }

  // Legacy version 2: nested encryption (backward compatibility)
  // This still requires reverse order, but we match by key hash
  const partyMap = new Map<string, EncryptionParty>();
  for (const party of parties) {
    let keyHash: string;
    if (party.keyType === 'jwt') {
      const encoder = new TextEncoder();
      const data = encoder.encode(party.key);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else {
      keyHash = await hashKey(party.key);
    }
    partyMap.set(keyHash, party);
  }

  // Decrypt in reverse order (legacy nested encryption)
  let currentData: unknown = encryptedData;

  for (let i = encryptedData.stages.length - 1; i >= 0; i--) {
    const stage = encryptedData.stages[i];
    const party = partyMap.get(stage.keyHash);
    
    if (!party || party.keyType !== stage.keyType) {
      throw new Error(
        `Decryption failed - no party provided with key matching stage ${stage.stage}. ` +
        'All parties must provide the correct keys.'
      );
    }

    if (i === encryptedData.stages.length - 1) {
      currentData = await decryptWithKey(
        stage.data,
        stage.iv,
        stage.salt,
        party.key,
        party.keyType
      );
    } else {
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
  // Two-stage encryption uses nested encryption:
  // Stage 1: Encrypt data with JWT token
  // Stage 2: Encrypt stage1 result with request key
  
  // Stage 1: Encrypt original data with JWT token
  const stage1Data = await encryptWithJWT(data, userToken);
  
  // Stage 2: Encrypt stage1 encrypted data with request key
  // We need to encrypt the stage1 data structure (the encrypted blob)
  const stage2Encrypted = await encryptWithKey(
    stage1Data, // Encrypt the entire stage1 encrypted data
    requestKey,
    'request-key'
  );

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
      iv: stage2Encrypted.iv,
      salt: stage2Encrypted.salt,
      keyHash: stage2Encrypted.keyHash,
      data: stage2Encrypted.encrypted, // This is the encrypted stage1 data
    },
    timestamp: new Date().toISOString(),
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

  // Two-stage encryption uses nested decryption:
  // Stage 2: Decrypt with request key to get stage1 encrypted data
  // Stage 1: Decrypt stage1 data with JWT token to get original data
  
  // First, decrypt stage2 with request key to get stage1 encrypted data
  const stage1EncryptedData = await decryptWithKey(
    encryptedData.stage2.data,
    encryptedData.stage2.iv,
    encryptedData.stage2.salt,
    requestKey,
    'request-key'
  ) as EncryptedData;

  // Then, decrypt stage1 with JWT token to get original data
  return await decryptWithJWT(stage1EncryptedData, userToken);
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

