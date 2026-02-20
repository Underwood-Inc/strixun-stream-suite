/**
 * Hook to check if customer has admin panel access
 * 
 * IMPORTANT: This is a UI convenience check. The backend enforces actual permissions on all operations.
 * 
 * Permission Model:
 * - Super admins: Always have access (implicit via wildcard permission)
 * - Admins: Have 'access:admin-panel' permission
 * - Moderators: Have 'access:admin-panel' permission (for mod review)
 * - Other customers: No admin access
 * 
 * Uses the same modPermissionsApi as useUploadPermission - the shared client that works for regular customers.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth';
import { getPermissions } from '../services/mods/modPermissionsApi';

/**
 * Check if user has a specific permission
 * Handles wildcard (*) permission for super admins
 */
function hasPermission(permissions: string[], permission: string): boolean {
    if (permissions.includes('*')) return true;
    return permissions.includes(permission);
}

/**
 * Hook to check admin panel access
 * Returns access status, roles, permissions, and loading state
 */
export function useAdminAccess() {
    const { customer, isAuthenticated, isSuperAdmin: isSuperAdminFromAuth } = useAuthStore();
    
    const canMakeRequest = isAuthenticated && !!customer?.customerId;
    
    const { data, isLoading, error } = useQuery({
        queryKey: ['permissions', customer?.customerId],
        queryFn: getPermissions,
        enabled: canMakeRequest,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        retry: (failureCount, error) => {
            // Don't retry on 401 errors (authentication failures)
            if (error && typeof error === 'object' && 'status' in error && error.status === 401) {
                return false;
            }
            return failureCount < 1;
        },
        retryDelay: 1000,
    });
    
    // 401 is expected when session expired or cookie not sent; avoid noisy error logs
    if (error && typeof error === 'object' && 'status' in error && error.status !== 401) {
        console.error('[useAdminAccess] Error checking permissions:', error);
    }
    
    // Compute derived values
    const permissions = data?.permissions ?? [];
    const roles = data?.roles ?? [];
    const isSuperAdmin = data?.isSuperAdmin ?? isSuperAdminFromAuth ?? false;
    const isAdmin = data?.isAdmin ?? false;
    
    // Check specific permissions
    const hasAdminPanelAccess = isSuperAdmin || hasPermission(permissions, 'access:admin-panel');
    const hasModsAdminAccess = isSuperAdmin || hasPermission(permissions, 'access:mods-admin');
    const canManageCustomers = isSuperAdmin || hasPermission(permissions, 'manage:customers');
    const canViewAnalytics = isSuperAdmin || hasPermission(permissions, 'view:analytics');
    const canManageRoles = isSuperAdmin || hasPermission(permissions, 'manage:roles');
    const canManagePermissions = isSuperAdmin || hasPermission(permissions, 'manage:permissions');
    const canReviewMods = isSuperAdmin || hasPermission(permissions, 'review:mod');
    const canApproveMods = isSuperAdmin || hasPermission(permissions, 'approve:mod');
    const canDeleteAnyMod = isSuperAdmin || hasPermission(permissions, 'delete:mod-any');
    const canManageSettings = isSuperAdmin || hasPermission(permissions, 'manage:settings');
    
    return {
        // Raw data
        roles,
        permissions,
        
        // Boolean flags
        isLoading,
        isAuthenticated,
        isSuperAdmin,
        isAdmin,
        
        // Specific permission checks
        hasAdminPanelAccess,
        hasModsAdminAccess,
        canManageCustomers,
        canViewAnalytics,
        canManageRoles,
        canManagePermissions,
        canReviewMods,
        canApproveMods,
        canDeleteAnyMod,
        canManageSettings,
        
        // Generic permission checker
        hasPermission: (permission: string) => hasPermission(permissions, permission),
        
        // Error
        error,
    };
}
