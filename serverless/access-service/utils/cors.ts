/**
 * CORS Utilities for Access Service
 * Provides consistent CORS configuration across all handlers
 */

import { getCorsHeaders } from '@strixun/api-framework/enhanced';
import type { Env } from '../types/authorization.js';

/**
 * Create CORS headers with Access Service defaults
 * Automatically reads ALLOWED_ORIGINS from env and supports localhost in dev
 */
export function createCORSHeaders(request: Request, env: Env): Headers {
    return getCorsHeaders(env, request);
}
