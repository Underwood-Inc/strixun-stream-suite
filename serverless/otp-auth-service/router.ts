/**
 * Router
 * Handles all route matching and dispatch to appropriate handlers
 */

import { getCorsHeaders, getCorsHeadersRecord } from './utils/cors.js';
import { trackError, trackResponseTime } from './services/analytics.js';
import { sendWebhook } from './services/webhooks.js';
import { getPlanLimits } from './utils/validation.js';
import { handlePublicRoutes } from './router/public-routes.js';
import { handleDevRoutes } from './router/dev-routes.js';
import { handleDashboardRoutes } from './router/dashboard-routes.js';
import { handleAuthRoutes } from './router/auth-routes.js';
import { handleCustomerRoutes } from './router/customer-routes.js';
import { handleGameRoutes } from './router/game-routes.js';
import { handleSSOConfigRoutes } from './router/sso-config-routes.js';
import { handleMigrationRoutes } from './router/migration-routes.js';
import { wrapWithEncryption } from '@strixun/api-framework';
import type { ExecutionContext } from '@strixun/types';

/**
 * Endpoints that MUST NOT require JWT (chicken-and-egg problem)
 * These endpoints generate JWT tokens or are called by systems that can't send JWT headers
 */
const NO_JWT_REQUIRED_PATHS = [
    '/auth/request-otp',
    '/auth/verify-otp',      // ⚠ CRITICAL - Returns JWT token
    '/auth/me',              // Reads HttpOnly cookie for SSO
    '/signup',
    '/signup/verify',
    '/track/email-open',     // Email clients can't send headers
    '/assets/',              // Static assets (CSS, JS, images) - must be public
    '/dashboard',            // Dashboard SPA - assets served via /assets/ but dashboard itself is public
    '/openapi.json',         // OpenAPI spec for Swagger UI - must be public
    '/health',               // Health check endpoints - must be public
    '/ads.txt',              // Google AdSense verification - must be public
    '/',                     // Landing page for first-time visitors
    ''
];

/**
 * Check for high error rate and alert
 */
async function checkErrorRateAlert(customerId: string, env: any): Promise<void> {
    try {
        const today = new Date().toISOString().split('T')[0];
        const usageKey = `usage_${customerId}_${today}`;
        const errorKey = `errors_${customerId}_${today}`;
        
        const usage = await env.OTP_AUTH_KV.get(usageKey, { type: 'json' }) || { otpRequests: 0 };
        const errors = await env.OTP_AUTH_KV.get(errorKey, { type: 'json' }) || { total: 0 };
        
        const totalRequests = usage.otpRequests || 0;
        const totalErrors = errors.total || 0;
        
        if (totalRequests > 0) {
            const errorRate = (totalErrors / totalRequests) * 100;
            
            // Alert if error rate > 5%
            if (errorRate > 5) {
                // Send webhook alert
                await sendWebhook(customerId, 'error_rate_high', {
                    errorRate: errorRate.toFixed(2),
                    totalRequests,
                    totalErrors,
                    threshold: 5
                }, env);
                
                console.warn(`High error rate for customer ${customerId}: ${errorRate.toFixed(2)}%`);
            }
        }
    } catch (error) {
        console.error('Error rate check failed:', error);
    }
}

/**
 * Main router function
 * Routes requests to appropriate handlers
 */
export async function route(request: Request, env: any, ctx?: ExecutionContext): Promise<Response> {
    const startTime = performance.now();
    const url = new URL(request.url);
    // Dev-proxy normalization:
    // Some frontend apps call the auth worker through a Vite proxy mounted at /auth-api.
    // When they accidentally hit the worker directly (or proxy doesn't rewrite), the worker receives /auth-api/* paths.
    // Normalize this so SSO works consistently across all apps in dev.
    let path = url.pathname;
    if (path.startsWith('/auth-api/')) {
        path = path.substring('/auth-api'.length);
    }
    let customerId: string | null = null;
    let endpoint = path.split('/').pop() || 'unknown';
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: getCorsHeaders(env, request),
        });
    }
    
    try {
        let response: Response | null = null;
        
        // Try public routes first
        const publicResponse = await handlePublicRoutes(request, path, env);
        if (publicResponse) {
            response = publicResponse;
        }
        
        // Try dev routes (ONLY in test mode - COMPLETELY ABSENT in production)
        // SECURITY: handleDevRoutes returns null in production, so /dev/otp endpoint DOES NOT EXIST
        // Production ENVIRONMENT is always 'production' (explicitly set in wrangler.toml [env.production.vars])
        // Production RESEND_API_KEY is a real key (never starts with 're_test_')
        // Result: In production, this returns null -> route not found -> 404 (endpoint is absent, not just disabled)
        if (!response) {
            const devResult = await handleDevRoutes(request, path, env);
            if (devResult) {
                customerId = devResult.customerId || null;
                response = devResult.response;
            }
            // PRODUCTION: devResult is always null, so this block never executes
            // The /dev/otp endpoint is completely absent in production
        }
        
        // Try dashboard routes
        if (!response) {
            const dashboardResult = await handleDashboardRoutes(request, path, env);
            if (dashboardResult) {
                customerId = dashboardResult.customerId || null;
                response = dashboardResult.response;
            }
        }
        
        // Try auth routes
        if (!response) {
            const authResult = await handleAuthRoutes(request, path, env);
            if (authResult) {
                customerId = authResult.customerId;
                response = authResult.response;
            }
        }
        
        // Try customer routes
        if (!response) {
            const customerResult = await handleCustomerRoutes(request, path, env);
            if (customerResult) {
                customerId = customerResult.customerId;
                response = customerResult.response;
            }
        }
        
        // Try game routes
        if (!response) {
            const gameResult = await handleGameRoutes(request, path, env);
            if (gameResult) {
                customerId = gameResult.customerId;
                response = gameResult.response;
            }
        }
        
        // Try SSO configuration routes (requires authentication)
        if (!response) {
            const ssoConfigResult = await handleSSOConfigRoutes(request, path, env, customerId);
            if (ssoConfigResult) {
                customerId = ssoConfigResult.customerId;
                response = ssoConfigResult.response;
            }
        }
        
        // Try migration routes (requires super admin authentication)
        if (!response) {
            // Extract isSuperAdmin from JWT payload if available
            let isSuperAdmin = false;
            const cookieHeader = request.headers.get('Cookie');
            if (cookieHeader) {
                const cookies = cookieHeader.split(';').map(c => c.trim());
                const authCookie = cookies.find(c => c.startsWith('auth_token='));
                if (authCookie) {
                    const token = authCookie.substring('auth_token='.length).trim();
                    try {
                        const { verifyJWT, getJWTSecret } = await import('./utils/crypto.js');
                        const jwtSecret = getJWTSecret(env);
                        const payload = await verifyJWT(token, jwtSecret);
                        if (payload && payload.isSuperAdmin === true) {
                            isSuperAdmin = true;
                        }
                    } catch (error) {
                        // JWT verification failed - not super admin
                    }
                }
            }
            
            const migrationResult = await handleMigrationRoutes(request, path, env, customerId, isSuperAdmin);
            if (migrationResult) {
                customerId = migrationResult.customerId;
                response = migrationResult.response;
            }
        }
        
        // 404 for unknown routes
        if (!response) {
            response = new Response(JSON.stringify({ error: 'Not found' }), {
                status: 404,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Track response time
        const responseTime = performance.now() - startTime;
        if (customerId && (path.startsWith('/admin/') || path.startsWith('/auth/') || path.startsWith('/customer/') || path.startsWith('/game/'))) {
            await trackResponseTime(customerId, endpoint, responseTime, env);
        }
        
        // CRITICAL: Handle JWT encryption requirements per route
        // Extract JWT token from HttpOnly cookie ONLY - NO Authorization header fallback
        // CRITICAL: Trim token to ensure it matches the token used for decryption
        let jwtToken: string | null = null;
        let isHttpOnlyCookie = false;
        const cookieHeader = request.headers.get('Cookie');
        if (cookieHeader) {
            const cookies = cookieHeader.split(';').map(c => c.trim());
            const authCookie = cookies.find(c => c.startsWith('auth_token='));
            if (authCookie) {
                jwtToken = authCookie.substring('auth_token='.length).trim();
                isHttpOnlyCookie = true; // JWT from HttpOnly cookie (browser request)
            }
        }
        const authForEncryption = jwtToken ? { userId: 'anonymous', customerId, jwtToken } : null;
        
        // Check if this endpoint should NOT require JWT
        const shouldRequireJWT = !NO_JWT_REQUIRED_PATHS.some(noJwtPath => {
            if (noJwtPath === '/' || noJwtPath === '') {
                return path === '/' || path === '';
            }
            // Handle paths that end with / (like /assets/) - match both exact and sub-paths
            if (noJwtPath.endsWith('/')) {
                return path === noJwtPath || path.startsWith(noJwtPath);
            }
            // Handle exact match or sub-path match
            return path === noJwtPath || path.startsWith(noJwtPath + '/');
        });
        
        // Special case: Email tracking - NO encryption at all
        if (path === '/track/email-open') {
            return response; // Return as-is, no encryption
        }
        
        // Check if response is binary (HTML, JS, CSS, images) vs JSON
        const contentType = response.headers.get('Content-Type') || '';
        const isBinary = !contentType.includes('application/json') && 
                        (contentType.includes('text/html') || 
                         contentType.includes('application/javascript') || 
                         contentType.includes('text/css') || 
                         contentType.includes('image/') ||
                         contentType.includes('font/'));
        
        // For binary responses, handle encryption differently
        if (isBinary && shouldRequireJWT) {
            if (!jwtToken) {
                const errorResponse = {
                    type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
                    title: 'Unauthorized',
                    status: 401,
                    detail: 'JWT token is required for encryption/decryption. Please provide a valid JWT token in the Authorization header.',
                    instance: request.url
                };
                const corsHeaders = getCorsHeadersRecord(env, request);
                return new Response(JSON.stringify(errorResponse), {
                    status: 401,
                    headers: {
                        'Content-Type': 'application/problem+json',
                        ...corsHeaders,
                    },
                });
            }
            
            // Encrypt binary response
            const { encryptBinaryWithJWT } = await import('@strixun/api-framework');
            const bodyBytes = await response.arrayBuffer();
            const encryptedBody = await encryptBinaryWithJWT(new Uint8Array(bodyBytes), jwtToken);
            const corsHeaders = getCorsHeadersRecord(env, request);
            return new Response(encryptedBody, {
                status: response.status,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/octet-stream',
                    'X-Encrypted': 'true',
                    'X-Original-Content-Type': contentType,
                },
            });
        }
        
        // For JSON responses or non-required JWT, use wrapWithEncryption
        // CRITICAL FIX: Disable encryption for browser requests with HttpOnly cookies
        // (JavaScript can't access HttpOnly cookies to decrypt, and HTTPS already protects data in transit)
        // When passing null for auth, we MUST set requireJWT: false (otherwise encryption middleware rejects)
        const authForEncryptionParam = isHttpOnlyCookie ? null : authForEncryption;
        const requireJWT = authForEncryptionParam ? shouldRequireJWT : false;
        
        const encryptedResult = await wrapWithEncryption(
            response,
            authForEncryptionParam, // Pass null to disable encryption for HttpOnly cookies
            request,
            env,
            { 
                requireJWT
            }
        );
        
        return encryptedResult.response;
    } catch (error: any) {
        console.error('Request handler error:', error);
        
        // Track error
        if (customerId) {
            await trackError(customerId, 'internal', error.message, endpoint, env);
            // Check error rate after tracking
            await checkErrorRateAlert(customerId, env);
        }
        
        const errorResponse = new Response(JSON.stringify({
            error: 'Internal server error',
            message: env.ENVIRONMENT === 'development' ? error.message : undefined
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
        
        // Track response time even for errors
        const responseTime = performance.now() - startTime;
        if (customerId) {
            await trackResponseTime(customerId, endpoint, responseTime);
        }
        
        // Apply encryption to error responses (but don't require JWT for errors)
        // CRITICAL: Never encrypt error responses (frontend needs to read them)
        const encryptedError = await wrapWithEncryption(
            errorResponse,
            null, // Never encrypt errors - frontend must be able to read them
            request,
            env,
            { requireJWT: false } // Don't require JWT for error responses (already false, but explicit)
        );
        return encryptedError.response;
    } finally {
        // Track response time
        const responseTime = performance.now() - startTime;
        if (customerId && path.startsWith('/auth/')) {
            await trackResponseTime(customerId, endpoint, responseTime, env);
        }
    }
}
