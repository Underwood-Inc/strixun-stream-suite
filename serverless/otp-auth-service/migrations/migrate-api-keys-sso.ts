/**
 * Migration: Add SSO Configuration to Existing API Keys
 * 
 * This migration adds default SSO configuration to all existing API keys
 * that don't have ssoConfig yet.
 * 
 * Default configuration:
 * - isolationMode: 'none' (global SSO enabled)
 * - allowedKeyIds: []
 * - globalSsoEnabled: true
 * - configVersion: 1
 * 
 * This enables inter-tenant SSO by default, allowing customers to
 * build their own SSO ecosystems with existing keys.
 * 
 * Run this migration once after deploying the SSO feature.
 */

import type { ApiKeyData, SSOConfig } from '../services/api-key.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    [key: string]: any;
}

/**
 * Migrate a single API key to add SSO configuration
 */
async function migrateApiKey(
    customerId: string,
    apiKey: ApiKeyData,
    env: Env
): Promise<boolean> {
    try {
        // Skip if already has SSO config
        if (apiKey.ssoConfig) {
            console.log(`[Migration] Skipping key ${apiKey.keyId} - already has SSO config`);
            return false;
        }
        
        // Add default SSO config
        const defaultSsoConfig: SSOConfig = {
            isolationMode: 'none',
            allowedKeyIds: [],
            globalSsoEnabled: true,
            configVersion: 1,
            updatedAt: new Date().toISOString()
        };
        
        apiKey.ssoConfig = defaultSsoConfig;
        
        console.log(`[Migration] ✓ Migrated key ${apiKey.keyId} with default SSO config`);
        return true;
    } catch (error) {
        console.error(`[Migration] Failed to migrate key ${apiKey.keyId}:`, error);
        return false;
    }
}

/**
 * Migrate all API keys for a customer
 */
async function migrateCustomerApiKeys(
    customerId: string,
    env: Env
): Promise<{ total: number; migrated: number; skipped: number }> {
    try {
        const customerApiKeysKey = `customer_${customerId}_apikeys`;
        const customerKeys = await env.OTP_AUTH_KV.get(customerApiKeysKey, { type: 'json' }) as ApiKeyData[] | null;
        
        if (!customerKeys || customerKeys.length === 0) {
            console.log(`[Migration] No API keys found for customer ${customerId}`);
            return { total: 0, migrated: 0, skipped: 0 };
        }
        
        let migrated = 0;
        let skipped = 0;
        
        for (const key of customerKeys) {
            const wasMigrated = await migrateApiKey(customerId, key, env);
            if (wasMigrated) {
                migrated++;
            } else {
                skipped++;
            }
        }
        
        // Save updated keys list
        if (migrated > 0) {
            await env.OTP_AUTH_KV.put(customerApiKeysKey, JSON.stringify(customerKeys));
            console.log(`[Migration] ✓ Saved updated keys for customer ${customerId}`);
        }
        
        return {
            total: customerKeys.length,
            migrated,
            skipped
        };
    } catch (error) {
        console.error(`[Migration] Error migrating customer ${customerId}:`, error);
        throw error;
    }
}

/**
 * Migrate all API keys in the system
 * 
 * This function lists all customer API key records and migrates them.
 * Note: This is a best-effort migration. Keys created during migration
 * will already have SSO config from the updated createApiKeyForCustomer function.
 */
export async function migrateAllApiKeys(env: Env): Promise<{
    totalCustomers: number;
    totalKeys: number;
    migratedKeys: number;
    skippedKeys: number;
    errors: string[];
}> {
    console.log('[Migration] Starting API key SSO configuration migration...');
    
    let totalCustomers = 0;
    let totalKeys = 0;
    let migratedKeys = 0;
    let skippedKeys = 0;
    const errors: string[] = [];
    
    try {
        // List all keys with prefix 'customer_*_apikeys'
        // Note: KV list() is eventually consistent, so this may not catch all keys immediately
        const listResult = await env.OTP_AUTH_KV.list({ prefix: 'customer_' });
        
        const customerKeyRecords = listResult.keys.filter(k =>
            k.name.endsWith('_apikeys')
        );
        
        console.log(`[Migration] Found ${customerKeyRecords.length} customer API key records`);
        
        for (const record of customerKeyRecords) {
            // Extract customerId from key name: customer_{customerId}_apikeys
            const match = record.name.match(/^customer_(.+)_apikeys$/);
            if (!match) {
                console.warn(`[Migration] Skipping invalid key name: ${record.name}`);
                continue;
            }
            
            const customerId = match[1];
            totalCustomers++;
            
            try {
                const result = await migrateCustomerApiKeys(customerId, env);
                totalKeys += result.total;
                migratedKeys += result.migrated;
                skippedKeys += result.skipped;
                
                console.log(`[Migration] Customer ${customerId}: ${result.migrated} migrated, ${result.skipped} skipped`);
            } catch (error) {
                const errorMsg = `Failed to migrate customer ${customerId}: ${error instanceof Error ? error.message : String(error)}`;
                errors.push(errorMsg);
                console.error(`[Migration] ${errorMsg}`);
            }
        }
        
        console.log('[Migration] Migration complete:', {
            totalCustomers,
            totalKeys,
            migratedKeys,
            skippedKeys,
            errors: errors.length
        });
        
        return {
            totalCustomers,
            totalKeys,
            migratedKeys,
            skippedKeys,
            errors
        };
    } catch (error) {
        console.error('[Migration] Critical error during migration:', error);
        throw error;
    }
}

/**
 * Migration endpoint handler
 * POST /migrations/api-keys-sso
 * 
 * This should be called once after deploying the SSO feature.
 * Requires super admin authentication.
 */
export async function handleMigrationEndpoint(
    request: Request,
    env: Env,
    isSuperAdmin: boolean
): Promise<Response> {
    // SECURITY: Only super admins can run migrations
    if (!isSuperAdmin) {
        return new Response(JSON.stringify({
            error: 'Unauthorized',
            message: 'Only super admins can run migrations'
        }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    try {
        const result = await migrateAllApiKeys(env);
        
        return new Response(JSON.stringify({
            success: true,
            message: 'API key SSO configuration migration complete',
            ...result
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('[Migration] Endpoint error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Migration failed',
            details: error instanceof Error ? error.message : String(error)
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
