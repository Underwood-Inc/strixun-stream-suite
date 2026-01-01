/**
 * User Routes
 * Handles user profile endpoints (require JWT authentication)
 */

import { getCorsHeaders } from '../utils/cors.js';
import { verifyJWT, getJWTSecret } from '../utils/crypto.js';
import * as userHandlers from '../handlers/user/displayName.js';
import * as twitchHandlers from '../handlers/user/twitch.js';
import * as profilePictureHandlers from '../handlers/user/profilePicture.js';
import * as preferencesHandlers from '../handlers/user/preferences.js';
import * as dataRequestHandlers from '../handlers/user/data-requests.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    JWT_SECRET?: string;
    [key: string]: any;
}

interface AuthResult {
    authenticated: boolean;
    status?: number;
    error?: string;
    userId?: string;
    email?: string;
    customerId?: string | null;
}

interface RouteResult {
    response: Response;
    customerId: string | null;
}

/**
 * Authenticate request using JWT token
 */
async function authenticateRequest(request: Request, env: Env): Promise<AuthResult> {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { authenticated: false, status: 401, error: 'Authorization header required' };
    }

    // CRITICAL: Trim token to ensure it matches the token used for encryption
    const token = authHeader.substring(7).trim();
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
 * Helper to wrap user route handlers with automatic encryption
 * Uses shared encryption suite from serverless/shared/encryption
 */
async function handleUserRoute(
    handler: (request: Request, env: Env) => Promise<Response>,
    request: Request,
    env: Env,
    auth: AuthResult
): Promise<RouteResult> {
    if (!auth.authenticated) {
        return {
            response: new Response(JSON.stringify({
                error: auth.error || 'Unauthorized',
                code: 'AUTHENTICATION_REQUIRED'
            }), {
                status: auth.status || 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            }),
            customerId: null
        };
    }

    // Get handler response
    const handlerResponse = await handler(request, env);

    // If JWT token is present, encrypt the response (automatic E2E encryption)
    // CRITICAL: Trim token to ensure it matches the token used for decryption
    // The frontend trims tokens, so we must trim here too to prevent token hash mismatches
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
    
    if (token && token.length >= 10 && handlerResponse.ok) {
        try {
            const { encryptWithJWT } = await import('@strixun/api-framework');
            const responseData = await handlerResponse.json();
            const encrypted = await encryptWithJWT(responseData, token);

            // Preserve original headers and add encryption flag
            const headers = new Headers(handlerResponse.headers);
            headers.set('Content-Type', 'application/json');
            headers.set('X-Encrypted', 'true');

            return {
                response: new Response(JSON.stringify(encrypted), {
                    status: handlerResponse.status,
                    statusText: handlerResponse.statusText,
                    headers: headers,
                }),
                customerId: auth.customerId || null
            };
        } catch (error) {
            console.error('Failed to encrypt response:', error);
            return { response: handlerResponse, customerId: auth.customerId || null };
        }
    }

    return { response: handlerResponse, customerId: auth.customerId || null };
}

/**
 * Handle user routes
 * @param request - HTTP request
 * @param path - Request path
 * @param env - Worker environment
 * @returns Response and customerId if route matched, null otherwise
 */
export async function handleUserRoutes(
    request: Request,
    path: string,
    env: Env
): Promise<RouteResult | null> {
    // Authenticate request
    const auth = await authenticateRequest(request, env);
    
    // User profile endpoints (require JWT authentication)
    if (path === '/user/display-name' && request.method === 'GET') {
        return await handleUserRoute(userHandlers.handleGetDisplayName, request, env, auth);
    }
    
    if (path === '/user/display-name' && request.method === 'PUT') {
        return await handleUserRoute(userHandlers.handleUpdateDisplayName, request, env, auth);
    }
    
    if (path === '/user/display-name/regenerate' && request.method === 'POST') {
        return await handleUserRoute(userHandlers.handleRegenerateDisplayName, request, env, auth);
    }
    
    // Twitch account attachment endpoints
    if (path === '/user/twitch/attach' && request.method === 'POST') {
        return await handleUserRoute(twitchHandlers.handleAttachTwitchAccount, request, env, auth);
    }
    
    if (path === '/user/twitch' && request.method === 'GET') {
        return await handleUserRoute(twitchHandlers.handleGetTwitchAccount, request, env, auth);
    }
    
    if (path === '/user/twitch/detach' && request.method === 'DELETE') {
        return await handleUserRoute(twitchHandlers.handleDetachTwitchAccount, request, env, auth);
    }
    
    // Profile picture endpoints (post-MVP)
    if (path === '/user/profile-picture' && request.method === 'POST') {
        return await handleUserRoute(profilePictureHandlers.handleUploadProfilePicture, request, env, auth);
    }
    
    if (path.startsWith('/user/profile-picture/') && request.method === 'GET') {
        return await handleUserRoute(profilePictureHandlers.handleGetProfilePicture, request, env, auth);
    }
    
    if (path === '/user/profile-picture' && request.method === 'DELETE') {
        return await handleUserRoute(profilePictureHandlers.handleDeleteProfilePicture, request, env, auth);
    }
    
    // User preferences endpoints
    if (path === '/user/me/preferences' && request.method === 'GET') {
        return await handleUserRoute(preferencesHandlers.handleGetPreferences, request, env, auth);
    }
    
    if (path === '/user/me/preferences' && request.method === 'PUT') {
        return await handleUserRoute(preferencesHandlers.handleUpdatePreferences, request, env, auth);
    }
    
    // Data request endpoints (user can view/approve/reject requests for their data)
    if (path === '/user/data-requests' && request.method === 'GET') {
        return await handleUserRoute(dataRequestHandlers.handleGetUserDataRequests, request, env, auth);
    }
    
    const userDataRequestMatch = path.match(/^\/user\/data-requests\/([^\/]+)$/);
    if (userDataRequestMatch && request.method === 'GET') {
        const requestId = userDataRequestMatch[1];
        return await handleUserRoute(
            (req, e) => dataRequestHandlers.handleGetUserDataRequest(req, e, requestId),
            request,
            env,
            auth
        );
    }
    
    const approveDataRequestMatch = path.match(/^\/user\/data-requests\/([^\/]+)\/approve$/);
    if (approveDataRequestMatch && request.method === 'POST') {
        const requestId = approveDataRequestMatch[1];
        return await handleUserRoute(
            (req, e) => dataRequestHandlers.handleApproveDataRequest(req, e, requestId),
            request,
            env,
            auth
        );
    }
    
    const rejectDataRequestMatch = path.match(/^\/user\/data-requests\/([^\/]+)\/reject$/);
    if (rejectDataRequestMatch && request.method === 'POST') {
        const requestId = rejectDataRequestMatch[1];
        return await handleUserRoute(
            (req, e) => dataRequestHandlers.handleRejectDataRequest(req, e, requestId),
            request,
            env,
            auth
        );
    }
    
    const decryptDataMatch = path.match(/^\/user\/data-requests\/([^\/]+)\/decrypt$/);
    if (decryptDataMatch && request.method === 'POST') {
        const requestId = decryptDataMatch[1];
        return await handleUserRoute(
            (req, e) => dataRequestHandlers.handleDecryptData(req, e, requestId),
            request,
            env,
            auth
        );
    }
    
    return null; // Route not matched
}

