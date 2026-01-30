/**
 * Debug Handlers
 * Handles debug/testing endpoints
 * NOTE: These endpoints require super-admin authentication
 */

import { getCorsHeadersRecord } from '../../utils/cors.js';
import { hashEmail } from '../../utils/crypto.js';
import { hashIP } from '../../services/rate-limit.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    ENVIRONMENT?: string;
}

/**
 * Clear rate limit endpoint (super-admin only)
 * POST /admin/debug/clear-rate-limit
 * Requires: SUPER_ADMIN_API_KEY in Authorization header
 * 
 * Body: { email?: string, ip?: string }
 * - If email provided: clears email-based rate limit
 * - If ip provided: clears IP-based rate limit
 * - If neither provided: auto-detects IP from request and clears IP-based rate limit
 */
export async function handleClearRateLimit(request: Request, env: Env, customerId: string | null = null): Promise<Response> {
    try {
        const body = await request.json() as { email?: string; ip?: string };
        let { email, ip } = body;
        
        // Auto-detect IP from request headers if not provided
        // CF-Connecting-IP is set by Cloudflare and cannot be spoofed
        if (!ip) {
            ip = request.headers.get('CF-Connecting-IP') || undefined;
        }
        
        const cleared = {
            email: false,
            ip: false
        };
        
        // Clear email-based rate limit if email provided
        if (email) {
            const emailHash = await hashEmail(email);
            const rateLimitKey = customerId 
                ? `cust_${customerId}_ratelimit_otp_${emailHash}`
                : `ratelimit_otp_${emailHash}`;
            await env.OTP_AUTH_KV.delete(rateLimitKey);
            cleared.email = true;
        }
        
        // Clear IP-based rate limit if IP available
        if (ip) {
            const ipHash = await hashIP(ip);
            
            // Clear IP rate limit (with and without customer prefix for safety)
            const ipRateLimitKey = customerId 
                ? `cust_${customerId}_ratelimit_ip_${ipHash}`
                : `ratelimit_ip_${ipHash}`;
            await env.OTP_AUTH_KV.delete(ipRateLimitKey);
            
            // Also clear without customer prefix (for legacy/backward compatibility)
            if (customerId) {
                await env.OTP_AUTH_KV.delete(`ratelimit_ip_${ipHash}`);
            }
            
            cleared.ip = true;
        }
        
        if (!cleared.email && !cleared.ip) {
            return new Response(JSON.stringify({ 
                error: 'email or ip required',
                detail: 'Either email address or IP address is required to clear rate limit. IP will be auto-detected from request if not provided.'
            }), {
                status: 400,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify({ 
            success: true, 
            message: 'Rate limit cleared',
            cleared: cleared,
            detectedIp: ip || null
        }), {
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Clear rate limit error:', error);
        const err = error as Error;
        return new Response(JSON.stringify({ 
            error: 'Failed to clear rate limit',
            detail: err.message
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}
