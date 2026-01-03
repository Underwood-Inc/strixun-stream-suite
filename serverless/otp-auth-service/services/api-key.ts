/**
 * API Key service
 * API key generation, hashing, verification, and management
 */

import { generateApiKey as generateKey, hashApiKey as hashApiKeyUtil, encryptData, decryptData, getJWTSecret } from '../utils/crypto.js';
import { getCustomer } from './customer.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    JWT_SECRET?: string;
    [key: string]: any;
}

interface ApiKeyData {
    customerId: string;
    keyId: string;
    name: string;
    createdAt: string;
    lastUsed: string | null;
    status: 'active' | 'inactive' | 'revoked';
    encryptedKey: string;
}

interface ApiKeyResult {
    apiKey: string;
    keyId: string;
}

interface ApiKeyVerification {
    customerId: string;
    keyId: string;
}

/**
 * Generate cryptographically secure API key
 * @param prefix - Key prefix (e.g., 'otp_live_sk_')
 * @returns API key
 */
export async function generateApiKey(prefix: string = 'otp_live_sk_'): Promise<string> {
    return await generateKey(prefix);
}

/**
 * Hash API key for storage (SHA-256)
 * @param apiKey - API key
 * @returns Hex-encoded hash
 */
export async function hashApiKeyForStorage(apiKey: string): Promise<string> {
    return await hashApiKeyUtil(apiKey);
}

/**
 * Hash API key (re-exported for convenience)
 * @param apiKey - API key
 * @returns Hex-encoded hash
 */
export async function hashApiKey(apiKey: string): Promise<string> {
    return await hashApiKeyUtil(apiKey);
}

/**
 * Create API key for customer
 * @param customerId - Customer ID
 * @param name - API key name
 * @param env - Worker environment
 * @returns API key and key ID
 */
export async function createApiKeyForCustomer(
    customerId: string,
    name: string,
    env: Env
): Promise<ApiKeyResult> {
    // Generate API key
    const apiKey = await generateApiKey('otp_live_sk_');
    // CRITICAL: Trim API key before hashing to ensure consistent hashing
    // This matches the trimming in verifyApiKey to prevent hash mismatches
    const trimmedApiKey = apiKey.trim();
    const apiKeyHash = await hashApiKeyUtil(trimmedApiKey);
    
    // Generate key ID
    const keyId = `key_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Encrypt API key for storage (so we can retrieve it later)
    const jwtSecret = getJWTSecret(env);
    const encryptedKey = await encryptData(apiKey, jwtSecret);
    
    // Store API key hash (for verification) and encrypted key (for retrieval)
    const apiKeyData: ApiKeyData = {
        customerId,
        keyId,
        name: name || 'Default API Key',
        createdAt: new Date().toISOString(),
        lastUsed: null,
        status: 'active',
        encryptedKey // Store encrypted key so we can decrypt and show it later
    };
    
    const apiKeyKey = `apikey_${apiKeyHash}`;
    await env.OTP_AUTH_KV.put(apiKeyKey, JSON.stringify(apiKeyData));
    
    // Also store key ID to hash mapping for customer (with encrypted key)
    const customerApiKeysKey = `customer_${customerId}_apikeys`;
    const existingKeys = await env.OTP_AUTH_KV.get(customerApiKeysKey, { type: 'json' }) as ApiKeyData[] | null || [];
    existingKeys.push({
        keyId,
        name: apiKeyData.name,
        createdAt: apiKeyData.createdAt,
        lastUsed: null,
        status: 'active',
        encryptedKey // Store encrypted key for retrieval
    });
    await env.OTP_AUTH_KV.put(customerApiKeysKey, JSON.stringify(existingKeys));
    
    // Return the original (untrimmed) API key to the caller
    // The hash is based on the trimmed version for consistency
    return { apiKey, keyId };
}

/**
 * Verify API key and get customer ID
 * @param apiKey - API key
 * @param env - Worker environment
 * @returns Customer ID and key ID or null
 */
export async function verifyApiKey(apiKey: string, env: Env): Promise<ApiKeyVerification | null> {
    // CRITICAL: Trim API key to ensure consistent hashing
    // This prevents hash mismatches due to whitespace differences
    const trimmedApiKey = apiKey.trim();
    
    // Validate API key format before attempting lookup
    if (!trimmedApiKey.startsWith('otp_live_sk_') && !trimmedApiKey.startsWith('otp_test_sk_')) {
        console.log(`[ApiKeyService] Invalid API key format: ${trimmedApiKey.substring(0, 20)}...`);
        return null;
    }
    
    const apiKeyHash = await hashApiKeyUtil(trimmedApiKey);
    const apiKeyKey = `apikey_${apiKeyHash}`;
    const keyData = await env.OTP_AUTH_KV.get(apiKeyKey, { type: 'json' }) as ApiKeyData | null;
    
    if (!keyData) {
        console.log(`[ApiKeyService] API key not found in KV: ${apiKeyKey.substring(0, 30)}...`);
        return null;
    }
    
    if (keyData.status !== 'active') {
        console.log(`[ApiKeyService] API key is not active: status=${keyData.status}, keyId=${keyData.keyId}`);
        return null;
    }
    
    // Update last used timestamp
    keyData.lastUsed = new Date().toISOString();
    await env.OTP_AUTH_KV.put(apiKeyKey, JSON.stringify(keyData));
    
    // Also update in customer's key list
    const customerApiKeysKey = `customer_${keyData.customerId}_apikeys`;
    const customerKeys = await env.OTP_AUTH_KV.get(customerApiKeysKey, { type: 'json' }) as ApiKeyData[] | null || [];
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
        console.log(`[ApiKeyService] Customer is not active: customerId=${keyData.customerId}, status=${customer.status}`);
        return null;
    }
    
    console.log(`[ApiKeyService] API key verification successful:`, {
        customerId: keyData.customerId,
        keyId: keyData.keyId,
        apiKeyPrefix: trimmedApiKey.substring(0, 20) + '...'
    });
    
    return {
        customerId: keyData.customerId,
        keyId: keyData.keyId
    };
}

