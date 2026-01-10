/**
 * Authorization Service Type Definitions
 * 
 * Defines roles, permissions, quotas, and authorization data structures.
 * Service-agnostic: works for ANY resource type, not just mods.
 */

import type { KVNamespace } from '@cloudflare/workers-types';

/**
 * Customer authorization data
 * Stored in KV: `access_{customerId}`
 */
export interface CustomerAuthorization {
    customerId: string;         // Only reference, not full customer data
    
    roles: string[];            // Generic roles: 'super-admin', 'admin', 'moderator', 'uploader', 'premium', 'customer', 'banned'
    
    permissions: string[];      // Generic permissions: 'action:resource'
    // Examples:
    // - 'upload:mod'
    // - 'delete:mod-any'
    // - 'edit:mod-any'
    // - 'approve:mod'
    // - 'access:admin-panel'
    // - 'manage:roles'
    // - 'manage:customers'
    // - 'view:analytics'
    // - 'api:unlimited'
    
    quotas: QuotaMap;
    
    metadata: {
        createdAt: string;
        updatedAt: string;
        updatedBy?: string;     // Admin customerId who made changes
        reason?: string;        // Why permissions were changed
        source?: string;        // Where authorization came from ('migration', 'subscription', 'manual')
    };
}

/**
 * Quota information per resource
 */
export interface QuotaInfo {
    limit: number;              // Max allowed
    period: 'day' | 'month' | 'year';
    current: number;            // Current usage
    resetAt: string;            // ISO timestamp when counter resets
}

/**
 * Map of resource quotas
 * Examples:
 * - 'upload:mod': { limit: 10, period: 'day', current: 3, resetAt: '2026-01-10T00:00:00Z' }
 * - 'storage:bytes': { limit: 1073741824, period: 'month', current: 524288000, resetAt: '2026-02-01T00:00:00Z' }
 */
export interface QuotaMap {
    [resource: string]: QuotaInfo;
}

/**
 * Role definition (admin-managed)
 * Stored in KV: `role_{roleName}`
 */
export interface RoleDefinition {
    name: string;               // e.g., 'super-admin', 'uploader'
    displayName: string;        // e.g., 'Super Administrator'
    description: string;
    permissions: string[];      // Permissions granted by this role
    defaultQuotas?: {
        [resource: string]: {
            limit: number;
            period: 'day' | 'month' | 'year';
        };
    };
    priority: number;           // For role hierarchy (higher = more powerful)
}

/**
 * Permission definition (for UI/documentation)
 * Stored in KV: `permission_{permissionName}`
 */
export interface PermissionDefinition {
    name: string;               // e.g., 'upload:mod'
    action: string;             // e.g., 'upload'
    resource: string;           // e.g., 'mod'
    displayName: string;        // e.g., 'Upload Mods'
    description: string;
    category: string;           // e.g., 'Mod Management', 'Admin', 'Analytics'
}

/**
 * Audit log entry
 * Stored in KV: `audit_{customerId}_{timestamp}`
 */
export interface AuditLogEntry {
    timestamp: string;
    action: AuditAction;
    details: Record<string, any>;
    performedBy: string;        // Admin customerId
    reason?: string;
}

export type AuditAction =
    | 'role_added'
    | 'role_removed'
    | 'permission_granted'
    | 'permission_revoked'
    | 'quota_updated'
    | 'quota_reset'
    | 'access_created'
    | 'access_deleted';

/**
 * Check permission request
 */
export interface CheckPermissionRequest {
    customerId: string;
    permission: string;         // e.g., 'upload:mod'
    resource?: string;          // Optional: specific resource ID for ownership checks
}

/**
 * Check permission response
 */
export interface CheckPermissionResponse {
    allowed: boolean;
    reason?: string;            // Why denied (for logging/debugging)
}

/**
 * Check quota request
 */
export interface CheckQuotaRequest {
    customerId: string;
    resource: string;           // e.g., 'upload:mod'
    amount?: number;            // Default: 1
}

/**
 * Check quota response
 */
export interface CheckQuotaResponse {
    allowed: boolean;
    quota: {
        limit: number;
        current: number;
        remaining: number;
        resetAt: string;
    };
}

/**
 * Environment interface
 */
export interface Env {
    ACCESS_KV: KVNamespace;
    JWT_SECRET?: string;
    SERVICE_API_KEY?: string;             // REQUIRED: Service-to-service authentication key
    SUPER_ADMIN_API_KEY?: string;
    MIGRATION_SECRET_KEY?: string;        // Secret key for running migrations (deployment only)
    ACCESS_SERVICE_URL?: string;          // URL of this service (for local dev)
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

/**
 * Default roles (seeded on first deployment)
 */
/**
 * Default Super Admin Emails
 * These emails are ALWAYS granted super-admin role during auto-provisioning
 */
export const DEFAULT_SUPER_ADMIN_EMAILS = [
    'm.seaward@pm.me', // Primary admin
] as const;

export const DEFAULT_ROLES: RoleDefinition[] = [
    {
        name: 'super-admin',
        displayName: 'Super Administrator',
        description: 'Full system access with all permissions',
        permissions: ['*'], // Wildcard = all permissions
        priority: 1000,
    },
    {
        name: 'admin',
        displayName: 'Administrator',
        description: 'Admin dashboard access and customer management',
        permissions: [
            'access:admin-panel',
            'manage:customers',
            'view:analytics',
            'approve:mod',
            'delete:mod-any',
            'edit:mod-any',
        ],
        priority: 900,
    },
    {
        name: 'moderator',
        displayName: 'Moderator',
        description: 'Mod approval and editing permissions',
        permissions: [
            'approve:mod',
            'edit:mod-any',
        ],
        priority: 500,
    },
    {
        name: 'uploader',
        displayName: 'Uploader',
        description: 'Can upload and manage own mods',
        permissions: [
            'upload:mod',
            'edit:mod-own',
            'delete:mod-own',
        ],
        defaultQuotas: {
            'upload:mod': { limit: 10, period: 'day' },
        },
        priority: 100,
    },
    {
        name: 'premium',
        displayName: 'Premium Member',
        description: 'Premium subscription with enhanced quotas',
        permissions: [
            'upload:mod',
            'edit:mod-own',
            'delete:mod-own',
            'api:unlimited',
        ],
        defaultQuotas: {
            'upload:mod': { limit: 50, period: 'day' },
            'storage:bytes': { limit: 53687091200, period: 'month' }, // 50 GB
        },
        priority: 200,
    },
    {
        name: 'customer',
        displayName: 'Customer',
        description: 'Basic customer access with mod upload capabilities',
        permissions: [
            'upload:mod',
            'edit:mod-own',
            'delete:mod-own',
        ],
        defaultQuotas: {
            'upload:mod': { limit: 10, period: 'day' },
        },
        priority: 10,
    },
    {
        name: 'banned',
        displayName: 'Banned',
        description: 'No permissions (banned user)',
        permissions: [],
        priority: 0,
    },
];

/**
 * Default permissions (seeded on first deployment)
 */
export const DEFAULT_PERMISSIONS: PermissionDefinition[] = [
    // Mod Management
    { name: 'upload:mod', action: 'upload', resource: 'mod', displayName: 'Upload Mods', description: 'Upload new mods', category: 'Mod Management' },
    { name: 'edit:mod-own', action: 'edit', resource: 'mod-own', displayName: 'Edit Own Mods', description: 'Edit own mods', category: 'Mod Management' },
    { name: 'edit:mod-any', action: 'edit', resource: 'mod-any', displayName: 'Edit Any Mod', description: 'Edit any mod', category: 'Mod Management' },
    { name: 'delete:mod-own', action: 'delete', resource: 'mod-own', displayName: 'Delete Own Mods', description: 'Delete own mods', category: 'Mod Management' },
    { name: 'delete:mod-any', action: 'delete', resource: 'mod-any', displayName: 'Delete Any Mod', description: 'Delete any mod', category: 'Mod Management' },
    { name: 'approve:mod', action: 'approve', resource: 'mod', displayName: 'Approve Mods', description: 'Approve/deny mod submissions', category: 'Mod Management' },
    
    // Admin
    { name: 'access:admin-panel', action: 'access', resource: 'admin-panel', displayName: 'Access Admin Panel', description: 'Access admin dashboard', category: 'Admin' },
    { name: 'manage:customers', action: 'manage', resource: 'customers', displayName: 'Manage Customers', description: 'Manage customer accounts', category: 'Admin' },
    { name: 'manage:roles', action: 'manage', resource: 'roles', displayName: 'Manage Roles', description: 'Assign/remove roles', category: 'Admin' },
    { name: 'view:analytics', action: 'view', resource: 'analytics', displayName: 'View Analytics', description: 'View system analytics', category: 'Analytics' },
    
    // API
    { name: 'api:unlimited', action: 'api', resource: 'unlimited', displayName: 'Unlimited API', description: 'No API rate limits', category: 'API' },
];
