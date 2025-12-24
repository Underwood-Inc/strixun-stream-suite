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
 * @version 2.1.0 - Refactored to use modular architecture
 */

import { route } from './router.js';

/**
 * Main request handler
 * Delegates to router for all routing logic
 */
export default {
    async fetch(request, env, ctx) {
        return route(request, env);
    }
};
