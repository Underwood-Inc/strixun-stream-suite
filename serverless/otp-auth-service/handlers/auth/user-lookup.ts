/**
 * Public user lookup handler
 * GET /auth/user/:userId
 * Returns public user information (displayName) by userId
 * This is a public endpoint for service-to-service communication
 */

import { getCorsHeaders } from '../../utils/cors.js';

interface User {
    userId: string;
    email: string;
    displayName?: string | null;
    customerId?: string | null;
    [key: string]: any;
}

/**
 * Lookup user by userId across all customer scopes
 * Since users are stored by email hash, we need to search through customer scopes
 */
async function findUserByUserId(userId: string, env: Env): Promise<User | null> {
    // Search through all customer scopes
    const customerPrefix = 'customer_';
    let cursor: string | undefined;
    
    do {
        const listResult = await env.OTP_AUTH_KV.list({ prefix: customerPrefix, cursor });
        
        for (const key of listResult.keys) {
            // Look for user keys: customer_{id}_user_{emailHash}
            if (key.name.includes('_user_')) {
                try {
                    const user = await env.OTP_AUTH_KV.get(key.name, { type: 'json' }) as User | null;
                    if (user && user.userId === userId) {
                        return user;
                    }
                } catch (error) {
                    // Skip invalid entries
                    continue;
                }
            }
        }
        
        cursor = listResult.listComplete ? undefined : listResult.cursor;
    } while (cursor);
    
    return null;
}

/**
 * Handle user lookup request
 * GET /auth/user/:userId
 */
export async function handleUserLookup(
    request: Request,
    env: Env,
    userId: string
): Promise<Response> {
    try {
        if (!userId || typeof userId !== 'string') {
            return new Response(JSON.stringify({
                error: 'Invalid userId',
                detail: 'userId must be a non-empty string'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Find user by userId
        const user = await findUserByUserId(userId, env);
        
        if (!user) {
            return new Response(JSON.stringify({
                error: 'User not found',
                detail: `No user found with userId: ${userId}`
            }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Return only public information (displayName)
        // Do not return email, customerId, or other sensitive data
        return new Response(JSON.stringify({
            userId: user.userId,
            displayName: user.displayName || null,
        }), {
            status: 200,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        console.error('[UserLookup] Error:', error);
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

