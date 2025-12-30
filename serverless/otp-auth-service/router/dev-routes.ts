/**
 * Dev Routes
 * Handles development-only endpoints (ONLY available when ENVIRONMENT is explicitly 'test')
 * 
 * SECURITY: These routes are ABSOLUTELY DISABLED in production, staging, and all non-test environments
 * 
 * WHITELIST APPROACH (not blacklist):
 * - ONLY ENVIRONMENT='test' is allowed
 * - Everything else is explicitly blocked: 'production', 'staging', 'development', undefined, etc.
 * 
 * Requirements for dev routes to work (ALL must be true):
 * 1. ENVIRONMENT must be explicitly 'test' (whitelist - only this value allowed)
 * 2. RESEND_API_KEY must start with 're_test_' (test key, never in production)
 * 
 * Production Safety:
 * - Production ENVIRONMENT is always 'production' (set in wrangler.toml [env.production.vars])
 * - Production RESEND_API_KEY is a real key (never starts with 're_test_')
 * - Staging ENVIRONMENT would be 'staging' - explicitly blocked
 * - Development ENVIRONMENT would be 'development' - explicitly blocked (only 'test' allowed)
 * - Undefined ENVIRONMENT - explicitly blocked
 * - If ENVIRONMENT is anything other than exactly 'test', dev routes return null (route doesn't exist)
 * - This endpoint returns 403 Forbidden in production, staging, development, or any non-test environment
 * 
 * This code path is NEVER reached in production deployments.
 */

import { getCorsHeaders } from '../utils/cors.js';
import { hashEmail } from '../utils/crypto.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    ENVIRONMENT?: string;
    RESEND_API_KEY?: string;
    [key: string]: any;
}

interface RouteResult {
    response: Response;
    customerId: string | null;
}

/**
 * Check if dev mode is enabled
 * 
 * SECURITY: Dev endpoints are ONLY available when ALL of these are true:
 * 1. ENVIRONMENT is explicitly 'test' (NOT 'production', NOT undefined, NOT anything else)
 * 2. RESEND_API_KEY starts with 're_test_' (test key, never used in production)
 * 
 * PRODUCTION SAFETY:
 * - Production ENVIRONMENT is always 'production' (set in wrangler.toml)
 * - Production RESEND_API_KEY is a real key (never starts with 're_test_')
 * - If ENVIRONMENT is undefined or anything other than 'test', dev routes are disabled
 * - This endpoint returns 403 in production, staging, or any non-test environment
 */
function isDevModeEnabled(env: Env): boolean {
    const envMode = env.ENVIRONMENT?.toLowerCase();
    const resendKey = env.RESEND_API_KEY;
    
    // CRITICAL WHITELIST: Only allow if ENVIRONMENT is explicitly 'test'
    // This is a strict whitelist - ONLY 'test' is allowed
    // Explicitly blocks: 'production', 'staging', 'development', undefined, or any other value
    const ALLOWED_ENVIRONMENTS = ['test'] as const;
    if (!envMode || !ALLOWED_ENVIRONMENTS.includes(envMode as typeof ALLOWED_ENVIRONMENTS[number])) {
        return false;
    }
    
    // ADDITIONAL SAFETY: Also require test Resend API key
    // Production keys never start with 're_test_'
    // This provides defense in depth - even if ENVIRONMENT check fails, this also fails
    if (!resendKey || typeof resendKey !== 'string' || !resendKey.startsWith('re_test_')) {
        return false;
    }
    
    // Both checks passed - we're in test mode
    return true;
}

/**
 * Get OTP code for an email (dev mode only)
 * GET /dev/otp?email=user@example.com
 */
async function handleGetOTP(request: Request, env: Env): Promise<Response> {
    // SECURITY: Explicit whitelist check - ONLY 'test' environment allowed
    // Returns 403 for production, staging, development, undefined, or any other value
    if (!isDevModeEnabled(env)) {
        const envMode = env.ENVIRONMENT?.toLowerCase();
        
        // Log security event for any non-test access attempt
        // This helps detect misconfigurations or security issues
        if (envMode === 'production') {
            console.warn('[SECURITY] Attempted access to dev endpoint in production:', request.url);
        } else if (envMode === 'staging') {
            console.warn('[SECURITY] Attempted access to dev endpoint in staging:', request.url);
        } else if (envMode === 'development') {
            console.warn('[SECURITY] Attempted access to dev endpoint with ENVIRONMENT=development (not allowed):', request.url);
        } else {
            console.warn('[SECURITY] Attempted access to dev endpoint with invalid ENVIRONMENT:', envMode || 'undefined', request.url);
        }
        
        return new Response(JSON.stringify({ 
            error: 'Forbidden',
            message: 'Dev endpoints are only available when ENVIRONMENT is explicitly set to "test" with test API keys'
        }), {
            status: 403,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }

    try {
        const url = new URL(request.url);
        const email = url.searchParams.get('email');
        
        if (!email) {
            return new Response(JSON.stringify({ 
                error: 'Email parameter is required',
                example: '/dev/otp?email=user@example.com'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return new Response(JSON.stringify({ 
                error: 'Invalid email format' 
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get OTP from KV (stored by email interception in test mode)
        const emailHash = await hashEmail(email);
        const e2eOTPKey = `e2e_otp_${emailHash}`;
        const otp = await env.OTP_AUTH_KV.get(e2eOTPKey);

        if (!otp) {
            return new Response(JSON.stringify({ 
                error: 'OTP not found',
                message: 'No OTP code found for this email. Request an OTP code first.',
                email: email.toLowerCase().trim()
            }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ 
            email: email.toLowerCase().trim(),
            otp: otp,
            expiresIn: '10 minutes',
            note: 'This endpoint is only available in test/development mode'
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        console.error('[Dev Routes] Error getting OTP:', error);
        return new Response(JSON.stringify({ 
            error: 'Internal server error',
            message: env.ENVIRONMENT === 'development' ? error.message : undefined
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Handle dev routes
 * @param request - HTTP request
 * @param path - Request path
 * @param env - Worker environment
 * @returns Response and customerId if route matched, null otherwise
 */
export async function handleDevRoutes(
    request: Request,
    path: string,
    env: Env
): Promise<RouteResult | null> {
    // SECURITY: Early return if not in test mode
    // This prevents the route from even being registered in production
    // Production ENVIRONMENT is always 'production' (set in wrangler.toml)
    if (!isDevModeEnabled(env)) {
        return null; // Route doesn't exist in production
    }

    // GET /dev/otp?email=user@example.com - Get OTP code for an email
    if (path === '/dev/otp' && request.method === 'GET') {
        const response = await handleGetOTP(request, env);
        return { response, customerId: null };
    }

    return null; // Route not matched
}

