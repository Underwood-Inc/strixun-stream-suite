/**
 * User Routes
 * Handles user profile endpoints (require JWT authentication)
 * 
 * @module router/user-routes
 */

import { getCorsHeaders } from '../utils/cors.js';
import { verifyJWT, getJWTSecret } from '../utils/crypto.js';
import * as userHandlers from '../handlers/user/displayName.js';
import * as twitchHandlers from '../handlers/user/twitch.js';
import * as profilePictureHandlers from '../handlers/user/profilePicture.js';

/**
 * Authenticate request using JWT token
 */
async function authenticateRequest(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { authenticated: false, status: 401, error: 'Authorization header required' };
    }

    const token = authHeader.substring(7);
    const jwtSecret = getJWTSecret(env);
    const payload = await verifyJWT(token, jwtSecret);

    if (!payload) {
        return { authenticated: false, status: 401, error: 'Invalid or expired token' };
    }

    return {
        authenticated: true,
        userId: payload.userId || payload.sub,
        email: payload.email,
        customerId: payload.customerId || null,
    };
}

/**
 * Handle user routes
 * @param {Request} request - HTTP request
 * @param {string} path - Request path
 * @param {*} env - Worker environment
 * @returns {Promise<{response: Response, customerId: string|null}>|null} Response and customerId if route matched, null otherwise
 */
export async function handleUserRoutes(request, path, env) {
    // User profile endpoints (require JWT authentication)
    if (path === '/user/display-name' && request.method === 'GET') {
        return { 
            response: await userHandlers.handleGetDisplayName(request, env), 
            customerId: null // Will be extracted from JWT in handler
        };
    }
    
    if (path === '/user/display-name' && request.method === 'PUT') {
        return { 
            response: await userHandlers.handleUpdateDisplayName(request, env), 
            customerId: null // Will be extracted from JWT in handler
        };
    }
    
    // Twitch account attachment endpoints
    if (path === '/user/twitch/attach' && request.method === 'POST') {
        return { 
            response: await twitchHandlers.handleAttachTwitchAccount(request, env), 
            customerId: null
        };
    }
    
    if (path === '/user/twitch' && request.method === 'GET') {
        return { 
            response: await twitchHandlers.handleGetTwitchAccount(request, env), 
            customerId: null
        };
    }
    
    if (path === '/user/twitch/detach' && request.method === 'DELETE') {
        return { 
            response: await twitchHandlers.handleDetachTwitchAccount(request, env), 
            customerId: null
        };
    }
    
    // Profile picture endpoints (post-MVP)
    if (path === '/user/profile-picture' && request.method === 'POST') {
        return { 
            response: await profilePictureHandlers.handleUploadProfilePicture(request, env), 
            customerId: null
        };
    }
    
    if (path.startsWith('/user/profile-picture/') && request.method === 'GET') {
        return { 
            response: await profilePictureHandlers.handleGetProfilePicture(request, env), 
            customerId: null
        };
    }
    
    if (path === '/user/profile-picture' && request.method === 'DELETE') {
        return { 
            response: await profilePictureHandlers.handleDeleteProfilePicture(request, env), 
            customerId: null
        };
    }
    
    return null; // Route not matched
}

