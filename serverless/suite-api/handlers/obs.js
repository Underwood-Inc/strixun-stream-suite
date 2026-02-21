/**
 * OBS Credentials Handlers
 *
 * Suite API worker: cloud storage, OBS credentials, notes, scrollbar CDN, legacy auth.
 * OBS credentials are stored here for historical reasons: one authenticated KV-backed API
 * used by streamkit.idling.app. 7 hour expiration to match token lifetime.
 */

import { getCorsHeaders } from '../utils/cors.js';

/**
 * Get OBS credentials storage key
 */
function getOBSCredentialsKey(userId) {
    return `obs_credentials_${userId}`;
}

/**
 * Save OBS credentials endpoint
 * POST /obs-credentials/save
 */
export async function handleOBSCredentialsSave(request, env, authenticateRequest) {
    try {
        // Authenticate (require CSRF for POST operations)
        const user = await authenticateRequest(request, env, true);
        if (!user) {
            return new Response(JSON.stringify({ error: 'Authentication required or invalid CSRF token' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const body = await request.json();
        const { host, port, password } = body;
        
        // Validate input
        if (!host || !port) {
            return new Response(JSON.stringify({ error: 'host and port are required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Store credentials (password is optional)
        const credentials = {
            host: String(host),
            port: String(port),
            password: password || '',
            savedAt: new Date().toISOString(),
        };
        
        const key = getOBSCredentialsKey(user.userId);
        // Store with 7 hour expiration (matches token expiration)
        await env.SUITE_CACHE.put(key, JSON.stringify(credentials), { expirationTtl: 25200 });
        
        return new Response(JSON.stringify({ 
            success: true,
            message: 'Credentials saved (expires in 7 hours)',
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to save credentials',
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Load OBS credentials endpoint
 * GET /obs-credentials/load
 */
export async function handleOBSCredentialsLoad(request, env, authenticateRequest) {
    try {
        // Authenticate (GET operations don't require CSRF)
        const user = await authenticateRequest(request, env, false);
        if (!user) {
            return new Response(JSON.stringify({ error: 'Authentication required' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const key = getOBSCredentialsKey(user.userId);
        const credentials = await env.SUITE_CACHE.get(key, { type: 'json' });
        
        if (!credentials) {
            return new Response(JSON.stringify({ 
                error: 'No credentials found',
                message: 'Credentials may have expired (7 hour limit)'
            }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify({ 
            success: true,
            host: credentials.host,
            port: credentials.port,
            password: credentials.password || '',
            savedAt: credentials.savedAt,
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to load credentials',
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Delete OBS credentials endpoint
 * DELETE /obs-credentials/delete
 */
export async function handleOBSCredentialsDelete(request, env, authenticateRequest) {
    try {
        // Authenticate (require CSRF for DELETE operations)
        const user = await authenticateRequest(request, env, true);
        if (!user) {
            return new Response(JSON.stringify({ error: 'Authentication required or invalid CSRF token' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const key = getOBSCredentialsKey(user.userId);
        await env.SUITE_CACHE.delete(key);
        
        return new Response(JSON.stringify({ 
            success: true,
            message: 'Credentials deleted',
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to delete credentials',
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

