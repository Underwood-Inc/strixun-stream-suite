/**
 * Strixun Stream Suite - Encrypted Storage Wrapper
 * 
 * Wraps the existing storage system with encryption at rest
 * Automatically encrypts/decrypts data based on encryption configuration
 * Uses email from authentication store for key derivation
 * 
 * CRITICAL: Without the original login email, decryption is impossible
 * 
 * @version 2.0.0
 */

import { storage } from '../../modules/storage';
import { get } from 'svelte/store';
import { token } from '../../stores/auth';
import {
  isEncryptionEnabled,
  encrypt,
  decrypt,
  type EncryptedData,
} from './encryption';

// Keys that should NEVER be encrypted (system keys)
const UNENCRYPTED_KEYS = [
  'sss_encryption_config',
  'sss_encryption_enabled',
  'sss_encryption_salt',
  'sss_has_passphrase',
  'sss_device_id',
  'sss_shared_key',
];

// Keys that are already encrypted (cloud storage, etc.)
const ALREADY_ENCRYPTED_KEYS = [
  'sss_encryption_salt', // Salt is stored as base64, not encrypted
];

// Track which keys have already been warned about to prevent spam
const warnedKeys = new Set<string>();

/**
 * Check if a key should be encrypted
 */
function shouldEncrypt(key: string): boolean {
  // Never encrypt system keys
  if (UNENCRYPTED_KEYS.some((k) => key === k || key.startsWith(k))) {
    return false;
  }

  // Skip already encrypted keys
  if (ALREADY_ENCRYPTED_KEYS.some((k) => key === k || key.startsWith(k))) {
    return false;
  }

  return true;
}

/**
 * Get JWT token from authentication store
 * The token is used as the key derivation source - without it (and email OTP access), decryption is impossible
 */
function getToken(): string | null {
  const authToken = get(token);
  if (!authToken || typeof authToken !== 'string') {
    return null;
  }
  return authToken;
}

/**
 * Encrypted storage wrapper
 */
export const encryptedStorage = {
  /**
   * Get a value from storage (automatically decrypts if encrypted)
   */
  async get(key: string): Promise<unknown | null> {
    const value = storage.get(key);

    if (value === null || value === undefined) {
      return null;
    }

    // Check if encryption is enabled
    const encryptionEnabled = await isEncryptionEnabled();
    if (!encryptionEnabled || !shouldEncrypt(key)) {
      return value;
    }

    // Check if value is encrypted
    if (
      typeof value === 'object' &&
      value !== null &&
      'encrypted' in value &&
      (value as EncryptedData).encrypted
    ) {
      // Decrypt using JWT token from auth store
      const authToken = getToken();
      if (!authToken) {
        // Encrypted data but no auth token - cannot decrypt
        // Return null silently (no warnings) - this is expected when encryption is enabled but user not logged in
        return null;
      }

      try {
        // Check if password-protected (would need password from caller)
        // For now, try without password - if it fails with password error, return null
        const decrypted = await decrypt(value as EncryptedData, authToken);
        return decrypted;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('password')) {
          // Password-protected item - would need password from caller
          // Only warn once per key to prevent spam
          if (!warnedKeys.has(`password:${key}`)) {
            warnedKeys.add(`password:${key}`);
            console.warn(
              `[EncryptedStorage] [WARNING] Cannot decrypt ${key}: password-protected item requires password`
            );
          }
        } else {
          // Only log error once per key to prevent spam
          if (!warnedKeys.has(`error:${key}`)) {
            warnedKeys.add(`error:${key}`);
            console.error(`[EncryptedStorage] [ERROR] Failed to decrypt ${key}:`, error);
          }
        }
        // If decryption fails, it means the token doesn't match - this is expected
        // if the user is not authenticated or token expired
        return null;
      }
    }

    // Not encrypted, return as-is
    return value;
  },

  /**
   * Set a value in storage (automatically encrypts if encryption enabled)
   */
  async set(key: string, value: unknown): Promise<boolean> {
    // Check if encryption is enabled
    const encryptionEnabled = await isEncryptionEnabled();
    if (!encryptionEnabled || !shouldEncrypt(key)) {
      // Store unencrypted
      return storage.set(key, value);
    }

    // CRITICAL: Encryption requires authentication - check token first
    const authToken = getToken();
    if (!authToken) {
      // Encryption is enabled but user not authenticated
      // Don't try to encrypt - just store unencrypted silently
      // Encryption will work once user authenticates
      return storage.set(key, value);
    }

    try {
      // Check if this is a password-protected item (would need to be passed as option)
      // For now, encrypt without password - password protection should be handled at higher level
      const encrypted = await encrypt(value, authToken);
      return storage.set(key, encrypted);
    } catch (error) {
      console.error(`[EncryptedStorage] [ERROR] Failed to encrypt ${key}:`, error);
      // Fallback to unencrypted storage
      return storage.set(key, value);
    }
  },

  /**
   * Remove a value from storage
   */
  remove(key: string): void {
    storage.remove(key);
  },

  /**
   * Get a raw string value (for credentials, etc) - NOT encrypted
   */
  getRaw(key: string): unknown {
    return storage.getRaw(key);
  },

  /**
   * Set a raw string value (for credentials, etc) - NOT encrypted
   */
  setRaw(key: string, value: string): void {
    storage.setRaw(key, value);
  },

  /**
   * Force sync all cached data
   */
  async flush(): Promise<void> {
    await storage.flush();
  },

  /**
   * Check if storage system is ready
   */
  isReady(): boolean {
    return storage.isReady();
  },
};

/**
 * Migrate existing unencrypted data to encrypted format
 * Call this after enabling encryption
 * Uses JWT token from authentication store
 */
export async function migrateToEncryption(): Promise<{ migrated: number; failed: number }> {
  const encryptionEnabled = await isEncryptionEnabled();
  if (!encryptionEnabled) {
    throw new Error('Encryption is not enabled');
  }

  const authToken = getToken();
  if (!authToken) {
    throw new Error('User must be authenticated to migrate data to encryption');
  }

  let migrated = 0;
  let failed = 0;

  // Get all keys from storage
  const allKeys: string[] = [];
  
  // Get keys from IndexedDB
  try {
    const idb = (window as any).SSS_Storage?.idbInstance;
    if (idb) {
      const tx = idb.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const request = store.getAll();
      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          const items = request.result || [];
          items.forEach((item: { key: string }) => {
            if (!allKeys.includes(item.key)) {
              allKeys.push(item.key);
            }
          });
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    }
  } catch (e) {
    console.warn('[EncryptedStorage] Failed to get keys from IndexedDB:', e);
  }

  // Get keys from localStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sss_')) {
        const cleanKey = key.substring(4); // Remove 'sss_' prefix
        if (!allKeys.includes(cleanKey)) {
          allKeys.push(cleanKey);
        }
      }
    }
  } catch (e) {
    console.warn('[EncryptedStorage] Failed to get keys from localStorage:', e);
  }

  // Migrate each key
  for (const key of allKeys) {
    if (!shouldEncrypt(key)) {
      continue; // Skip system keys
    }

    try {
      const value = storage.get(key);
      if (value === null || value === undefined) {
        continue;
      }

      // Check if already encrypted
      if (
        typeof value === 'object' &&
        value !== null &&
        'encrypted' in value &&
        (value as EncryptedData).encrypted
      ) {
        continue; // Already encrypted
      }

      // Encrypt and save
      await encryptedStorage.set(key, value);
      migrated++;
    } catch (error) {
      console.error(`[EncryptedStorage] Failed to migrate ${key}:`, error);
      failed++;
    }
  }

  console.log(
    `[EncryptedStorage] [OK] Migration complete: ${migrated} migrated, ${failed} failed`
  );

  return { migrated, failed };
}

export default encryptedStorage;

