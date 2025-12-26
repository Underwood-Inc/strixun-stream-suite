/**
 * API Key Management Handlers
 * Handles API key CRUD operations
 * 
 * SECURITY: API keys are double-encrypted:
 * - Stage 1: Encrypted with user's JWT (only the developer can decrypt)
 * - Stage 2: Router automatically encrypts entire response (data in transit)
 * - API keys are only revealed on-demand via reveal endpoint
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { getCustomer } from '../../services/customer.js';
import { createApiKeyForCustomer } from '../../services/api-key.js';
import { logSecurityEvent } from '../../services/security.js';
import { decryptData, getJWTSecret } from '../../utils/crypto.js';
import { encryptWithJWT } from '../../utils/jwt-encryption.js';

/**
 * List customer API keys
 * GET /admin/customers/{customerId}/api-keys
 * 
 * Returns API keys with double-encrypted values (encrypted with user's JWT)
 * Router will encrypt the entire response again (data in transit)
 */
export async function handleListApiKeys(request, env, customerId, jwtToken = null) {
    try {
        const customerApiKeysKey = `customer_${customerId}_apikeys`;
        const keys = await env.OTP_AUTH_KV.get(customerApiKeysKey, { type: 'json' }) || [];
        
        // Decrypt API keys from storage (server-side encryption with JWT_SECRET)
        const jwtSecret = getJWTSecret(env);
        const keysWithEncryptedValues = await Promise.all(keys.map(async (k) => {
            let doubleEncryptedKey = null;
            
            // If we have user's JWT token, double-encrypt the API key with it
            if (k.encryptedKey && jwtToken) {
                try {
                    // First decrypt from server-side storage
                    const decryptedKey = await decryptData(k.encryptedKey, jwtSecret);
                    
                    // Then encrypt with user's JWT (Stage 1 encryption - only user can decrypt)
                    doubleEncryptedKey = await encryptWithJWT(decryptedKey, jwtToken);
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
                // Include double-encrypted key (encrypted with user's JWT)
                // Router will encrypt entire response again (Stage 2 - data in transit)
                apiKey: doubleEncryptedKey ? {
                    doubleEncrypted: true,
                    encrypted: true,
                    algorithm: doubleEncryptedKey.algorithm,
                    iv: doubleEncryptedKey.iv,
                    salt: doubleEncryptedKey.salt,
                    tokenHash: doubleEncryptedKey.tokenHash,
                    data: doubleEncryptedKey.data,
                    timestamp: doubleEncryptedKey.timestamp
                } : null
            };
        }));
        
        return new Response(JSON.stringify({
            success: true,
            apiKeys: keysWithEncryptedValues
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to list API keys',
            message: error.message
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
export async function handleCreateApiKey(request, env, customerId) {
    try {
        const body = await request.json();
        const { name = 'New API Key' } = body;
        
        // Verify customer exists
        const customer = await getCustomer(customerId, env);
        if (!customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Create API key
        const { apiKey, keyId } = await createApiKeyForCustomer(customerId, name, env);
        
        return new Response(JSON.stringify({
            success: true,
            apiKey, // Only returned once!
            keyId,
            name,
            message: 'API key created successfully. Your API key is also available in the API Keys tab.'
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to create API key',
            message: error.message
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
export async function handleRotateApiKey(request, env, customerId, keyId) {
    try {
        // Find the API key in customer's list
        const customerApiKeysKey = `customer_${customerId}_apikeys`;
        const customerKeys = await env.OTP_AUTH_KV.get(customerApiKeysKey, { type: 'json' }) || [];
        const keyIndex = customerKeys.findIndex(k => k.keyId === keyId);
        
        if (keyIndex < 0) {
            return new Response(JSON.stringify({ error: 'API key not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Create new API key
        const { apiKey: newApiKey, keyId: newKeyId } = await createApiKeyForCustomer(
            customerId, 
            `${customerKeys[keyIndex].name} (rotated)`, 
            env
        );
        
        // Mark old key as rotated (keep for 7 days grace period)
        customerKeys[keyIndex].status = 'rotated';
        customerKeys[keyIndex].rotatedAt = new Date().toISOString();
        customerKeys[keyIndex].replacedBy = newKeyId;
        await env.OTP_AUTH_KV.put(customerApiKeysKey, JSON.stringify(customerKeys));
        
        // Log rotation
        await logSecurityEvent(customerId, 'api_key_rotated', {
            oldKeyId: keyId,
            newKeyId: newKeyId
        }, env);
        
        return new Response(JSON.stringify({
            success: true,
            apiKey: newApiKey, // Only returned once!
            keyId: newKeyId,
            oldKeyId: keyId,
            message: 'API key rotated successfully. Old key will work for 7 days. Your new API key is also available in the API Keys tab.'
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to rotate API key',
            message: error.message
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
export async function handleRevealApiKey(request, env, customerId, keyId, jwtToken) {
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
        
        // Find the API key in customer's list
        const customerApiKeysKey = `customer_${customerId}_apikeys`;
        const customerKeys = await env.OTP_AUTH_KV.get(customerApiKeysKey, { type: 'json' }) || [];
        const keyData = customerKeys.find(k => k.keyId === keyId);
        
        if (!keyData) {
            return new Response(JSON.stringify({ error: 'API key not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Decrypt API key from storage
        const jwtSecret = getJWTSecret(env);
        let apiKey = null;
        if (keyData.encryptedKey) {
            apiKey = await decryptData(keyData.encryptedKey, jwtSecret);
        }
        
        // Log security event
        await logSecurityEvent(customerId, 'api_key_revealed', {
            keyId: keyId,
            keyName: keyData.name
        }, env);
        
        return new Response(JSON.stringify({
            success: true,
            apiKey, // Plain text API key (will be encrypted by router)
            keyId,
            name: keyData.name,
            message: 'API key revealed. Copy it now - it will not be shown again.'
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to reveal API key',
            message: error.message
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
export async function handleRevokeApiKey(request, env, customerId, keyId) {
    try {
        // Find the API key in customer's list
        const customerApiKeysKey = `customer_${customerId}_apikeys`;
        const customerKeys = await env.OTP_AUTH_KV.get(customerApiKeysKey, { type: 'json' }) || [];
        const keyIndex = customerKeys.findIndex(k => k.keyId === keyId);
        
        if (keyIndex < 0) {
            return new Response(JSON.stringify({ error: 'API key not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Mark as revoked in customer's list
        customerKeys[keyIndex].status = 'revoked';
        customerKeys[keyIndex].revokedAt = new Date().toISOString();
        await env.OTP_AUTH_KV.put(customerApiKeysKey, JSON.stringify(customerKeys));
        
        // Note: We can't delete the hash->keyId mapping without the original key
        // But we check status in verifyApiKey, so revoked keys won't work
        
        return new Response(JSON.stringify({
            success: true,
            message: 'API key revoked successfully'
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to revoke API key',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

