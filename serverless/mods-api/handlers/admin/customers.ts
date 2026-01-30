/**
 * Admin Customer Handlers
 * Provides enriched customer data aggregated from multiple services:
 * - customer-api: Base customer data (displayName, createdAt, lastLogin, tier, etc.)
 * - access-service: Permissions and roles (hasUploadPermission, isSuperAdmin, roles)
 * - mods-api: Mod counts
 * 
 * This endpoint is the single source of truth for admin customer management UI.
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { createError } from '../../utils/errors.js';
import { getCustomerPermissionInfo } from '../../utils/admin.js';

interface Env {
    MODS_KV: KVNamespace;
    CUSTOMER_API_URL?: string;
    ACCESS_SERVICE_URL?: string;
    SERVICE_API_KEY?: string;
    JWT_SECRET?: string;
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

interface AuthResult {
    customerId: string;
    jwtToken?: string;
}

/**
 * Base customer data from customer-api
 */
interface CustomerApiData {
    customerId: string;
    displayName?: string | null;
    email?: string; // Will be stripped before returning to frontend
    companyName?: string;
    tier?: 'free' | 'basic' | 'premium' | 'enterprise';
    status?: string;
    createdAt?: string;
    updatedAt?: string;
    lastLogin?: string;
    subscriptions?: any[];
    flairs?: any[];
}

/**
 * Enriched customer data for admin UI
 * This matches the frontend CustomerListItem interface
 */
interface EnrichedCustomer {
    customerId: string;
    displayName: string | null;
    customerIdExternal: string | null;
    createdAt: string | null;
    lastLogin: string | null;
    hasUploadPermission: boolean;
    permissionSource: 'super-admin' | 'env-var' | 'kv' | 'access-service' | 'none' | 'error';
    isSuperAdmin: boolean;
    modCount: number;
    // Extended fields
    tier?: 'free' | 'basic' | 'premium' | 'enterprise';
    status?: string;
    roles?: string[];
    permissions?: string[];
    validationIssues?: Array<{
        field: string;
        severity: 'error' | 'warning' | 'info';
        message: string;
    }>;
}

/**
 * Count mods by author from MODS_KV
 * Uses the idx:mods:mods-by-author:{customerId} index
 */
async function countModsByAuthor(kv: KVNamespace, customerId: string): Promise<number> {
    try {
        // Try the index first (faster)
        const indexKey = `idx:mods:mods-by-author:${customerId}`;
        const modIds = await kv.get(indexKey, { type: 'json' }) as string[] | null;
        
        if (modIds && Array.isArray(modIds)) {
            return modIds.length;
        }
        
        // Fallback: scan mods:mod: keys and count by authorId
        // This is slower but works if index is missing
        let count = 0;
        let cursor: string | undefined;
        
        do {
            const listResult = await kv.list({ prefix: 'mods:mod:', cursor, limit: 500 });
            
            for (const key of listResult.keys) {
                try {
                    const mod = await kv.get(key.name, { type: 'json' }) as { authorId?: string } | null;
                    if (mod && mod.authorId === customerId) {
                        count++;
                    }
                } catch {
                    // Skip malformed entries
                }
            }
            
            cursor = listResult.list_complete ? undefined : listResult.cursor;
        } while (cursor);
        
        return count;
    } catch (error) {
        console.error(`[Customers] Failed to count mods for ${customerId}:`, error);
        return 0;
    }
}

/**
 * Fetch customers from customer-api
 */
async function fetchCustomersFromCustomerApi(
    env: Env,
    jwtToken?: string
): Promise<{ customers: CustomerApiData[]; total: number }> {
    if (!env.CUSTOMER_API_URL) {
        console.error('[Customers] CUSTOMER_API_URL is not configured');
        return { customers: [], total: 0 };
    }
    
    if (!jwtToken) {
        console.error('[Customers] JWT token is required for customer-api calls');
        return { customers: [], total: 0 };
    }

    const targetUrl = `${env.CUSTOMER_API_URL}/admin/customers`;
    console.log('[Customers] Calling customer-api:', targetUrl);

    const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`,
            'X-Service-Request': 'true',  // Mark as service-to-service call to prevent encryption
        },
    });

    console.log('[Customers] customer-api response status:', response.status);
    console.log('[Customers] customer-api response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
        const error = await response.text();
        console.error(`[Customers] customer-api returned ${response.status}:`, error);
        return { customers: [], total: 0 };
    }

    const rawText = await response.text();
    console.log('[Customers] customer-api raw response length:', rawText.length);
    console.log('[Customers] customer-api raw response first 1000 chars:', rawText.substring(0, 1000));
    
    let data: { customers?: CustomerApiData[]; total?: number };
    try {
        data = JSON.parse(rawText);
    } catch (parseError) {
        console.error('[Customers] Failed to parse customer-api response:', parseError);
        return { customers: [], total: 0 };
    }
    
    console.log('[Customers] customer-api parsed response:', { 
        customersCount: data.customers?.length, 
        total: data.total,
        keys: Object.keys(data || {})
    });
    
    return { 
        customers: data.customers || [], 
        total: data.total || 0 
    };
}

/**
 * Enrich a single customer with permission and mod data
 */
async function enrichCustomer(
    customer: CustomerApiData,
    jwtToken: string | undefined,
    env: Env
): Promise<EnrichedCustomer> {
    // Fetch permission info from access-service
    // If no jwtToken, return defaults (shouldn't happen for admin routes)
    let permInfo: {
        hasUploadPermission: boolean;
        isSuperAdmin: boolean;
        permissionSource: string;
        roles: string[];
        permissions: string[];
        isAdmin?: boolean;
        quotas?: Record<string, unknown>;
    } = {
        hasUploadPermission: false,
        isSuperAdmin: false,
        permissionSource: 'none',
        roles: [],
        permissions: [],
    };
    
    if (jwtToken) {
        permInfo = await getCustomerPermissionInfo(customer.customerId, jwtToken, env);
    }
    
    // Count mods
    const modCount = await countModsByAuthor(env.MODS_KV, customer.customerId);
    
    // Map permissionSource values
    let permissionSource: EnrichedCustomer['permissionSource'] = 'none';
    if (permInfo.isSuperAdmin) {
        permissionSource = 'super-admin';
    } else if (permInfo.permissionSource === 'access-service') {
        permissionSource = 'access-service';
    } else if (permInfo.permissionSource === 'error') {
        permissionSource = 'error';
    } else if (permInfo.hasUploadPermission) {
        permissionSource = 'kv'; // Fallback for legacy
    }
    
    return {
        customerId: customer.customerId,
        displayName: customer.displayName || null,
        customerIdExternal: null, // TODO: Map from subscriptions if available
        createdAt: customer.createdAt || null,
        lastLogin: customer.lastLogin || null,
        hasUploadPermission: permInfo.hasUploadPermission,
        permissionSource,
        isSuperAdmin: permInfo.isSuperAdmin,
        modCount,
        tier: customer.tier,
        status: customer.status,
        roles: permInfo.roles,
        permissions: permInfo.permissions,
    };
}

/**
 * GET /admin/customers - List all customers with enriched data
 * 
 * Returns customers aggregated from customer-api with:
 * - Permission data from access-service
 * - Mod counts from MODS_KV
 * 
 * Query params:
 * - search: Filter by displayName or customerId
 * - page: Page number (default 1)
 * - pageSize: Items per page (default 50)
 */
export async function handleListCustomersEnriched(
    request: Request,
    env: Env,
    auth: AuthResult
): Promise<Response> {
    const corsHeaders = getCorsHeaders(env, request);
    const headersObj = Object.fromEntries(corsHeaders.entries());

    try {
        // Parse query params
        const url = new URL(request.url);
        const search = url.searchParams.get('search')?.toLowerCase() || '';
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const pageSize = parseInt(url.searchParams.get('pageSize') || '50', 10);

        console.log('[Customers] Fetching enriched customer list', { search, page, pageSize });

        // Fetch base customers from customer-api
        const response = await fetchCustomersFromCustomerApi(env, auth.jwtToken);
        const rawCustomers = response?.customers || [];

        console.log(`[Customers] Fetched ${rawCustomers.length} customers from customer-api`);

        // Enrich customers with permission and mod data
        // Process in batches to avoid overwhelming services
        const enrichedCustomers: EnrichedCustomer[] = [];
        const batchSize = 10;
        
        for (let i = 0; i < rawCustomers.length; i += batchSize) {
            const batch = rawCustomers.slice(i, i + batchSize);
            const enrichedBatch = await Promise.all(
                batch.map(c => enrichCustomer(c, auth.jwtToken, env))
            );
            enrichedCustomers.push(...enrichedBatch);
        }

        console.log(`[Customers] Enriched ${enrichedCustomers.length} customers`);

        // Apply search filter
        let filtered = enrichedCustomers;
        if (search) {
            filtered = enrichedCustomers.filter(c => 
                c.customerId.toLowerCase().includes(search) ||
                (c.displayName?.toLowerCase().includes(search) ?? false)
            );
        }

        // Apply pagination
        const total = filtered.length;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const paginated = filtered.slice(start, end);

        return new Response(JSON.stringify({
            customers: paginated,
            total,
            page,
            pageSize,
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...headersObj,
            },
        });
    } catch (error: any) {
        console.error('[Customers] Failed to list enriched customers:', error);
        const rfcError = createError(
            request,
            500,
            'Internal Server Error',
            env.ENVIRONMENT === 'development' ? error.message : 'Failed to list customers'
        );
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...headersObj,
            },
        });
    }
}

/**
 * GET /admin/customers/:customerId - Get single customer with enriched data
 */
export async function handleGetCustomerEnriched(
    request: Request,
    env: Env,
    customerId: string,
    auth: AuthResult
): Promise<Response> {
    const corsHeaders = getCorsHeaders(env, request);
    const headersObj = Object.fromEntries(corsHeaders.entries());

    try {
        if (!env.CUSTOMER_API_URL) {
            throw new Error('CUSTOMER_API_URL is not configured');
        }

        // Fetch customer from customer-api
        const response = await fetch(`${env.CUSTOMER_API_URL}/admin/customers/${customerId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.jwtToken}`,
                'X-Service-Request': 'true',  // Mark as service-to-service call to prevent encryption
            },
        });

        if (!response.ok) {
            if (response.status === 404) {
                const rfcError = createError(request, 404, 'Not Found', `Customer ${customerId} not found`);
                return new Response(JSON.stringify(rfcError), {
                    status: 404,
                    headers: { 'Content-Type': 'application/problem+json', ...headersObj },
                });
            }
            throw new Error(`Failed to fetch customer: ${response.status}`);
        }

        const { customer: rawCustomer } = await response.json() as { customer: CustomerApiData };
        
        // Enrich with permission and mod data
        const enriched = await enrichCustomer(rawCustomer, auth.jwtToken, env);

        return new Response(JSON.stringify({ customer: enriched }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...headersObj,
            },
        });
    } catch (error: any) {
        console.error(`[Customers] Failed to get enriched customer ${customerId}:`, error);
        const rfcError = createError(
            request,
            500,
            'Internal Server Error',
            env.ENVIRONMENT === 'development' ? error.message : 'Failed to get customer'
        );
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...headersObj,
            },
        });
    }
}

/**
 * PUT /admin/customers/:customerId - Update customer
 * Proxies to customer-api and returns enriched response
 */
export async function handleUpdateCustomerEnriched(
    request: Request,
    env: Env,
    customerId: string,
    auth: AuthResult
): Promise<Response> {
    const corsHeaders = getCorsHeaders(env, request);
    const headersObj = Object.fromEntries(corsHeaders.entries());

    try {
        if (!env.CUSTOMER_API_URL) {
            throw new Error('CUSTOMER_API_URL is not configured');
        }

        // Forward request to customer-api
        const body = await request.text();
        const response = await fetch(`${env.CUSTOMER_API_URL}/admin/customers/${customerId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.jwtToken}`,
                'X-Service-Request': 'true',  // Mark as service-to-service call to prevent encryption
            },
            body,
        });

        if (!response.ok) {
            const error = await response.text();
            return new Response(error, {
                status: response.status,
                headers: { 'Content-Type': 'application/json', ...headersObj },
            });
        }

        const { customer: updatedCustomer } = await response.json() as { customer: CustomerApiData };
        
        // Enrich with permission and mod data
        const enriched = await enrichCustomer(updatedCustomer, auth.jwtToken, env);

        return new Response(JSON.stringify({ customer: enriched }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...headersObj,
            },
        });
    } catch (error: any) {
        console.error(`[Customers] Failed to update customer ${customerId}:`, error);
        const rfcError = createError(
            request,
            500,
            'Internal Server Error',
            env.ENVIRONMENT === 'development' ? error.message : 'Failed to update customer'
        );
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...headersObj,
            },
        });
    }
}
