/**
 * API Key service
 * API key generation, hashing, verification, and management
 */

import { generateApiKey as generateKey, hashApiKey as hashApiKeyUtil } from '../utils/crypto.js';
import { getCustomer } from './customer.js';

/**
 * Generate cryptographically secure API key
 * @param {string} prefix - Key prefix (e.g., 'otp_live_sk_')
 * @returns {Promise<string>} API key
 */
export async function generateApiKey(prefix = 'otp_live_sk_') {
    return await generateKey(prefix);
}

/**
 * Hash API key for storage (SHA-256)
 * @param {string} apiKey - API key
 * @returns {Promise<string>} Hex-encoded hash
 */
export async function hashApiKeyForStorage(apiKey) {
    return await hashApiKeyUtil(apiKey);
}

/**
 * Hash API key (re-exported for convenience)
 * @param {string} apiKey - API key
 * @returns {Promise<string>} Hex-encoded hash
 */
export async function hashApiKey(apiKey) {
    return await hashApiKeyUtil(apiKey);
}

/**
 * Create API key for customer
 * @param {string} customerId - Customer ID
 * @param {string} name - API key name
 * @param {*} env - Worker environment
 * @returns {Promise<{apiKey: string, keyId: string}>} API key and key ID
 */
export async function createApiKeyForCustomer(customerId, name, env) {
    // Generate API key
    const apiKey = await generateApiKey('otp_live_sk_');
    const apiKeyHash = await hashApiKeyUtil(apiKey);
    
    // Generate key ID
    const keyId = `key_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Store API key hash
    const apiKeyData = {
        customerId,
        keyId,
        name: name || 'Default API Key',
        createdAt: new Date().toISOString(),
        lastUsed: null,
        status: 'active'
    };
    
    const apiKeyKey = `apikey_${apiKeyHash}`;
    await env.OTP_AUTH_KV.put(apiKeyKey, JSON.stringify(apiKeyData));
    
    // Also store key ID to hash mapping for customer
    const customerApiKeysKey = `customer_${customerId}_apikeys`;
    const existingKeys = await env.OTP_AUTH_KV.get(customerApiKeysKey, { type: 'json' }) || [];
    existingKeys.push({
        keyId,
        name: apiKeyData.name,
        createdAt: apiKeyData.createdAt,
        lastUsed: null,
        status: 'active'
    });
    await env.OTP_AUTH_KV.put(customerApiKeysKey, JSON.stringify(existingKeys));
    
    return { apiKey, keyId };
}

/**
 * Verify API key and get customer ID
 * @param {string} apiKey - API key
 * @param {*} env - Worker environment
 * @returns {Promise<{customerId: string, keyId: string}|null>} Customer ID and key ID or null
 */
export async function verifyApiKey(apiKey, env) {
    const apiKeyHash = await hashApiKeyUtil(apiKey);
    const apiKeyKey = `apikey_${apiKeyHash}`;
    const keyData = await env.OTP_AUTH_KV.get(apiKeyKey, { type: 'json' });
    
    if (!keyData || keyData.status !== 'active') {
        return null;
    }
    
    // Update last used timestamp
    keyData.lastUsed = new Date().toISOString();
    await env.OTP_AUTH_KV.put(apiKeyKey, JSON.stringify(keyData));
    
    // Also update in customer's key list
    const customerApiKeysKey = `customer_${keyData.customerId}_apikeys`;
    const customerKeys = await env.OTP_AUTH_KV.get(customerApiKeysKey, { type: 'json' }) || [];
    const keyIndex = customerKeys.findIndex(k => k.keyId === keyData.keyId);
    if (keyIndex >= 0) {
        customerKeys[keyIndex].lastUsed = keyData.lastUsed;
        await env.OTP_AUTH_KV.put(customerApiKeysKey, JSON.stringify(customerKeys));
    }
    
    // Check if customer exists and is active
    const customer = await getCustomer(keyData.customerId, env);
    if (!customer) {
        return null;
    }
    
    // Only allow active customers
    if (customer.status !== 'active') {
        return null;
    }
    
    return {
        customerId: keyData.customerId,
        keyId: keyData.keyId
    };
}

