/**
 * Migration: Unified Key Structure for Customer API
 * 
 * Migrates from old key patterns to unified entity/index pattern.
 * 
 * OLD PATTERNS:
 *   customer_{customerId}              → Customer data (or just customerId as key)
 *   email_{emailHash}                  → Email to customer mapping
 *   displayname_{name}                 → Display name reservations (in OTP_AUTH_KV)
 *   preferences_{customerId}           → Customer preferences
 * 
 * NEW PATTERNS:
 *   customer:customer:{customerId}     → Customer data
 *   idx:customer:email-to-customer:{emailHash} → Email to customer mapping
 *   customer:displayname:{name}        → Display name reservations
 *   customer:preferences:{customerId}  → Customer preferences
 */

interface MigrationStats {
    customers: { processed: number; errors: number };
    emailIndex: { processed: number; errors: number };
    displayNames: { processed: number; errors: number };
    preferences: { processed: number; errors: number };
}

interface Env {
    CUSTOMER_KV: KVNamespace;
    OTP_AUTH_KV?: KVNamespace; // Display names are stored here
}

/**
 * Run the migration
 */
export async function runMigration(
    env: Env,
    options: {
        dryRun?: boolean;
        deleteOld?: boolean;
        verbose?: boolean;
    } = {}
): Promise<{ success: boolean; stats: MigrationStats; errors: string[] }> {
    const { dryRun = true, deleteOld = false, verbose = false } = options;
    const kv = env.CUSTOMER_KV;
    const errors: string[] = [];
    
    const stats: MigrationStats = {
        customers: { processed: 0, errors: 0 },
        emailIndex: { processed: 0, errors: 0 },
        displayNames: { processed: 0, errors: 0 },
        preferences: { processed: 0, errors: 0 },
    };
    
    const log = (msg: string) => {
        if (verbose) console.log(`[Migration] ${msg}`);
    };
    
    log(`Starting migration (dryRun=${dryRun}, deleteOld=${deleteOld})`);
    
    try {
        // ===== CUSTOMER_KV =====
        const allKeys = await scanAllKeys(kv);
        log(`Found ${allKeys.length} total keys in CUSTOMER_KV`);
        
        // ===== Customers =====
        log('Migrating customer data...');
        
        // Look for keys that look like customer data (not new pattern)
        const customerKeys = allKeys.filter(k => 
            (k.startsWith('customer_') || k.startsWith('cust_')) && 
            !k.startsWith('customer:')
        );
        
        for (const oldKey of customerKeys) {
            try {
                const data = await kv.get(oldKey, { type: 'json' }) as any;
                if (!data) continue;
                
                // Extract customerId
                const customerId = data.customerId || oldKey.replace('customer_', '');
                const newKey = `customer:customer:${customerId}`;
                
                if (!dryRun) {
                    await kv.put(newKey, JSON.stringify(data));
                    if (deleteOld) await kv.delete(oldKey);
                }
                
                stats.customers.processed++;
            } catch (error) {
                stats.customers.errors++;
                errors.push(`Customer ${oldKey}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        
        // ===== Email Index =====
        log('Migrating email indexes...');
        const emailKeys = allKeys.filter(k => 
            k.startsWith('email_') && !k.startsWith('idx:')
        );
        
        for (const oldKey of emailKeys) {
            try {
                const customerId = await kv.get(oldKey);
                if (!customerId) continue;
                
                const emailHash = oldKey.replace('email_', '');
                const newKey = `idx:customer:email-to-customer:${emailHash}`;
                
                if (!dryRun) {
                    await kv.put(newKey, customerId);
                    if (deleteOld) await kv.delete(oldKey);
                }
                
                stats.emailIndex.processed++;
            } catch (error) {
                stats.emailIndex.errors++;
                errors.push(`EmailIndex ${oldKey}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        
        // ===== Preferences =====
        log('Migrating customer preferences...');
        const prefKeys = allKeys.filter(k => 
            k.startsWith('preferences_') && !k.startsWith('customer:')
        );
        
        for (const oldKey of prefKeys) {
            try {
                const data = await kv.get(oldKey, { type: 'json' });
                if (!data) continue;
                
                const customerId = oldKey.replace('preferences_', '');
                const newKey = `customer:preferences:${customerId}`;
                
                if (!dryRun) {
                    await kv.put(newKey, JSON.stringify(data));
                    if (deleteOld) await kv.delete(oldKey);
                }
                
                stats.preferences.processed++;
            } catch (error) {
                stats.preferences.errors++;
                errors.push(`Preferences ${oldKey}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        
        // ===== Display Names (in OTP_AUTH_KV) =====
        if (env.OTP_AUTH_KV) {
            log('Migrating display name reservations from OTP_AUTH_KV...');
            const authKeys = await scanAllKeys(env.OTP_AUTH_KV);
            const displayNameKeys = authKeys.filter(k => 
                k.startsWith('displayname_') && !k.startsWith('customer:')
            );
            
            for (const oldKey of displayNameKeys) {
                try {
                    const data = await env.OTP_AUTH_KV.get(oldKey, { type: 'json' });
                    if (!data) continue;
                    
                    const name = oldKey.replace('displayname_', '');
                    const newKey = `customer:displayname:${name}`;
                    
                    if (!dryRun) {
                        await env.OTP_AUTH_KV.put(newKey, JSON.stringify(data), { expirationTtl: 31536000 });
                        if (deleteOld) await env.OTP_AUTH_KV.delete(oldKey);
                    }
                    
                    stats.displayNames.processed++;
                } catch (error) {
                    stats.displayNames.errors++;
                    errors.push(`DisplayName ${oldKey}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }
        
        log('Migration complete!');
        log(`Customers: ${stats.customers.processed} processed, ${stats.customers.errors} errors`);
        log(`EmailIndex: ${stats.emailIndex.processed} processed, ${stats.emailIndex.errors} errors`);
        log(`DisplayNames: ${stats.displayNames.processed} processed, ${stats.displayNames.errors} errors`);
        log(`Preferences: ${stats.preferences.processed} processed, ${stats.preferences.errors} errors`);
        
        return {
            success: errors.length === 0,
            stats,
            errors
        };
        
    } catch (error) {
        errors.push(`Fatal: ${error instanceof Error ? error.message : String(error)}`);
        return { success: false, stats, errors };
    }
}

/**
 * Scan all keys in KV namespace
 */
async function scanAllKeys(kv: KVNamespace): Promise<string[]> {
    const allKeys: string[] = [];
    let cursor: string | undefined;
    
    do {
        const result = await kv.list({ limit: 1000, cursor });
        allKeys.push(...result.keys.map(k => k.name));
        cursor = result.list_complete ? undefined : result.cursor;
    } while (cursor);
    
    return allKeys;
}

/**
 * Verify migration by checking key counts
 */
export async function verifyMigration(env: Env): Promise<{
    oldKeyCount: number;
    newKeyCount: number;
    indexCount: number;
}> {
    const kv = env.CUSTOMER_KV;
    const allKeys = await scanAllKeys(kv);
    
    const oldKeyCount = allKeys.filter(k => 
        k.startsWith('customer_') ||
        k.startsWith('cust_') ||
        k.startsWith('email_') ||
        k.startsWith('preferences_')
    ).length;
    
    const newKeyCount = allKeys.filter(k => 
        k.startsWith('customer:')
    ).length;
    
    const indexCount = allKeys.filter(k => 
        k.startsWith('idx:customer:')
    ).length;
    
    return { oldKeyCount, newKeyCount, indexCount };
}

/**
 * Migration export for the migration runner
 */
import type { Migration } from '../../shared/migration-runner.js';

export const migration: Migration = {
    id: '001_migrate_to_unified_keys',
    description: 'Migrate from scattered key patterns to unified entity/index pattern',
    
    async up(kv, env): Promise<void> {
        console.log('[Migration 001] Starting unified key migration for customer-api...');
        
        const result = await runMigration(
            { CUSTOMER_KV: kv, OTP_AUTH_KV: env?.OTP_AUTH_KV } as Env,
            {
                dryRun: false,
                deleteOld: false,
                verbose: true,
            }
        );
        
        if (!result.success) {
            console.error('[Migration 001] Migration completed with errors:', result.errors);
        }
        
        console.log('[Migration 001] Complete. Stats:', result.stats);
    },
    
    async down(): Promise<void> {
        console.log('[Migration 001] Down migration not implemented - manual rollback required');
    }
};
