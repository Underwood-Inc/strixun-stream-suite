/**
 * Enhanced API Framework - JWT-Based E2E Encryption
 * 
 * Encrypts API responses using JWT token as key derivation source
 * Only the JWT token holder (email owner) can decrypt the data
 */

import type { E2EEncryptionConfig, EncryptedData } from '../types';
import type { APIRequest, APIResponse } from '../../types';

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

/**
 * Hash JWT token for verification
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derive encryption key from JWT token using PBKDF2
 */
async function deriveKeyFromToken(token: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const tokenKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(token),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    tokenKey,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );

  return key;
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
 * Encrypt data using JWT token
 */
export async function encryptWithJWT(
  data: unknown,
  token: string
): Promise<EncryptedData> {
  if (!token || token.length < 10) {
    throw new Error('Valid JWT token is required for encryption');
  }

  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Derive key from token
  const key = await deriveKeyFromToken(token, salt);

  // Hash token for verification
  const tokenHash = await hashToken(token);

  // Encrypt data
  const encoder = new TextEncoder();
  const dataStr = JSON.stringify(data);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encoder.encode(dataStr)
  );

  // Return encrypted blob
  return {
    version: 3,
    encrypted: true,
    algorithm: 'AES-GCM-256',
    iv: arrayBufferToBase64(iv),
    salt: arrayBufferToBase64(salt),
    tokenHash: tokenHash,
    data: arrayBufferToBase64(encrypted),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Decrypt data using JWT token
 */
export async function decryptWithJWT(
  encryptedData: EncryptedData | unknown,
  token: string
): Promise<unknown> {
  // Check if encrypted
  if (!encryptedData || typeof encryptedData !== 'object' || !('encrypted' in encryptedData)) {
    // Not encrypted, return as-is (backward compatibility)
    return encryptedData;
  }

  const encrypted = encryptedData as EncryptedData;

  if (!encrypted.encrypted) {
    return encryptedData;
  }

  if (!token || token.length < 10) {
    throw new Error('Valid JWT token is required for decryption');
  }

  // Extract metadata
  const salt = base64ToArrayBuffer(encrypted.salt);
  const iv = base64ToArrayBuffer(encrypted.iv);
  const encryptedDataBuffer = base64ToArrayBuffer(encrypted.data);

  // Verify token hash matches
  if (encrypted.tokenHash) {
    const tokenHash = await hashToken(token);
    if (encrypted.tokenHash !== tokenHash) {
      throw new Error(
        'Decryption failed - token does not match. ' +
        'Only authenticated users (with email OTP access) can decrypt this data.'
      );
    }
  }

  // Derive key from token
  const key = await deriveKeyFromToken(token, new Uint8Array(salt));

  // Decrypt
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      key,
      encryptedDataBuffer
    );

    const decoder = new TextDecoder();
    const dataStr = decoder.decode(decrypted);
    return JSON.parse(dataStr);
  } catch (error) {
    throw new Error(
      'Decryption failed - incorrect token or corrupted data. ' +
      'Only authenticated users (with email OTP access) can decrypt this data.'
    );
  }
}

/**
 * E2E Encryption Middleware
 * 
 * Automatically encrypts responses if JWT token is present
 */
export function createE2EEncryptionMiddleware(
  config: E2EEncryptionConfig
) {
  return async (
    request: APIRequest,
    next: (request: APIRequest) => Promise<APIResponse>
  ): Promise<APIResponse> => {
    if (!config.enabled) {
      return await next(request);
    }

    // Get JWT token
    const token = await config.tokenGetter();
    if (!token) {
      // No token, proceed without encryption
      return await next(request);
    }

    // Execute request
    const response = await next(request);

    // Check if we should encrypt
    const shouldEncrypt = config.encryptCondition
      ? config.encryptCondition(request, response)
      : true;

    if (!shouldEncrypt || !response.ok) {
      return response;
    }

    try {
      // Parse response data
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        // Not JSON, don't encrypt
        return response;
      }

      const data = await response.json();

      // Encrypt data
      const encrypted = await encryptWithJWT(data, token);

      // Create new response with encrypted data
      const headers = new Headers(response.headers);
      headers.set('Content-Type', 'application/json');
      headers.set('X-Encrypted', 'true'); // Flag to indicate encrypted response

      return {
        ...response,
        data: encrypted,
        headers,
      };
    } catch (error) {
      console.error('E2E encryption failed:', error);
      // Return unencrypted response if encryption fails
      return response;
    }
  };
}

