/**
 * Per-Route Encryption System
 * 
 * Industry-standard encryption middleware that ensures ALL routes encrypt responses
 * with appropriate keys based on route type and authentication status.
 * 
 * Architecture:
 * - Route-level encryption policies define encryption requirements
 * - Centralized middleware enforces encryption for all routes
 * - JWT-based encryption for authenticated routes
 * - Service key encryption for public routes (when no JWT available)
 * - Configurable per-route encryption strategies
 * 
 * Security Benefits:
 * - Defense in depth: Even if authentication is bypassed, data is encrypted
 * - Industry standard: All responses encrypted, no plaintext data in transit
 * - Per-route control: Different encryption strategies for different route types
 * - Key isolation: Public routes use service keys, authenticated routes use JWT
 */

import type { EncryptedData } from './types.js';
import { encryptWithJWT } from './jwt-encryption.js';

// ============ Types ============

/**
 * Encryption strategy for a route
 */
export type EncryptionStrategy = 
  | 'jwt'              // Use JWT token (authenticated routes)
  | 'service-key'      // Use service key (public routes)
  | 'conditional-jwt'  // Use JWT if available, fallback to service key
  | 'none';            // No encryption (only for special cases like health checks)

/**
 * Route encryption policy
 */
export interface RouteEncryptionPolicy {
  /** Route pattern (supports wildcards: /api/*, /user/**) */
  pattern: string;
  /** Encryption strategy for this route */
  strategy: EncryptionStrategy;
  /** Whether encryption is mandatory (throws error if encryption fails) */
  mandatory?: boolean;
  /** Custom condition for when to apply this policy */
  condition?: (request: Request) => boolean;
}

/**
 * Encryption context for a request
 */
export interface EncryptionContext {
  /** JWT token if available */
  jwtToken: string | null;
  /** Service key for public routes */
  serviceKey: string | null;
  /** Route path */
  path: string;
  /** Request method */
  method: string;
}

/**
 * Encryption result
 */
export interface EncryptionResult {
  /** Whether encryption was applied */
  encrypted: boolean;
  /** Encrypted data (if encrypted) */
  encryptedData?: EncryptedData;
  /** Strategy used */
  strategy?: EncryptionStrategy;
  /** Error if encryption failed */
  error?: Error;
}

// ============ Constants ============

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;

// ============ Service Key Encryption ============

/**
 * Derive encryption key from service key using PBKDF2
 */
async function deriveKeyFromServiceKey(serviceKey: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(serviceKey),
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
 * Hash service key for verification
 */
async function hashServiceKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert ArrayBuffer to base64
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
 * Encrypt data using service key (for public routes)
 */
async function encryptWithServiceKey(
  data: unknown,
  serviceKey: string
): Promise<EncryptedData> {
  if (!serviceKey || serviceKey.length < 32) {
    throw new Error('Valid service key is required for encryption (minimum 32 characters)');
  }

  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Derive key from service key
  const key = await deriveKeyFromServiceKey(serviceKey, salt);

  // Hash service key for verification
  const keyHash = await hashServiceKey(serviceKey);

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
    iv: arrayBufferToBase64(iv.buffer),
    salt: arrayBufferToBase64(salt.buffer),
    tokenHash: keyHash, // Reuse tokenHash field for service key hash
    data: arrayBufferToBase64(encrypted),
    timestamp: new Date().toISOString(),
  };
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
 * Decrypt data using service key
 * 
 * @param encryptedData - Encrypted data blob
 * @param serviceKey - Service encryption key
 * @returns Decrypted data
 * 
 * @throws Error if service key doesn't match or decryption fails
 */
export async function decryptWithServiceKey(
  encryptedData: EncryptedData | unknown,
  serviceKey: string
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

  if (!serviceKey || serviceKey.length < 32) {
    throw new Error('Valid service key is required for decryption (minimum 32 characters)');
  }

  // Extract metadata
  const salt = base64ToArrayBuffer(encrypted.salt);
  const iv = base64ToArrayBuffer(encrypted.iv);
  const encryptedDataBuffer = base64ToArrayBuffer(encrypted.data);

  // Verify service key hash matches (if present)
  if (encrypted.tokenHash) {
    const keyHash = await hashServiceKey(serviceKey);
    if (encrypted.tokenHash !== keyHash) {
      throw new Error(
        'Decryption failed - service key does not match. ' +
        'The service key used for encryption does not match the provided key.'
      );
    }
  }

  // Derive key from service key
  const key = await deriveKeyFromServiceKey(serviceKey, new Uint8Array(salt));

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
      'Decryption failed - incorrect service key or corrupted data. ' +
      'Please verify the service key matches the one used for encryption.'
    );
  }
}

// ============ Route Pattern Matching ============

/**
 * Check if a path matches a route pattern
 * Supports wildcards: /api/*, /user/**
 */
function matchesPattern(path: string, pattern: string): boolean {
  // Exact match
  if (path === pattern) {
    return true;
  }

  // Convert pattern to regex
  const regexPattern = pattern
    .replace(/\*\*/g, '.*')  // ** matches any path
    .replace(/\*/g, '[^/]*') // * matches any segment
    .replace(/\//g, '\\/');  // Escape slashes

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

/**
 * Find matching encryption policy for a route
 */
export function findMatchingPolicy(
  path: string,
  policies: RouteEncryptionPolicy[],
  request?: Request
): RouteEncryptionPolicy | null {
  for (const policy of policies) {
    if (matchesPattern(path, policy.pattern)) {
      // Check custom condition if provided
      if (policy.condition && request) {
        if (!policy.condition(request)) {
          continue;
        }
      }
      return policy;
    }
  }
  return null;
}

// ============ Encryption Logic ============

/**
 * Encrypt response data based on encryption context and policy
 */
export async function encryptResponse(
  data: unknown,
  context: EncryptionContext,
  policy: RouteEncryptionPolicy
): Promise<EncryptionResult> {
  try {
    let encryptedData: EncryptedData;
    let strategy: EncryptionStrategy;

    switch (policy.strategy) {
      case 'jwt':
        if (!context.jwtToken) {
          if (policy.mandatory) {
            throw new Error(`JWT token required for route ${context.path} but not provided`);
          }
          return {
            encrypted: false,
            error: new Error('JWT token required but not available'),
          };
        }
        encryptedData = await encryptWithJWT(data, context.jwtToken);
        strategy = 'jwt';
        break;

      case 'service-key':
        if (!context.serviceKey) {
          if (policy.mandatory) {
            throw new Error(`Service key required for route ${context.path} but not configured`);
          }
          return {
            encrypted: false,
            error: new Error('Service key required but not configured'),
          };
        }
        encryptedData = await encryptWithServiceKey(data, context.serviceKey);
        strategy = 'service-key';
        break;

      case 'conditional-jwt':
        // Try JWT first, fallback to service key
        if (context.jwtToken) {
          encryptedData = await encryptWithJWT(data, context.jwtToken);
          strategy = 'jwt';
        } else if (context.serviceKey) {
          encryptedData = await encryptWithServiceKey(data, context.serviceKey);
          strategy = 'service-key';
        } else {
          if (policy.mandatory) {
            throw new Error(`Encryption required for route ${context.path} but no key available`);
          }
          return {
            encrypted: false,
            error: new Error('No encryption key available (JWT or service key)'),
          };
        }
        break;

      case 'none':
        return {
          encrypted: false,
          strategy: 'none',
        };

      default:
        throw new Error(`Unknown encryption strategy: ${policy.strategy}`);
    }

    return {
      encrypted: true,
      encryptedData,
      strategy,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (policy.mandatory) {
      throw err;
    }
    return {
      encrypted: false,
      error: err,
    };
  }
}

// ============ Default Policies ============

/**
 * Default encryption policies for common route patterns
 * These can be overridden or extended per service
 */
export const DEFAULT_ENCRYPTION_POLICIES: RouteEncryptionPolicy[] = [
  // Root and static assets - don't encrypt (HTML, JS, CSS, etc.)
  {
    pattern: '/',
    strategy: 'none', // Root path typically serves dashboard HTML
  },
  {
    pattern: '/assets/**',
    strategy: 'none', // Static assets (JS, CSS, images) don't need encryption
  },
  
  // Public routes - don't encrypt (clients need to read responses without JWT/service key)
  {
    pattern: '/signup',
    strategy: 'none', // Don't encrypt - client needs to read success/error messages
  },
  {
    pattern: '/signup/**',
    strategy: 'none', // Don't encrypt - client needs to read API keys, JWT tokens, customer info
  },
  {
    pattern: '/health',
    strategy: 'none', // Health checks don't need encryption
  },
  {
    pattern: '/health/**',
    strategy: 'none',
  },
  {
    pattern: '/openapi.json',
    strategy: 'none', // API docs can be public
  },
  {
    pattern: '/track/**',
    strategy: 'service-key',
    mandatory: true,
  },

  // Auth routes - don't encrypt endpoints that clients need to read before authentication
  {
    pattern: '/auth/request-otp',
    strategy: 'none', // Don't encrypt - client needs to read success/error, rate limit info
  },
  {
    pattern: '/auth/verify-otp',
    strategy: 'none', // Don't encrypt - client needs to read the JWT token
  },
  {
    pattern: '/auth/**',
    strategy: 'conditional-jwt',
    mandatory: true,
  },

  // Protected routes - require JWT
  {
    pattern: '/user/**',
    strategy: 'jwt',
    mandatory: true,
  },
  {
    pattern: '/game/**',
    strategy: 'jwt',
    mandatory: true,
  },
  {
    pattern: '/admin/**',
    strategy: 'jwt',
    mandatory: true,
  },

  // Default catch-all - encrypt with available key
  {
    pattern: '/**',
    strategy: 'conditional-jwt',
    mandatory: false, // Allow fallback for unknown routes
  },
];

// ============ Helper Functions ============

/**
 * Extract JWT token from request
 */
export function extractJWTToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  return token.length >= 10 ? token : null;
}

/**
 * Get service key from environment
 * Service key should be stored as a Cloudflare Worker secret
 */
export function getServiceKey(env: any): string | null {
  // Service key should be set as: wrangler secret put SERVICE_ENCRYPTION_KEY
  return env.SERVICE_ENCRYPTION_KEY || null;
}

/**
 * Create encryption context from request
 */
export function createEncryptionContext(
  request: Request,
  env: any
): EncryptionContext {
  return {
    jwtToken: extractJWTToken(request),
    serviceKey: getServiceKey(env),
    path: new URL(request.url).pathname,
    method: request.method,
  };
}

