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
 * Lookup user by userId using the index for O(1) lookup
 * Falls back to scanning if index is not available (backward compatibility)
 */
async function findUserByUserId(userId: string, env: Env): Promise<User | null> {
    // Try to get customerId from index first (O(1) lookup)
    const { getCustomerIdFromIndex, updateUserIndex } = await import('../../utils/user-index.js');
    const indexedCustomerId = await getCustomerIdFromIndex(userId, env);
    
    // Check if index entry exists by checking if the key exists
    // (getCustomerIdFromIndex returns null if not found, but we need to distinguish between
    // "not found" and "customerId is null")
    const indexKey = `user_index_${userId}`;
    const indexValue = await env.OTP_AUTH_KV.get(indexKey);
    const indexExists = indexValue !== null;
    
    if (indexExists) {
        // Index entry exists - search only within the specific customer scope (much faster)
        // This reduces search space from all customers to just one customer
        const customerPrefix = indexedCustomerId 
            ? `customer_${indexedCustomerId}_user_` 
            : 'customer_'; // If customerId is null, search all customer_ prefixes (but still faster than full scan)
        
        let cursor: string | undefined;
        
        do {
            const listResult = await env.OTP_AUTH_KV.list({ prefix: customerPrefix, cursor });
            
            for (const key of listResult.keys) {
                try {
                    const user = await env.OTP_AUTH_KV.get(key.name, { type: 'json' }) as User | null;
                    if (user && user.userId === userId) {
                        // Update index if customerId changed (shouldn't happen, but ensure consistency)
                        if (user.customerId !== indexedCustomerId) {
                            await updateUserIndex(userId, user.customerId || null, env);
                        }
                        return user;
                    }
                } catch (error) {
                    continue;
                }
            }
            
            cursor = listResult.listComplete ? undefined : listResult.cursor;
        } while (cursor);
    }
    
    // Fallback: Index not available or customerId is null - scan all scopes (backward compatibility)
    // This should rarely happen if index is properly maintained
    console.warn(`[UserLookup] Index lookup failed or customerId is null, falling back to full scan for userId: ${userId}`);
    
    const customerPrefix = 'customer_';
    let cursor: string | undefined;
    let iterations = 0;
    const MAX_ITERATIONS = 100; // Safety limit
    
    do {
        const listResult = await env.OTP_AUTH_KV.list({ prefix: customerPrefix, cursor });
        
        for (const key of listResult.keys) {
            if (key.name.includes('_user_')) {
                try {
                    const user = await env.OTP_AUTH_KV.get(key.name, { type: 'json' }) as User | null;
                    if (user && user.userId === userId) {
                        // Update index for future lookups
                        if (user.customerId !== undefined) {
                            const { updateUserIndex } = await import('../../utils/user-index.js');
                            await updateUserIndex(userId, user.customerId, env);
                        }
                        return user;
                    }
                } catch (error) {
                    continue;
                }
            }
        }
        
        cursor = listResult.listComplete ? undefined : listResult.cursor;
        iterations++;
        
        if (iterations >= MAX_ITERATIONS) {
            console.warn(`[UserLookup] Reached max iterations (${MAX_ITERATIONS}) while searching for userId: ${userId}`);
            break;
        }
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

        // Find user by userId using the index for O(1) customerId lookup
        // Then searches only within that customer's scope (much faster than scanning all scopes)
        const startTime = Date.now();
        const user = await findUserByUserId(userId, env);
        const lookupTime = Date.now() - startTime;
        
        if (lookupTime > 5000) {
            console.warn(`[UserLookup] Slow lookup detected: ${lookupTime}ms for userId: ${userId}`);
        }
        
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

