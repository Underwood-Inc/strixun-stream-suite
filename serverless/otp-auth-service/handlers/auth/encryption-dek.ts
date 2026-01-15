/**
 * Encryption DEK (Data Encryption Key) Handler
 *
 * A2 architecture:
 * - Client encryption-at-rest key material is NOT the JWT string
 * - DEK is generated/stored server-side and only released to authenticated sessions (HttpOnly cookie)
 * - No offline decrypt: if session expires, client cannot retrieve DEK
 */

interface Env {
  OTP_AUTH_KV: KVNamespace;
  JWT_SECRET?: string;
  [key: string]: unknown;
}

interface StoredDekRecord {
  version: 1;
  createdAt: string;
  ivB64: string;
  ciphertextB64: string;
}

interface DekResponse {
  dek: string; // base64 raw 32-byte DEK
}

const DEK_KV_PREFIX = 'customer_dek_v1:';
const IV_LENGTH = 12; // AES-GCM standard IV size

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getMasterKey(env: Env): Promise<CryptoKey> {
  const secret = env.JWT_SECRET;
  if (!secret || typeof secret !== 'string' || secret.length < 16) {
    throw new Error('JWT_SECRET is required to protect DEK storage at rest');
  }

  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptDekForStorage(dekBytes: Uint8Array, masterKey: CryptoKey): Promise<StoredDekRecord> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, masterKey, dekBytes);
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    ivB64: toBase64(iv),
    ciphertextB64: toBase64(new Uint8Array(ciphertext)),
  };
}

async function decryptDekFromStorage(record: StoredDekRecord, masterKey: CryptoKey): Promise<Uint8Array> {
  const iv = fromBase64(record.ivB64);
  const ciphertext = fromBase64(record.ciphertextB64);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, masterKey, ciphertext);
  return new Uint8Array(plaintext);
}

/**
 * GET /auth/encryption/dek
 * Requires authenticated session (customerId provided by router after JWT/cookie validation).
 */
export async function handleGetEncryptionDek(
  _request: Request,
  env: Env,
  customerId: string
): Promise<Response> {
  const key = `${DEK_KV_PREFIX}${customerId}`;

  const masterKey = await getMasterKey(env);
  const existing = await env.OTP_AUTH_KV.get(key, { type: 'json' }) as StoredDekRecord | null;

  let dekBytes: Uint8Array;

  if (existing && existing.version === 1) {
    dekBytes = await decryptDekFromStorage(existing, masterKey);
  } else {
    dekBytes = crypto.getRandomValues(new Uint8Array(32));
    const record = await encryptDekForStorage(dekBytes, masterKey);
    await env.OTP_AUTH_KV.put(key, JSON.stringify(record));
  }

  const body: DekResponse = { dek: toBase64(dekBytes) };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // Explicitly disable caching
      'Cache-Control': 'no-store',
    },
  });
}

