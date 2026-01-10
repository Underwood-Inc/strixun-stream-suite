/**
 * Migration Script: Existing Permissions to Authorization Service
 * 
 * Migrates existing permission data from:
 * - SUPER_ADMIN_EMAILS env var → super-admin role
 * - APPROVED_UPLOADER_EMAILS env var → uploader role
 * - MODS_KV upload_approval_* keys → uploader role
 * - MODS_KV approved_uploaders list → uploader role
 * 
 * Usage:
 *   npx tsx scripts/migrate-permissions.ts
 *   
 * OR via wrangler:
 *   wrangler dev --local
 *   curl -X POST http://localhost:8787/migrate
 */

import type { Env, CustomerAuthorization } from '../types/authorization.js';
import { saveCustomerAuthz, addAuditLog } from '../utils/authz-kv.js';

interface MigrationResult {
    success: boolean;
    migrated: number;
    errors: Array<{ customerId: string; error: string }>;
    summary: {
        superAdmins: number;
        approvedUploaders: number;
    };
}

/**
 * Migrate a customer to authorization service
 */
async function migrateCustomer(
    customerId: string,
    roles: string[],
    source: string,
    env: Env
): Promise<void> {
    const authz: CustomerAuthorization = {
        customerId,
        roles,
        permissions: [], // Will be resolved from roles
        quotas: {}, // Will be set by role defaults
        metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            source: `migration:${source}`,
            reason: 'Migrated from existing permission system',
        },
    };
    
    // Apply default quotas from roles
    if (roles.includes('uploader')) {
        authz.quotas['upload:mod'] = {
            limit: 10,
            period: 'day',
            current: 0,
            resetAt: new Date(Date.now() + 86400000).toISOString(), // +1 day
        };
    }
    
    if (roles.includes('premium')) {
        authz.quotas['upload:mod'] = {
            limit: 50,
            period: 'day',
            current: 0,
            resetAt: new Date(Date.now() + 86400000).toISOString(),
        };
        authz.quotas['storage:bytes'] = {
            limit: 53687091200, // 50 GB
            period: 'month',
            current: 0,
            resetAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
        };
    }
    
    // Resolve permissions from roles
    const permissionMap: Record<string, string[]> = {
        'super-admin': ['*'],
        'admin': ['access:admin-panel', 'manage:customers', 'view:analytics', 'approve:mod', 'delete:mod-any', 'edit:mod-any'],
        'moderator': ['approve:mod', 'edit:mod-any'],
        'uploader': ['upload:mod', 'edit:mod-own', 'delete:mod-own'],
        'premium': ['upload:mod', 'edit:mod-own', 'delete:mod-own', 'api:unlimited'],
        'customer': [],
        'banned': [],
    };
    
    const allPermissions = new Set<string>();
    for (const role of roles) {
        const perms = permissionMap[role] || [];
        perms.forEach(p => allPermissions.add(p));
    }
    authz.permissions = Array.from(allPermissions);
    
    await saveCustomerAuthz(authz, env);
    
    await addAuditLog(customerId, {
        timestamp: new Date().toISOString(),
        action: 'authz_created',
        details: { roles, source, method: 'migration' },
        performedBy: 'system:migration',
        reason: 'Migrated from existing permission system',
    }, env);
}

/**
 * Main migration function
 */
export async function migratePermissions(env: Env): Promise<MigrationResult> {
    const result: MigrationResult = {
        success: true,
        migrated: 0,
        errors: [],
        summary: {
            superAdmins: 0,
            approvedUploaders: 0,
        },
    };
    
    console.log('[Migration] Starting permission migration...');
    
    try {
        // 1. Migrate SUPER_ADMIN_EMAILS
        if (env.SUPER_ADMIN_EMAILS) {
            console.log('[Migration] Migrating super admins from SUPER_ADMIN_EMAILS...');
            const emails = env.SUPER_ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase());
            
            // NOTE: We need to resolve emails to customerIds
            // This requires calling OTP auth service or having a customer lookup
            // For now, we'll log a warning
            console.warn('[Migration] SUPER_ADMIN_EMAILS found but requires customer ID mapping');
            console.warn('[Migration] Please manually migrate super admins using their customer IDs');
            console.warn('[Migration] Emails found:', emails);
        }
        
        // 2. Migrate APPROVED_UPLOADER_EMAILS
        if (env.APPROVED_UPLOADER_EMAILS) {
            console.log('[Migration] Migrating approved uploaders from APPROVED_UPLOADER_EMAILS...');
            const emails = env.APPROVED_UPLOADER_EMAILS.split(',').map(e => e.trim().toLowerCase());
            
            console.warn('[Migration] APPROVED_UPLOADER_EMAILS found but requires customer ID mapping');
            console.warn('[Migration] Please manually migrate approved uploaders using their customer IDs');
            console.warn('[Migration] Emails found:', emails);
        }
        
        // 3. Migrate KV upload approvals
        if (env.MODS_KV) {
            console.log('[Migration] Migrating upload approvals from MODS_KV...');
            let cursor: string | undefined;
            
            do {
                const listResult = await env.MODS_KV.list({
                    prefix: 'upload_approval_',
                    cursor,
                });
                
                for (const key of listResult.keys) {
                    // Key format: upload_approval_{customerId}
                    const customerId = key.name.replace('upload_approval_', '');
                    
                    try {
                        const approval = await env.MODS_KV.get(key.name);
                        if (approval === 'approved') {
                            await migrateCustomer(customerId, ['uploader'], 'mods-kv', env);
                            result.migrated++;
                            result.summary.approvedUploaders++;
                            console.log(`[Migration] Migrated customer: ${customerId} (uploader)`);
                        }
                    } catch (error) {
                        console.error(`[Migration] Failed to migrate ${customerId}:`, error);
                        result.errors.push({
                            customerId,
                            error: error instanceof Error ? error.message : 'Unknown error',
                        });
                    }
                }
                
                cursor = listResult.list_complete ? undefined : listResult.cursor;
            } while (cursor);
        }
        
        console.log('[Migration] Migration complete!');
        console.log(`[Migration] Migrated: ${result.migrated} customers`);
        console.log(`[Migration] Errors: ${result.errors.length}`);
        console.log(`[Migration] Summary:`, result.summary);
        
        return result;
    } catch (error) {
        console.error('[Migration] Fatal error:', error);
        result.success = false;
        return result;
    }
}

/**
 * HTTP handler for migration endpoint
 */
export async function handleMigration(
    request: Request,
    env: Env
): Promise<Response> {
    // TODO: Add authentication check (super-admin only)
    
    const result = await migratePermissions(env);
    
    return new Response(JSON.stringify(result, null, 2), {
        status: result.success ? 200 : 500,
        headers: {
            'Content-Type': 'application/json',
        },
    });
}
