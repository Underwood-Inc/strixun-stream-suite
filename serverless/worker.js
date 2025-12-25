/**
 * Strixun Stream Suite - Twitch API Worker
 * Cloudflare Worker for Twitch API proxy + Cloud Storage
 * 
 * This worker handles:
 * - App Access Token management (cached)
 * - Clips fetching
 * - User following fetching
 * - Game data fetching
 * - Cloud Save System (backup/restore configs across devices)
 * - Email OTP Authentication System (legacy - use OTP Auth Service for new implementations)
 * 
 * @version 3.0.0 - Reorganized per-worker structure
 */

import { route } from './twitch-api/router.js';
import { getCorsHeaders } from './twitch-api/utils/cors.js';

/**
 * Main request handler
 */
export default {
    async fetch(request, env, ctx) {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: getCorsHeaders(env, request) });
        }

        // Route to appropriate handler
        return await route(request, env);
    },
};
