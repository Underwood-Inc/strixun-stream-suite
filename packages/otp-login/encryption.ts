/**
 * Encryption Utilities
 * 
 * Handles encryption of OTP request bodies using service key encryption
 * Uses Web Crypto API (available in browsers and workers)
 * Matches server-side encryptWithServiceKey implementation exactly
 */

import type { EncryptedData } from './types.js';

/**
 * Encrypt request body using OTP encryption key
 * CRITICAL: Never send unencrypted data - always require encryption key
 */
export async function encryptRequestBody(
  data: { email?: string; otp?: string },
  otpEncryptionKey: string
): Promise<string> {
  // If no encryption key provided, throw error (encryption is mandatory)
  if (!otpEncryptionKey) {
    console.error('[OtpLoginCore] ❌ CRITICAL: OTP encryption key is missing!');
    console.error('[OtpLoginCore] Config:', {
      hasKey: !!otpEncryptionKey,
      keyLength: otpEncryptionKey?.length || 0,
    });
    throw new Error('OTP encryption key is required. Please configure otpEncryptionKey in OtpLoginConfig.');
  }

  if (otpEncryptionKey.length < 32) {
    console.error('[OtpLoginCore] ❌ CRITICAL: OTP encryption key is too short!', {
      keyLength: otpEncryptionKey.length,
      requiredLength: 32
    });
    throw new Error('OTP encryption key must be at least 32 characters long.');
  }
  
  console.log('[OtpLoginCore] ✅ Encrypting request body with key length:', otpEncryptionKey.length);

  try {
    // Constants matching server-side implementation
    const PBKDF2_ITERATIONS = 100000;
    const SALT_LENGTH = 16;
    const IV_LENGTH = 12;
    const KEY_LENGTH = 256;

    // Generate random salt and IV
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

    // Hash service key for verification (matches hashServiceKey)
    const encoder = new TextEncoder();
    const keyData = encoder.encode(otpEncryptionKey);
    const keyHashBuffer = await crypto.subtle.digest('SHA-256', keyData);
    const keyHashArray = Array.from(new Uint8Array(keyHashBuffer));
    const keyHash = keyHashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Derive key from service key (matches deriveKeyFromServiceKey)
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(otpEncryptionKey),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    // Ensure salt is a proper BufferSource (matches server implementation)
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

    // Encrypt data
    const dataStr = JSON.stringify(data);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      derivedKey,
      encoder.encode(dataStr)
    );

    // Convert to base64 (matches arrayBufferToBase64)
    const arrayBufferToBase64 = (buffer: ArrayBuffer | Uint8Array): string => {
      const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    };

    // Return encrypted blob (matches server-side format exactly)
    const encryptedData: EncryptedData = {
      version: 3,
      encrypted: true,
      algorithm: 'AES-GCM-256',
      iv: arrayBufferToBase64(iv.buffer),
      salt: arrayBufferToBase64(salt.buffer),
      tokenHash: keyHash, // Reuse tokenHash field for service key hash
      data: arrayBufferToBase64(encrypted),
      timestamp: new Date().toISOString(),
    };

    return JSON.stringify(encryptedData);
  } catch (error) {
    console.error('[OtpLoginCore] Encryption failed:', error);
    throw new Error('Failed to encrypt OTP request. Please check your encryption key configuration.');
  }
}

/**
 * Verify encrypted body is actually encrypted (not plain JSON)
 */
export function validateEncryptedBody(encryptedBody: string): void {
  try {
    const parsed = JSON.parse(encryptedBody);
    if (!parsed.encrypted || parsed.encrypted !== true) {
      console.error('[OtpLoginCore] ❌ CRITICAL: Encrypted body does not have encrypted flag! Aborting.');
      throw new Error('Encryption validation failed. Request aborted for security.');
    }
    console.log('[OtpLoginCore] ✅ Verified encrypted payload:', {
      version: parsed.version,
      algorithm: parsed.algorithm,
      hasData: !!parsed.data
    });
  } catch (parseError) {
    if (parseError instanceof Error && parseError.message.includes('Encryption validation failed')) {
      throw parseError;
    }
    console.error('[OtpLoginCore] ❌ CRITICAL: Encrypted body is not valid JSON! Aborting.');
    throw new Error('Encryption validation failed. Request aborted for security.');
  }
}

