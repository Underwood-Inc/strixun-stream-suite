/**
 * Customer Management Handlers
 * Handles customer profile and status management
 * 
 * Includes enriched customer list for admin dashboard that aggregates data from:
 * - customer-api: Base customer data (displayName, createdAt, tier)
 * - access-service: Roles, permissions, quotas
 * - otp-auth-service: Last login tracking
 */

import { getCorsHeadersRecord } from '../../utils/cors.js';
import { getCustomer, storeCustomer } from '../../services/customer.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    CUSTOMER_API_URL?: string;
    ACCESS_SERVICE_URL?: string;
    SERVICE_API_KEY?: string;
    ENVIRONMENT?: string;
    [key: string]: unknown;
}

/**
 * Customer data from customer-api
 */
interface CustomerApiData {
    customerId: string;
    displayName?: string | null;
    tier?: 'free' | 'basic' | 'premium' | 'enterprise';
    status?: string;
    createdAt?: string;
    updatedAt?: string;
    lastLogin?: string;
}

/**
 * Enriched customer for admin UI
 */
interface EnrichedCustomer {
    customerId: string;
    displayName: string | null;
    createdAt: string | null;
    lastLogin: string | null;
    tier?: string;
    status?: string;
    roles: string[];
    permissions: string[];
    isSuperAdmin: boolean;
    hasUploadPermission: boolean;
    permissionSource: string;
}

type CustomerStatus = 'active' | 'suspended' | 'cancelled' | 'pending_verification';

/**
 * Update customer status
 * PUT /admin/customers/{customerId}/status
 */
export async function handleUpdateCustomerStatus(request: Request, env: Env, customerId: string, newStatus: CustomerStatus): Promise<Response> {
    try {
        const customer = await getCustomer(customerId, env);
        if (!customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Validate status
        const validStatuses: CustomerStatus[] = ['active', 'suspended', 'cancelled', 'pending_verification'];
        if (!validStatuses.includes(newStatus)) {
            return new Response(JSON.stringify({ 
                error: 'Invalid status',
                validStatuses 
            }), {
                status: 400,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Update status
        const oldStatus = customer.status;
        customer.status = newStatus;
        customer.statusChangedAt = new Date().toISOString();
        customer.updatedAt = new Date().toISOString();
        
        await storeCustomer(customerId, customer, env);
        
        // Log status change
        console.log(`Customer ${customerId} status changed from ${oldStatus} to ${newStatus}`);
        
        return new Response(JSON.stringify({
            success: true,
            customerId,
            oldStatus,
            newStatus,
            statusChangedAt: customer.statusChangedAt,
            message: `Customer status updated to ${newStatus}`
        }), {
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const err = error as Error;
        return new Response(JSON.stringify({
            error: 'Failed to update customer status',
            message: err.message
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Suspend customer
 * POST /admin/customers/{customerId}/suspend
 */
export async function handleSuspendCustomer(request: Request, env: Env, customerId: string): Promise<Response> {
    return handleUpdateCustomerStatus(request, env, customerId, 'suspended');
}

/**
 * Activate customer
 * POST /admin/customers/{customerId}/activate
 */
export async function handleActivateCustomer(request: Request, env: Env, customerId: string): Promise<Response> {
    return handleUpdateCustomerStatus(request, env, customerId, 'active');
}

/**
 * Fetch customers from customer-api
 */
async function fetchCustomersFromCustomerApi(
    env: Env,
    jwtToken: string
): Promise<{ customers: CustomerApiData[]; total: number }> {
    if (!env.CUSTOMER_API_URL) {
        console.error('[Customers] CUSTOMER_API_URL is not configured');
        return { customers: [], total: 0 };
    }

    if (!jwtToken) {
        console.error('[Customers] JWT token is required');
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
 * Fetch customer authorization from access-service
 */
async function fetchCustomerAccess(
    customerId: string,
    jwtToken: string,
    env: Env
): Promise<{ roles: string[]; permissions: string[]; isSuperAdmin: boolean }> {
    if (!env.ACCESS_SERVICE_URL) {
        return { roles: [], permissions: [], isSuperAdmin: false };
    }

    try {
        const response = await fetch(`${env.ACCESS_SERVICE_URL}/access/${customerId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`,
                'X-Service-Request': 'true',  // Mark as service-to-service call to prevent encryption
            },
        });

        if (!response.ok) {
            console.warn(`[Customers] Failed to fetch access for ${customerId}: ${response.status}`);
            return { roles: [], permissions: [], isSuperAdmin: false };
        }

        const data = await response.json() as { roles?: string[]; permissions?: string[] };
        const roles = data.roles || [];
        const isSuperAdmin = roles.includes('super-admin');
        
        return {
            roles,
            permissions: data.permissions || [],
            isSuperAdmin,
        };
    } catch (error) {
        console.warn(`[Customers] Error fetching access for ${customerId}:`, error);
        return { roles: [], permissions: [], isSuperAdmin: false };
    }
}

/**
 * Enrich a single customer with access data
 */
async function enrichCustomer(
    customer: CustomerApiData,
    jwtToken: string,
    env: Env
): Promise<EnrichedCustomer> {
    const access = await fetchCustomerAccess(customer.customerId, jwtToken, env);
    
    // Determine permission source
    let permissionSource = 'none';
    if (access.isSuperAdmin) {
        permissionSource = 'super-admin';
    } else if (access.roles.includes('admin')) {
        permissionSource = 'admin';
    } else if (access.permissions.includes('mods:upload')) {
        permissionSource = 'access-service';
    }
    
    return {
        customerId: customer.customerId,
        displayName: customer.displayName || null,
        createdAt: customer.createdAt || null,
        lastLogin: customer.lastLogin || null,
        tier: customer.tier,
        status: customer.status,
        roles: access.roles,
        permissions: access.permissions,
        isSuperAdmin: access.isSuperAdmin,
        hasUploadPermission: access.isSuperAdmin || access.permissions.includes('mods:upload'),
        permissionSource,
    };
}

/**
 * List all customers with enriched data
 * GET /admin/customers
 * 
 * Aggregates data from customer-api and access-service
 * For use in the OTP Auth admin dashboard
 */
export async function handleListCustomersEnriched(
    request: Request,
    env: Env,
    jwtToken: string
): Promise<Response> {
    try {
        // Parse query params
        const url = new URL(request.url);
        const search = url.searchParams.get('search')?.toLowerCase() || '';
        const page = parseInt(url.searchParams.get('page') || '1', 10);
        const pageSize = parseInt(url.searchParams.get('pageSize') || '50', 10);

        console.log('[Customers] Fetching enriched customer list', { search, page, pageSize });

        // Fetch base customers from customer-api
        const response = await fetchCustomersFromCustomerApi(env, jwtToken);
        const rawCustomers = response?.customers || [];

        console.log(`[Customers] Fetched ${rawCustomers.length} customers from customer-api`);

        // Enrich customers with access data (batch to avoid overwhelming access-service)
        const enrichedCustomers: EnrichedCustomer[] = [];
        const batchSize = 10;
        
        for (let i = 0; i < rawCustomers.length; i += batchSize) {
            const batch = rawCustomers.slice(i, i + batchSize);
            const enrichedBatch = await Promise.all(
                batch.map(c => enrichCustomer(c, jwtToken, env))
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
            headers: { 
                ...getCorsHeadersRecord(env, request), 
                'Content-Type': 'application/json' 
            },
        });
    } catch (error) {
        const err = error as Error;
        console.error('[Customers] Failed to list enriched customers:', err);
        return new Response(JSON.stringify({
            error: 'Failed to list customers',
            message: env.ENVIRONMENT === 'development' ? err.message : 'Internal server error'
        }), {
            status: 500,
            headers: { 
                ...getCorsHeadersRecord(env, request), 
                'Content-Type': 'application/json' 
            },
        });
    }
}
