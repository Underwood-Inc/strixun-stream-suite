/**
 * Mods API Service - Dedicated Cloudflare Worker
 * 
 * Dedicated worker for mod hosting and version control
 * Handles mod uploads, downloads, versioning, and metadata management
 * 
 * @version 2.1.0 - KV Migration System Active
 */

import type { ExecutionContext } from '@cloudflare/workers-types';
import { createError } from './utils/errors.js';
import { getCorsHeadersRecord } from './utils/cors.js';
import { handleModRoutes } from './router/mod-routes.js';
import { handleAdminRoutes } from './router/admin-routes.js';
import { handleR2Cleanup } from './handlers/admin/r2-cleanup.js';
// Worker version for deployment verification
const WORKER_VERSION = '2.2.0';
console.log(`[ModsAPI] Worker loaded: v${WORKER_VERSION}`);

/**
 * Route configuration interface
 */
interface RouteConfig {
    pattern: string;
    zone_name: string;
}

/**
 * Parse ROUTES environment variable from JSON string
 * Supports both JSON and TOML-like syntax
 */
function parseRoutes(env: Env): RouteConfig[] {
    if (!env.ROUTES) {
        return [];
    }
    
    try {
        let routesJson = env.ROUTES.trim();
        
        // If it contains TOML syntax (pattern = "value"), convert to JSON
        if (routesJson.includes('=') && !routesJson.includes('":')) {
            // Convert TOML object syntax to JSON
            routesJson = routesJson
                .replace(/\{\s*(\w+)\s*=\s*"([^"]+)"/g, '{"$1": "$2"')
                .replace(/,\s*(\w+)\s*=\s*"([^"]+)"/g, ', "$1": "$2"')
                .replace(/\{\s*(\w+)\s*=\s*(\w+)/g, '{"$1": "$2"')
                .replace(/,\s*(\w+)\s*=\s*(\w+)/g, ', "$1": "$2"');
        }
        
        const parsed = JSON.parse(routesJson);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Failed to parse ROUTES environment variable:', error);
        return [];
    }
}

/**
 * Health check endpoint
 * CRITICAL: JWT encryption is MANDATORY for all endpoints, including /health
 */
async function handleHealth(env: Env, request: Request): Promise<Response> {
    // ONLY check HttpOnly cookie - NO fallbacks, NO Authorization header
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) {
        const errorResponse = {
            type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
            title: 'Unauthorized',
            status: 401,
            detail: 'JWT token is required for encryption/decryption. Please authenticate with HttpOnly cookie.',
            instance: request.url
        };
        
        return new Response(JSON.stringify(errorResponse), {
            status: 401,
            headers: {
                'Content-Type': 'application/problem+json',
                ...getCorsHeadersRecord(env, request),
            },
        });
    }
    
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const authCookie = cookies.find(c => c.startsWith('auth_token='));
    if (!authCookie) {
        const errorResponse = {
            type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
            title: 'Unauthorized',
            status: 401,
            detail: 'JWT token is required for encryption/decryption. Please authenticate with HttpOnly cookie.',
            instance: request.url
        };
        
        return new Response(JSON.stringify(errorResponse), {
            status: 401,
            headers: {
                'Content-Type': 'application/problem+json',
                ...getCorsHeadersRecord(env, request),
            },
        });
    }
    
    const jwtToken = authCookie.substring('auth_token='.length).trim();
    
    // Authenticate request to get auth object for encryption
    const { authenticateRequest } = await import('./utils/auth.js');
    const auth = await authenticateRequest(request, env);
    
    // If authentication fails, return error since JWT is required
    if (!auth) {
        const errorResponse = {
            type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
            title: 'Unauthorized',
            status: 401,
            detail: 'Invalid JWT token. Please provide a valid JWT token in the Authorization header.',
            instance: request.url
        };
        
        return new Response(JSON.stringify(errorResponse), {
            status: 401,
            headers: {
                'Content-Type': 'application/problem+json',
                ...getCorsHeadersRecord(env, request),
            },
        });
    }
    
    const routes = parseRoutes(env);
    const healthData = { 
        status: 'ok', 
        message: 'Mods API is running',
        service: 'strixun-mods-api',
        timestamp: new Date().toISOString(),
        environment: env.ENVIRONMENT || 'development',
        routes: routes.length > 0 ? routes : undefined
    };
    
    // Encrypt response with JWT
    const { wrapWithEncryption } = await import('@strixun/api-framework');
    const response = new Response(JSON.stringify(healthData), {
        headers: { 
            'Content-Type': 'application/json',
            ...getCorsHeadersRecord(env, request),
        },
    });
    
    // Wrap with encryption - but disable for HttpOnly cookie auth (browser can't decrypt)
    // (JavaScript can't access HttpOnly cookies to decrypt, and HTTPS already protects data in transit)
    const encryptedResult = await wrapWithEncryption(response, null, request, env, {
        requireJWT: false // Pass null to disable encryption for HttpOnly cookies
    });
    return encryptedResult.response;
}

/**
 * Main request handler with API framework
 */
async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    // Dev-proxy normalization: allow apps to call through /mods-api/* without 404s
    let path = url.pathname;
    if (path.startsWith('/mods-api/')) {
        path = path.substring('/mods-api'.length);
    }

    try {
        // Health check (only at /health, not at root to allow root-level mod routes)
        if (path === '/health') {
            return await handleHealth(env, request);
        }

        // Handle admin routes (before mod routes to catch /admin paths)
        if (path.startsWith('/admin')) {
            const adminResult = await handleAdminRoutes(request, path, env);
            if (adminResult) {
                return adminResult.response;
            }
        }

        // Handle mod routes (supports both /mods/* and root-level paths for subdomain routing)
        const modResult = await handleModRoutes(request, path, env);
        if (modResult) {
            return modResult.response;
        }

        // 404 for unknown routes
        const rfcError = createError(request, 404, 'Not Found', 'The requested endpoint was not found');
        return new Response(JSON.stringify(rfcError), {
            status: 404,
            headers: {
                'Content-Type': 'application/problem+json',
                ...getCorsHeadersRecord(env, request),
            },
        });
    } catch (error: any) {
        console.error('Request handler error:', error);
        
        // Check if it's already an RFC 7807 error
        if (error.status && error.type) {
            return new Response(JSON.stringify(error), {
                status: error.status,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...getCorsHeadersRecord(env, request),
                },
            });
        }
        
        // Check if it's a JWT secret error (configuration issue)
        if (error.message && error.message.includes('JWT_SECRET')) {
            const rfcError = createError(
                request,
                500,
                'Server Configuration Error',
                'JWT_SECRET environment variable is required. Please contact the administrator.'
            );
            return new Response(JSON.stringify(rfcError), {
                status: 500,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...getCorsHeadersRecord(env, request),
                },
            });
        }
        
        // Generic error
        const rfcError = createError(
            request,
            500,
            'Internal Server Error',
            env.ENVIRONMENT === 'development' ? error.message : 'An internal server error occurred'
        );
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...getCorsHeadersRecord(env, request),
            },
        });
    }
}

/**
 * Export worker with CORS support and scheduled events
 */
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // CRITICAL: Handle CORS preflight FIRST, before any routing
        // This ensures OPTIONS requests always get CORS headers, even if route doesn't match
        if (request.method === 'OPTIONS') {
            const corsHeaders = getCorsHeadersRecord(env, request);
            console.log('[Worker] OPTIONS preflight request:', {
                url: request.url,
                origin: request.headers.get('Origin'),
                corsHeaders: Object.keys(corsHeaders),
            });
            return new Response(null, { 
                status: 204,
                headers: corsHeaders,
            });
        }
        
        // Use service binding for JWKS fetch when available (avoids same-zone 522 to auth.idling.app)
        const envForRequest = env.AUTH_SERVICE
            ? { ...env, JWKS_FETCH: (url: string) => env.AUTH_SERVICE.fetch(url) }
            : env;
        return handleRequest(request, envForRequest, ctx);
    },
    
    /**
     * Handle scheduled events (cron triggers)
     */
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        console.log('[Worker] Scheduled event triggered:', {
            scheduledTime: new Date(event.scheduledTime).toISOString(),
            cron: event.cron,
        });
        
        // Handle R2 cleanup cron job
        if (event.cron === '0 2 * * *') { // Daily at 2 AM UTC
            await handleR2Cleanup(event, env, ctx);
        } else {
            console.warn('[Worker] Unknown cron schedule:', event.cron);
        }
    },
};

/**
 * Environment interface for TypeScript
 */
export interface Env {
    // KV Namespaces
    MODS_KV: KVNamespace;
    
    // R2 Buckets
    MODS_R2: R2Bucket;
    
    // Service binding to otp-auth-service (for JWKS fetch; avoids same-zone 522)
    AUTH_SERVICE?: Fetcher;
    
    // Environment variables
    JWT_ISSUER?: string; // REQUIRED for auth: JWKS URL base (e.g. https://auth.idling.app), from wrangler [vars]
    JWT_SECRET?: string; // REQUIRED: JWT signing secret (must match OTP auth service)
    FILE_INTEGRITY_KEYPHRASE?: string; // OPTIONAL: Keyphrase for file integrity hashing
    ALLOWED_ORIGINS?: string; // OPTIONAL: Comma-separated CORS origins (recommended for production)
    ENVIRONMENT?: string;
    MODS_PUBLIC_URL?: string; // OPTIONAL: Public URL for R2 bucket (if using custom domain)
    ROUTES?: string; // OPTIONAL: JSON string array of route configurations (matches wrangler.toml routes)
    
    [key: string]: any;
}

interface ScheduledEvent {
    scheduledTime: number;
    cron: string;
    noRetry: () => void;
}

