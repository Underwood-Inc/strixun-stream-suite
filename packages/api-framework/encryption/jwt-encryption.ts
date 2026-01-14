/**
 * Universal JWT Token-Based Encryption
 * 
 * Encrypts data end-to-end using JWT token as key derivation source
 * Only the JWT token holder can decrypt the data
 * 
 * Works in both Cloudflare Workers and browser environments
 * Uses AES-GCM-256 encryption with PBKDF2 key derivation
 * 
 * @version 4.0.0 - Unified implementation
 */

import type { EncryptedData } from './types';

// ============ Constants ============

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

// ============ Helper Functions ============

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

  // Ensure salt is a proper BufferSource for deriveKey
  // Create a new Uint8Array from the buffer to avoid type inference issues
  // Convert to ArrayBuffer explicitly to avoid SharedArrayBuffer issues
  const saltBuffer = new ArrayBuffer(salt.byteLength);
  const saltView = new Uint8Array(saltBuffer);
  saltView.set(salt);
  const saltArray = saltView;

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltArray,
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

// ============ Public API ============

/**
 * Encrypt data using JWT token
 * 
 * @param data - Data to encrypt (will be JSON stringified)
 * @param token - JWT token from request
 * @returns Encrypted data blob
 * 
 * @throws Error if token is invalid or encryption fails
 */
export async function encryptWithJWT(
  data: unknown,
  token: string
): Promise<EncryptedData> {
  // Only log for /auth/me related data (check if data contains email or userId)
  // const shouldLog = data && typeof data === 'object' && (
  //   'email' in data || 
  //   'userId' in data || 
  //   'customerId' in data
  // );
  
  // CRITICAL: Trim token to ensure consistency with backend
  const tokenToUse = token?.trim() || token;
  
  // if (shouldLog) {
  //   console.log('[encryptWithJWT] Encrypting data with token:', {
  //     rawTokenLength: rawToken?.length || 0,
  //     trimmedTokenLength: trimmedToken?.length || 0,
  //     wasTrimmed,
  //     rawTokenPrefix: rawToken ? rawToken.substring(0, 20) + '...' : 'none',
  //     trimmedTokenPrefix: trimmedToken ? trimmedToken.substring(0, 20) + '...' : 'none',
  //     rawTokenSuffix: rawToken ? '...' + rawToken.substring(rawToken.length - 10) : 'none',
  //     trimmedTokenSuffix: trimmedToken ? '...' + trimmedToken.substring(trimmedToken.length - 10) : 'none',
  //     dataKeys: data && typeof data === 'object' ? Object.keys(data) : null,
  //   });
  // }
  
  if (!tokenToUse || tokenToUse.length < 10) {
    throw new Error('Valid JWT token is required for encryption');
  }

  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Derive key from token (use trimmed token)
  const key = await deriveKeyFromToken(tokenToUse, salt);

  // Hash token for verification (use trimmed token)
  const tokenHash = await hashToken(tokenToUse);
  
  // if (shouldLog) {
  //   console.log('[encryptWithJWT] Token hash generated:', {
  //     tokenHash,
  //     tokenHashLength: tokenHash?.length || 0,
  //   });
  // }

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
 * 
 * @param encryptedData - Encrypted data blob or unencrypted data
 * @param token - JWT token
 * @returns Decrypted data
 * 
 * @throws Error if token doesn't match or decryption fails
 */
export async function decryptWithJWT(
  encryptedData: EncryptedData | unknown,
  token: string
): Promise<unknown> {
  // DEBUG: Log token used for decryption (for /auth/me debugging)
  const rawToken = token;
  const trimmedToken = token?.trim() || token;
  const wasTrimmed = rawToken !== trimmedToken;
  const tokenToUse = trimmedToken;
  
  // Check if encrypted
  if (!encryptedData || typeof encryptedData !== 'object' || !('encrypted' in encryptedData)) {
    // Not encrypted, return as-is (backward compatibility)
    return encryptedData;
  }

  const encrypted = encryptedData as EncryptedData;

  if (!encrypted.encrypted) {
    return encryptedData;
  }

  if (!tokenToUse || tokenToUse.length < 10) {
    throw new Error('Valid JWT token is required for decryption');
  }
  
  // DEBUG: Log token details for /auth/me debugging
  // const shouldLog = encrypted.tokenHash && encrypted.data;
  // if (shouldLog) {
  //   console.log('[decryptWithJWT] Decrypting with token:', {
  //     rawTokenLength: rawToken?.length || 0,
  //     trimmedTokenLength: trimmedToken?.length || 0,
  //     wasTrimmed,
  //     rawTokenPrefix: rawToken ? rawToken.substring(0, 20) + '...' : 'none',
  //     trimmedTokenPrefix: trimmedToken ? trimmedToken.substring(0, 20) + '...' : 'none',
  //     rawTokenSuffix: rawToken ? '...' + rawToken.substring(rawToken.length - 10) : 'none',
  //     trimmedTokenSuffix: trimmedToken ? '...' + trimmedToken.substring(trimmedToken.length - 10) : 'none',
  //     storedTokenHash: encrypted.tokenHash,
  //     hasEncryptedData: !!encrypted.data,
  //   });
  // }
  
  // Use trimmed token for all operations
  token = tokenToUse;

  // Extract metadata
  const salt = base64ToArrayBuffer(encrypted.salt);
  const iv = base64ToArrayBuffer(encrypted.iv);
  const encryptedDataBuffer = base64ToArrayBuffer(encrypted.data);

  // Verify token hash matches (if present)
  if (encrypted.tokenHash) {
    const tokenHash = await hashToken(token);
    const tokenHashMatches = encrypted.tokenHash === tokenHash;
    
    // DEBUG: Log token hash comparison
    // if (shouldLog) {
    //   console.log('[decryptWithJWT] Token hash comparison:', {
    //     storedTokenHash: encrypted.tokenHash,
    //     computedTokenHash: tokenHash,
    //     hashesMatch: tokenHashMatches,
    //     storedTokenHashLength: encrypted.tokenHash?.length || 0,
    //     computedTokenHashLength: tokenHash?.length || 0,
    //     tokenLength: token?.length || 0,
    //     tokenPrefix: token ? token.substring(0, 20) + '...' : 'none',
    //     tokenSuffix: token ? '...' + token.substring(token.length - 10) : 'none',
    //     rawTokenLength: rawToken?.length || 0,
    //     rawTokenPrefix: rawToken ? rawToken.substring(0, 20) + '...' : 'none',
    //     wasTrimmed,
    //   });
    // }
    
    if (!tokenHashMatches) {
      const errorMessage = 'Decryption failed - token does not match. ' +
        'The token used for decryption does not match the token used for encryption.';
      console.error('[decryptWithJWT] Token hash mismatch:', {
        error: errorMessage,
        storedTokenHash: encrypted.tokenHash,
        computedTokenHash: tokenHash,
        tokenLength: token?.length || 0,
        tokenPrefix: token ? token.substring(0, 20) + '...' : 'none',
        tokenSuffix: token ? '...' + token.substring(token.length - 10) : 'none',
        rawTokenLength: rawToken?.length || 0,
        rawTokenPrefix: rawToken ? rawToken.substring(0, 20) + '...' : 'none',
        wasTrimmed,
      });
      throw new Error(errorMessage);
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

// ============ Binary Encryption API (Optimized for File Storage) ============

/**
 * Compress data using gzip (default compression for Cloudflare Workers)
 * 
 * @param data - Data to compress
 * @returns Compressed data as Uint8Array
 */
async function compressData(data: Uint8Array & { buffer: ArrayBuffer }): Promise<Uint8Array> {
  const stream = new CompressionStream('gzip');
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  
  // Write data to compression stream (data is already typed with ArrayBuffer)
  writer.write(data);
  writer.close();
  
  // Read compressed chunks
  const chunks: Uint8Array[] = [];
  let done = false;
  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (value) {
      chunks.push(value);
    }
  }
  
  // Combine chunks into single Uint8Array
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  return result;
}

/**
 * Decompress gzip data
 * 
 * @param compressedData - Compressed data to decompress
 * @returns Decompressed data as Uint8Array
 */
async function decompressData(compressedData: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream('gzip');
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  
  // Write compressed data to decompression stream
  // Convert to ArrayBuffer if needed to satisfy BufferSource type
  let dataBuffer: Uint8Array & { buffer: ArrayBuffer };
  if (compressedData.buffer instanceof ArrayBuffer) {
    dataBuffer = compressedData as Uint8Array & { buffer: ArrayBuffer };
  } else {
    // SharedArrayBuffer - need to create a copy
    const arrayBuffer = compressedData.buffer.slice(compressedData.byteOffset, compressedData.byteOffset + compressedData.byteLength) as unknown as ArrayBuffer;
    dataBuffer = new Uint8Array(arrayBuffer) as Uint8Array & { buffer: ArrayBuffer };
  }
  writer.write(dataBuffer);
  writer.close();
  
  // Read decompressed chunks
  const chunks: Uint8Array[] = [];
  let done = false;
  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (value) {
      chunks.push(value);
    }
  }
  
  // Combine chunks into single Uint8Array
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  return result;
}

/**
 * Encrypt binary data (ArrayBuffer) directly without base64/JSON overhead
 * 
 * This function is optimized for file encryption, eliminating the 40-45% overhead
 * from base64 encoding and JSON wrapping. It stores encrypted binary data with
 * a minimal metadata header.
 * 
 * **Compression is enabled by default** to maximize Cloudflare free tier efficiency.
 * Data is compressed with gzip before encryption to reduce storage and bandwidth.
 * 
 * Format (Version 5):
 * [1 byte version][1 byte compressed][1 byte saltLen][1 byte ivLen][1 byte hashLen]
 * [salt (16 bytes)][iv (12 bytes)][tokenHash (32 bytes)][encryptedData (variable)]
 * 
 * @param data - Binary data to encrypt (ArrayBuffer or Uint8Array)
 * @param token - JWT token for key derivation
 * @returns Encrypted binary data with metadata header (Uint8Array)
 * 
 * @throws Error if token is invalid or encryption fails
 */
export async function encryptBinaryWithJWT(
  data: ArrayBuffer | Uint8Array,
  token: string
): Promise<Uint8Array> {
  if (!token || token.length < 10) {
    throw new Error('Valid JWT token is required for encryption');
  }

  // Ensure dataBuffer is a Uint8Array with ArrayBuffer (not ArrayBufferLike)
  // This prevents type errors with crypto.subtle.encrypt which requires BufferSource
  // Optimize: avoid unnecessary copies when possible
  let dataBuffer: Uint8Array & { buffer: ArrayBuffer };
  if (data instanceof ArrayBuffer) {
    // Direct ArrayBuffer - no copy needed
    dataBuffer = new Uint8Array(data) as Uint8Array & { buffer: ArrayBuffer };
  } else {
    // Uint8Array input - check if buffer is ArrayBuffer (not SharedArrayBuffer)
    // Only create copy if necessary (SharedArrayBuffer or non-zero offset/length)
    if (data.buffer instanceof SharedArrayBuffer || 
        data.byteOffset !== 0 || 
        data.byteLength !== data.buffer.byteLength) {
      // Need to create a copy - slice() always returns ArrayBuffer
      const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
      dataBuffer = new Uint8Array(arrayBuffer) as Uint8Array & { buffer: ArrayBuffer };
    } else {
      // Can use directly - buffer is ArrayBuffer and covers full range
      // Type assertion needed because TypeScript can't infer ArrayBuffer vs SharedArrayBuffer
      dataBuffer = new Uint8Array(data.buffer as ArrayBuffer) as Uint8Array & { buffer: ArrayBuffer };
    }
  }

  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Derive key from token
  const key = await deriveKeyFromToken(token, salt);

  // Hash token for verification
  const tokenHashHex = await hashToken(token);
  const tokenHash = new Uint8Array(32); // SHA-256 = 32 bytes
  for (let i = 0; i < 32; i++) {
    tokenHash[i] = parseInt(tokenHashHex.substr(i * 2, 2), 16);
  }

  // CRITICAL: Compress data before encryption (default, always enabled)
  // This maximizes Cloudflare free tier efficiency by reducing storage and bandwidth
  const compressedData = await compressData(dataBuffer);
  
  // Only use compression if it actually reduces size (compression overhead is ~18 bytes for gzip)
  // For very small data, compression might increase size
  const useCompression = compressedData.length < dataBuffer.length - 18;
  const dataToEncrypt: Uint8Array & { buffer: ArrayBuffer } = useCompression 
    ? (compressedData as Uint8Array & { buffer: ArrayBuffer })
    : dataBuffer;

  // Encrypt binary data directly
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    dataToEncrypt
  );

  const encryptedArray = new Uint8Array(encrypted);

  // Build binary format: [header][salt][iv][tokenHash][encryptedData]
  // Version 5: Added compression flag
  const headerSize = 5; // version + compressed + saltLen + ivLen + hashLen
  const totalSize = headerSize + salt.length + iv.length + tokenHash.length + encryptedArray.length;
  const result = new Uint8Array(totalSize);
  let offset = 0;

  // Header
  result[offset++] = 5; // Version 5: binary format with compression support
  result[offset++] = useCompression ? 1 : 0; // Compression flag (1 = compressed, 0 = uncompressed)
  result[offset++] = salt.length;
  result[offset++] = iv.length;
  result[offset++] = tokenHash.length;

  // Salt
  result.set(salt, offset);
  offset += salt.length;

  // IV
  result.set(iv, offset);
  offset += iv.length;

  // Token hash
  result.set(tokenHash, offset);
  offset += tokenHash.length;

  // Encrypted data
  result.set(encryptedArray, offset);

  return result;
}

/**
 * Decrypt binary encrypted data
 * 
 * Supports both Version 4 (uncompressed) and Version 5 (with compression) formats
 * for backward compatibility.
 * 
 * @param encryptedBinary - Binary encrypted data with header (ArrayBuffer or Uint8Array)
 * @param token - JWT token for decryption (or deterministic token for public files)
 * @param options - Optional decryption options
 * @param options.publicModToken - If provided, use this token for key derivation instead of verifying token hash (for public mods)
 * @returns Decrypted binary data (Uint8Array)
 * 
 * @throws Error if token doesn't match or decryption fails
 */
export async function decryptBinaryWithJWT(
  encryptedBinary: ArrayBuffer | Uint8Array,
  token: string
): Promise<Uint8Array> {
  if (!token || token.length < 10) {
    throw new Error('Valid JWT token is required for decryption');
  }

  // CRITICAL: Trim token to ensure it matches the token used for encryption
  // This prevents mismatches due to whitespace differences
  const trimmedToken = token.trim();

  const data = encryptedBinary instanceof ArrayBuffer 
    ? new Uint8Array(encryptedBinary) 
    : encryptedBinary;

  if (data.length < 4) {
    throw new Error('Invalid encrypted binary format: too short');
  }

  // Parse header
  let offset = 0;
  const version = data[offset++];
  
  // Support both Version 4 (legacy, no compression) and Version 5 (with compression)
  if (version !== 4 && version !== 5) {
    throw new Error(`Unsupported binary encryption version: ${version}`);
  }

  // Version 5 has compression flag, Version 4 doesn't
  let isCompressed = false;
  if (version === 5) {
    isCompressed = data[offset++] === 1;
  }

  const saltLength = data[offset++];
  const ivLength = data[offset++];
  const tokenHashLength = data[offset++];

  // Validate lengths
  if (saltLength !== SALT_LENGTH || ivLength !== IV_LENGTH || tokenHashLength !== 32) {
    throw new Error('Invalid encrypted binary format: invalid header lengths');
  }

  // Extract components
  const salt = data.slice(offset, offset + saltLength);
  offset += saltLength;

  const iv = data.slice(offset, offset + ivLength);
  offset += ivLength;

  const storedTokenHash = data.slice(offset, offset + tokenHashLength);
  offset += tokenHashLength;

  const encryptedData = data.slice(offset);

  // Verify token hash (use trimmed token)
  const tokenHashHex = await hashToken(trimmedToken);
  const expectedTokenHash = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    expectedTokenHash[i] = parseInt(tokenHashHex.substr(i * 2, 2), 16);
  }

  // Constant-time comparison
  let hashMatch = true;
  for (let i = 0; i < 32; i++) {
    if (storedTokenHash[i] !== expectedTokenHash[i]) {
      hashMatch = false;
    }
  }

  if (!hashMatch) {
    throw new Error(
      'Decryption failed - token does not match. ' +
      'Only authenticated users (with email OTP access) can decrypt this data. ' +
      'This usually means the token was refreshed or changed since the file was encrypted.'
    );
  }

  // Derive key from token (use trimmed token)
  const key = await deriveKeyFromToken(trimmedToken, salt);

  // Decrypt
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encryptedData
    );

    const decryptedData = new Uint8Array(decrypted);

    // Decompress if data was compressed (Version 5 with compression flag)
    if (isCompressed) {
      return await decompressData(decryptedData);
    }

    return decryptedData;
  } catch (error) {
    throw new Error(
      'Decryption failed - incorrect token or corrupted data. ' +
      'Only authenticated users (with email OTP access) can decrypt this data.'
    );
  }
}

