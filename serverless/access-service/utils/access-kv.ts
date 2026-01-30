/**
 * Authorization KV Utilities
 * 
 * Low-level utilities for reading/writing authorization data to KV.
 * Uses unified entity key pattern: access:{entity}:{id}
 */

import type {
    CustomerAuthorization,
    RoleDefinition,
    PermissionDefinition,
    AuditLogEntry,
    Env,
} from '../types/authorization.js';

/**
 * KV key builders using unified pattern
 */
const KEYS = {
    customerAuth: (customerId: string) => `access:customer-auth:${customerId}`,
    role: (roleName: string) => `access:role:${roleName}`,
    permission: (permName: string) => `access:permission:${permName}`,
    audit: (customerId: string, timestamp: number) => `access:audit:${customerId}_${timestamp}`,
    seeded: 'access:system:seeded',
    // Index keys
    rolesIndex: 'idx:access:roles-all:list',
    permissionsIndex: 'idx:access:permissions-all:list',
} as const;

/**
 * Get customer authorization from KV
 */
export async function getCustomerAccess(
    customerId: string,
    env: Env
): Promise<CustomerAuthorization | null> {
    const key = KEYS.customerAuth(customerId);
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
    const key = KEYS.customerAuth(access.customerId);
    await env.ACCESS_KV.put(key, JSON.stringify(access));
}

/**
 * Delete customer authorization from KV
 */
export async function deleteCustomerAccess(
    customerId: string,
    env: Env
): Promise<void> {
    const key = KEYS.customerAuth(customerId);
    await env.ACCESS_KV.delete(key);
}

/**
 * Get role definition from KV
 */
export async function getRoleDefinition(
    roleName: string,
    env: Env
): Promise<RoleDefinition | null> {
    const key = KEYS.role(roleName);
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
    const key = KEYS.role(role.name);
    await env.ACCESS_KV.put(key, JSON.stringify(role));
    
    // Update roles index
    await updateRolesIndex(env);
}

/**
 * Delete role definition from KV
 */
export async function deleteRoleDefinition(
    roleName: string,
    env: Env
): Promise<void> {
    const key = KEYS.role(roleName);
    await env.ACCESS_KV.delete(key);
    
    // Update roles index
    await updateRolesIndex(env);
}

/**
 * Update the roles index by scanning all role keys
 */
async function updateRolesIndex(env: Env): Promise<void> {
    const roleNames: string[] = [];
    let cursor: string | undefined;
    
    do {
        const result = await env.ACCESS_KV.list({
            prefix: 'access:role:',
            cursor,
        });
        
        for (const key of result.keys) {
            // Extract role name from key: access:role:{roleName}
            const roleName = key.name.replace('access:role:', '');
            roleNames.push(roleName);
        }
        
        cursor = result.list_complete ? undefined : result.cursor;
    } while (cursor);
    
    await env.ACCESS_KV.put(KEYS.rolesIndex, JSON.stringify(roleNames));
}

/**
 * List all role definitions
 */
export async function listRoleDefinitions(env: Env): Promise<RoleDefinition[]> {
    const roles: RoleDefinition[] = [];
    let cursor: string | undefined;
    
    do {
        const result = await env.ACCESS_KV.list({
            prefix: 'access:role:',
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
    const key = KEYS.permission(permissionName);
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
    const key = KEYS.permission(permission.name);
    await env.ACCESS_KV.put(key, JSON.stringify(permission));
    
    // Update permissions index
    await updatePermissionsIndex(env);
}

/**
 * Update the permissions index by scanning all permission keys
 */
async function updatePermissionsIndex(env: Env): Promise<void> {
    const permissionNames: string[] = [];
    let cursor: string | undefined;
    
    do {
        const result = await env.ACCESS_KV.list({
            prefix: 'access:permission:',
            cursor,
        });
        
        for (const key of result.keys) {
            // Extract permission name from key: access:permission:{permName}
            const permName = key.name.replace('access:permission:', '');
            permissionNames.push(permName);
        }
        
        cursor = result.list_complete ? undefined : result.cursor;
    } while (cursor);
    
    await env.ACCESS_KV.put(KEYS.permissionsIndex, JSON.stringify(permissionNames));
}

/**
 * List all permission definitions
 */
export async function listPermissionDefinitions(env: Env): Promise<PermissionDefinition[]> {
    const permissions: PermissionDefinition[] = [];
    let cursor: string | undefined;
    
    do {
        const result = await env.ACCESS_KV.list({
            prefix: 'access:permission:',
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
    const key = KEYS.audit(customerId, timestamp);
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
    const prefix = `access:audit:${customerId}_`;
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
    const value = await env.ACCESS_KV.get(KEYS.seeded);
    return value === 'true';
}

/**
 * Mark as seeded
 */
export async function markSeeded(env: Env): Promise<void> {
    await env.ACCESS_KV.put(KEYS.seeded, 'true');
}
