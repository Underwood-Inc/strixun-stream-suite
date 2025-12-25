/**
 * Twitch API Router
 * 
 * Routes requests to appropriate handlers for Twitch API worker
 */

import { handleCloudDelete, handleCloudList, handleCloudLoad, handleCloudSave } from './handlers/cloud-storage.js';
import { handleNotesDelete, handleNotesList, handleNotesLoad, handleNotesSave } from './handlers/notes.js';
import { handleOBSCredentialsDelete, handleOBSCredentialsLoad, handleOBSCredentialsSave } from './handlers/obs.js';
import { handleScrollbar, handleScrollbarCompensation, handleScrollbarCustomizer } from './handlers/scrollbar.js';
import { getAppAccessToken, handleClips, handleFollowing, handleGame, handleUser } from './handlers/twitch.js';
import { handleRequestOTP, handleVerifyOTP, handleGetMe, handleLogout, handleRefresh } from './handlers/auth.js';
import { handleTestEmail, handleClearRateLimit } from './handlers/test.js';
import { authenticateRequest } from './utils/auth.js';
import { getCorsHeaders } from './utils/cors.js';

/**
 * Health check endpoint
 */
async function handleHealth(env, request) {
    try {
        // Test token generation
        await getAppAccessToken(env);
        return new Response(JSON.stringify({ 
            status: 'ok', 
            message: 'Strixun Stream Suite API is running',
            features: ['twitch-api', 'cloud-storage', 'scrollbar-customizer'],
            timestamp: new Date().toISOString()
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            status: 'error', 
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Main router function
 */
export async function route(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
        // Twitch API endpoints
        if (path === '/clips') return handleClips(request, env);
        if (path === '/following') return handleFollowing(request, env);
        if (path === '/game') return handleGame(request, env);
        if (path === '/user') return handleUser(request, env);
        
        // Cloud Storage endpoints
        // Authenticated cloud save endpoints (replaces device-based /cloud/*)
        if (path === '/cloud-save/save' && request.method === 'POST') return handleCloudSave(request, env, authenticateRequest);
        if (path === '/cloud-save/load' && request.method === 'GET') return handleCloudLoad(request, env, authenticateRequest);
        if (path === '/cloud-save/list' && request.method === 'GET') return handleCloudList(request, env, authenticateRequest);
        if (path === '/cloud-save/delete' && request.method === 'DELETE') return handleCloudDelete(request, env, authenticateRequest);
        
        // Legacy device-based endpoints (kept for backward compatibility)
        if (path === '/cloud/save' && request.method === 'POST') return handleCloudSave(request, env, authenticateRequest);
        if (path === '/cloud/load' && request.method === 'GET') return handleCloudLoad(request, env, authenticateRequest);
        if (path === '/cloud/list' && request.method === 'GET') return handleCloudList(request, env, authenticateRequest);
        if (path === '/cloud/delete' && request.method === 'DELETE') return handleCloudDelete(request, env, authenticateRequest);
        
        // CDN endpoints
        if (path === '/cdn/scrollbar.js' && request.method === 'GET') return handleScrollbar(request, env);
        if (path === '/cdn/scrollbar-customizer.js' && request.method === 'GET') return handleScrollbarCustomizer(request, env);
        if (path === '/cdn/scrollbar-compensation.js' && request.method === 'GET') return handleScrollbarCompensation(request, env);
        
        // Authentication endpoints (legacy - new auth should use OTP Auth Service)
        if (path === '/auth/request-otp' && request.method === 'POST') return handleRequestOTP(request, env);
        if (path === '/auth/verify-otp' && request.method === 'POST') return handleVerifyOTP(request, env);
        if (path === '/auth/me' && request.method === 'GET') return handleGetMe(request, env);
        if (path === '/auth/logout' && request.method === 'POST') return handleLogout(request, env);
        if (path === '/auth/refresh' && request.method === 'POST') return handleRefresh(request, env);
        
        // Notes/Notebook endpoints (require authentication)
        if (path === '/notes/save' && request.method === 'POST') return handleNotesSave(request, env, authenticateRequest);
        if (path === '/notes/load' && request.method === 'GET') return handleNotesLoad(request, env, authenticateRequest);
        if (path === '/notes/list' && request.method === 'GET') return handleNotesList(request, env, authenticateRequest);
        if (path === '/notes/delete' && request.method === 'DELETE') return handleNotesDelete(request, env, authenticateRequest);
        
        // OBS Credentials endpoints (require authentication, 7 hour expiration)
        if (path === '/obs-credentials/save' && request.method === 'POST') return handleOBSCredentialsSave(request, env, authenticateRequest);
        if (path === '/obs-credentials/load' && request.method === 'GET') return handleOBSCredentialsLoad(request, env, authenticateRequest);
        if (path === '/obs-credentials/delete' && request.method === 'DELETE') return handleOBSCredentialsDelete(request, env, authenticateRequest);
        
        // Test endpoints
        if (path === '/test/email' && request.method === 'GET') return handleTestEmail(request, env);
        
        // Debug endpoints
        if (path === '/debug/clear-rate-limit' && request.method === 'POST') return handleClearRateLimit(request, env);
        
        // Health check
        if (path === '/health' || path === '/') return handleHealth(env, request);
        
        // Not found
        return new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        // Check if it's a JWT secret error (configuration issue)
        if (error.message && error.message.includes('JWT_SECRET')) {
            return new Response(JSON.stringify({ 
                error: 'Server configuration error',
                message: 'JWT_SECRET environment variable is required. Please contact the administrator.',
                details: 'The server is not properly configured. JWT_SECRET must be set via: wrangler secret put JWT_SECRET'
            }), {
                status: 500,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify({ error: 'Internal server error', message: error.message }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

