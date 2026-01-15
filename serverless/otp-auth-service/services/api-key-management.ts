/**
 * API Key Management Service
 * Provides functions for managing API keys and SSO configuration
 */

import type { ApiKeyData, SSOConfig, SSOIsolationMode } from './api-key.js';

// Ensure this file is treated as an ES module
export {};

interface Env {
    OTP_AUTH_KV: KVNamespace;
    JWT_SECRET?: string;
    [key: string]: any;
}

/**
 * Get API key by key ID
 * @param customerId - Customer ID (for validation)
 * @param keyId - API key ID
 * @param env - Worker environment
 * @returns API key data or null
 */
export async function getApiKeyById(
    customerId: string,
    keyId: string,
    env: Env
): Promise<ApiKeyData | null> {
    try {
        // Get customer's API keys list
        const customerApiKeysKey = `customer_${customerId}_apikeys`;
        const customerKeys = await env.OTP_AUTH_KV.get(customerApiKeysKey, { type: 'json' }) as ApiKeyData[] | null;
        
        if (!customerKeys || customerKeys.length === 0) {
            return null;
        }
        
        // Find the specific key by keyId
        const keyData = customerKeys.find(k => k.keyId === keyId);
        
        if (!keyData) {
            return null;
        }
        
        return keyData;
    } catch (error) {
        console.error(`[ApiKeyManagement] Error retrieving API key by ID:`, error);
        return null;
    }
}

/**
 * Get all API keys for a customer
 * @param customerId - Customer ID
 * @param env - Worker environment
 * @returns Array of API key data
 */
export async function getAllApiKeysForCustomer(
    customerId: string,
    env: Env
): Promise<ApiKeyData[]> {
    try {
        const customerApiKeysKey = `customer_${customerId}_apikeys`;
        const customerKeys = await env.OTP_AUTH_KV.get(customerApiKeysKey, { type: 'json' }) as ApiKeyData[] | null;
        
        if (!customerKeys) {
            return [];
        }
        
        return customerKeys;
    } catch (error) {
        console.error(`[ApiKeyManagement] Error retrieving customer API keys:`, error);
        return [];
    }
}

/**
 * Update SSO configuration for an API key
 * @param customerId - Customer ID (for validation)
 * @param keyId - API key ID
 * @param ssoConfig - New SSO configuration
 * @param env - Worker environment
 * @returns Success status
 */
export async function updateSSOConfig(
    customerId: string,
    keyId: string,
    ssoConfig: Partial<SSOConfig>,
    env: Env
): Promise<boolean> {
    try {
        // Get customer's API keys list
        const customerApiKeysKey = `customer_${customerId}_apikeys`;
        const customerKeys = await env.OTP_AUTH_KV.get(customerApiKeysKey, { type: 'json' }) as ApiKeyData[] | null;
        
        if (!customerKeys || customerKeys.length === 0) {
            console.error(`[ApiKeyManagement] No API keys found for customer ${customerId}`);
            return false;
        }
        
        // Find the key to update
        const keyIndex = customerKeys.findIndex(k => k.keyId === keyId);
        
        if (keyIndex === -1) {
            console.error(`[ApiKeyManagement] API key ${keyId} not found for customer ${customerId}`);
            return false;
        }
        
        // Update SSO config
        const existingConfig = customerKeys[keyIndex].ssoConfig || {
            isolationMode: 'complete' as SSOIsolationMode,
            allowedKeyIds: [],
            globalSsoEnabled: false,
            configVersion: 1,
            updatedAt: new Date().toISOString()
        };
        
        const updatedConfig: SSOConfig = {
            ...existingConfig,
            ...ssoConfig,
            configVersion: (existingConfig.configVersion || 0) + 1,
            updatedAt: new Date().toISOString()
        };
        
        customerKeys[keyIndex].ssoConfig = updatedConfig;
        
        // Save updated keys list
        await env.OTP_AUTH_KV.put(customerApiKeysKey, JSON.stringify(customerKeys));
        
        // Also update the main API key record (hashed lookup)
        // We need to find and update the apikey_{hash} record
        // This is a bit tricky since we don't have the raw API key here
        // For now, we'll rely on the customer keys list being the source of truth
        // The verifyApiKey function will need to merge data from both sources
        
        console.log(`[ApiKeyManagement] ✓ Updated SSO config for key ${keyId}:`, {
            isolationMode: updatedConfig.isolationMode,
            globalSsoEnabled: updatedConfig.globalSsoEnabled,
            allowedKeyIds: updatedConfig.allowedKeyIds
        });
        
        return true;
    } catch (error) {
        console.error(`[ApiKeyManagement] Error updating SSO config:`, error);
        return false;
    }
}

/**
 * Validate if a key has permission to use a session based on SSO scope
 * @param requestingKeyId - The key ID making the request
 * @param sessionSsoScope - The SSO scope from the JWT session
 * @param customerId - Customer ID (for validation)
 * @returns true if the key can use the session, false otherwise
 */
export function validateSSOAccess(
    requestingKeyId: string | null,
    sessionSsoScope: string[],
    customerId: string
): boolean {
    // If no session SSO scope, deny access (shouldn't happen, but fail-safe)
    if (!sessionSsoScope || sessionSsoScope.length === 0) {
        return false;
    }
    
    // If no requesting key ID, allow access (session created without API key)
    // This supports backwards compatibility and direct OTP auth without API keys
    if (!requestingKeyId) {
        return true;
    }
    
    // If session has wildcard scope (*), allow all keys for this customer
    if (sessionSsoScope.includes('*')) {
        return true;
    }
    
    // Check if the requesting key is in the allowed scope
    return sessionSsoScope.includes(requestingKeyId);
}

/**
 * Get SSO-compatible keys for a given key
 * Returns list of key IDs that can share sessions with the specified key
 * @param customerId - Customer ID
 * @param keyId - API key ID
 * @param env - Worker environment
 * @returns Array of compatible key IDs
 */
export async function getSSOCompatibleKeys(
    customerId: string,
    keyId: string,
    env: Env
): Promise<string[]> {
    try {
        const keyData = await getApiKeyById(customerId, keyId, env);
        
        if (!keyData || !keyData.ssoConfig) {
            return [keyId]; // Only itself
        }
        
        const ssoConfig = keyData.ssoConfig;
        
        if (ssoConfig.isolationMode === 'none' && ssoConfig.globalSsoEnabled) {
            // Global SSO: get all active keys for customer
            const allKeys = await getAllApiKeysForCustomer(customerId, env);
            return allKeys
                .filter(k => k.status === 'active')
                .map(k => k.keyId);
        } else if (ssoConfig.isolationMode === 'selective') {
            // Selective SSO: return configured keys
            return [keyId, ...ssoConfig.allowedKeyIds];
        } else {
            // Complete isolation: only itself
            return [keyId];
        }
    } catch (error) {
        console.error(`[ApiKeyManagement] Error getting SSO-compatible keys:`, error);
        return [keyId];
    }
}
