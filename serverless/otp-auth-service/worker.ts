/**
 * OTP Authentication Service - Standalone Worker
 * Cloudflare Worker for multi-tenant OTP authentication
 * 
 * This worker handles:
 * - Email OTP Authentication System (secure user authentication)
 * - Multi-tenant customer isolation
 * - API key management
 * - JWT token generation and validation
 * 
 * @version 2.2.4 - Auth worker does not piggyback _featureFlags (breaks Set-Cookie / login)
 */

import { initializeServiceTypes, type ExecutionContext } from '@strixun/types';
import { route } from './router.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    AUTH_SERVICE?: Fetcher;
    ENVIRONMENT?: string;
    ALLOWED_ORIGINS?: string;
    [key: string]: unknown;
}

// Initialize service types
initializeServiceTypes();

/**
 * Main request handler
 * Delegates to router for all routing logic including CORS
 */
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // Route handles everything including CORS preflight
        const envForRequest = env.AUTH_SERVICE
            ? { ...env, JWKS_FETCH: (url: string) => env.AUTH_SERVICE!.fetch(url) }
            : env;
        return route(request, envForRequest, ctx);
    }
};