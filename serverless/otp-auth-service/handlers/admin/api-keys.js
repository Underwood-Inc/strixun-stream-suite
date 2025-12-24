/**
 * API Key Management Handlers
 * Handles API key CRUD operations
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { getCustomer } from '../../services/customer.js';
import { createApiKeyForCustomer } from '../../services/api-key.js';
import { logSecurityEvent } from '../../services/security.js';

/**
 * List customer API keys
 * GET /admin/customers/{customerId}/api-keys
 */
export async function handleListApiKeys(request, env, customerId) {
    try {
        const customerApiKeysKey = `customer_${customerId}_apikeys`;
        const keys = await env.OTP_AUTH_KV.get(customerApiKeysKey, { type: 'json' }) || [];
        
        // Don't expose key hashes, just metadata
        const keysMetadata = keys.map(k => ({
            keyId: k.keyId,
            name: k.name,
            createdAt: k.createdAt,
            lastUsed: k.lastUsed,
            status: k.status
        }));
        
        return new Response(JSON.stringify({
            success: true,
            keys: keysMetadata
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
            message: 'API key created successfully. Save your API key - it will not be shown again.'
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
            message: 'API key rotated successfully. Old key will work for 7 days. Save your new API key - it will not be shown again.'
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

