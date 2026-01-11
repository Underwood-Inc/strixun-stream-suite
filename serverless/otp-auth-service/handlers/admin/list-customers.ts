/**
 * Admin handler for listing all customers
 * GET /admin/customers
 * Returns all customers from Customer API (admin only)
 * 
 * NOTE: Customer data is now stored in CUSTOMER_KV (via customer-api), not OTP_AUTH_KV
 * OTP_AUTH_KV only stores authentication data (OTP codes, sessions, API keys)
 */

import { getCorsHeaders } from '../../utils/cors.js';

interface Customer {
    customerId: string;
    email?: string; // May not be present in customer-api responses
    displayName?: string | null;
    createdAt?: string;
    lastLogin?: string;
    status?: string;
    [key: string]: any;
}

interface CustomerListItem {
    customerId: string;
    displayName: string | null;
    createdAt: string | null;
    lastLogin: string | null;
}

interface CustomerListResponse {
    customers: CustomerListItem[];
    total: number;
}

interface Env {
    OTP_AUTH_KV: KVNamespace;
    CUSTOMER_API_URL?: string;
    SUPER_ADMIN_API_KEY?: string;
    SERVICE_API_KEY?: string;
    NETWORK_INTEGRITY_KEYPHRASE?: string;
    [key: string]: any;
}

/**
 * List all customers from Customer API
 * Fetches from customer-api service which has the authoritative customer data
 */
export async function handleListCustomers(request: Request, env: Env, customerId: string | null): Promise<Response> {
    try {
        const customers: CustomerListItem[] = [];
        
        // CRITICAL: Fetch customers from Customer API, not OTP_AUTH_KV
        // Customer data has been migrated to CUSTOMER_KV (customer-api)
        // OTP_AUTH_KV only stores authentication data now
        
        const { createServiceClient } = await import('@strixun/service-client');
        
        // Use env var if set, otherwise fallback to appropriate Customer API URL
        const customerApiUrl = env.CUSTOMER_API_URL || (env.ENVIRONMENT === 'development' ? 'http://localhost:8790' : 'https://customer-api.idling.app');
        
        if (!customerApiUrl) {
            console.error('[Admin] CUSTOMER_API_URL not configured and no fallback available');
            return new Response(JSON.stringify({ 
                error: 'Customer API URL not configured',
                detail: 'CUSTOMER_API_URL environment variable is required'
            }), {
                status: 500,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Create service client with SUPER_ADMIN_API_KEY for admin operations
        const client = createServiceClient(customerApiUrl, env);
        
        // Fetch customers from customer-api
        const response = await client.get<{ customers: Customer[]; total: number }>('/admin/customers');
        
        if (response.status === 200 && response.data) {
            const customersData = response.data.customers || [];
            
            // Map to CustomerListItem format
            for (const customer of customersData) {
                if (customer.customerId) {
                    customers.push({
                        customerId: customer.customerId,
                        displayName: customer.displayName || null,
                        createdAt: customer.createdAt || null,
                        lastLogin: customer.lastLogin || null,
                    });
                }
            }
            
            console.log('[Admin] Loaded customers from Customer API:', {
                total: customers.length,
                customerApiUrl,
            });
        } else {
            console.error('[Admin] Failed to fetch customers from Customer API:', {
                status: response.status,
                statusText: response.statusText,
            });
            return new Response(JSON.stringify({ 
                error: 'Failed to fetch customers from Customer API',
                detail: `Customer API returned ${response.status} ${response.statusText}`
            }), {
                status: 500,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const responseData: CustomerListResponse = {
            customers,
            total: customers.length,
        };
        
        return new Response(JSON.stringify(responseData), {
            status: 200,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('[Admin] Failed to list customers:', error);
        return new Response(JSON.stringify({ 
            error: 'Failed to list customers',
            detail: error instanceof Error ? error.message : String(error)
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}
