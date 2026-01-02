/**
 * Shared Key Binary Encryption
 * 
 * Encrypts/decrypts binary data using a shared encryption key
 * Used for mod files where any authenticated user should be able to decrypt
 * 
 * Works in both Cloudflare Workers and browser environments
 * Uses AES-GCM-256 encryption with PBKDF2 key derivation
 * 
 * @version 1.0.0
 */

// ============ Constants ============

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

// ============ Helper Functions ============

/**
 * Hash shared key for verification
 */
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derive encryption key from shared key using PBKDF2
 */
async function deriveKeyFromSharedKey(sharedKey: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(sharedKey),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Ensure salt is a proper BufferSource for deriveKey
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
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );

  return key;
}

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
  
  // Write data to compression stream
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

// ============ Public API ============

/**
 * Encrypt binary data using shared encryption key
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
 * [salt (16 bytes)][iv (12 bytes)][keyHash (32 bytes)][encryptedData (variable)]
 * 
 * @param data - Binary data to encrypt (ArrayBuffer or Uint8Array)
 * @param sharedKey - Shared encryption key (minimum 32 characters recommended)
 * @returns Encrypted binary data with metadata header (Uint8Array)
 * 
 * @throws Error if shared key is invalid or encryption fails
 */
export async function encryptBinaryWithSharedKey(
  data: ArrayBuffer | Uint8Array,
  sharedKey: string
): Promise<Uint8Array> {
  if (!sharedKey || sharedKey.length < 32) {
    throw new Error('Valid shared encryption key is required (minimum 32 characters)');
  }

  // Ensure dataBuffer is a Uint8Array with ArrayBuffer (not ArrayBufferLike)
  let dataBuffer: Uint8Array & { buffer: ArrayBuffer };
  if (data instanceof ArrayBuffer) {
    dataBuffer = new Uint8Array(data) as Uint8Array & { buffer: ArrayBuffer };
  } else {
    // Uint8Array input - check if buffer is ArrayBuffer (not SharedArrayBuffer)
    if (data.buffer instanceof SharedArrayBuffer || 
        data.byteOffset !== 0 || 
        data.byteLength !== data.buffer.byteLength) {
      // Need to create a copy
      const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
      dataBuffer = new Uint8Array(arrayBuffer) as Uint8Array & { buffer: ArrayBuffer };
    } else {
      // Can use directly
      dataBuffer = new Uint8Array(data.buffer as ArrayBuffer) as Uint8Array & { buffer: ArrayBuffer };
    }
  }

  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Derive key from shared key
  const key = await deriveKeyFromSharedKey(sharedKey, salt);

  // Hash shared key for verification
  const keyHashHex = await hashKey(sharedKey);
  const keyHash = new Uint8Array(32); // SHA-256 = 32 bytes
  for (let i = 0; i < 32; i++) {
    keyHash[i] = parseInt(keyHashHex.substr(i * 2, 2), 16);
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

  // Build binary format: [header][salt][iv][keyHash][encryptedData]
  // Version 5: Added compression flag (same format as JWT encryption for compatibility)
  const headerSize = 5; // version + compressed + saltLen + ivLen + hashLen
  const totalSize = headerSize + salt.length + iv.length + keyHash.length + encryptedArray.length;
  const result = new Uint8Array(totalSize);
  let offset = 0;

  // Header
  result[offset++] = 5; // Version 5: binary format with compression support
  result[offset++] = useCompression ? 1 : 0; // Compression flag (1 = compressed, 0 = uncompressed)
  result[offset++] = salt.length;
  result[offset++] = iv.length;
  result[offset++] = keyHash.length;

  // Salt
  result.set(salt, offset);
  offset += salt.length;

  // IV
  result.set(iv, offset);
  offset += iv.length;

  // Key hash
  result.set(keyHash, offset);
  offset += keyHash.length;

  // Encrypted data
  result.set(encryptedArray, offset);

  return result;
}

/**
 * Decrypt binary encrypted data using shared encryption key
 * 
 * Supports both Version 4 (uncompressed) and Version 5 (with compression) formats
 * for backward compatibility.
 * 
 * @param encryptedBinary - Binary encrypted data with header (ArrayBuffer or Uint8Array)
 * @param sharedKey - Shared encryption key (must match the key used for encryption)
 * @returns Decrypted binary data (Uint8Array)
 * 
 * @throws Error if shared key doesn't match or decryption fails
 */
export async function decryptBinaryWithSharedKey(
  encryptedBinary: ArrayBuffer | Uint8Array,
  sharedKey: string
): Promise<Uint8Array> {
  if (!sharedKey || sharedKey.length < 32) {
    throw new Error('Valid shared encryption key is required (minimum 32 characters)');
  }

  // Trim shared key to ensure consistency
  const trimmedKey = sharedKey.trim();

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
  const keyHashLength = data[offset++];

  // Validate lengths
  if (saltLength !== SALT_LENGTH || ivLength !== IV_LENGTH || keyHashLength !== 32) {
    throw new Error('Invalid encrypted binary format: invalid header lengths');
  }

  // Extract components
  const salt = data.slice(offset, offset + saltLength);
  offset += saltLength;

  const iv = data.slice(offset, offset + ivLength);
  offset += ivLength;

  const storedKeyHash = data.slice(offset, offset + keyHashLength);
  offset += keyHashLength;

  const encryptedData = data.slice(offset);

  // Verify key hash (use trimmed key)
  const keyHashHex = await hashKey(trimmedKey);
  const expectedKeyHash = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    expectedKeyHash[i] = parseInt(keyHashHex.substr(i * 2, 2), 16);
  }

  // Constant-time comparison
  let hashMatch = true;
  for (let i = 0; i < 32; i++) {
    if (storedKeyHash[i] !== expectedKeyHash[i]) {
      hashMatch = false;
    }
  }

  if (!hashMatch) {
    throw new Error(
      'Decryption failed - shared key does not match. ' +
      'The key used for decryption must match the key used for encryption.'
    );
  }

  // Derive key from shared key (use trimmed key)
  const key = await deriveKeyFromSharedKey(trimmedKey, salt);

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
      'Decryption failed - incorrect shared key or corrupted data. ' +
      'Please ensure you are using the correct shared encryption key.'
    );
  }
}
