/**
 * Router
 * Handles all route matching and dispatch to appropriate handlers
 */

import { getCorsHeaders } from './utils/cors.js';
import { trackError, trackResponseTime } from './services/analytics.js';
import { sendWebhook } from './services/webhooks.js';
import { getPlanLimits } from './utils/validation.js';
import { handlePublicRoutes } from './router/public-routes.js';
import { handleAdminRoutes } from './router/admin-routes.js';
import { handleAuthRoutes } from './router/auth-routes.js';
import { handleUserRoutes } from './router/user-routes.js';
import { handleGameRoutes } from './router/game-routes.js';
import { applyEncryptionMiddleware } from '@strixun/api-framework';
import type { ExecutionContext } from '../../shared/types.js';

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
        
        // Try admin routes
        if (!response) {
            const adminResult = await handleAdminRoutes(request, path, env);
            if (adminResult) {
                customerId = adminResult.customerId || null;
                response = adminResult.response;
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
        
        // Try user routes
        if (!response) {
            const userResult = await handleUserRoutes(request, path, env);
            if (userResult) {
                customerId = userResult.customerId;
                response = userResult.response;
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
        if (customerId && (path.startsWith('/admin/') || path.startsWith('/auth/') || path.startsWith('/user/') || path.startsWith('/game/'))) {
            await trackResponseTime(customerId, endpoint, responseTime, env);
        }
        
        // Apply encryption middleware to ALL responses
        return await applyEncryptionMiddleware(response, request, env);
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
            await trackResponseTime(customerId, endpoint, responseTime, env);
        }
        
        // Apply encryption middleware to error responses too
        return await applyEncryptionMiddleware(errorResponse, request, env);
    } finally {
        // Track response time
        const responseTime = performance.now() - startTime;
        if (customerId && path.startsWith('/auth/')) {
            await trackResponseTime(customerId, endpoint, responseTime, env);
        }
    }
}

