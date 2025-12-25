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
 * @version 4.0.0 - Migrated to use shared API framework
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { route } from './twitch-api/router.js';

/**
 * Main request handler
 */
export default {
    async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
            });
            return new Response(null, { headers: Object.fromEntries(corsHeaders.entries()) });
        }

        // Route to appropriate handler
        return await route(request, env);
    },
};

