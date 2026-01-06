/**
 * Customer Routes
 * Handles customer profile endpoints (require JWT authentication)
 * CRITICAL: All endpoints use /customer/ prefix (not /user/)
 */

import { getCorsHeaders } from '../utils/cors.js';
import { verifyJWT, getJWTSecret } from '../utils/crypto.js';
import * as customerHandlers from '../handlers/customer/displayName.js';
import * as twitchHandlers from '../handlers/customer/twitch.js';
import * as profilePictureHandlers from '../handlers/customer/profilePicture.js';
import * as preferencesHandlers from '../handlers/customer/preferences.js';
import * as dataRequestHandlers from '../handlers/customer/data-requests.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    JWT_SECRET?: string;
    CUSTOMER_API_URL?: string;
    NETWORK_INTEGRITY_KEYPHRASE?: string;
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
 * Helper to wrap customer route handlers with automatic encryption
 * Uses shared encryption suite from @strixun/api-framework
 */
async function handleCustomerRoute(
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
 * Handle customer routes
 * @param request - HTTP request
 * @param path - Request path
 * @param env - Worker environment
 * @returns Response and customerId if route matched, null otherwise
 */
export async function handleCustomerRoutes(
    request: Request,
    path: string,
    env: Env
): Promise<RouteResult | null> {
    // Authenticate request
    const auth = await authenticateRequest(request, env);
    
    // Customer profile endpoints (require JWT authentication)
    if (path === '/customer/display-name' && request.method === 'GET') {
        return await handleCustomerRoute(customerHandlers.handleGetDisplayName, request, env, auth);
    }
    
    if (path === '/customer/display-name' && request.method === 'PUT') {
        return await handleCustomerRoute(customerHandlers.handleUpdateDisplayName, request, env, auth);
    }
    
    if (path === '/customer/display-name/regenerate' && request.method === 'POST') {
        return await handleCustomerRoute(customerHandlers.handleRegenerateDisplayName, request, env, auth);
    }
    
    // Twitch account attachment endpoints
    if (path === '/customer/twitch/attach' && request.method === 'POST') {
        return await handleCustomerRoute(twitchHandlers.handleAttachTwitchAccount, request, env, auth);
    }
    
    if (path === '/customer/twitch' && request.method === 'GET') {
        return await handleCustomerRoute(twitchHandlers.handleGetTwitchAccount, request, env, auth);
    }
    
    if (path === '/customer/twitch/detach' && request.method === 'DELETE') {
        return await handleCustomerRoute(twitchHandlers.handleDetachTwitchAccount, request, env, auth);
    }
    
    // Profile picture endpoints (post-MVP)
    if (path === '/customer/profile-picture' && request.method === 'POST') {
        return await handleCustomerRoute(profilePictureHandlers.handleUploadProfilePicture, request, env, auth);
    }
    
    if (path.startsWith('/customer/profile-picture/') && request.method === 'GET') {
        return await handleCustomerRoute(profilePictureHandlers.handleGetProfilePicture, request, env, auth);
    }
    
    if (path === '/customer/profile-picture' && request.method === 'DELETE') {
        return await handleCustomerRoute(profilePictureHandlers.handleDeleteProfilePicture, request, env, auth);
    }
    
    // Customer preferences endpoints (forward to customer-api)
    if (path === '/customer/me/preferences' && request.method === 'GET') {
        return await handleCustomerRoute(preferencesHandlers.handleGetPreferences, request, env, auth);
    }
    
    if (path === '/customer/me/preferences' && request.method === 'PUT') {
        return await handleCustomerRoute(preferencesHandlers.handleUpdatePreferences, request, env, auth);
    }
    
    // Data request endpoints (customer can view/approve/reject requests for their data)
    if (path === '/customer/data-requests' && request.method === 'GET') {
        return await handleCustomerRoute(dataRequestHandlers.handleGetUserDataRequests, request, env, auth);
    }
    
    const customerDataRequestMatch = path.match(/^\/customer\/data-requests\/([^\/]+)$/);
    if (customerDataRequestMatch && request.method === 'GET') {
        const requestId = customerDataRequestMatch[1];
        return await handleCustomerRoute(
            (req, e) => dataRequestHandlers.handleGetUserDataRequest(req, e, requestId),
            request,
            env,
            auth
        );
    }
    
    const approveDataRequestMatch = path.match(/^\/customer\/data-requests\/([^\/]+)\/approve$/);
    if (approveDataRequestMatch && request.method === 'POST') {
        const requestId = approveDataRequestMatch[1];
        return await handleCustomerRoute(
            (req, e) => dataRequestHandlers.handleApproveDataRequest(req, e, requestId),
            request,
            env,
            auth
        );
    }
    
    const rejectDataRequestMatch = path.match(/^\/customer\/data-requests\/([^\/]+)\/reject$/);
    if (rejectDataRequestMatch && request.method === 'POST') {
        const requestId = rejectDataRequestMatch[1];
        return await handleCustomerRoute(
            (req, e) => dataRequestHandlers.handleRejectDataRequest(req, e, requestId),
            request,
            env,
            auth
        );
    }
    
    const decryptDataMatch = path.match(/^\/customer\/data-requests\/([^\/]+)\/decrypt$/);
    if (decryptDataMatch && request.method === 'POST') {
        const requestId = decryptDataMatch[1];
        return await handleCustomerRoute(
            (req, e) => dataRequestHandlers.handleDecryptData(req, e, requestId),
            request,
            env,
            auth
        );
    }
    
    return null; // Route not matched
}
