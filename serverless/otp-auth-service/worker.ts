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
 * @version 2.2.0 - Enhanced with API framework features
 */

import { createEnhancedRouter } from '../shared/enhanced-router.js';
import { initializeServiceTypes, type ExecutionContext } from '../shared/types.js';
import { route } from './router.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    ENVIRONMENT?: string;
    [key: string]: unknown;
}

// Initialize service types
initializeServiceTypes();

// Create enhanced router
const enhancedRoute = createEnhancedRouter(route);

/**
 * Main request handler
 * Delegates to enhanced router for all routing logic
 */
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        return enhancedRoute(request, env, ctx);
    }
};

