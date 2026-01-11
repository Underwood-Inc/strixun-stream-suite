/**
 * Rate Limiting Utility for Access Service
 * 
 * Implements KV-based rate limiting to prevent abuse of access control endpoints.
 * Uses a sliding window algorithm for accurate rate limiting.
 */

import type { Env } from '../types/authorization.js';

export interface RateLimitConfig {
    /** Maximum requests allowed in the window */
    maxRequests: number;
    /** Time window in seconds */
    windowSeconds: number;
    /** Optional: Key prefix for organization */
    keyPrefix?: string;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: string;
    retryAfter?: number; // Seconds until reset (if blocked)
}

/**
 * Default rate limit configurations per endpoint type
 */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
    // Read operations - generous limits
    read: {
        maxRequests: 100,
        windowSeconds: 60,
        keyPrefix: 'rl_read',
    },
    // Check operations - medium limits
    check: {
        maxRequests: 50,
        windowSeconds: 60,
        keyPrefix: 'rl_check',
    },
    // Write operations - strict limits
    write: {
        maxRequests: 20,
        windowSeconds: 60,
        keyPrefix: 'rl_write',
    },
    // Seed/admin operations - very strict limits
    admin: {
        maxRequests: 5,
        windowSeconds: 60,
        keyPrefix: 'rl_admin',
    },
};

/**
 * Check and increment rate limit for a given identifier
 * Uses sliding window algorithm with KV storage
 * 
 * @param identifier - Unique identifier (e.g., customerId, IP, service key hash)
 * @param config - Rate limit configuration
 * @param env - Worker environment
 * @returns Rate limit result indicating if request is allowed
 */
export async function checkRateLimit(
    identifier: string,
    config: RateLimitConfig,
    env: Env
): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;
    const keyPrefix = config.keyPrefix || 'rl';
    const key = `${keyPrefix}_${identifier}`;
    
    // Get current request log from KV
    const existingData = await env.ACCESS_KV.get(key, { type: 'json' }) as { requests: number[]; resetAt: number } | null;
    
    // Calculate window start time
    const windowStart = now - windowMs;
    
    // Filter out requests outside the current window
    const recentRequests = existingData?.requests?.filter(ts => ts > windowStart) || [];
    
    // Check if limit exceeded
    const currentCount = recentRequests.length;
    const allowed = currentCount < config.maxRequests;
    
    if (allowed) {
        // Add current request timestamp
        recentRequests.push(now);
        
        // Store updated request log with TTL
        const resetAt = now + windowMs;
        await env.ACCESS_KV.put(
            key,
            JSON.stringify({
                requests: recentRequests,
                resetAt,
            }),
            { expirationTtl: config.windowSeconds * 2 } // TTL is 2x window for safety
        );
        
        return {
            allowed: true,
            remaining: config.maxRequests - recentRequests.length,
            resetAt: new Date(resetAt).toISOString(),
        };
    } else {
        // Calculate retry-after based on oldest request in window
        const oldestRequest = Math.min(...recentRequests);
        const retryAfterMs = (oldestRequest + windowMs) - now;
        const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
        
        return {
            allowed: false,
            remaining: 0,
            resetAt: new Date(oldestRequest + windowMs).toISOString(),
            retryAfter: retryAfterSeconds,
        };
    }
}

/**
 * Get rate limit identifier from request
 * Priority: Service Key hash > JWT customerId > IP address
 * 
 * @param request - HTTP request
 * @param auth - Authentication result (if available)
 * @returns Unique identifier for rate limiting
 */
export function getRateLimitIdentifier(
    request: Request,
    auth: { customerId: string | null; isServiceCall: boolean; jwtToken?: string } | null
): string {
    // Priority 1: Service key (hash it for privacy)
    const serviceKey = request.headers.get('X-Service-Key');
    if (serviceKey) {
        // Use first 16 chars as identifier (enough uniqueness, not full key)
        return `service_${serviceKey.substring(0, 16)}`;
    }
    
    // Priority 2: Customer ID from JWT
    if (auth?.customerId) {
        return `customer_${auth.customerId}`;
    }
    
    // Priority 3: IP address (from Cloudflare)
    const ip = request.headers.get('CF-Connecting-IP') || 
                request.headers.get('X-Forwarded-For') || 
                'unknown';
    return `ip_${ip}`;
}

/**
 * Create rate limit error response
 * Returns 429 Too Many Requests with retry information
 */
export function createRateLimitError(result: RateLimitResult): Response {
    return new Response(JSON.stringify({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: result.retryAfter,
        resetAt: result.resetAt,
    }), {
        status: 429,
        headers: {
            'Content-Type': 'application/problem+json',
            'Retry-After': String(result.retryAfter || 60),
            'X-RateLimit-Limit': '0', // Will be set by caller
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.resetAt,
        },
    });
}

/**
 * Add rate limit headers to response
 * Adds standard rate limit headers for transparency
 */
export function addRateLimitHeaders(response: Response, result: RateLimitResult, limit: number): Response {
    const headers = new Headers(response.headers);
    headers.set('X-RateLimit-Limit', String(limit));
    headers.set('X-RateLimit-Remaining', String(result.remaining));
    headers.set('X-RateLimit-Reset', result.resetAt);
    
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}
