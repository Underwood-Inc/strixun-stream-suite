/**
 * Admin utilities for mods API
 * 
 * NEW: Now uses Authorization Service for all permission checks.
 * All email-based permission checks have been migrated to role-based authorization.
 * 
 * @module admin
 */

import { createAuthzClient } from '../../shared/authz-client.js';

interface Env {
    MODS_KV: KVNamespace;
    AUTHORIZATION_SERVICE_URL?: string;
    SERVICE_API_KEY?: string;
    [key: string]: any;
}

/**
 * Check if a customer is a super admin
 * Uses Authorization Service to check for 'super-admin' role
 * 
 * @param customerId - Customer ID
 * @param env - Environment
 * @returns True if customer has super-admin role
 */
export async function isSuperAdmin(customerId: string, env: Env): Promise<boolean> {
    try {
        const authz = createAuthzClient(env);
        return await authz.isSuperAdmin(customerId);
    } catch (error) {
        console.error('[Admin] Failed to check super admin status:', error);
        return false; // Fail closed
    }
}

/**
 * Check if a customer is an admin (includes super-admins)
 * Uses Authorization Service to check for 'admin' or 'super-admin' role
 * 
 * @param customerId - Customer ID
 * @param env - Environment
 * @returns True if customer has admin or super-admin role
 */
export async function isAdmin(customerId: string, env: Env): Promise<boolean> {
    try {
        const authz = createAuthzClient(env);
        return await authz.isAdmin(customerId);
    } catch (error) {
        console.error('[Admin] Failed to check admin status:', error);
        return false; // Fail closed
    }
}

/**
 * Check if customer has upload permission
 * 
 * NEW: Uses Authorization Service to check 'upload:mod' permission
 * ALL authenticated customers have this permission by default via 'customer' role
 * 
 * @param customerId - Customer ID
 * @param env - Environment
 * @returns True if customer has upload permission
 */
export async function hasUploadPermission(customerId: string, env: Env): Promise<boolean> {
    if (!customerId) {
        console.log('[Admin] No customerId provided - not authenticated');
        return false;
    }

    try {
        const authz = createAuthzClient(env);
        const hasPermission = await authz.checkPermission(customerId, 'upload:mod');
        
        console.log('[Admin] Upload permission check:', { customerId, hasPermission });
        return hasPermission;
    } catch (error) {
        console.error('[Admin] Failed to check upload permission:', error);
        return false; // Fail closed
    }
}

/**
 * Check if customer has permission to manage (edit/delete) a specific mod
 * 
 * Rules:
 * - Mod author can always manage their own mods
 * - Super admins can manage any mod
 * - Admins can manage any mod
 * 
 * @param customerId - Customer ID making the request
 * @param modAuthorId - Author ID of the mod
 * @param env - Environment
 * @returns True if customer can manage the mod
 */
export async function canManageMod(
    customerId: string,
    modAuthorId: string,
    env: Env
): Promise<boolean> {
    // Mod author can always manage their own mods
    if (customerId === modAuthorId) {
        return true;
    }

    // Check if user has admin permissions (can manage any mod)
    try {
        const authz = createAuthzClient(env);
        const hasAdminPerm = await authz.checkPermission(customerId, 'edit:mod-any');
        return hasAdminPerm;
    } catch (error) {
        console.error('[Admin] Failed to check manage permission:', error);
        return false; // Fail closed
    }
}

/**
 * Check if customer has permission to delete any mod
 * Only super admins and admins with 'delete:mod-any' permission
 * 
 * @param customerId - Customer ID
 * @param env - Environment
 * @returns True if customer can delete any mod
 */
export async function canDeleteAnyMod(customerId: string, env: Env): Promise<boolean> {
    try {
        const authz = createAuthzClient(env);
        return await authz.checkPermission(customerId, 'delete:mod-any');
    } catch (error) {
        console.error('[Admin] Failed to check delete permission:', error);
        return false; // Fail closed
    }
}

/**
 * Check if customer has permission to review/approve mods
 * Requires 'review:mod' permission (moderator, admin, super-admin)
 * 
 * @param customerId - Customer ID
 * @param env - Environment
 * @returns True if customer can review mods
 */
export async function canReviewMods(customerId: string, env: Env): Promise<boolean> {
    try {
        const authz = createAuthzClient(env);
        return await authz.checkPermission(customerId, 'review:mod');
    } catch (error) {
        console.error('[Admin] Failed to check review permission:', error);
        return false; // Fail closed
    }
}

/**
 * Check if customer has admin dashboard access
 * Requires 'admin:dashboard' permission (admin, super-admin)
 * 
 * @param customerId - Customer ID
 * @param env - Environment
 * @returns True if customer can access admin dashboard
 */
export async function hasAdminDashboardAccess(customerId: string, env: Env): Promise<boolean> {
    try {
        const authz = createAuthzClient(env);
        return await authz.checkPermission(customerId, 'admin:dashboard');
    } catch (error) {
        console.error('[Admin] Failed to check dashboard access:', error);
        return false; // Fail closed
    }
}

/**
 * Get comprehensive permission info for a customer
 * Returns all roles, permissions, and quotas from Authorization Service
 * 
 * @param customerId - Customer ID
 * @param env - Environment
 * @returns Customer authorization data or null
 */
export async function getCustomerPermissionInfo(customerId: string, env: Env) {
    try {
        const authz = createAuthzClient(env);
        const authorization = await authz.getCustomerAuthorization(customerId);
        
        if (!authorization) {
            return {
                hasUploadPermission: false,
                isAdmin: false,
                isSuperAdmin: false,
                roles: [],
                permissions: [],
                permissionSource: 'none',
            };
        }

        return {
            hasUploadPermission: authorization.permissions.includes('upload:mod'),
            isAdmin: authorization.roles.includes('admin') || authorization.roles.includes('super-admin'),
            isSuperAdmin: authorization.roles.includes('super-admin'),
            roles: authorization.roles,
            permissions: authorization.permissions,
            quotas: authorization.quotas,
            permissionSource: 'authorization-service',
        };
    } catch (error) {
        console.error('[Admin] Failed to get customer permission info:', error);
        return {
            hasUploadPermission: false,
            isAdmin: false,
            isSuperAdmin: false,
            roles: [],
            permissions: [],
            permissionSource: 'error',
        };
    }
}

/**
 * DEPRECATED: Old email-based functions (kept for reference, not used)
 * Use the Authorization Service functions above instead
 */

/**
 * @deprecated Use isSuperAdmin(customerId, env) instead
 */
export async function isSuperAdminEmail(email: string | undefined, env: Env): Promise<boolean> {
    console.warn('[Admin] DEPRECATED: isSuperAdminEmail() called. Use isSuperAdmin(customerId, env) instead.');
    // This function is deprecated but kept for backward compatibility during migration
    // It now returns false - use the Authorization Service instead
    return false;
}

/**
 * @deprecated Use Authorization Service for approved uploader checks
 */
export async function isApprovedUploaderEmail(email: string | undefined, env: Env): Promise<boolean> {
    console.warn('[Admin] DEPRECATED: isApprovedUploaderEmail() called. All customers can upload now.');
    return false;
}

/**
 * @deprecated Use Authorization Service
 */
export async function getSuperAdminEmails(env: Env): Promise<string[]> {
    console.warn('[Admin] DEPRECATED: getSuperAdminEmails() called. Use Authorization Service instead.');
    return [];
}

/**
 * @deprecated Use Authorization Service
 */
export async function getApprovedUploaderEmails(env: Env): Promise<string[]> {
    console.warn('[Admin] DEPRECATED: getApprovedUploaderEmails() called. Use Authorization Service instead.');
    return [];
}
