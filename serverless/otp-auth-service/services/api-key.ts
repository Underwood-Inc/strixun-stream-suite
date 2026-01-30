/**
 * API Key service
 * API key generation, hashing, verification, and management
 * 
 * Uses kv-entities pattern for consistent key management.
 */

import { generateApiKey as generateKey, hashApiKey as hashApiKeyUtil, encryptData, decryptData, getJWTSecret } from '../utils/crypto.js';
import { getCustomer } from './customer.js';
import { getEntity, putEntity, indexGet, indexAdd } from '@strixun/kv-entities';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    JWT_SECRET?: string;
    [key: string]: any;
}

/**
 * SSO Isolation Mode
 * - 'none': No isolation - global SSO enabled for all customer's keys (default)
 * - 'selective': Selective SSO - only communicate with specified keys
 * - 'complete': Complete isolation - no SSO with any keys
 */
type SSOIsolationMode = 'none' | 'selective' | 'complete';

/**
 * SSO Communication Configuration
 * Controls how this API key's authentication sessions can be shared
 * with other API keys owned by the same customer.
 * 
 * PURPOSE: Enable customers to build their own decoupled SSO ecosystems
 * where different API keys (representing different apps/services) can
 * optionally share authentication sessions.
 * 
 * SECURITY: API keys are NOT authentication replacements - they are
 * organizational/data separation layers. JWT handles actual authentication.
 * SSO config only controls whether JWT sessions can be used across keys.
 */
interface SSOConfig {
    /**
     * Isolation mode for this API key
     * - 'none': Global SSO enabled - sessions shared with ALL customer's keys
     * - 'selective': Selective SSO - sessions shared only with allowedKeyIds
     * - 'complete': Complete isolation - sessions NOT shared with any keys
     */
    isolationMode: SSOIsolationMode;
    
    /**
     * Specific key IDs this key can share sessions with (when isolationMode='selective')
     * Empty array means no keys allowed (same as 'complete' isolation)
     * Only used when isolationMode='selective'
     */
    allowedKeyIds: string[];
    
    /**
     * Enable global SSO across ALL customer's keys (when isolationMode='none')
     * When true, sessions are shared across all active keys for this customer
     * When false, falls back to selective or complete isolation
     */
    globalSsoEnabled: boolean;
    
    /**
     * Configuration version for migration/compatibility
     */
    configVersion: number;
    
    /**
     * Last updated timestamp
     */
    updatedAt: string;
}

interface ApiKeyData {
    customerId: string;
    keyId: string;
    name: string;
    createdAt: string;
    lastUsed: string | null;
    status: 'active' | 'inactive' | 'revoked';
    encryptedKey: string;
    /**
     * SSO communication configuration
     * Controls inter-tenant session sharing for this API key
     */
    ssoConfig?: SSOConfig;
}

interface ApiKeyResult {
    apiKey: string;
    keyId: string;
}

interface ApiKeyVerification {
    customerId: string;
    keyId: string;
    /**
     * SSO configuration for session validation
     */
    ssoConfig?: SSOConfig;
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
 * 
 * Generates a new API key, stores it encrypted, and adds it to the customer's key list.
 * 
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
    
    // Initialize default SSO config: global SSO enabled (no isolation)
    // This allows customers to build their own SSO ecosystems by default
    const defaultSsoConfig: SSOConfig = {
        isolationMode: 'none',
        allowedKeyIds: [],
        globalSsoEnabled: true,
        configVersion: 1,
        updatedAt: new Date().toISOString()
    };
    
    // Store API key hash (for verification) and encrypted key (for retrieval)
    const apiKeyData: ApiKeyData = {
        customerId,
        keyId,
        name: name || 'Default API Key',
        createdAt: new Date().toISOString(),
        lastUsed: null,
        status: 'active',
        encryptedKey, // Store encrypted key so we can decrypt and show it later
        ssoConfig: defaultSsoConfig // Initialize with global SSO enabled
    };
    
    // Store API key entity using hash as ID
    await putEntity(env.OTP_AUTH_KV, 'auth', 'apikey', apiKeyHash, apiKeyData);
    
    // CRITICAL: Verify the key was stored correctly (for debugging)
    const verifyStored = await getEntity<ApiKeyData>(env.OTP_AUTH_KV, 'auth', 'apikey', apiKeyHash);
    if (!verifyStored) {
        console.error(`[ApiKeyService] CRITICAL: API key was not stored correctly!`, {
            hashPrefix: apiKeyHash.substring(0, 16) + '...',
            customerId,
            keyId
        });
        throw new Error('Failed to store API key in KV');
    }
    
    // Add key to customer's API keys index
    await indexAdd(env.OTP_AUTH_KV, 'auth', 'apikeys-for-customer', customerId, JSON.stringify(apiKeyData));
    
    // Return the original (untrimmed) API key to the caller
    // The hash is based on the trimmed version for consistency
    return { apiKey, keyId };
}

/**
 * Verify API key and get customer ID
 * 
 * Validates the API key, checks customer status, and returns verification info.
 * 
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
        return null;
    }
    
    const apiKeyHash = await hashApiKeyUtil(trimmedApiKey);
    const keyData = await getEntity<ApiKeyData>(env.OTP_AUTH_KV, 'auth', 'apikey', apiKeyHash);
    
    if (!keyData) {
        return null;
    }
    
    if (keyData.status !== 'active') {
        return null;
    }
    
    // Update last used timestamp
    keyData.lastUsed = new Date().toISOString();
    await putEntity(env.OTP_AUTH_KV, 'auth', 'apikey', apiKeyHash, keyData);
    
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
        keyId: keyData.keyId,
        ssoConfig: keyData.ssoConfig // Return SSO config for session validation
    };
}

/**
 * Get all API keys for a customer
 * 
 * Retrieves all API keys from the customer's index.
 * 
 * @param customerId - Customer ID
 * @param env - Worker environment
 * @returns Array of API key data
 */
export async function getApiKeysForCustomer(customerId: string, env: Env): Promise<ApiKeyData[]> {
    const keyDataStrings = await indexGet(env.OTP_AUTH_KV, 'auth', 'apikeys-for-customer', customerId);
    return keyDataStrings.map(s => JSON.parse(s) as ApiKeyData);
}

// Export types for use in other modules
export type { ApiKeyData, ApiKeyResult, ApiKeyVerification, SSOConfig, SSOIsolationMode };
