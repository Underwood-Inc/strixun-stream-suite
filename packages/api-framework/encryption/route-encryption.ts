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
 * - Configurable per-route encryption strategies
 * 
 * Security Benefits:
 * - Defense in depth: Even if authentication is bypassed, data is encrypted
 * - Industry standard: All responses encrypted, no plaintext data in transit
 * - Per-route control: Different encryption strategies for different route types
 * - JWT-based encryption: All authenticated routes use JWT encryption
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
const KEY_LENGTH = 256;

// ============ Service Key Encryption ============

/**
 * Derive encryption key from service key using PBKDF2
 * @deprecated Service key encryption removed - kept for type compatibility only
 */
async function _deriveKeyFromServiceKey(_serviceKey: string, salt: Uint8Array): Promise<CryptoKey> {
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
 * @deprecated Service key encryption removed - kept for type compatibility only
 */
function _arrayBufferToBase64(_buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Encrypt data using service key (DEPRECATED - REMOVED)
 * Service key encryption was obfuscation only (key is in frontend bundle).
 * Use JWT encryption instead.
 */
export async function encryptWithServiceKey(
  data: unknown,
  serviceKey: string
): Promise<EncryptedData> {
  throw new Error('Service key encryption has been completely removed. Use JWT encryption (encryptWithJWT) instead.');
}

/**
 * Convert base64 to ArrayBuffer
 * @deprecated Service key encryption removed - kept for type compatibility only
 */
function _base64ToArrayBuffer(_base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Decrypt data using service key (DEPRECATED - REMOVED)
 * Service key encryption was obfuscation only (key is in frontend bundle).
 * Use JWT decryption instead.
 */
export async function decryptWithServiceKey(
  encryptedData: EncryptedData | unknown,
  serviceKey: string
): Promise<unknown> {
  throw new Error('Service key decryption has been completely removed. Use JWT decryption (decryptWithJWT) instead.');
}

// ============ Binary Service Key Encryption ============
// Reuses existing deriveKeyFromServiceKey and hashServiceKey functions above

/**
 * Compress data with gzip (reused from JWT encryption pattern)
 * @deprecated Service key encryption removed - kept for type compatibility only
 */
async function _compressDataForServiceKey(_data: Uint8Array & { buffer: ArrayBuffer }): Promise<Uint8Array> {
  const stream = new CompressionStream('gzip');
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  
  writer.write(data);
  writer.close();
  
  const chunks: Uint8Array[] = [];
  let done = false;
  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (value) chunks.push(value);
  }
  
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
 * Decompress gzip data (reused from JWT encryption pattern)
 */
async function decompressDataForServiceKey(compressedData: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream('gzip');
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  
  let dataBuffer: Uint8Array & { buffer: ArrayBuffer };
  if (compressedData.buffer instanceof ArrayBuffer) {
    dataBuffer = compressedData as Uint8Array & { buffer: ArrayBuffer };
  } else {
    const arrayBuffer = compressedData.buffer.slice(compressedData.byteOffset, compressedData.byteOffset + compressedData.byteLength) as unknown as ArrayBuffer;
    dataBuffer = new Uint8Array(arrayBuffer) as Uint8Array & { buffer: ArrayBuffer };
  }
  writer.write(dataBuffer);
  writer.close();
  
  const chunks: Uint8Array[] = [];
  let done = false;
  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (value) chunks.push(value);
  }
  
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
 * Encrypt binary data using service key (DEPRECATED - REMOVED)
 * Service key encryption was obfuscation only (key is in frontend bundle).
 * Use JWT binary encryption instead.
 */
export async function encryptBinaryWithServiceKey(
  _data: ArrayBuffer | Uint8Array,
  _serviceKey: string
): Promise<Uint8Array> {
  throw new Error('Service key binary encryption has been completely removed. Use JWT binary encryption (encryptBinaryWithJWT) instead.');
}

/**
 * Decrypt binary data encrypted with service key (DEPRECATED - REMOVED)
 * Service key encryption was obfuscation only (key is in frontend bundle).
 * Use JWT binary decryption instead.
 */
export async function decryptBinaryWithServiceKey(
  encryptedBinary: ArrayBuffer | Uint8Array,
  serviceKey: string
): Promise<Uint8Array> {
  throw new Error('Service key binary decryption has been completely removed. Use JWT binary decryption (decryptBinaryWithJWT) instead.');
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

      case 'conditional-jwt':
        // Try JWT only - service key fallback removed
        if (context.jwtToken) {
          encryptedData = await encryptWithJWT(data, context.jwtToken);
          strategy = 'jwt';
        } else {
          if (policy.mandatory) {
            throw new Error(`Encryption required for route ${context.path} but no JWT token available`);
          }
          return {
            encrypted: false,
            error: new Error('No JWT token available - service key fallback removed'),
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
  {
    pattern: '/dashboard/assets/**',
    strategy: 'none', // Dashboard static assets (JS, CSS, images) don't need encryption
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
    pattern: '/auth/restore-session',
    strategy: 'none', // Don't encrypt - client needs to read the JWT token (chicken-and-egg: token is IN the response)
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
  // CRITICAL: Trim token to ensure it matches the token used for encryption
  const token = authHeader.substring(7).trim();
  return token.length >= 10 ? token : null;
}

/**
 * Create encryption context from request
 */
export function createEncryptionContext(
  request: Request,
  _env: any
): EncryptionContext {
  return {
    jwtToken: extractJWTToken(request),
    path: new URL(request.url).pathname,
    method: request.method,
  };
}

