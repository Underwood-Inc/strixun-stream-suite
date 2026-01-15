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
 * @version 2.2.1 - Fixed: CORS now properly handled by router with env.ALLOWED_ORIGINS
 */

import { initializeServiceTypes, type ExecutionContext } from '@strixun/types';
import { route } from './router.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    ENVIRONMENT?: string;
    ALLOWED_ORIGINS?: string;
    [key: string]: unknown;
}

// Initialize service types
initializeServiceTypes();

/**
 * Main request handler
 * Delegates to router for all routing logic including CORS
 * 
 * CORS is handled by router.ts using getCorsHeaders(env, request) which:
 * - Reads from env.ALLOWED_ORIGINS
 * - Sets Access-Control-Allow-Credentials: true
 * - Supports localhost in development
 * - Uses the api-framework's standardized CORS implementation
 */
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // Route handles everything including CORS preflight via getCorsHeaders(env, request)
        return route(request, env, ctx);
    }
};
