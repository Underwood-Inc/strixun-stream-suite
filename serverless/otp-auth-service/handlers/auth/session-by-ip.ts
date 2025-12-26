/**
 * Session by IP Handler
 * 
 * Allows applications to discover active sessions for a given IP address.
 * This enables cross-application session sharing.
 */

import { getCustomer } from '../../services/customer.js';
import { getSessionsByIP } from '../../services/ip-session-index.js';
import { checkIPRateLimit, recordIPRequest } from '../../services/rate-limit.js';
import { getCustomerCached, type GetCustomerFn } from '../../utils/cache.js';
import { getCorsHeaders } from '../../utils/cors.js';
import { getJWTSecret, verifyJWT } from '../../utils/crypto.js';
import { isSuperAdminEmail } from '../../utils/super-admin.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    ENVIRONMENT?: string;
    [key: string]: any;
}

interface JWTPayload {
    userId?: string;
    sub?: string;
    email?: string;
    customerId?: string | null;
    [key: string]: any;
}

/**
 * Get active sessions by IP address
 * GET /auth/session-by-ip
 * GET /auth/session-by-ip?ip={ip}
 * 
 * - Without query param: Returns sessions for the request IP (requires authentication)
 * - With query param: Returns sessions for specified IP (requires admin authentication)
 */
export async function handleSessionByIP(request: Request, env: Env): Promise<Response> {
    try {
        const url = new URL(request.url);
        const queryIP = url.searchParams.get('ip');
        
        // Get request IP
        const requestIP = request.headers.get('CF-Connecting-IP') || 
                         request.headers.get('X-Forwarded-For') || 
                         'unknown';
        
        // Extract and verify authentication token
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ 
                error: 'Authorization required',
                detail: 'Authentication required to lookup sessions'
            }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const token = authHeader.substring(7);
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret) as JWTPayload | null;
        
        if (!payload || !payload.email) {
            return new Response(JSON.stringify({ 
                error: 'Invalid or expired token'
            }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const customerId = payload.customerId || null;
        const email = payload.email;
        
        // Check IP rate limit for session lookup endpoint using existing rate limiting service
        const getCustomerFn: GetCustomerFn = (cid: string) => getCustomer(cid, env);
        const rateLimit = await checkIPRateLimit(
            requestIP,
            customerId,
            (id: string) => getCustomerCached(id, getCustomerFn),
            env,
            'session-lookup',
            undefined, // Use plan default
            email
        );
        
        if (!rateLimit.allowed) {
            // Record failed request for usage statistics (FULL SERVICE - same as OTP rate limiting)
            await recordIPRequest(requestIP, customerId, env, false);
            
            return new Response(JSON.stringify({ 
                type: 'https://tools.ietf.org/html/rfc6585#section-4',
                title: 'Too Many Requests',
                status: 429,
                detail: 'Rate limit exceeded. Please try again later.',
                instance: request.url,
                reason: rateLimit.reason || 'rate_limit_exceeded',
                reset_at: rateLimit.resetAt,
                remaining: rateLimit.remaining,
            }), {
                status: 429,
                headers: { 
                    ...getCorsHeaders(env, request), 
                    'Content-Type': 'application/problem+json',
                    'Retry-After': '3600', // Retry after 1 hour
                    'X-RateLimit-Limit': rateLimit.ipLimit?.max?.toString() || '',
                    'X-RateLimit-Remaining': rateLimit.remaining?.toString() || '0',
                    'X-RateLimit-Reset': rateLimit.resetAt,
                },
            });
        }
        
        // Determine which IP to lookup
        const lookupIP = queryIP || requestIP;
        
        // If querying a specific IP, require admin authentication
        if (queryIP) {
            // Check if user is super admin
            const isSuperAdmin = await isSuperAdminEmail(email, env);
            if (!isSuperAdmin) {
                return new Response(JSON.stringify({ 
                    error: 'Forbidden',
                    detail: 'Admin privileges required to query sessions for a specific IP address'
                }), {
                    status: 403,
                    headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                });
            }
        }
        
        // Get sessions for the IP
        const sessions = await getSessionsByIP(lookupIP, env);
        
        // Record successful request for usage statistics (FULL SERVICE - same as OTP rate limiting)
        await recordIPRequest(requestIP, customerId, env, true);
        
        // Format response (exclude sensitive data like tokens)
        const sessionList = sessions.map(session => ({
            userId: session.userId,
            email: session.email,
            customerId: session.customerId,
            expiresAt: session.expiresAt,
            createdAt: session.createdAt,
            // Note: IP address is not included in response for privacy
            // Applications can infer it from the request
        }));
        
        return new Response(JSON.stringify({
            ip: queryIP ? lookupIP : undefined, // Only include IP if explicitly queried
            sessions: sessionList,
            count: sessionList.length
        }), {
            headers: { 
                ...getCorsHeaders(env, request), 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store', // Don't cache session data
                'Pragma': 'no-cache',
                'X-RateLimit-Limit': rateLimit.ipLimit?.max?.toString() || '',
                'X-RateLimit-Remaining': rateLimit.remaining?.toString() || '0',
                'X-RateLimit-Reset': rateLimit.resetAt,
            },
        });
    } catch (error: any) {
        console.error('[Session by IP] Error:', error);
        return new Response(JSON.stringify({ 
            error: 'Failed to get sessions by IP',
            message: env.ENVIRONMENT === 'development' ? error.message : undefined
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

