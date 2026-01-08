/**
 * Admin handler for listing all customers
 * GET /admin/customers
 * Returns all customers across all customer scopes (admin only)
 */

import { getCorsHeaders } from '../../utils/cors.js';

interface Customer {
    customerId: string;
    email: string;
    displayName?: string | null;
    createdAt?: string;
    lastLogin?: string;
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

/**
 * List all customers from OTP auth service
 */
export async function handleListCustomers(request: Request, env: Env, customerId: string | null): Promise<Response> {
    try {
        const customers: CustomerListItem[] = [];
        
        // List all customers from all customer scopes
        const customerPrefix = 'customer_';
        let cursor: string | undefined;
        
        do {
            const listResult = await env.OTP_AUTH_KV.list({ prefix: customerPrefix, cursor });
            
            for (const key of listResult.keys) {
                // Look for customer keys: customer_{id}_customer_{emailHash}
                if (key.name.includes('_customer_')) {
                    try {
                        const customer = await env.OTP_AUTH_KV.get(key.name, { type: 'json' }) as Customer | null;
                        if (customer && customer.customerId) {
                            // Extract customerId from key name
                            const match = key.name.match(/^customer_([^_/]+)[_/]customer_/);
                            const scopeCustomerId = match ? match[1] : null;
                            
                            customers.push({
                                customerId: customer.customerId || scopeCustomerId,
                                displayName: customer.displayName || null,
                                createdAt: customer.createdAt || null,
                                lastLogin: customer.lastLogin || null,
                            });
                        }
                    } catch (error) {
                        // Skip invalid entries
                        console.warn('[ListCustomers] Failed to parse customer:', key.name, error);
                        continue;
                    }
                }
            }
            
            cursor = listResult.listComplete ? undefined : listResult.cursor;
        } while (cursor);
        
        // Sort by createdAt (newest first)
        customers.sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
        });
        
        const response: CustomerListResponse = {
            customers,
            total: customers.length,
        };
        
        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        console.error('[ListCustomers] Error:', error);
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: env.ENVIRONMENT === 'development' ? error.message : undefined
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

interface Env {
    OTP_AUTH_KV: KVNamespace;
    ENVIRONMENT?: string;
    [key: string]: any;
}

