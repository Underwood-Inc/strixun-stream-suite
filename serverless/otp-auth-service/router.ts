/**
 * Router
 * Handles all route matching and dispatch to appropriate handlers
 */

import { getCorsHeaders } from './utils/cors.js';
import { trackError, trackResponseTime } from './services/analytics.js';
import { sendWebhook } from './services/webhooks.js';
import { getPlanLimits } from './utils/validation.js';
import { handlePublicRoutes } from './router/public-routes.js';
import { handleDevRoutes } from './router/dev-routes.js';
import { handleDashboardRoutes } from './router/dashboard-routes.js';
import { handleAuthRoutes } from './router/auth-routes.js';
import { handleCustomerRoutes } from './router/customer-routes.js';
import { handleGameRoutes } from './router/game-routes.js';
import { wrapWithEncryption } from '@strixun/api-framework';
import type { ExecutionContext } from '@strixun/types';

/**
 * Endpoints that MUST NOT require JWT (chicken-and-egg problem)
 * These endpoints generate JWT tokens or are called by systems that can't send JWT headers
 */
const NO_JWT_REQUIRED_PATHS = [
    '/auth/request-otp',
    '/auth/verify-otp',      // ⚠ CRITICAL - Returns JWT token
    '/auth/restore-session',
    '/signup',
    '/signup/verify',
    '/track/email-open',     // Email clients can't send headers
    '/assets/',              // Static assets (CSS, JS, images) - must be public
    '/dashboard',            // Dashboard SPA - assets served via /assets/ but dashboard itself is public
    '/openapi.json',         // OpenAPI spec for Swagger UI - must be public
    '/health',               // Health check endpoints - must be public
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
    const path = url.pathname;
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
        
        // 404 for unknown routes
        if (!response) {
            response = new Response(JSON.stringify({ error: 'Not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Track response time
        const responseTime = performance.now() - startTime;
        if (customerId && (path.startsWith('/admin/') || path.startsWith('/auth/') || path.startsWith('/customer/') || path.startsWith('/game/'))) {
            await trackResponseTime(customerId, endpoint, responseTime, env);
        }
        
        // CRITICAL: Handle JWT encryption requirements per route
        // Extract JWT token from request for encryption
        // CRITICAL: Trim token to ensure it matches the token used for decryption
        const authHeader = request.headers.get('Authorization');
        const jwtToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
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
                const corsHeaders = getCorsHeaders(env, request);
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
            const corsHeaders = getCorsHeaders(env, request);
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
        const encryptedResult = await wrapWithEncryption(
            response,
            authForEncryption,
            request,
            env,
            { requireJWT: shouldRequireJWT }
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
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
        
        // Track response time even for errors
        const responseTime = performance.now() - startTime;
        if (customerId) {
            await trackResponseTime(customerId, endpoint, responseTime);
        }
        
        // Apply encryption to error responses (but don't require JWT for errors)
        // CRITICAL: Trim token to ensure it matches the token used for decryption
        const authHeader = request.headers.get('Authorization');
        const jwtToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
        const authForEncryption = jwtToken ? { userId: 'anonymous', customerId, jwtToken } : null;
        const encryptedError = await wrapWithEncryption(
            errorResponse,
            authForEncryption,
            request,
            env,
            { requireJWT: false } // Don't require JWT for error responses
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
