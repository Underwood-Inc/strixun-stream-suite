/**
 * Authorization KV Utilities
 * 
 * Low-level utilities for reading/writing authorization data to KV.
 * All KV keys are prefixed for namespace organization.
 */

import type {
    CustomerAuthorization,
    RoleDefinition,
    PermissionDefinition,
    AuditLogEntry,
    Env,
} from '../types/authorization.js';

/**
 * KV key prefixes
 */
const KEYS = {
    ACCESS: 'access_',
    ROLE: 'role_',
    PERMISSION: 'permission_',
    AUDIT: 'audit_',
    SEEDED: 'system_seeded',
} as const;

/**
 * Get customer authorization from KV
 */
export async function getCustomerAccess(
    customerId: string,
    env: Env
): Promise<CustomerAuthorization | null> {
    const key = `${KEYS.ACCESS}${customerId}`;
    const data = await env.ACCESS_KV.get(key, { type: 'json' });
    return data as CustomerAuthorization | null;
}

/**
 * Save customer authorization to KV
 */
export async function saveCustomerAccess(
    access: CustomerAuthorization,
    env: Env
): Promise<void> {
    const key = `${KEYS.ACCESS}${access.customerId}`;
    await env.ACCESS_KV.put(key, JSON.stringify(access));
}

/**
 * Delete customer authorization from KV
 */
export async function deleteCustomerAccess(
    customerId: string,
    env: Env
): Promise<void> {
    const key = `${KEYS.ACCESS}${customerId}`;
    await env.ACCESS_KV.delete(key);
}

/**
 * Get role definition from KV
 */
export async function getRoleDefinition(
    roleName: string,
    env: Env
): Promise<RoleDefinition | null> {
    const key = `${KEYS.ROLE}${roleName}`;
    const data = await env.ACCESS_KV.get(key, { type: 'json' });
    return data as RoleDefinition | null;
}

/**
 * Save role definition to KV
 */
export async function saveRoleDefinition(
    role: RoleDefinition,
    env: Env
): Promise<void> {
    const key = `${KEYS.ROLE}${role.name}`;
    await env.ACCESS_KV.put(key, JSON.stringify(role));
}

/**
 * Delete role definition from KV
 */
export async function deleteRoleDefinition(
    roleName: string,
    env: Env
): Promise<void> {
    const key = `${KEYS.ROLE}${roleName}`;
    await env.ACCESS_KV.delete(key);
}

/**
 * List all role definitions
 */
export async function listRoleDefinitions(env: Env): Promise<RoleDefinition[]> {
    const roles: RoleDefinition[] = [];
    let cursor: string | undefined;
    
    do {
        const result = await env.ACCESS_KV.list({
            prefix: KEYS.ROLE,
            cursor,
        });
        
        for (const key of result.keys) {
            const roleData = await env.ACCESS_KV.get(key.name, { type: 'json' });
            if (roleData) {
                roles.push(roleData as RoleDefinition);
            }
        }
        
        cursor = result.list_complete ? undefined : result.cursor;
    } while (cursor);
    
    // Sort by priority descending (highest priority first)
    return roles.sort((a, b) => b.priority - a.priority);
}

/**
 * Get permission definition from KV
 */
export async function getPermissionDefinition(
    permissionName: string,
    env: Env
): Promise<PermissionDefinition | null> {
    const key = `${KEYS.PERMISSION}${permissionName}`;
    const data = await env.ACCESS_KV.get(key, { type: 'json' });
    return data as PermissionDefinition | null;
}

/**
 * Save permission definition to KV
 */
export async function savePermissionDefinition(
    permission: PermissionDefinition,
    env: Env
): Promise<void> {
    const key = `${KEYS.PERMISSION}${permission.name}`;
    await env.ACCESS_KV.put(key, JSON.stringify(permission));
}

/**
 * List all permission definitions
 */
export async function listPermissionDefinitions(env: Env): Promise<PermissionDefinition[]> {
    const permissions: PermissionDefinition[] = [];
    let cursor: string | undefined;
    
    do {
        const result = await env.ACCESS_KV.list({
            prefix: KEYS.PERMISSION,
            cursor,
        });
        
        for (const key of result.keys) {
            const permData = await env.ACCESS_KV.get(key.name, { type: 'json' });
            if (permData) {
                permissions.push(permData as PermissionDefinition);
            }
        }
        
        cursor = result.list_complete ? undefined : result.cursor;
    } while (cursor);
    
    // Sort by category, then name
    return permissions.sort((a, b) => {
        const catCompare = a.category.localeCompare(b.category);
        return catCompare !== 0 ? catCompare : a.name.localeCompare(b.name);
    });
}

/**
 * Add audit log entry
 */
export async function addAuditLog(
    customerId: string,
    entry: AuditLogEntry,
    env: Env
): Promise<void> {
    const timestamp = Date.now();
    const key = `${KEYS.AUDIT}${customerId}_${timestamp}`;
    await env.ACCESS_KV.put(key, JSON.stringify(entry), {
        expirationTtl: 31536000, // 1 year
    });
}

/**
 * Get audit logs for a customer
 */
export async function getAuditLogs(
    customerId: string,
    env: Env,
    limit: number = 100
): Promise<AuditLogEntry[]> {
    const logs: AuditLogEntry[] = [];
    const prefix = `${KEYS.AUDIT}${customerId}_`;
    let cursor: string | undefined;
    
    do {
        const result = await env.ACCESS_KV.list({
            prefix,
            cursor,
        });
        
        for (const key of result.keys) {
            if (logs.length >= limit) break;
            
            const logData = await env.ACCESS_KV.get(key.name, { type: 'json' });
            if (logData) {
                logs.push(logData as AuditLogEntry);
            }
        }
        
        if (logs.length >= limit) break;
        cursor = result.list_complete ? undefined : result.cursor;
    } while (cursor);
    
    // Sort by timestamp descending (newest first)
    return logs.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
}

/**
 * Check if default roles/permissions have been seeded
 */
export async function isSeeded(env: Env): Promise<boolean> {
    const value = await env.ACCESS_KV.get(KEYS.SEEDED);
    return value === 'true';
}

/**
 * Mark as seeded
 */
export async function markSeeded(env: Env): Promise<void> {
    await env.ACCESS_KV.put(KEYS.SEEDED, 'true');
}
