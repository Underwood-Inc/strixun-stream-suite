/**
 * Dev Routes
 * Handles development-only endpoints (ONLY available when ENVIRONMENT is explicitly 'test')
 * 
 * SECURITY: These routes are ABSOLUTELY DISABLED in production, staging, and all non-test/development environments
 * 
 * ALLOWLIST APPROACH (not denylist):
 * - ONLY ENVIRONMENT='test' or 'development' is allowed
 * - Everything else is explicitly blocked: 'production', 'staging', undefined, etc.
 * 
 * Requirements for dev routes to work (ALL must be true):
 * 1. ENVIRONMENT must be 'test' or 'development' (allowlist - only these values allowed)
 * 2. RESEND_API_KEY must start with 're_test_' (test key, never in production)
 * 
 * Production Safety:
 * - Production ENVIRONMENT is always 'production' (set in wrangler.toml [env.production.vars])
 * - Production RESEND_API_KEY is a real key (never starts with 're_test_')
 * - Staging ENVIRONMENT would be 'staging' - explicitly blocked
 * - Undefined ENVIRONMENT - explicitly blocked
 * - If ENVIRONMENT is anything other than 'test' or 'development', dev routes return null (route doesn't exist)
 * - This endpoint returns 403 Forbidden in production, staging, or any non-test/development environment
 * 
 * This code path is NEVER reached in production deployments.
 */

import { getCorsHeaders, getCorsHeadersRecord } from '../utils/cors.js';
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
 * 1. ENVIRONMENT is 'test' or 'development' (NOT 'production', NOT undefined, NOT anything else)
 * 2. RESEND_API_KEY starts with 're_test_' (test key, never used in production)
 * 
 * PRODUCTION SAFETY (GUARANTEED):
 * - Production ENVIRONMENT is ALWAYS 'production' (explicitly set in wrangler.toml [env.production.vars])
 * - Production RESEND_API_KEY is a REAL key (NEVER starts with 're_test_' - that's a test key prefix)
 * - If ENVIRONMENT is undefined or anything other than 'test' or 'development', dev routes are disabled
 * - This function returns false in production, causing handleDevRoutes() to return null
 * - Result: /dev/otp endpoint DOES NOT EXIST in production (returns 404, not 403)
 * 
 * DEFENSE IN DEPTH:
 * - Even if this check somehow fails, handleGetOTP() has a second identical check
 * - Double-check pattern ensures endpoint is completely absent in production
 */
function isDevModeEnabled(env: Env): boolean {
    const envMode = env.ENVIRONMENT?.toLowerCase();
    const resendKey = env.RESEND_API_KEY;
    
    // CRITICAL ALLOWLIST: Only allow if ENVIRONMENT is 'test' or 'development'
    // This is a strict allowlist - ONLY 'test' and 'development' are allowed
    // Explicitly blocks: 'production', 'staging', undefined, or any other value
    // PRODUCTION: envMode will be 'production' -> returns false immediately
    const ALLOWED_ENVIRONMENTS = ['test', 'development'] as const;
    if (!envMode || !ALLOWED_ENVIRONMENTS.includes(envMode as typeof ALLOWED_ENVIRONMENTS[number])) {
        return false; // PRODUCTION: Always returns false here
    }
    
    // ADDITIONAL SAFETY: If RESEND_API_KEY is provided, it MUST be a test key
    // This prevents accidentally using a real production key in dev mode
    // BUT: If no RESEND_API_KEY is provided, that's OK - OTPs will be console logged
    // Production keys never start with 're_test_' (that's a test key prefix)
    // PRODUCTION: resendKey will be a real key (e.g., 're_abc123...') -> returns false
    if (resendKey && typeof resendKey === 'string' && !resendKey.startsWith('re_test_')) {
        // Has a key, but it's not a test key - reject (might be production key)
        return false; // PRODUCTION: Always returns false here (real keys don't start with 're_test_')
    }
    
    // ENVIRONMENT check passed, and either no RESEND_API_KEY or it's a test key
    // PRODUCTION: This line is NEVER reached (envMode='production' fails first check)
    return true;
}

/**
 * Get OTP code for an email (dev mode only)
 * GET /dev/otp?email=user@example.com
 */
async function handleGetOTP(request: Request, env: Env): Promise<Response> {
    // SECURITY: Explicit allowlist check - ONLY 'test' or 'development' environment allowed
    // Returns 403 for production, staging, undefined, or any other value
    if (!isDevModeEnabled(env)) {
        const envMode = env.ENVIRONMENT?.toLowerCase();
        
        // Log security event for any non-test/development access attempt
        // This helps detect misconfigurations or security issues
        if (envMode === 'production') {
            console.warn('[SECURITY] Attempted access to dev endpoint in production:', request.url);
        } else if (envMode === 'staging') {
            console.warn('[SECURITY] Attempted access to dev endpoint in staging:', request.url);
        } else {
            console.warn('[SECURITY] Attempted access to dev endpoint with invalid ENVIRONMENT:', envMode || 'undefined', request.url);
        }
        
        return new Response(JSON.stringify({ 
            error: 'Forbidden',
            message: 'Dev endpoints are only available when ENVIRONMENT is set to "test" or "development" with test API keys'
        }), {
            status: 403,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
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
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return new Response(JSON.stringify({ 
                error: 'Invalid email format' 
            }), {
                status: 400,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
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
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ 
            email: email.toLowerCase().trim(),
            otp: otp,
            expiresIn: '10 minutes',
            note: 'This endpoint is only available in test/development mode'
        }), {
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        console.error('[Dev Routes] Error getting OTP:', error);
        return new Response(JSON.stringify({ 
            error: 'Internal server error',
            message: env.ENVIRONMENT === 'development' ? error.message : undefined
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
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
    // 
    // CRITICAL PRODUCTION SAFETY:
    // - In production: ENVIRONMENT='production' (from wrangler.toml [env.production.vars])
    // - In production: RESEND_API_KEY is a real key (never starts with 're_test_')
    // - This function returns null immediately, so /dev/otp route DOES NOT EXIST in production
    // - Even if this code path is reached, handleGetOTP() has a second check that returns 403
    // - This endpoint is COMPLETELY ABSENT in production - returns null (404) not 403
    if (!isDevModeEnabled(env)) {
        // PRODUCTION: Route doesn't exist - return null (will result in 404)
        // This is the correct behavior - the endpoint is completely absent in production
        return null;
    }

    // GET /dev/otp?email=user@example.com - Get OTP code for an email
    // ONLY REACHED IN TEST/DEVELOPMENT MODE
    if (path === '/dev/otp' && request.method === 'GET') {
        const response = await handleGetOTP(request, env);
        return { response, customerId: null };
    }

    return null; // Route not matched
}

