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
                            const parts = key.name.split('_');
                            const extractedCustomerId = parts[1];
                            
                            customers.push({
                                customerId: extractedCustomerId || customer.customerId,
                                displayName: customer.displayName || null,
                                createdAt: customer.createdAt || null,
                                lastLogin: customer.lastLogin || null,
                            });
                        }
                    } catch (error) {
                        console.error(`[Admin] Failed to parse customer key ${key.name}:`, error);
                    }
                }
            }
            
            cursor = listResult.cursor;
        } while (cursor);
        
        // Remove duplicates (same customerId can appear multiple times)
        const uniqueCustomers = Array.from(
            new Map(customers.map(c => [c.customerId, c])).values()
        );
        
        const response: CustomerListResponse = {
            customers: uniqueCustomers,
            total: uniqueCustomers.length,
        };
        
        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('[Admin] Failed to list customers:', error);
        return new Response(JSON.stringify({ error: 'Failed to list customers' }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}
