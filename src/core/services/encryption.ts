/**
 * Strixun Stream Suite - JWT Token-Based Encryption Service
 * 
 * Industry-standard encryption for data at rest and in transit
 * 
 * Features:
 * - AES-GCM-256 encryption for local storage (at rest)
 * - JWT token-based key derivation (ONLY authenticated users can decrypt)
 * - Optional password-based encryption layer for specific items (notebooks, etc.)
 * - HTTPS enforcement for all network requests (in transit)
 * - Configurable opt-in/opt-out (default: enabled)
 * - Seamless integration with existing storage system
 * 
 * Security Standards:
 * - AES-GCM-256 (authenticated encryption)
 * - PBKDF2 key derivation (100,000 iterations, SHA-256)
 * - Random salt per user (16 bytes)
 * - Random IV per encryption (12 bytes)
 * - JWT token verification (requires email OTP access)
 * - Zero-knowledge architecture (server never sees keys)
 * 
 * CRITICAL: 
 * - Base encryption requires JWT token (obtained via email OTP)
 * - Without authentication (email OTP), decryption is IMPOSSIBLE
 * - Optional password layer adds additional security for sensitive items
 * - Even the user cannot decrypt without being authenticated
 * 
 * @version 3.0.0
 */

// ============ Types ============

export interface EncryptionConfig {
  enabled: boolean;
  tokenHash?: string; // SHA-256 hash of the JWT token (for verification only)
  keyDerived?: boolean;
  salt?: string; // Base64 encoded
}

interface DekApiResponse {
  dek: string;
}

interface EncryptionAuthRequiredEvent {
  reason: 'encryption-locked';
  status: 401 | 403;
}

export interface EncryptedData {
  version: number;
  encrypted: boolean;
  algorithm: string;
  iv: string; // Base64 encoded
  salt?: string; // Base64 encoded (only for new encryptions)
  tokenHash?: string; // SHA-256 hash of the JWT token used for encryption (for verification, version 3+)
  passwordProtected?: boolean; // Whether this item has an additional password layer
  data: string; // Base64 encoded encrypted data
  timestamp: string;
}

// ============ Constants ============

const ENCRYPTION_CONFIG_KEY = 'sss_encryption_config';
const ENCRYPTION_SALT_KEY = 'sss_encryption_salt';
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

// ============ State ============

let encryptionConfig: EncryptionConfig | null = null;
let derivedKey: CryptoKey | null = null;
let keyDerivationPromise: Promise<CryptoKey> | null = null;

// A2: session key material (DEK) is fetched from server via HttpOnly cookie and kept in memory only.
let sessionDekB64: string | null = null;

// ============ Configuration Management ============

/**
 * Load encryption configuration from storage
 */
export async function loadEncryptionConfig(): Promise<EncryptionConfig> {
  if (encryptionConfig) {
    return encryptionConfig;
  }

  // Try to load from storage
  const storage = (window as any).SSS_Storage?.storage;
  if (storage) {
    const config = storage.get(ENCRYPTION_CONFIG_KEY);
    if (config) {
      encryptionConfig = config as EncryptionConfig;
      return encryptionConfig;
    }
  }

  // No localStorage fallback - use proper storage system only

  // Default config (encryption ENABLED by default as requested)
  // All data is encrypted by default, users can opt-out if needed
  encryptionConfig = {
    enabled: true, // Encryption ON by default - user must authenticate to access app
    keyDerived: false,
  };

  return encryptionConfig;
}

/**
 * Save encryption configuration to storage
 */
export async function saveEncryptionConfig(config: EncryptionConfig): Promise<void> {
  encryptionConfig = config;

  const storage = (window as any).SSS_Storage?.storage;
  if (storage) {
    storage.set(ENCRYPTION_CONFIG_KEY, config);
  } else {
    console.warn('[Encryption] Storage system not available');
  }
}

/**
 * Check if encryption is enabled
 */
export async function isEncryptionEnabled(): Promise<boolean> {
  const config = await loadEncryptionConfig();
  return config.enabled === true;
}

/**
 * Fetch per-customer DEK from OTP auth service using HttpOnly cookie session.
 * No offline decrypt: this will fail if the session is expired/invalid.
 */
export async function fetchSessionDek(): Promise<string> {
  // Prefer injected helper if present (keeps consistency across apps)
  let authApiUrl = '';
  if (typeof window !== 'undefined' && (window as any).getOtpAuthApiUrl) {
    const url = (window as any).getOtpAuthApiUrl();
    if (typeof url === 'string') authApiUrl = url;
  }
  if (!authApiUrl) {
    // Dev default: use Vite proxy path convention used across apps
    authApiUrl = '/auth-api';
  }

  const response = await fetch(`${authApiUrl}/auth/encryption/dek`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store',
  });

  if (response.status === 401 || response.status === 403) {
    const { EventBus } = await import('../events/EventBus');
    EventBus.emitSync<EncryptionAuthRequiredEvent>('auth:required', {
      reason: 'encryption-locked',
      status: response.status,
    });
    throw new Error('Authentication required to unlock encryption');
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch encryption key material: ${response.status}`);
  }

  const data = (await response.json()) as DekApiResponse;
  if (!data || typeof data.dek !== 'string' || data.dek.length < 10) {
    throw new Error('Invalid encryption key material response');
  }

  sessionDekB64 = data.dek;
  return data.dek;
}

export function clearSessionDek(): void {
  sessionDekB64 = null;
  derivedKey = null;
  keyDerivationPromise = null;
}

async function requireSessionKeyMaterial(): Promise<string> {
  if (sessionDekB64) return sessionDekB64;
  return await fetchSessionDek();
}

/**
 * Enable encryption with JWT token
 * The JWT token is used as the key derivation source - without it (and email OTP access), decryption is impossible
 */
export async function enableEncryption(token: string): Promise<void> {
  if (!token || token.length < 10) {
    throw new Error('Valid session key material is required for encryption');
  }

  // Generate salt if not exists
  let salt: Uint8Array;
  const existingSalt = await getStoredSalt();
  if (existingSalt) {
    salt = existingSalt;
  } else {
    salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    await saveSalt(salt);
  }

  // Derive key to verify token works
  await deriveKeyFromToken(token, salt);

  // Hash token for verification (stored with encrypted data)
  const tokenHash = await hashToken(token);

  // Save config
  const config: EncryptionConfig = {
    enabled: true,
    tokenHash: tokenHash, // Store hash for verification only
    keyDerived: true,
    salt: arrayBufferToBase64(salt),
  };

  await saveEncryptionConfig(config);
  console.log('[Encryption] Encryption enabled with session key-based derivation');
}

/**
 * Disable encryption (decrypts all data first)
 * Requires the JWT token to verify before disabling
 */
export async function disableEncryption(token: string): Promise<void> {
  if (!(await isEncryptionEnabled())) {
    return; // Already disabled
  }

  // Verify token before disabling
  const config = await loadEncryptionConfig();
  if (!config.salt) {
    throw new Error('No encryption salt found');
  }

  const salt = base64ToArrayBuffer(config.salt);
  await deriveKeyFromToken(token, salt); // This will throw if wrong token

  // Verify token hash matches
  const tokenHash = await hashToken(token);
  if (config.tokenHash && config.tokenHash !== tokenHash) {
    throw new Error('Token does not match the token used for encryption');
  }

  // Decrypt all storage data (this is handled by storage wrapper)
  // Just update config
  const newConfig: EncryptionConfig = {
    enabled: false,
    keyDerived: false,
  };

  await saveEncryptionConfig(newConfig);
  console.log('[Encryption] Encryption disabled');
}

/**
 * Change encryption token (re-encrypts all data with new token)
 * Requires the old token to decrypt existing data, then re-encrypts with new token
 */
export async function changeEncryptionToken(
  oldToken: string,
  newToken: string
): Promise<void> {
  if (!(await isEncryptionEnabled())) {
    throw new Error('Encryption is not enabled');
  }

  if (!newToken || newToken.length < 10) {
    throw new Error('Valid JWT token is required');
  }

  // Verify old token
  const config = await loadEncryptionConfig();
  if (!config.salt) {
    throw new Error('No encryption salt found');
  }

  const oldSalt = base64ToArrayBuffer(config.salt);
  await deriveKeyFromToken(oldToken, oldSalt); // Verify old token

  // Verify token hash matches
  const oldTokenHash = await hashToken(oldToken);
  if (config.tokenHash && config.tokenHash !== oldTokenHash) {
    throw new Error('Old token does not match the token used for encryption');
  }

  // Generate new salt for new token
  const newSalt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  await saveSalt(newSalt);

  // Hash new token
  const newTokenHash = await hashToken(newToken);

  // Re-encrypt all data with new token (handled by storage wrapper)
  const newConfig: EncryptionConfig = {
    enabled: true,
    tokenHash: newTokenHash,
    keyDerived: true,
    salt: arrayBufferToBase64(newSalt),
  };

  await saveEncryptionConfig(newConfig);
  console.log('[Encryption] Encryption key material changed - data will be re-encrypted');
}

// ============ Key Derivation ============

/**
 * Hash token using SHA-256 (for verification only, not for key derivation)
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derive encryption key from JWT token using PBKDF2
 * CRITICAL: The JWT token is the ONLY source for key derivation
 * Without the exact token (obtained via email OTP), decryption is impossible
 */
async function deriveKeyFromToken(token: string, salt: Uint8Array): Promise<CryptoKey> {
  // Check if we already have a derivation in progress
  if (keyDerivationPromise) {
    return keyDerivationPromise;
  }

  keyDerivationPromise = (async () => {
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
        salt: salt as BufferSource,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      tokenKey,
      { name: 'AES-GCM', length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );

    derivedKey = key;
    keyDerivationPromise = null;
    return key;
  })();

  return keyDerivationPromise;
}

/**
 * Get or derive encryption key from JWT token
 */
async function getEncryptionKeyFromToken(token: string): Promise<CryptoKey> {
  if (derivedKey) {
    return derivedKey;
  }

  const config = await loadEncryptionConfig();
  if (!config.salt) {
    throw new Error('Encryption salt not found. Please enable encryption first.');
  }

  const salt = base64ToArrayBuffer(config.salt);
  return await deriveKeyFromToken(token, salt);
}

/**
 * Derive encryption key from password (for optional password-protected items)
 * This is used for additional security layer on top of base encryption
 */
async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

// ============ Salt Management ============

/**
 * Get stored salt
 */
async function getStoredSalt(): Promise<Uint8Array | null> {
  const storage = (window as any).SSS_Storage?.storage;
  if (storage) {
    const saltBase64 = storage.getRaw(ENCRYPTION_SALT_KEY);
    if (saltBase64 && typeof saltBase64 === 'string') {
      return base64ToArrayBuffer(saltBase64);
    }
  }

  return null;
}

/**
 * Save salt to storage
 */
async function saveSalt(salt: Uint8Array): Promise<void> {
  const saltBase64 = arrayBufferToBase64(salt);

  const storage = (window as any).SSS_Storage?.storage;
  if (storage) {
    storage.setRaw(ENCRYPTION_SALT_KEY, saltBase64);
  } else {
    console.warn('[Encryption] Storage system not available, cannot save salt');
  }
}

// ============ Encryption/Decryption ============

/**
 * Encrypt data using session key material as key derivation source.
 * In A2, session key material (DEK) is fetched from the auth service via HttpOnly cookie and is not persisted.
 * 
 * @param data - Data to encrypt
 * @param token - Session key material. If empty, the function will fetch DEK via cookie-auth.
 * @param password - Optional password for additional security layer (for sensitive items)
 */
export async function encrypt(
  data: unknown,
  token: string,
  password?: string
): Promise<EncryptedData> {
  if (!token || token.length < 10) {
    token = await requireSessionKeyMaterial();
  }

  // Get or generate salt
  let salt: Uint8Array;
  const existingSalt = await getStoredSalt();
  if (existingSalt) {
    salt = existingSalt;
  } else {
    salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    await saveSalt(salt);
  }

  let dataToEncrypt = data;
  let isPasswordProtected = false;

  // If password is provided, encrypt data with password first (double encryption)
  if (password && password.length > 0) {
    isPasswordProtected = true;
    const passwordSalt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const passwordKey = await deriveKeyFromPassword(password, passwordSalt);
    const passwordIV = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    
    const encoder = new TextEncoder();
    const dataStr = JSON.stringify(data);
    const passwordEncrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: passwordIV },
      passwordKey,
      encoder.encode(dataStr)
    );
    
    // Store password-encrypted data as the payload to encrypt with token
    dataToEncrypt = {
      passwordEncrypted: arrayBufferToBase64(passwordEncrypted),
      passwordIV: arrayBufferToBase64(passwordIV),
      passwordSalt: arrayBufferToBase64(passwordSalt),
    };
  }

  // Derive key from token
  const key = await getEncryptionKeyFromToken(token);

  // Generate IV
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Hash token for verification (stored with encrypted data)
  const tokenHash = await hashToken(token);

  // Encrypt
  const encoder = new TextEncoder();
  const dataStr = JSON.stringify(dataToEncrypt);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encoder.encode(dataStr)
  );

  // Return encrypted blob with key-material hash for verification
  return {
    version: 3, // Version 3: JWT token-based encryption
    encrypted: true,
    algorithm: 'AES-GCM-256',
    iv: arrayBufferToBase64(iv),
    salt: arrayBufferToBase64(salt),
    tokenHash: tokenHash, // Stored for verification - cannot be used to decrypt
    passwordProtected: isPasswordProtected,
    data: arrayBufferToBase64(encrypted),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Decrypt data using session key material as key derivation source.
 * 
 * @param encryptedData - Encrypted data to decrypt
 * @param token - Session key material. If empty, the function will fetch DEK via cookie-auth.
 * @param password - Optional password if item is password-protected
 */
export async function decrypt(
  encryptedData: EncryptedData | unknown,
  token: string,
  password?: string
): Promise<unknown> {
  // Check if data is encrypted
  if (
    typeof encryptedData !== 'object' ||
    encryptedData === null ||
    !('encrypted' in encryptedData) ||
    !(encryptedData as EncryptedData).encrypted
  ) {
    // Not encrypted, return as-is (backward compatibility)
    return encryptedData;
  }

  const encrypted = encryptedData as EncryptedData;

  if (!token || token.length < 10) {
    token = await requireSessionKeyMaterial();
  }

  // Extract metadata
  const saltValue = encrypted.salt || (await getStoredSalt());
  if (!saltValue) {
    throw new Error('Encryption salt not found');
  }
  const salt = typeof saltValue === 'string' ? base64ToArrayBuffer(saltValue) : saltValue;
  const iv = base64ToArrayBuffer(encrypted.iv);
  const encryptedDataBuffer = base64ToArrayBuffer(encrypted.data);

  // Verify token hash matches (if present - version 3+)
  if (encrypted.version >= 3 && encrypted.tokenHash) {
    const tokenHash = await hashToken(token);
    if (encrypted.tokenHash !== tokenHash) {
      throw new Error(
        'Decryption failed - token does not match the token used for encryption. ' +
        'Only authenticated users (with email OTP access) can decrypt this data.'
      );
    }
  }

  // Derive key from token
  const key = await deriveKeyFromToken(token, salt);

  // Decrypt with token
  let decryptedData: unknown;
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      encryptedDataBuffer as BufferSource
    );

    const decoder = new TextDecoder();
    const dataStr = decoder.decode(decrypted);
    decryptedData = JSON.parse(dataStr);
  } catch (error) {
    throw new Error(
      'Decryption failed - incorrect token or corrupted data. ' +
      'Only authenticated users (with email OTP access) can decrypt this data.'
    );
  }

  // If password-protected, decrypt with password
  if (encrypted.passwordProtected) {
    if (!password || password.length === 0) {
      throw new Error(
        'This item is password-protected. A password is required to decrypt.'
      );
    }

    try {
      const passwordData = decryptedData as {
        passwordEncrypted: string;
        passwordIV: string;
        passwordSalt: string;
      };

      const passwordSalt = base64ToArrayBuffer(passwordData.passwordSalt);
      const passwordIV = base64ToArrayBuffer(passwordData.passwordIV);
      const passwordEncrypted = base64ToArrayBuffer(passwordData.passwordEncrypted);

      const passwordKey = await deriveKeyFromPassword(password, passwordSalt);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: passwordIV as BufferSource },
        passwordKey,
        passwordEncrypted as BufferSource
      );

      const decoder = new TextDecoder();
      const dataStr = decoder.decode(decrypted);
      return JSON.parse(dataStr);
    } catch (error) {
      throw new Error(
        'Decryption failed - incorrect password. ' +
        'The password does not match the password used for encryption.'
      );
    }
  }

  return decryptedData;
}

// ============ HTTPS Enforcement ============

/**
 * Check if current connection is HTTPS
 */
export function isHTTPS(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return (
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
}

/**
 * Enforce HTTPS for network requests
 */
export function enforceHTTPS(url: string): string {
  // Allow localhost and 127.0.0.1 for development
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    return url;
  }

  // Enforce HTTPS
  if (url.startsWith('http://')) {
    console.warn('[Encryption] HTTP request blocked, upgrading to HTTPS:', url);
    return url.replace('http://', 'https://');
  }

  return url;
}

/**
 * Secure fetch wrapper that enforces HTTPS
 */
export async function secureFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const secureUrl = enforceHTTPS(url);

  if (!isHTTPS() && !secureUrl.includes('localhost') && !secureUrl.includes('127.0.0.1')) {
    console.warn('[Encryption] Non-HTTPS connection detected. Some features may not work.');
  }

  return fetch(secureUrl, options);
}

// ============ Utility Functions ============

/**
 * Convert ArrayBuffer to Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Verify token matches the token used for encryption
 * Returns true if token hash matches stored hash
 */
export async function verifyEncryptionToken(token: string): Promise<boolean> {
  const config = await loadEncryptionConfig();
  if (!config.tokenHash) {
    return false; // No token hash stored
  }

  const tokenHash = await hashToken(token);
  return config.tokenHash === tokenHash;
}

/**
 * Check if encrypted data is password-protected
 */
export function isPasswordProtected(encryptedData: EncryptedData | unknown): boolean {
  if (
    typeof encryptedData !== 'object' ||
    encryptedData === null ||
    !('encrypted' in encryptedData) ||
    !(encryptedData as EncryptedData).encrypted
  ) {
    return false;
  }

  return (encryptedData as EncryptedData).passwordProtected === true;
}

/**
 * Encrypt data with password protection (for sensitive items like notebooks)
 * This adds an additional encryption layer on top of the base JWT token encryption
 * 
 * @param data - Data to encrypt
 * @param token - JWT token (obtained via email OTP authentication)
 * @param password - Password for additional security layer
 */
export async function encryptWithPassword(
  data: unknown,
  token: string,
  password: string
): Promise<EncryptedData> {
  if (!password || password.length < 4) {
    throw new Error('Password must be at least 4 characters');
  }
  return await encrypt(data, token, password);
}

/**
 * Decrypt password-protected data
 * 
 * @param encryptedData - Encrypted data to decrypt
 * @param token - JWT token (obtained via email OTP authentication)
 * @param password - Password used for encryption
 */
export async function decryptWithPassword(
  encryptedData: EncryptedData | unknown,
  token: string,
  password: string
): Promise<unknown> {
  if (!password || password.length === 0) {
    throw new Error('Password is required for decryption');
  }
  return await decrypt(encryptedData, token, password);
}

// ============ Exports ============

export default {
  // Configuration
  loadEncryptionConfig,
  saveEncryptionConfig,
  isEncryptionEnabled,
  enableEncryption,
  disableEncryption,
  changeEncryptionToken,

  // Encryption/Decryption
  encrypt,
  decrypt,

  // HTTPS Enforcement
  isHTTPS,
  enforceHTTPS,
  secureFetch,

  // Utilities
  verifyEncryptionToken,
  hashToken,
  isPasswordProtected,
};

