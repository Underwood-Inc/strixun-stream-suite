/**
 * API Key Management Handlers
 * Handles API key CRUD operations
 * 
 * SECURITY: API keys are double-encrypted:
 * - Stage 1: Encrypted with customer's JWT (only the developer can decrypt)
 * - Stage 2: Router automatically encrypts entire response (data in transit)
 * - API keys are only revealed on-demand via reveal endpoint
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { createApiKeyForCustomer } from '../../services/api-key.js';
import { logSecurityEvent } from '../../services/security.js';
import { decryptData, getJWTSecret } from '../../utils/crypto.js';
import { getCustomer } from '@strixun/api-framework';
import { indexGet } from '@strixun/kv-entities';
// Uses shared encryption suite from serverless/shared/encryption

interface Env {
    OTP_AUTH_KV: KVNamespace;
    JWT_SECRET?: string;
    [key: string]: any;
}

interface ApiKeyData {
    keyId: string;
    name: string;
    createdAt: string;
    lastUsed: string | null;
    status: 'active' | 'inactive' | 'revoked' | 'rotated';
    encryptedKey: string;
    rotatedAt?: string;
    replacedBy?: string;
    revokedAt?: string;
    /** Allowed origins for CORS when using this API key */
    allowedOrigins?: string[];
    /** Allowed OIDC scopes for tokens issued with this key; empty = all supported */
    allowedScopes?: string[];
}

interface EncryptedKeyData {
    doubleEncrypted: boolean;
    encrypted: boolean;
    algorithm: string;
    iv: string;
    salt: string;
    tokenHash: string;
    data: string;
    timestamp: string;
}

interface ApiKeyResponse {
    keyId: string;
    name: string;
    createdAt: string;
    lastUsed: string | null;
    status: string;
    apiKey: EncryptedKeyData | null; // Double-encrypted (only customer can decrypt with their JWT)
    allowedOrigins?: string[];
    allowedScopes?: string[];
}

interface CreateApiKeyBody {
    name?: string;
    allowedOrigins?: string[];
    allowedScopes?: string[];
}

interface CreateApiKeyResponse {
    success: boolean;
    apiKey: string;
    keyId: string;
    name: string;
    message: string;
}

interface ListApiKeysResponse {
    success: boolean;
    apiKeys: ApiKeyResponse[];
}

interface RotateApiKeyResponse {
    success: boolean;
    apiKey: string;
    keyId: string;
    oldKeyId: string;
    message: string;
}

interface RevealApiKeyResponse {
    success: boolean;
    apiKey: string | null;
    keyId: string;
    name: string;
    message: string;
}

interface RevokeApiKeyResponse {
    success: boolean;
    message: string;
}

/**
 * List customer API keys
 * GET /admin/customers/{customerId}/api-keys
 * 
 * Returns API keys with double-encrypted values (encrypted with customer's JWT)
 * Router will encrypt the entire response again (data in transit)
 */
export async function handleListApiKeys(
    request: Request,
    env: Env,
    customerId: string,
    jwtToken: string | null = null
): Promise<Response> {
    try {
        // Use indexGet to match where createApiKeyForCustomer stores keys
        const keyDataStrings = await indexGet(env.OTP_AUTH_KV, 'auth', 'apikeys-for-customer', customerId);
        const keys: ApiKeyData[] = keyDataStrings.map(s => JSON.parse(s) as ApiKeyData);
        
        // Decrypt API keys from storage (server-side encryption with JWT_SECRET)
        const jwtSecret = getJWTSecret(env);
        const keysWithEncryptedValues = await Promise.all(keys.map(async (k): Promise<ApiKeyResponse> => {
            let doubleEncryptedKey: EncryptedKeyData | null = null;
            
            // If we have user's JWT token, double-encrypt the API key with it
            if (k.encryptedKey && jwtToken) {
                try {
                    // First decrypt from server-side storage
                    const decryptedKeyRaw = await decryptData(k.encryptedKey, jwtSecret);
                    if (!decryptedKeyRaw) {
                        // Skip double encryption if decryption fails - return key without double encryption
                        return {
                            keyId: k.keyId,
                            name: k.name,
                            createdAt: k.createdAt,
                            lastUsed: k.lastUsed,
                            status: k.status,
                            apiKey: null,
                            allowedOrigins: k.allowedOrigins || [],
                            allowedScopes: k.allowedScopes
                        };
                    }
                    
                    // CRITICAL: Trim the decrypted key to ensure consistency
                    // The key was trimmed before hashing during creation
                    const decryptedKey = decryptedKeyRaw.trim();
                    
                    // Then encrypt with user's JWT (Stage 1 encryption - only user can decrypt)
                    // Uses shared encryption suite
                    const { encryptWithJWT } = await import('@strixun/api-framework');
                    const encrypted = await encryptWithJWT(decryptedKey, jwtToken);
                    doubleEncryptedKey = {
                        doubleEncrypted: true,
                        encrypted: true,
                        algorithm: encrypted.algorithm,
                        iv: encrypted.iv,
                        salt: encrypted.salt,
                        tokenHash: encrypted.tokenHash ?? '',
                        data: encrypted.data,
                        timestamp: encrypted.timestamp ?? ''
                    };
                } catch (error) {
                    console.error('Failed to double-encrypt API key:', error);
                    // If encryption fails, don't include the key
                }
            }
            
            return {
                keyId: k.keyId,
                name: k.name,
                createdAt: k.createdAt,
                lastUsed: k.lastUsed,
                status: k.status,
                apiKey: doubleEncryptedKey,
                allowedOrigins: k.allowedOrigins || [],
                allowedScopes: k.allowedScopes
            };
        }));
        
        const response: ListApiKeysResponse = {
            success: true,
            apiKeys: keysWithEncryptedValues
        };
        
        return new Response(JSON.stringify(response), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({
            error: 'Failed to list API keys',
            message: errorMessage
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Create new API key for customer
 * POST /admin/customers/{customerId}/api-keys
 */
export async function handleCreateApiKey(
    request: Request,
    env: Env,
    customerId: string
): Promise<Response> {
    try {
        const body = await request.json() as CreateApiKeyBody;
        const name = body.name || 'New API Key';
        
        const { extractAuthToken, verifyTokenOIDC } = await import('../../utils/verify-token.js');
        const jwtToken = extractAuthToken(request.headers.get('Cookie'));
        if (!jwtToken) {
            return new Response(JSON.stringify({ error: 'Authentication required. Please authenticate with HttpOnly cookie.' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        const jwtPayload = await verifyTokenOIDC(jwtToken, env);
        if (!jwtPayload || !jwtPayload.customerId) {
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // SECURITY: Verify JWT customerId matches path customerId (authorization check)
        // This ensures customers can only create API keys for themselves
        if (jwtPayload.customerId !== customerId) {
            return new Response(JSON.stringify({ error: 'Forbidden: You can only create API keys for your own account' }), {
                status: 403,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Verify customer exists in customer-api
        const customer = await getCustomer(customerId, jwtToken, env);
        if (!customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        let allowedOrigins: string[] | undefined;
        if (Array.isArray(body.allowedOrigins)) {
            allowedOrigins = [];
            for (const origin of body.allowedOrigins) {
                if (typeof origin !== 'string') continue;
                const trimmed = origin.trim();
                if (!trimmed) continue;
                if (trimmed === 'null' || trimmed.startsWith('http://') || trimmed.startsWith('https://')) allowedOrigins.push(trimmed);
            }
            if (allowedOrigins.length === 0) allowedOrigins = undefined;
        }
        let allowedScopes: string[] | undefined;
        if (Array.isArray(body.allowedScopes)) {
            const { SCOPES_SUPPORTED } = await import('../../shared/oidc-constants.js');
            const supportedSet = new Set(SCOPES_SUPPORTED);
            allowedScopes = body.allowedScopes.filter((s): s is string => typeof s === 'string' && supportedSet.has(s.trim()));
        }
        const { apiKey, keyId } = await createApiKeyForCustomer(customerId, name, env, { allowedOrigins, allowedScopes });
        
        const response: CreateApiKeyResponse = {
            success: true,
            apiKey, // Only returned once!
            keyId,
            name,
            message: 'API key created successfully. Your API key is also available in the API Keys tab.'
        };
        
        return new Response(JSON.stringify(response), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({
            error: 'Failed to create API key',
            message: errorMessage
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Rotate API key
 * POST /admin/customers/{customerId}/api-keys/{keyId}/rotate
 */
export async function handleRotateApiKey(
    request: Request,
    env: Env,
    customerId: string,
    keyId: string
): Promise<Response> {
    try {
        // Get keys from index where createApiKeyForCustomer stores them
        const keyDataStrings = await indexGet(env.OTP_AUTH_KV, 'auth', 'apikeys-for-customer', customerId);
        const customerKeys: ApiKeyData[] = keyDataStrings.map(s => JSON.parse(s) as ApiKeyData);
        const oldKeyData = customerKeys.find(k => k.keyId === keyId);
        
        if (!oldKeyData) {
            return new Response(JSON.stringify({ error: 'API key not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Create new API key
        const { apiKey: newApiKey, keyId: newKeyId } = await createApiKeyForCustomer(
            customerId, 
            `${oldKeyData.name} (rotated)`, 
            env
        );
        
        // Mark old key as rotated - update in index
        // Remove old entry, add updated entry
        const { indexRemove, indexAdd: indexAddEntry } = await import('@strixun/kv-entities');
        const oldKeyString = JSON.stringify(oldKeyData);
        await indexRemove(env.OTP_AUTH_KV, 'auth', 'apikeys-for-customer', customerId, oldKeyString);
        
        oldKeyData.status = 'rotated';
        oldKeyData.rotatedAt = new Date().toISOString();
        oldKeyData.replacedBy = newKeyId;
        await indexAddEntry(env.OTP_AUTH_KV, 'auth', 'apikeys-for-customer', customerId, JSON.stringify(oldKeyData));
        
        // Log rotation
        await logSecurityEvent(customerId, 'api_key_rotated', {
            oldKeyId: keyId,
            newKeyId: newKeyId
        }, env);
        
        const response: RotateApiKeyResponse = {
            success: true,
            apiKey: newApiKey, // Only returned once!
            keyId: newKeyId,
            oldKeyId: keyId,
            message: 'API key rotated successfully. Old key will work for 7 days. Your new API key is also available in the API Keys tab.'
        };
        
        return new Response(JSON.stringify(response), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({
            error: 'Failed to rotate API key',
            message: errorMessage
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Reveal API key on-demand
 * POST /admin/customers/{customerId}/api-keys/{keyId}/reveal
 * 
 * Decrypts and returns API key - requires user's JWT token
 * This is the only way to see the actual API key value
 */
export async function handleRevealApiKey(
    request: Request,
    env: Env,
    customerId: string,
    keyId: string,
    jwtToken: string | null
): Promise<Response> {
    try {
        if (!jwtToken) {
            return new Response(JSON.stringify({ 
                error: 'JWT token required',
                message: 'You must be authenticated to reveal API keys'
            }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Get keys from index where createApiKeyForCustomer stores them
        const keyDataStrings = await indexGet(env.OTP_AUTH_KV, 'auth', 'apikeys-for-customer', customerId);
        const customerKeys: ApiKeyData[] = keyDataStrings.map(s => JSON.parse(s) as ApiKeyData);
        const keyData = customerKeys.find(k => k.keyId === keyId);
        
        if (!keyData) {
            return new Response(JSON.stringify({ error: 'API key not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Decrypt API key from storage
        const jwtSecret = getJWTSecret(env);
        let apiKey: string | null = null;
        if (keyData.encryptedKey) {
            const decryptedKey = await decryptData(keyData.encryptedKey, jwtSecret);
            if (decryptedKey) {
                // CRITICAL: Trim the decrypted key to ensure it matches the stored hash
                // The key was trimmed before hashing during creation
                apiKey = decryptedKey.trim();
            }
        }
        
        // Log security event
        await logSecurityEvent(customerId, 'api_key_revealed', {
            keyId: keyId,
            keyName: keyData.name
        }, env);
        
        const response: RevealApiKeyResponse = {
            success: true,
            apiKey, // Plain text API key (will be encrypted by router)
            keyId,
            name: keyData.name,
            message: 'API key revealed. Copy it now - it will not be shown again.'
        };
        
        return new Response(JSON.stringify(response), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({
            error: 'Failed to reveal API key',
            message: errorMessage
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Revoke API key
 * DELETE /admin/customers/{customerId}/api-keys/{keyId}
 */
export async function handleRevokeApiKey(
    request: Request,
    env: Env,
    customerId: string,
    keyId: string
): Promise<Response> {
    try {
        // Get keys from index where createApiKeyForCustomer stores them
        const keyDataStrings = await indexGet(env.OTP_AUTH_KV, 'auth', 'apikeys-for-customer', customerId);
        const customerKeys: ApiKeyData[] = keyDataStrings.map(s => JSON.parse(s) as ApiKeyData);
        const keyData = customerKeys.find(k => k.keyId === keyId);
        
        if (!keyData) {
            return new Response(JSON.stringify({ error: 'API key not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Mark as revoked - update in index
        // Remove old entry, add updated entry
        const { indexRemove, indexAdd: indexAddEntry } = await import('@strixun/kv-entities');
        const oldKeyString = JSON.stringify(keyData);
        await indexRemove(env.OTP_AUTH_KV, 'auth', 'apikeys-for-customer', customerId, oldKeyString);
        
        keyData.status = 'revoked';
        keyData.revokedAt = new Date().toISOString();
        await indexAddEntry(env.OTP_AUTH_KV, 'auth', 'apikeys-for-customer', customerId, JSON.stringify(keyData));
        
        // Note: We can't delete the hash->keyId mapping without the original key
        // But we check status in verifyApiKey, so revoked keys won't work
        
        const response: RevokeApiKeyResponse = {
            success: true,
            message: 'API key revoked successfully'
        };
        
        return new Response(JSON.stringify(response), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({
            error: 'Failed to revoke API key',
            message: errorMessage
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

interface UpdateOriginsBody {
    allowedOrigins: string[];
    /** Optional: allowed OIDC scopes for this key (e.g. ["openid", "profile", "email"]) */
    allowedScopes?: string[];
}

interface UpdateOriginsResponse {
    success: boolean;
    keyId: string;
    allowedOrigins: string[];
    allowedScopes?: string[];
    message: string;
}

/**
 * Update allowed origins for a specific API key
 * PUT /admin/customers/{customerId}/api-keys/{keyId}/origins
 * 
 * Each API key can have its own set of allowed origins for CORS
 */
export async function handleUpdateKeyOrigins(
    request: Request,
    env: Env,
    customerId: string,
    keyId: string
): Promise<Response> {
    try {
        const body = await request.json() as UpdateOriginsBody;
        
        if (!Array.isArray(body.allowedOrigins)) {
            return new Response(JSON.stringify({ 
                error: 'Invalid request',
                message: 'allowedOrigins must be an array of strings'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Validate origins format: http(s) URLs or literal "null" for file:// (Origin: null)
        const validatedOrigins: string[] = [];
        for (const origin of body.allowedOrigins) {
            if (typeof origin !== 'string') continue;
            const trimmed = origin.trim();
            if (!trimmed) continue;
            if (trimmed === 'null') {
                validatedOrigins.push('null');
                continue;
            }
            if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
                validatedOrigins.push(trimmed);
            } else {
                return new Response(JSON.stringify({
                    error: 'Invalid origin',
                    message: `Origin "${trimmed}" must be http:// or https:// URL, or null (for file://).`
                }), {
                    status: 400,
                    headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                });
            }
        }
        
        // Get keys from index
        const keyDataStrings = await indexGet(env.OTP_AUTH_KV, 'auth', 'apikeys-for-customer', customerId);
        const customerKeys: ApiKeyData[] = keyDataStrings.map(s => JSON.parse(s) as ApiKeyData);
        const keyData = customerKeys.find(k => k.keyId === keyId);
        
        if (!keyData) {
            return new Response(JSON.stringify({ error: 'API key not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Optional: validate and set allowedScopes
        let validatedScopes: string[] | undefined;
        if (body.allowedScopes !== undefined) {
            const { SCOPES_SUPPORTED } = await import('../../shared/oidc-constants.js');
            const supportedSet = new Set(SCOPES_SUPPORTED);
            validatedScopes = Array.isArray(body.allowedScopes)
                ? body.allowedScopes.filter((s: unknown) => typeof s === 'string' && supportedSet.has(s.trim()))
                : [];
        }

        const { indexRemove, indexAdd: indexAddEntry } = await import('@strixun/kv-entities');
        const oldKeyString = JSON.stringify(keyData);
        await indexRemove(env.OTP_AUTH_KV, 'auth', 'apikeys-for-customer', customerId, oldKeyString);
        
        keyData.allowedOrigins = validatedOrigins;
        if (validatedScopes !== undefined) keyData.allowedScopes = validatedScopes.length > 0 ? validatedScopes : undefined;
        await indexAddEntry(env.OTP_AUTH_KV, 'auth', 'apikeys-for-customer', customerId, JSON.stringify(keyData));

        if (keyData.apiKeyHash) {
            const { putEntity } = await import('@strixun/kv-entities');
            await putEntity(env.OTP_AUTH_KV, 'auth', 'apikey', keyData.apiKeyHash, keyData);
        }
        
        await logSecurityEvent(customerId, 'api_key_origins_updated', {
            keyId: keyId,
            keyName: keyData.name,
            originsCount: validatedOrigins.length
        }, env);
        
        const response: UpdateOriginsResponse = {
            success: true,
            keyId,
            allowedOrigins: validatedOrigins,
            ...(validatedScopes !== undefined && { allowedScopes: validatedScopes }),
            message: `Allowed origins updated successfully. ${validatedOrigins.length} origin(s) configured.`
        };
        
        return new Response(JSON.stringify(response), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({
            error: 'Failed to update allowed origins',
            message: errorMessage
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

