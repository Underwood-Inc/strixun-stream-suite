/**
 * Migration: Unified Key Structure for Access Service
 * 
 * Migrates from old prefix-based patterns to unified entity/index pattern.
 * 
 * OLD PATTERNS:
 *   access_{customerId}     → Customer authorization data
 *   role_{roleName}         → Role definitions
 *   permission_{permName}   → Permission definitions
 *   audit_{customerId}_{ts} → Audit log entries
 *   system_seeded           → System initialization flag
 * 
 * NEW PATTERNS:
 *   access:customer-auth:{customerId}
 *   access:role:{roleName}
 *   access:permission:{permissionName}
 *   access:audit:{customerId}_{timestamp}
 *   access:system:seeded
 *   idx:access:roles-all:list           → Array of all role names
 *   idx:access:permissions-all:list     → Array of all permission names
 */

interface MigrationStats {
    customerAuth: { processed: number; errors: number };
    roles: { processed: number; errors: number };
    permissions: { processed: number; errors: number };
    audit: { processed: number; errors: number };
    system: { processed: number; errors: number };
    indexes: { processed: number; errors: number };
}

interface Env {
    ACCESS_KV: KVNamespace;
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
    const kv = env.ACCESS_KV;
    const errors: string[] = [];
    
    const stats: MigrationStats = {
        customerAuth: { processed: 0, errors: 0 },
        roles: { processed: 0, errors: 0 },
        permissions: { processed: 0, errors: 0 },
        audit: { processed: 0, errors: 0 },
        system: { processed: 0, errors: 0 },
        indexes: { processed: 0, errors: 0 },
    };
    
    const log = (msg: string) => {
        if (verbose) console.log(`[Migration] ${msg}`);
    };
    
    log(`Starting migration (dryRun=${dryRun}, deleteOld=${deleteOld})`);
    
    // Track for index building
    const allRoleNames: string[] = [];
    const allPermissionNames: string[] = [];
    
    try {
        const allKeys = await scanAllKeys(kv);
        log(`Found ${allKeys.length} total keys`);
        
        // ===== Customer Authorization =====
        log('Migrating customer authorization...');
        const accessKeys = allKeys.filter(k => 
            k.startsWith('access_') && !k.startsWith('access:')
        );
        
        for (const oldKey of accessKeys) {
            try {
                const data = await kv.get(oldKey, { type: 'json' });
                if (!data) continue;
                
                const customerId = oldKey.replace('access_', '');
                const newKey = `access:customer-auth:${customerId}`;
                
                if (!dryRun) {
                    await kv.put(newKey, JSON.stringify(data));
                    if (deleteOld) await kv.delete(oldKey);
                }
                
                stats.customerAuth.processed++;
            } catch (error) {
                stats.customerAuth.errors++;
                errors.push(`CustomerAuth ${oldKey}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        
        // ===== Role Definitions =====
        log('Migrating role definitions...');
        const roleKeys = allKeys.filter(k => 
            k.startsWith('role_') && !k.startsWith('access:')
        );
        
        for (const oldKey of roleKeys) {
            try {
                const data = await kv.get(oldKey, { type: 'json' }) as any;
                if (!data) continue;
                
                const roleName = oldKey.replace('role_', '');
                const newKey = `access:role:${roleName}`;
                allRoleNames.push(roleName);
                
                if (!dryRun) {
                    await kv.put(newKey, JSON.stringify(data));
                    if (deleteOld) await kv.delete(oldKey);
                }
                
                stats.roles.processed++;
            } catch (error) {
                stats.roles.errors++;
                errors.push(`Role ${oldKey}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        
        // ===== Permission Definitions =====
        log('Migrating permission definitions...');
        const permissionKeys = allKeys.filter(k => 
            k.startsWith('permission_') && !k.startsWith('access:')
        );
        
        for (const oldKey of permissionKeys) {
            try {
                const data = await kv.get(oldKey, { type: 'json' }) as any;
                if (!data) continue;
                
                const permissionName = oldKey.replace('permission_', '');
                const newKey = `access:permission:${permissionName}`;
                allPermissionNames.push(permissionName);
                
                if (!dryRun) {
                    await kv.put(newKey, JSON.stringify(data));
                    if (deleteOld) await kv.delete(oldKey);
                }
                
                stats.permissions.processed++;
            } catch (error) {
                stats.permissions.errors++;
                errors.push(`Permission ${oldKey}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        
        // ===== Audit Logs =====
        log('Migrating audit logs...');
        const auditKeys = allKeys.filter(k => 
            k.startsWith('audit_') && !k.startsWith('access:')
        );
        
        for (const oldKey of auditKeys) {
            try {
                const data = await kv.get(oldKey, { type: 'json' });
                if (!data) continue;
                
                // Old format: audit_{customerId}_{timestamp}
                const keyPart = oldKey.replace('audit_', '');
                const newKey = `access:audit:${keyPart}`;
                
                if (!dryRun) {
                    await kv.put(newKey, JSON.stringify(data));
                    if (deleteOld) await kv.delete(oldKey);
                }
                
                stats.audit.processed++;
            } catch (error) {
                stats.audit.errors++;
                errors.push(`Audit ${oldKey}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        
        // ===== System Flags =====
        log('Migrating system flags...');
        if (allKeys.includes('system_seeded')) {
            try {
                const data = await kv.get('system_seeded');
                if (data) {
                    const newKey = 'access:system:seeded';
                    
                    if (!dryRun) {
                        await kv.put(newKey, data);
                        if (deleteOld) await kv.delete('system_seeded');
                    }
                    
                    stats.system.processed++;
                }
            } catch (error) {
                stats.system.errors++;
                errors.push(`System seeded: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        
        // ===== Build Indexes =====
        log('Building indexes...');
        
        if (allRoleNames.length > 0 && !dryRun) {
            await kv.put('idx:access:roles-all:list', JSON.stringify(allRoleNames));
            stats.indexes.processed++;
        }
        
        if (allPermissionNames.length > 0 && !dryRun) {
            await kv.put('idx:access:permissions-all:list', JSON.stringify(allPermissionNames));
            stats.indexes.processed++;
        }
        
        log('Migration complete!');
        log(`CustomerAuth: ${stats.customerAuth.processed} processed, ${stats.customerAuth.errors} errors`);
        log(`Roles: ${stats.roles.processed} processed, ${stats.roles.errors} errors`);
        log(`Permissions: ${stats.permissions.processed} processed, ${stats.permissions.errors} errors`);
        log(`Audit: ${stats.audit.processed} processed, ${stats.audit.errors} errors`);
        log(`System: ${stats.system.processed} processed, ${stats.system.errors} errors`);
        log(`Indexes: ${stats.indexes.processed} created`);
        
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
    const kv = env.ACCESS_KV;
    const allKeys = await scanAllKeys(kv);
    
    const oldKeyCount = allKeys.filter(k => 
        k.startsWith('access_') ||
        k.startsWith('role_') ||
        k.startsWith('permission_') ||
        k.startsWith('audit_') ||
        k === 'system_seeded'
    ).length;
    
    const newKeyCount = allKeys.filter(k => 
        k.startsWith('access:')
    ).length;
    
    const indexCount = allKeys.filter(k => 
        k.startsWith('idx:access:')
    ).length;
    
    return { oldKeyCount, newKeyCount, indexCount };
}
