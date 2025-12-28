/**
 * Admin handler for listing all users
 * GET /admin/users
 * Returns all users across all customer scopes (admin only)
 */

import { getCorsHeaders } from '../../utils/cors.js';

interface User {
    userId: string;
    email: string;
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
}

interface UserListResponse {
    users: UserListItem[];
    total: number;
}

/**
 * List all users from OTP auth service
 */
export async function handleListUsers(request: Request, env: Env, customerId: string | null): Promise<Response> {
    try {
        const users: UserListItem[] = [];
        
        // List all users from all customer scopes
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
                            // Extract customerId from key name
                            const match = key.name.match(/^customer_([^_/]+)[_/]user_/);
                            const customerId = match ? match[1] : null;
                            
                            users.push({
                                userId: user.userId,
                                displayName: user.displayName || null,
                                customerId: customerId || user.customerId || null,
                                createdAt: user.createdAt || null,
                                lastLogin: user.lastLogin || null,
                            });
                        }
                    } catch (error) {
                        // Skip invalid entries
                        console.warn('[ListUsers] Failed to parse user:', key.name, error);
                        continue;
                    }
                }
            }
            
            cursor = listResult.listComplete ? undefined : listResult.cursor;
        } while (cursor);
        
        // Sort by createdAt (newest first)
        users.sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
        });
        
        const response: UserListResponse = {
            users,
            total: users.length,
        };
        
        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        console.error('[ListUsers] Error:', error);
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

