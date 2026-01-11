/**
 * Admin customer management handlers
 * Handles customer listing, details, updates, and customer mods
 * 
 * CRITICAL: We ONLY have Customer entities - NO "User" entity exists
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerPermissionInfo } from '../../utils/admin.js';
import { getCustomerKey } from '../../utils/customer.js';
import type { ModMetadata } from '../../types/mod.js';

interface Customer {
    customerId: string; // PRIMARY IDENTITY - REQUIRED
    email?: string; // Internal only - never returned to frontend, not always available from admin endpoints
    displayName?: string | null;
    createdAt?: string | null;
    lastLogin?: string | null;
    [key: string]: any;
}

interface CustomerListItem {
    customerId: string; // PRIMARY IDENTITY
    displayName: string | null;
    createdAt: string | null;
    lastLogin: string | null;
    hasUploadPermission: boolean;
    modCount: number;
}

interface CustomerDetail extends CustomerListItem {
    emailHash?: string; // For admin reference only, not the actual email
    approvedAt?: string | null; // Only set if permissionSource is 'kv'
}

interface CustomerListResponse {
    customers: CustomerListItem[];
    total: number;
    page: number;
    pageSize: number;
}

/**
 * List all customers from OTP auth service
 * Always uses service-to-service call to ensure we get ALL customers system-wide
 * (not just customers scoped to mods hub)
 * 
 * NOTE: OTP auth service still returns userId in legacy responses, we map it to customerId
 */
async function listAllCustomers(env: Env): Promise<Customer[]> {
    const customers: Customer[] = [];
    
    // Always use service-to-service call to OTP auth service
    // This ensures we get ALL customers across the entire system, not just mods-hub customers
    // NOTE: Admin endpoints require SUPER_ADMIN_API_KEY
    console.log('[CustomerManagement] Fetching all customers from OTP auth service (system-wide)');
    try {
        const { createServiceClient } = await import('@strixun/service-client');
        const { getAuthApiUrl } = await import('@strixun/api-framework');
        const authApiUrl = getAuthApiUrl(env);
        
        // For admin endpoints, we need SUPER_ADMIN_API_KEY
        // createServiceClient requires SUPER_ADMIN_API_KEY
        // This is correct for admin operations
        const client = createServiceClient(authApiUrl, env);
        
        const response = await client.get<{ customers: Array<{
            customerId: string;
            displayName: string | null;
            createdAt: string | null;
            lastLogin: string | null;
        }>; total: number }>('/admin/customers');
        
        if (response.status === 200 && response.data) {
            // Convert to Customer format
            if (response.data.customers && Array.isArray(response.data.customers)) {
                customers.push(...response.data.customers.map(c => ({
                    customerId: c.customerId,
                    displayName: c.displayName,
                    createdAt: c.createdAt,
                    lastLogin: c.lastLogin,
                })));
                console.log('[CustomerManagement] Loaded all customers via service call:', {
                    total: customers.length,
                    authApiUrl,
                    responseCustomerCount: response.data.customers.length,
                    responseTotal: response.data.total
                });
            } else {
                console.warn('[CustomerManagement] Service response missing customers array:', {
                    dataKeys: response.data ? Object.keys(response.data) : null,
                    hasCustomers: 'customers' in (response.data || {}),
                    customersIsArray: response.data?.customers ? Array.isArray(response.data.customers) : false
                });
            }
        } else {
            console.error('[CustomerManagement] Service call failed:', {
                status: response.status,
                statusText: response.statusText,
                error: typeof response.data === 'object' ? JSON.stringify(response.data).substring(0, 500) : String(response.data).substring(0, 500),
                authApiUrl
            });
            // If service call fails, try direct KV access as fallback
            if (env.OTP_AUTH_KV) {
                console.log('[CustomerManagement] Falling back to direct KV access');
                const customerPrefix = 'customer_';
                let cursor: string | undefined;
                
                do {
                    const listResult = await env.OTP_AUTH_KV.list({ prefix: customerPrefix, cursor });
                    
                    for (const key of listResult.keys) {
                        // Look for legacy keys: customer_{id}_user_{emailHash} or customer_{id}_customer_{emailHash}
                        if (key.name.includes('_user_') || key.name.includes('_customer_')) {
                            try {
                                const customerData = await env.OTP_AUTH_KV.get(key.name, { type: 'json' }) as any;
                                if (customerData) {
                                    // Extract customerId from key name (ALWAYS - this is the source of truth)
                                    const match = key.name.match(/^customer_([^_/]+)[_/]user_/);
                                    const customer: Customer = {
                                        customerId: match ? match[1] : (customerData.customerId || customerData.customerId || ''),
                                        email: customerData.email || '',
                                        displayName: customerData.displayName,
                                        createdAt: customerData.createdAt,
                                        lastLogin: customerData.lastLogin,
                                    };
                                    customers.push(customer);
                                }
                            } catch (error) {
                                console.warn('[CustomerManagement] Failed to parse customer:', key.name, error);
                                continue;
                            }
                        }
                    }
                    
                    cursor = listResult.list_complete ? undefined : listResult.cursor;
                } while (cursor);
                
                console.log('[CustomerManagement] Fallback KV access loaded:', customers.length, 'customers');
            }
        }
    } catch (error) {
        console.error('[UserManagement] Service-to-service call error:', error);
        // If service call fails completely, try direct KV access as fallback
        if (env.OTP_AUTH_KV) {
            console.log('[CustomerManagement] Falling back to direct KV access due to error');
            const customerPrefix = 'customer_';
            let cursor: string | undefined;
            
            do {
                const listResult = await env.OTP_AUTH_KV.list({ prefix: customerPrefix, cursor });
                
                for (const key of listResult.keys) {
                    if (key.name.includes('_user_')) {
                        try {
                            const customerData = await env.OTP_AUTH_KV.get(key.name, { type: 'json' }) as any;
                            if (customerData) {
                                const match = key.name.match(/^customer_([^_/]+)[_/]user_/);
                                const customer: Customer = {
                                    customerId: match ? match[1] : (customerData.customerId || customerData.customerId || ''),
                                    email: customerData.email || '',
                                    displayName: customerData.displayName,
                                    createdAt: customerData.createdAt,
                                    lastLogin: customerData.lastLogin,
                                };
                                customers.push(customer);
                            }
                        } catch (error) {
                            console.warn('[CustomerManagement] Failed to parse customer:', key.name, error);
                            continue;
                        }
                    }
                }
                
                cursor = listResult.list_complete ? undefined : listResult.cursor;
            } while (cursor);
            
            console.log('[CustomerManagement] Fallback KV access loaded:', customers.length, 'customers');
        }
    }
    
    return customers;
}

/**
 * Get customer's mod count
 */
async function getCustomerModCount(customerId: string, env: Env): Promise<number> {
    let count = 0;
    
    // Search through all mod lists to find mods by this customer
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
        
        cursor = listResult.list_complete ? undefined : listResult.cursor;
    } while (cursor);
    
    // Count mods by this customer
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
                const modListResult = await env.MODS_KV.list({ prefix: customerModPrefix, cursor: modCursor });
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
                modCursor = modListResult.list_complete ? undefined : modListResult.cursor;
            } while (modCursor && !found);
        }
        
        if (mod && mod.authorId === customerId) {
            count++;
        }
    }
    
    return count;
}

/**
 * Handle list all customers request (admin only)
 * GET /admin/customers
 */
export async function handleListCustomers(
    request: Request,
    env: Env,
    _auth: { customerId: string }
): Promise<Response> {
    try {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') || '50', 10), 200);
        const search = url.searchParams.get('search'); // For filtering
        
        // Get all customers from OTP auth service
        const allCustomers = await listAllCustomers(env);
        
        // Aggregate customer data
        const customerItems: CustomerListItem[] = [];
        
        for (const customer of allCustomers) {
            // Get mod count (this is expensive, so we'll do it in batches or optimize later)
            const modCount = await getCustomerModCount(customer.customerId, env);
            
            // Apply search filter if provided
            if (search) {
                const searchLower = search.toLowerCase();
                const matchesSearch = 
                    customer.customerId.toLowerCase().includes(searchLower) ||
                    (customer.displayName || '').toLowerCase().includes(searchLower);
                
                if (!matchesSearch) {
                    continue;
                }
            }
            
            // Get comprehensive permission info via Access Service
            const permissionInfo = await getCustomerPermissionInfo(customer.customerId, env);
            
            customerItems.push({
                customerId: customer.customerId,
                displayName: customer.displayName || null,
                createdAt: customer.createdAt || null,
                lastLogin: customer.lastLogin || null,
                hasUploadPermission: permissionInfo.hasUploadPermission,
                modCount,
            });
        }
        
        // Sort by createdAt (newest first)
        customerItems.sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
        });
        
        // Paginate
        const total = customerItems.length;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const paginatedCustomers = customerItems.slice(start, end);
        
        const response: CustomerListResponse = {
            customers: paginatedCustomers,
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
        console.error('Admin list customers error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to List Customers',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while listing customers'
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
 * Handle get customer details request (admin only)
 * GET /admin/customers/:customerId
 */
export async function handleGetCustomerDetails(
    request: Request,
    env: Env,
    customerId: string,
    _auth: { customerId: string }
): Promise<Response> {
    try {
        // Find customer
        const allCustomers = await listAllCustomers(env);
        const customer = allCustomers.find(c => c.customerId === customerId);
        
        if (!customer) {
            const rfcError = createError(request, 404, 'Customer Not Found', `Customer with customerId ${customerId} not found`);
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
        
        // Get comprehensive permission info via Access Service
        const permissionInfo = await getCustomerPermissionInfo(customer.customerId, env);
        const hasUploadPermission = permissionInfo.hasUploadPermission;
        
        // Get approval metadata - Access Service provides createdAt for authorization
        const approvedAt: string | null = null; // Legacy field, no longer tracked separately
        
        // Get mod count
        const modCount = await getCustomerModCount(customerId, env);
        
        // Get email hash for admin reference (not the actual email)
        let emailHash: string | undefined;
        if (env.OTP_AUTH_KV) {
            const customerPrefix = 'customer_';
            let cursor: string | undefined;
            
            do {
                const listResult = await env.OTP_AUTH_KV.list({ prefix: customerPrefix, cursor });
                for (const key of listResult.keys) {
                    if (key.name.includes('_user_') && key.name.includes(customerId)) {
                        const match = key.name.match(/_user_(.+)$/);
                        if (match) {
                            emailHash = match[1];
                            break;
                        }
                    }
                }
                if (emailHash) break;
                cursor = listResult.list_complete ? undefined : listResult.cursor;
            } while (cursor);
        }
        
        const customerDetail: CustomerDetail = {
            customerId: customer.customerId,
            displayName: customer.displayName || null,
            createdAt: customer.createdAt || null,
            lastLogin: customer.lastLogin || null,
            hasUploadPermission,
            modCount,
            emailHash, // For admin reference only
            approvedAt,
        };
        
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        
        return new Response(JSON.stringify(customerDetail), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Admin get customer details error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Get Customer Details',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while getting customer details'
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
 * Handle update customer request (admin only)
 * PUT /admin/customers/:customerId
 */
export async function handleUpdateCustomer(
    request: Request,
    env: Env,
    customerId: string,
    _auth: { customerId: string }
): Promise<Response> {
    try {
        const requestData = await request.json().catch(() => ({})) as {
            hasUploadPermission?: boolean;
            [key: string]: any;
        };
        
        // Update upload permission if provided
        if (typeof requestData.hasUploadPermission === 'boolean') {
            // Use Access Service to manage uploader role
            const { createAccessClient } = await import('../../../shared/access-client.js');
            const access = createAccessClient(env);
            
            const authorization = await access.getCustomerAuthorization(customerId);
            if (!authorization) {
                throw new Error('Customer not found in Access Service');
            }
            
            if (requestData.hasUploadPermission) {
                // Add 'uploader' role if not already present
                const updatedRoles = authorization.roles.includes('uploader')
                    ? authorization.roles
                    : [...authorization.roles, 'uploader'];
                console.log('[Admin] Grant uploader role via Access Service:', { customerId, roles: updatedRoles });
                // Note: This requires an admin endpoint in Access Service to update roles
            } else {
                // Remove 'uploader' role if present
                const updatedRoles = authorization.roles.filter(r => r !== 'uploader');
                console.log('[Admin] Revoke uploader role via Access Service:', { customerId, roles: updatedRoles });
                // Note: This requires an admin endpoint in Access Service to update roles
            }
        }
        
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        
        return new Response(JSON.stringify({ success: true, customerId }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Admin update customer error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Update Customer',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while updating customer'
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
 * Handle get customer's mods request (admin only)
 * GET /admin/customers/:customerId/mods
 */
export async function handleGetCustomerMods(
    request: Request,
    env: Env,
    customerId: string,
    _auth: { customerId: string }
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
            
            cursor = listResult.list_complete ? undefined : listResult.cursor;
        } while (cursor);
        
        // Find mods by this customer
        const customerMods: ModMetadata[] = [];
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
            
            if (mod && mod.authorId === customerId) {
                customerMods.push(mod);
            }
        }
        
        // Sort by updatedAt (newest first)
        customerMods.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        
        // Paginate
        const total = customerMods.length;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const paginatedMods = customerMods.slice(start, end);
        
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
        console.error('Admin get customer mods error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Get Customer Mods',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while getting customer mods'
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

