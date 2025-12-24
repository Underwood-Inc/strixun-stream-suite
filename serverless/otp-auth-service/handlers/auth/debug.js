/**
 * Debug Handlers
 * Handles debug/testing endpoints
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { hashEmail } from '../../utils/crypto.js';

/**
 * Clear rate limit endpoint (for testing/debugging)
 * POST /auth/request-otp/clear-rate-limit
 */
export async function handleClearRateLimit(request, env, customerId = null) {
    try {
        const body = await request.json();
        const { email, ip } = body;
        
        if (!email) {
            return new Response(JSON.stringify({ 
                error: 'email required',
                detail: 'Email address is required to clear rate limit'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Hash email
        const emailHash = await hashEmail(email);
        
        // Clear email-based rate limit
        const rateLimitKey = customerId 
            ? `cust_${customerId}_ratelimit_otp_${emailHash}`
            : `ratelimit_otp_${emailHash}`;
        await env.OTP_AUTH_KV.delete(rateLimitKey);
        
        // Clear IP-based rate limit if IP provided
        let clearedIp = false;
        if (ip) {
            // Hash IP (same logic as rate-limit service)
            const encoder = new TextEncoder();
            const data = encoder.encode(ip);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const ipHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
            
            const ipRateLimitKey = customerId 
                ? `cust_${customerId}_ratelimit_ip_${ipHash}`
                : `ratelimit_ip_${ipHash}`;
            await env.OTP_AUTH_KV.delete(ipRateLimitKey);
            clearedIp = true;
        }
        
        return new Response(JSON.stringify({ 
            success: true, 
            message: 'Rate limit cleared',
            cleared: {
                email: true,
                ip: clearedIp
            }
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Clear rate limit error:', error);
        return new Response(JSON.stringify({ 
            error: 'Failed to clear rate limit',
            detail: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

