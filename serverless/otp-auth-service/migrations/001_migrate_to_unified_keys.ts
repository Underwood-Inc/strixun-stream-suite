/**
 * Migration: Unified Key Structure for OTP Auth Service
 * 
 * Migrates from old scattered key patterns to unified entity/index pattern.
 * 
 * OLD PATTERNS:
 *   session_{customerId}                    → Sessions
 *   customer_{emailHash}                    → Customer sessions
 *   customer_{customerId}_apikeys           → API keys list
 *   blacklist_{tokenHash}                   → JWT deny list
 *   twitch_{twitchUserId}                   → Twitch links
 *   onboarding_{customerId}                 → Onboarding state
 * 
 * NEW PATTERNS:
 *   otp-auth:session:{customerId}           → Sessions
 *   otp-auth:customer-session:{customerId}_{emailHash}
 *   otp-auth:customer-apikeys:{customerId}
 *   otp-auth:jwt-denylist:{customerId}_{tokenHash}
 *   otp-auth:twitch-link:{customerId}_{twitchUserId}
 *   otp-auth:onboarding:{customerId}
 * 
 * NOTE: Ephemeral data (OTPs, rate limits, analytics) are NOT migrated
 * as they expire quickly and will naturally use new patterns.
 */

interface MigrationStats {
    sessions: { processed: number; errors: number };
    customerSessions: { processed: number; errors: number };
    apiKeys: { processed: number; errors: number };
    jwtDenyList: { processed: number; errors: number };
    twitchLinks: { processed: number; errors: number };
    onboarding: { processed: number; errors: number };
}

interface Env {
    OTP_AUTH_KV: KVNamespace;
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
    const kv = env.OTP_AUTH_KV;
    const errors: string[] = [];
    
    const stats: MigrationStats = {
        sessions: { processed: 0, errors: 0 },
        customerSessions: { processed: 0, errors: 0 },
        apiKeys: { processed: 0, errors: 0 },
        jwtDenyList: { processed: 0, errors: 0 },
        twitchLinks: { processed: 0, errors: 0 },
        onboarding: { processed: 0, errors: 0 },
    };
    
    const log = (msg: string) => {
        if (verbose) console.log(`[Migration] ${msg}`);
    };
    
    log(`Starting migration (dryRun=${dryRun}, deleteOld=${deleteOld})`);
    
    try {
        const allKeys = await scanAllKeys(kv);
        log(`Found ${allKeys.length} total keys`);
        
        // ===== Sessions =====
        log('Migrating sessions...');
        const sessionKeys = allKeys.filter(k => 
            k.startsWith('session_') && !k.startsWith('otp-auth:')
        );
        
        for (const oldKey of sessionKeys) {
            try {
                const data = await kv.get(oldKey, { type: 'json' });
                if (!data) continue;
                
                // Extract customerId from key
                const customerId = oldKey.replace('session_', '');
                const newKey = `otp-auth:session:${customerId}`;
                
                if (!dryRun) {
                    await kv.put(newKey, JSON.stringify(data));
                    if (deleteOld) await kv.delete(oldKey);
                }
                
                stats.sessions.processed++;
            } catch (error) {
                stats.sessions.errors++;
                errors.push(`Session ${oldKey}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        
        // ===== Customer Sessions =====
        log('Migrating customer sessions...');
        const customerSessionKeys = allKeys.filter(k => 
            k.startsWith('customer_') && !k.includes('_apikeys') && !k.startsWith('otp-auth:')
        );
        
        for (const oldKey of customerSessionKeys) {
            try {
                const data = await kv.get(oldKey, { type: 'json' }) as any;
                if (!data) continue;
                
                // Try to extract customerId and emailHash
                // Old format: customer_{emailHash} or customer_{customerId}_{emailHash}
                const keyPart = oldKey.replace('customer_', '');
                const customerId = data.customerId || keyPart;
                
                // Create new key with composite ID
                const newKey = `otp-auth:customer-session:${customerId}`;
                
                if (!dryRun) {
                    await kv.put(newKey, JSON.stringify(data));
                    if (deleteOld) await kv.delete(oldKey);
                }
                
                stats.customerSessions.processed++;
            } catch (error) {
                stats.customerSessions.errors++;
                errors.push(`CustomerSession ${oldKey}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        
        // ===== API Keys =====
        log('Migrating API keys...');
        const apiKeyKeys = allKeys.filter(k => 
            k.includes('_apikeys') && !k.startsWith('otp-auth:')
        );
        
        for (const oldKey of apiKeyKeys) {
            try {
                const data = await kv.get(oldKey, { type: 'json' });
                if (!data) continue;
                
                // Extract customerId from key: customer_{customerId}_apikeys
                const match = oldKey.match(/customer_([^_]+)_apikeys/);
                if (!match) continue;
                
                const customerId = match[1];
                const newKey = `otp-auth:customer-apikeys:${customerId}`;
                
                if (!dryRun) {
                    await kv.put(newKey, JSON.stringify(data));
                    if (deleteOld) await kv.delete(oldKey);
                }
                
                stats.apiKeys.processed++;
            } catch (error) {
                stats.apiKeys.errors++;
                errors.push(`APIKeys ${oldKey}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        
        // ===== JWT Deny List =====
        log('Migrating JWT deny list...');
        const denyListKeys = allKeys.filter(k => 
            k.startsWith('blacklist_') && !k.startsWith('otp-auth:')
        );
        
        for (const oldKey of denyListKeys) {
            try {
                const data = await kv.get(oldKey, { type: 'json' }) as any;
                if (!data) continue;
                
                const tokenHash = oldKey.replace('blacklist_', '');
                const customerId = data.customerId || 'unknown';
                const newKey = `otp-auth:jwt-denylist:${customerId}_${tokenHash}`;
                
                if (!dryRun) {
                    await kv.put(newKey, JSON.stringify(data));
                    if (deleteOld) await kv.delete(oldKey);
                }
                
                stats.jwtDenyList.processed++;
            } catch (error) {
                stats.jwtDenyList.errors++;
                errors.push(`JwtDenyList ${oldKey}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        
        // ===== Twitch Links =====
        log('Migrating Twitch links...');
        const twitchKeys = allKeys.filter(k => 
            k.startsWith('twitch_') && !k.startsWith('otp-auth:')
        );
        
        for (const oldKey of twitchKeys) {
            try {
                const data = await kv.get(oldKey, { type: 'json' }) as any;
                if (!data) continue;
                
                const twitchUserId = oldKey.replace('twitch_', '');
                const customerId = data.customerId || 'unknown';
                const newKey = `otp-auth:twitch-link:${customerId}_${twitchUserId}`;
                
                if (!dryRun) {
                    await kv.put(newKey, JSON.stringify(data));
                    if (deleteOld) await kv.delete(oldKey);
                }
                
                stats.twitchLinks.processed++;
            } catch (error) {
                stats.twitchLinks.errors++;
                errors.push(`TwitchLink ${oldKey}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        
        // ===== Onboarding =====
        log('Migrating onboarding state...');
        const onboardingKeys = allKeys.filter(k => 
            k.startsWith('onboarding_') && !k.startsWith('otp-auth:')
        );
        
        for (const oldKey of onboardingKeys) {
            try {
                const data = await kv.get(oldKey, { type: 'json' });
                if (!data) continue;
                
                const customerId = oldKey.replace('onboarding_', '');
                const newKey = `otp-auth:onboarding:${customerId}`;
                
                if (!dryRun) {
                    await kv.put(newKey, JSON.stringify(data));
                    if (deleteOld) await kv.delete(oldKey);
                }
                
                stats.onboarding.processed++;
            } catch (error) {
                stats.onboarding.errors++;
                errors.push(`Onboarding ${oldKey}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        
        log('Migration complete!');
        log(`Sessions: ${stats.sessions.processed} processed, ${stats.sessions.errors} errors`);
        log(`CustomerSessions: ${stats.customerSessions.processed} processed, ${stats.customerSessions.errors} errors`);
        log(`APIKeys: ${stats.apiKeys.processed} processed, ${stats.apiKeys.errors} errors`);
        log(`JwtDenyList: ${stats.jwtDenyList.processed} processed, ${stats.jwtDenyList.errors} errors`);
        log(`TwitchLinks: ${stats.twitchLinks.processed} processed, ${stats.twitchLinks.errors} errors`);
        log(`Onboarding: ${stats.onboarding.processed} processed, ${stats.onboarding.errors} errors`);
        
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
}> {
    const kv = env.OTP_AUTH_KV;
    const allKeys = await scanAllKeys(kv);
    
    const oldKeyCount = allKeys.filter(k => 
        k.startsWith('session_') ||
        k.startsWith('customer_') ||
        k.startsWith('blacklist_') || // Old deny list pattern
        k.startsWith('twitch_') ||
        k.startsWith('onboarding_')
    ).length;
    
    const newKeyCount = allKeys.filter(k => 
        k.startsWith('otp-auth:')
    ).length;
    
    return { oldKeyCount, newKeyCount };
}
