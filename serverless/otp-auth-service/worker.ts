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
 * @version 2.2.2 - Added: Auto-run migrations on startup
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
 */
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // Route handles everything including CORS preflight
        return route(request, env, ctx);
    }
};
