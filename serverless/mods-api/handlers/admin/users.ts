/**
 * Admin user management handlers
 * Handles user listing, details, updates, and user mods
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getApprovedUploaders, getUserUploadPermissionInfo, isSuperAdminEmail } from '../../utils/admin.js';
import { getCustomerKey } from '../../utils/customer.js';
import type { ModMetadata } from '../../types/mod.js';

interface User {
    userId: string;
    email: string; // Internal only - never returned to frontend
    displayName?: string | null;
    customerId?: string | null;
    createdAt?: string;
    lastLogin?: string;
    [key: string]: any;
}

interface UserListItem {
    userId: string;
    displayName: string | null;
    customerId: string | null;
    createdAt: string | null;
    lastLogin: string | null;
    hasUploadPermission: boolean;
    modCount: number;
}

interface UserDetail extends UserListItem {
    emailHash?: string; // For admin reference only, not the actual email
    approvedAt?: string | null; // Only set if permissionSource is 'kv'
}

interface UserListResponse {
    users: UserListItem[];
    total: number;
    page: number;
    pageSize: number;
}

/**
 * List all users from OTP auth service
 * Always uses service-to-service call to ensure we get ALL users system-wide
 * (not just users scoped to mods hub)
 */
async function listAllUsers(env: Env): Promise<User[]> {
    const users: User[] = [];
    
    // Always use service-to-service call to OTP auth service
    // This ensures we get ALL users across the entire system, not just mods-hub users
    // NOTE: Admin endpoints require SUPER_ADMIN_API_KEY
    console.log('[UserManagement] Fetching all users from OTP auth service (system-wide)');
    try {
        const { createServiceClient } = await import('@strixun/service-client');
        const { getAuthApiUrl } = await import('@strixun/api-framework');
        const authApiUrl = getAuthApiUrl(env);
        
        // For admin endpoints, we need SUPER_ADMIN_API_KEY
        // createServiceClient requires SUPER_ADMIN_API_KEY
        // This is correct for admin operations
        const client = createServiceClient(authApiUrl, env);
        
        const response = await client.get<{ users: Array<{
            userId: string;
            displayName: string | null;
            customerId: string | null;
            createdAt: string | null;
            lastLogin: string | null;
        }>; total: number }>('/admin/users');
        
        if (response.status === 200 && response.data) {
            // Convert to User format
            if (response.data.users && Array.isArray(response.data.users)) {
                users.push(...response.data.users.map(u => ({
                    userId: u.userId,
                    email: '', // Not returned by admin endpoint for security
                    displayName: u.displayName,
                    customerId: u.customerId,
                    createdAt: u.createdAt,
                    lastLogin: u.lastLogin,
                })));
                console.log('[UserManagement] Loaded all users via service call:', {
                    total: users.length,
                    authApiUrl,
                    responseUserCount: response.data.users.length,
                    responseTotal: response.data.total
                });
            } else {
                console.warn('[UserManagement] Service response missing users array:', {
                    dataKeys: response.data ? Object.keys(response.data) : null,
                    hasUsers: 'users' in (response.data || {}),
                    usersIsArray: response.data?.users ? Array.isArray(response.data.users) : false
                });
            }
        } else {
            console.error('[UserManagement] Service call failed:', {
                status: response.status,
                statusText: response.statusText,
                error: typeof response.data === 'object' ? JSON.stringify(response.data).substring(0, 500) : String(response.data).substring(0, 500),
                authApiUrl
            });
            // If service call fails, try direct KV access as fallback
            if (env.OTP_AUTH_KV) {
                console.log('[UserManagement] Falling back to direct KV access');
                const customerPrefix = 'customer_';
                let cursor: string | undefined;
                
                do {
                    const listResult = await env.OTP_AUTH_KV.list({ prefix: customerPrefix, cursor });
                    
                    for (const key of listResult.keys) {
                        // Look for user keys: customer_{id}_user_{emailHash}
                        if (key.name.includes('_user_')) {
                            try {
                                const user = await env.OTP_AUTH_KV.get(key.name, { type: 'json' }) as User | null;
                                if (user && user.userId) {
                                    // Extract customerId from key name if not in user object
                                    if (!user.customerId) {
                                        const match = key.name.match(/^customer_([^_/]+)[_/]user_/);
                                        if (match) {
                                            user.customerId = match[1];
                                        }
                                    }
                                    users.push(user);
                                }
                            } catch (error) {
                                console.warn('[UserManagement] Failed to parse user:', key.name, error);
                                continue;
                            }
                        }
                    }
                    
                    cursor = listResult.listComplete ? undefined : listResult.cursor;
                } while (cursor);
                
                console.log('[UserManagement] Fallback KV access loaded:', users.length, 'users');
            }
        }
    } catch (error) {
        console.error('[UserManagement] Service-to-service call error:', error);
        // If service call fails completely, try direct KV access as fallback
        if (env.OTP_AUTH_KV) {
            console.log('[UserManagement] Falling back to direct KV access due to error');
            const customerPrefix = 'customer_';
            let cursor: string | undefined;
            
            do {
                const listResult = await env.OTP_AUTH_KV.list({ prefix: customerPrefix, cursor });
                
                for (const key of listResult.keys) {
                    if (key.name.includes('_user_')) {
                        try {
                            const user = await env.OTP_AUTH_KV.get(key.name, { type: 'json' }) as User | null;
                            if (user && user.userId) {
                                if (!user.customerId) {
                                    const match = key.name.match(/^customer_([^_/]+)[_/]user_/);
                                    if (match) {
                                        user.customerId = match[1];
                                    }
                                }
                                users.push(user);
                            }
                        } catch (error) {
                            console.warn('[UserManagement] Failed to parse user:', key.name, error);
                            continue;
                        }
                    }
                }
                
                cursor = listResult.listComplete ? undefined : listResult.cursor;
            } while (cursor);
            
            console.log('[UserManagement] Fallback KV access loaded:', users.length, 'users');
        }
    }
    
    return users;
}

/**
 * Get user's mod count
 */
async function getUserModCount(userId: string, env: Env): Promise<number> {
    let count = 0;
    
    // Search through all mod lists to find mods by this user
    const allModIds = new Set<string>();
    
    // Get global public list
    const globalListKey = 'mods_list_public';
    const globalListData = await env.MODS_KV.get(globalListKey, { type: 'json' }) as string[] | null;
    if (globalListData) {
        globalListData.forEach(id => allModIds.add(id));
    }
    
    // Get mods from all customer scopes
    const customerListPrefix = 'customer_';
    let cursor: string | undefined;
    
    do {
        const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor });
        
        for (const key of listResult.keys) {
            if (key.name.endsWith('_mods_list')) {
                const customerListData = await env.MODS_KV.get(key.name, { type: 'json' }) as string[] | null;
                if (customerListData && Array.isArray(customerListData)) {
                    customerListData.forEach(id => allModIds.add(id));
                }
            }
        }
        
        cursor = listResult.listComplete ? undefined : listResult.cursor;
    } while (cursor);
    
    // Count mods by this user
    for (const modId of allModIds) {
        // Try global scope first
        const globalModKey = `mod_${modId}`;
        let mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
        
        // If not found, search customer scopes
        if (!mod) {
            const customerModPrefix = 'customer_';
            let modCursor: string | undefined;
            let found = false;
            
            do {
                const modListResult = await env.MODS_KV.list({ prefix: customerModPrefix, modCursor });
                for (const key of modListResult.keys) {
                    if (key.name.endsWith(`_mod_${modId}`)) {
                        mod = await env.MODS_KV.get(key.name, { type: 'json' }) as ModMetadata | null;
                        if (mod) {
                            found = true;
                            break;
                        }
                    }
                }
                if (found) break;
                modCursor = modListResult.listComplete ? undefined : modListResult.cursor;
            } while (modCursor && !found);
        }
        
        if (mod && mod.authorId === userId) {
            count++;
        }
    }
    
    return count;
}

/**
 * Handle list all users request (admin only)
 * GET /admin/users
 */
export async function handleListUsers(
    request: Request,
    env: Env,
    auth: { userId: string; email?: string; customerId: string | null }
): Promise<Response> {
    try {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '50', 10), 200);
        const search = url.searchParams.get('search'); // For filtering
        
        // Get all users from OTP auth service
        const allUsers = await listAllUsers(env);
        
        // Aggregate user data
        const userItems: UserListItem[] = [];
        
        for (const user of allUsers) {
            // Get mod count (this is expensive, so we'll do it in batches or optimize later)
            const modCount = await getUserModCount(user.userId, env);
            
            // Apply search filter if provided
            if (search) {
                const searchLower = search.toLowerCase();
                const matchesSearch = 
                    user.userId.toLowerCase().includes(searchLower) ||
                    (user.displayName || '').toLowerCase().includes(searchLower) ||
                    (user.customerId || '').toLowerCase().includes(searchLower);
                
                if (!matchesSearch) {
                    continue;
                }
            }
            
            // Get comprehensive permission info (checks all three tiers: super admin, env var, KV)
            // Note: user.email may be empty string from listAllUsers (privacy), but we can get it from KV metadata
            const permissionInfo = await getUserUploadPermissionInfo(user.userId, user.email || undefined, env);
            
            userItems.push({
                userId: user.userId,
                displayName: user.displayName || null,
                customerId: user.customerId || null,
                createdAt: user.createdAt || null,
                lastLogin: user.lastLogin || null,
                hasUploadPermission: permissionInfo.hasPermission,
                permissionSource: permissionInfo.permissionSource,
                isSuperAdmin: permissionInfo.isSuperAdmin,
                modCount,
            });
        }
        
        // Sort by createdAt (newest first)
        userItems.sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
        });
        
        // Paginate
        const total = userItems.length;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const paginatedUsers = userItems.slice(start, end);
        
        const response: UserListResponse = {
            users: paginatedUsers,
            total,
            page,
            pageSize,
        };
        
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        
        return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Admin list users error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to List Users',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while listing users'
        );
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}

/**
 * Handle get user details request (admin only)
 * GET /admin/users/:userId
 */
export async function handleGetUserDetails(
    request: Request,
    env: Env,
    userId: string,
    auth: { userId: string; email?: string; customerId: string | null }
): Promise<Response> {
    try {
        // Find user
        const allUsers = await listAllUsers(env);
        const user = allUsers.find(u => u.userId === userId);
        
        if (!user) {
            const rfcError = createError(request, 404, 'User Not Found', `User with userId ${userId} not found`);
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }
        
        // Get comprehensive permission info (checks all three tiers: super admin, env var, KV)
        const permissionInfo = await getUserUploadPermissionInfo(user.userId, user.email || undefined, env);
        const hasUploadPermission = permissionInfo.hasPermission;
        
        // Get approval metadata if approved via KV
        let approvedAt: string | null = null;
        if (permissionInfo.permissionSource === 'kv' && env.MODS_KV) {
            const approvalKey = `upload_approval_${userId}`;
            const approvalData = await env.MODS_KV.get(approvalKey, { type: 'json' }) as { metadata?: { approvedAt?: string } } | null;
            approvedAt = approvalData?.metadata?.approvedAt || null;
        }
        
        // Get mod count
        const modCount = await getUserModCount(userId, env);
        
        // Get email hash for admin reference (not the actual email)
        let emailHash: string | undefined;
        if (env.OTP_AUTH_KV) {
            const customerPrefix = 'customer_';
            let cursor: string | undefined;
            
            do {
                const listResult = await env.OTP_AUTH_KV.list({ prefix: customerPrefix, cursor });
                for (const key of listResult.keys) {
                    if (key.name.includes('_user_') && key.name.includes(userId)) {
                        const match = key.name.match(/_user_(.+)$/);
                        if (match) {
                            emailHash = match[1];
                            break;
                        }
                    }
                }
                if (emailHash) break;
                cursor = listResult.listComplete ? undefined : listResult.cursor;
            } while (cursor);
        }
        
        const userDetail: UserDetail = {
            userId: user.userId,
            displayName: user.displayName || null,
            customerId: user.customerId || null,
            createdAt: user.createdAt || null,
            lastLogin: user.lastLogin || null,
            hasUploadPermission,
            modCount,
            emailHash, // For admin reference only
            approvedAt,
        };
        
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        
        return new Response(JSON.stringify(userDetail), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Admin get user details error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Get User Details',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while getting user details'
        );
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}

/**
 * Handle update user request (admin only)
 * PUT /admin/users/:userId
 */
export async function handleUpdateUser(
    request: Request,
    env: Env,
    userId: string,
    auth: { userId: string; email?: string; customerId: string | null }
): Promise<Response> {
    try {
        const requestData = await request.json().catch(() => ({})) as {
            hasUploadPermission?: boolean;
            [key: string]: any;
        };
        
        // Update upload permission if provided
        if (typeof requestData.hasUploadPermission === 'boolean') {
            const { approveUserUpload, revokeUserUpload, getUserUploadPermissionInfo } = await import('../../utils/admin.js');
            
            // Check current permission source
            const allUsers = await listAllUsers(env);
            const user = allUsers.find(u => u.userId === userId);
            const currentPermissionInfo = await getUserUploadPermissionInfo(userId, user?.email || undefined, env);
            
            // If user has env-var or super-admin permission, warn that revoking KV won't remove their permission
            // (They'll still have permission from env var)
            if (!requestData.hasUploadPermission && 
                (currentPermissionInfo.permissionSource === 'env-var' || currentPermissionInfo.permissionSource === 'super-admin')) {
                // User has env-based permission - revoking KV won't actually remove their upload permission
                // But we'll still remove the KV entry for consistency
                await revokeUserUpload(userId, env);
                // Note: User will still have permission from APPROVED_UPLOADER_EMAILS or SUPER_ADMIN_EMAILS
            } else if (requestData.hasUploadPermission) {
                // Approve user (adds to KV)
                const email = user?.email || '';
                await approveUserUpload(userId, email, env);
            } else {
                // Revoke KV approval
                await revokeUserUpload(userId, env);
            }
        }
        
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        
        return new Response(JSON.stringify({ success: true, userId }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Admin update user error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Update User',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while updating user'
        );
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}

/**
 * Handle get user's mods request (admin only)
 * GET /admin/users/:userId/mods
 */
export async function handleGetUserMods(
    request: Request,
    env: Env,
    userId: string,
    auth: { userId: string; email?: string; customerId: string | null }
): Promise<Response> {
    try {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '20', 10), 100);
        
        // Get all mod IDs
        const allModIds = new Set<string>();
        const modIdToCustomerId = new Map<string, string | null>();
        
        // Get global public list
        const globalListKey = 'mods_list_public';
        const globalListData = await env.MODS_KV.get(globalListKey, { type: 'json' }) as string[] | null;
        if (globalListData) {
            globalListData.forEach(id => {
                allModIds.add(id);
                modIdToCustomerId.set(id, null);
            });
        }
        
        // Get mods from all customer scopes
        const customerListPrefix = 'customer_';
        let cursor: string | undefined;
        
        do {
            const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor });
            
            for (const key of listResult.keys) {
                if (key.name.endsWith('_mods_list')) {
                    const match = key.name.match(/^customer_([^_/]+)[_/]mods_list$/);
                    const customerId = match ? match[1] : null;
                    
                    const customerListData = await env.MODS_KV.get(key.name, { type: 'json' }) as string[] | null;
                    if (customerListData && Array.isArray(customerListData)) {
                        customerListData.forEach(id => {
                            allModIds.add(id);
                            if (customerId) {
                                modIdToCustomerId.set(id, customerId);
                            }
                        });
                    }
                }
            }
            
            cursor = listResult.listComplete ? undefined : listResult.cursor;
        } while (cursor);
        
        // Find mods by this user
        const userMods: ModMetadata[] = [];
        const { normalizeModId } = await import('../../utils/customer.js');
        
        for (const modId of allModIds) {
            const normalizedModId = normalizeModId(modId);
            let mod: ModMetadata | null = null;
            
            // Try global scope first
            const globalModKey = `mod_${normalizedModId}`;
            mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
            
            // If not found, try customer scope
            if (!mod) {
                const customerId = modIdToCustomerId.get(modId);
                if (customerId) {
                    const customerModKey = getCustomerKey(customerId, `mod_${normalizedModId}`);
                    mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                }
            }
            
            if (mod && mod.authorId === userId) {
                userMods.push(mod);
            }
        }
        
        // Sort by updatedAt (newest first)
        userMods.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        
        // Paginate
        const total = userMods.length;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const paginatedMods = userMods.slice(start, end);
        
        const response = {
            mods: paginatedMods,
            total,
            page,
            pageSize,
        };
        
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        
        return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Admin get user mods error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Get User Mods',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while getting user mods'
        );
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}

interface Env {
    MODS_KV: KVNamespace;
    OTP_AUTH_KV?: KVNamespace; // Optional - for direct access if available
    AUTH_API_URL?: string;
    SUPER_ADMIN_API_KEY?: string;
    SUPER_ADMIN_EMAILS?: string;
    ENVIRONMENT?: string;
    ALLOWED_ORIGINS?: string;
    [key: string]: any;
}

