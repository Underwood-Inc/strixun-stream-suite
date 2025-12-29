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
    const startTime = Date.now();
    const TIMEOUT_MS = 10000; // 10 second timeout to prevent 522 errors
    
    // Try to get customerId from index first (O(1) lookup)
    const { getCustomerIdFromIndex, updateUserIndex } = await import('../../utils/user-index.js');
    const indexedCustomerId = await getCustomerIdFromIndex(userId, env);
    
    // Check if index entry exists by checking if the key exists
    // (getCustomerIdFromIndex returns null if not found, but we need to distinguish between
    // "not found" and "customerId is null")
    const indexKey = `user_index_${userId}`;
    const indexValue = await env.OTP_AUTH_KV.get(indexKey);
    const indexExists = indexValue !== null;
    
    if (indexExists && indexedCustomerId) {
        // Index entry exists with a valid customerId - search only within that customer's scope
        // This is the fastest path: O(1) index lookup + search within one customer scope
        const customerPrefix = `customer_${indexedCustomerId}_user_`;
        let cursor: string | undefined;
        let iterations = 0;
        const MAX_ITERATIONS = 3; // Limit iterations to prevent excessive scanning
        
        do {
            // Check timeout
            if (Date.now() - startTime > TIMEOUT_MS) {
                console.warn(`[UserLookup] Timeout (${TIMEOUT_MS}ms) while searching customer scope for userId: ${userId}`);
                return null;
            }
            
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
            iterations++;
            
            if (iterations >= MAX_ITERATIONS) {
                console.warn(`[UserLookup] Reached max iterations (${MAX_ITERATIONS}) while searching customer scope for userId: ${userId}`);
                break;
            }
        } while (cursor);
        
        // User not found in expected customer scope - return null (don't fall through to full scan)
        console.warn(`[UserLookup] User ${userId} not found in customer scope ${indexedCustomerId} after ${iterations} iterations`);
        return null;
    }
    
    // Fallback: Index not available or customerId is null - scan all scopes (backward compatibility)
    // This should rarely happen if index is properly maintained
    // WARNING: This is slow and may timeout - should only happen for old users without index entries
    console.warn(`[UserLookup] Index lookup failed or customerId is null, falling back to limited scan for userId: ${userId}`);
    
    const customerPrefix = 'customer_';
    let cursor: string | undefined;
    let iterations = 0;
    const MAX_ITERATIONS = 2; // Very limited for fallback - only 2 iterations to prevent timeouts
    
    do {
        // Check timeout
        if (Date.now() - startTime > TIMEOUT_MS) {
            console.warn(`[UserLookup] Timeout (${TIMEOUT_MS}ms) during fallback scan for userId: ${userId}`);
            return null;
        }
        
        const listResult = await env.OTP_AUTH_KV.list({ prefix: customerPrefix, cursor });
        
        for (const key of listResult.keys) {
            if (key.name.includes('_user_')) {
                try {
                    const user = await env.OTP_AUTH_KV.get(key.name, { type: 'json' }) as User | null;
                    if (user && user.userId === userId) {
                        // Update index for future lookups
                        if (user.customerId !== undefined) {
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
            console.warn(`[UserLookup] Reached max iterations (${MAX_ITERATIONS}) during fallback scan for userId: ${userId}`);
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

