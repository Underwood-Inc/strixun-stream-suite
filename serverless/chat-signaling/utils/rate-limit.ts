/**
 * Rate Limiting Utilities
 * 
 * KV-based rate limiting for Chat Signaling worker
 * Prevents DoS attacks and resource exhaustion
 * 
 * @module utils/rate-limit
 */

import type { Env } from '../types';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed */
  maxRequests: number;
  
  /** Time window in milliseconds */
  windowMs: number;
  
  /** Optional: Custom error message */
  message?: string;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  
  /** Number of requests remaining in current window */
  remaining?: number;
  
  /** Timestamp when the rate limit resets */
  resetAt?: number;
  
  /** Seconds until rate limit resets (for Retry-After header) */
  retryAfter?: number;
}

/**
 * Rate limit data stored in KV
 */
interface RateLimitData {
  /** Number of requests made in current window */
  count: number;
  
  /** Timestamp when the window resets */
  resetAt: number;
}

/**
 * Check rate limit for a given key
 * 
 * Uses KV to track request counts per key (IP, user ID, etc.)
 * Implements sliding window rate limiting
 * 
 * @param key - Unique identifier for rate limiting (e.g., IP address, user ID)
 * @param env - Worker environment
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export async function checkRateLimit(
  key: string,
  env: Env,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const rateLimitKey = `rate_limit_${key}`;
  const now = Date.now();
  
  try {
    // Get existing rate limit data
    const dataStr = await env.CHAT_KV.get(rateLimitKey);
    const data: RateLimitData | null = dataStr ? JSON.parse(dataStr) : null;
    
    // If no data or window expired, start new window
    if (!data || now > data.resetAt) {
      const resetAt = now + config.windowMs;
      const newData: RateLimitData = {
        count: 1,
        resetAt,
      };
      
      // Store with TTL slightly longer than window to handle clock skew
      const ttlSeconds = Math.ceil(config.windowMs / 1000) + 60;
      await env.CHAT_KV.put(rateLimitKey, JSON.stringify(newData), { 
        expirationTtl: ttlSeconds 
      });
      
      return { 
        allowed: true, 
        remaining: config.maxRequests - 1,
        resetAt,
      };
    }
    
    // Check if limit exceeded
    if (data.count >= config.maxRequests) {
      const retryAfter = Math.ceil((data.resetAt - now) / 1000);
      return { 
        allowed: false, 
        remaining: 0,
        resetAt: data.resetAt,
        retryAfter: retryAfter > 0 ? retryAfter : 1,
      };
    }
    
    // Increment count
    const newData: RateLimitData = {
      count: data.count + 1,
      resetAt: data.resetAt,
    };
    
    const ttlSeconds = Math.ceil((data.resetAt - now) / 1000) + 60;
    await env.CHAT_KV.put(rateLimitKey, JSON.stringify(newData), { 
      expirationTtl: ttlSeconds 
    });
    
    return { 
      allowed: true, 
      remaining: config.maxRequests - newData.count,
      resetAt: data.resetAt,
    };
  } catch (error) {
    // On error, allow the request (fail open)
    // Log error for monitoring
    console.error('[Rate Limit] Error checking rate limit:', error);
    return { allowed: true };
  }
}

/**
 * Get client identifier for rate limiting
 * 
 * Uses IP address as primary identifier
 * Falls back to user ID if authenticated
 * 
 * @param request - HTTP request
 * @param userId - Optional user ID from auth
 * @returns Client identifier for rate limiting
 */
export function getClientIdentifier(request: Request, userId?: string): string {
  // Try to get real IP from Cloudflare headers
  const cfConnectingIp = request.headers.get('CF-Connecting-IP');
  if (cfConnectingIp) {
    return `ip_${cfConnectingIp}`;
  }
  
  // Fallback to X-Forwarded-For
  const xForwardedFor = request.headers.get('X-Forwarded-For');
  if (xForwardedFor) {
    const ip = xForwardedFor.split(',')[0].trim();
    return `ip_${ip}`;
  }
  
  // If authenticated, use user ID
  if (userId) {
    return `user_${userId}`;
  }
  
  // Last resort: use a generic identifier
  // This is not ideal but prevents complete failure
  return 'unknown';
}

/**
 * Create rate limit response
 * 
 * Returns 429 Too Many Requests with appropriate headers
 * 
 * @param result - Rate limit result
 * @param corsHeaders - CORS headers to include
 * @param message - Optional custom message
 * @returns HTTP response
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string>,
  message?: string
): Response {
  const errorMessage = message || 'Too many requests. Please try again later.';
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...corsHeaders,
  };
  
  // Add rate limit headers
  if (result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString();
  }
  
  if (result.resetAt) {
    headers['X-RateLimit-Reset'] = result.resetAt.toString();
  }
  
  if (result.remaining !== undefined) {
    headers['X-RateLimit-Remaining'] = result.remaining.toString();
  }
  
  return new Response(JSON.stringify({
    error: 'Rate limit exceeded',
    message: errorMessage,
    retryAfter: result.retryAfter,
  }), {
    status: 429,
    headers,
  });
}

/**
 * Predefined rate limit configurations
 */
export const RATE_LIMITS = {
  /** Room creation: 5 rooms per hour per user */
  CREATE_ROOM: {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Too many rooms created. Limit: 5 per hour.',
  },
  
  /** Heartbeat: 100 heartbeats per hour per room */
  HEARTBEAT: {
    maxRequests: 100,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Too many heartbeats. Limit: 100 per hour.',
  },
  
  /** Offer/Answer exchange: 50 exchanges per hour per user */
  OFFER_ANSWER: {
    maxRequests: 50,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Too many offer/answer exchanges. Limit: 50 per hour.',
  },
  
  /** Join room: 20 joins per hour per user */
  JOIN_ROOM: {
    maxRequests: 20,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Too many room joins. Limit: 20 per hour.',
  },
  
  /** General API: 1000 requests per hour per IP */
  GENERAL: {
    maxRequests: 1000,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Too many requests. Limit: 1000 per hour.',
  },
} as const;
