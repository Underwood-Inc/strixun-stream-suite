/**
 * SSO Configuration Routes
 * Handles API key SSO configuration management
 */

import { getCorsHeaders } from '../utils/cors.js';
import type { SSOConfig, SSOIsolationMode } from '../services/api-key.js';
import {
    getAllApiKeysForCustomer,
    getApiKeyById,
    updateSSOConfig,
    getSSOCompatibleKeys
} from '../services/api-key-management.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    [key: string]: any;
}

interface RouteResult {
    response: Response;
    customerId: string | null;
}

/**
 * List all API keys for a customer with SSO configuration
 * GET /auth/api-keys
 */
async function handleListApiKeys(
    request: Request,
    env: Env,
    customerId: string
): Promise<Response> {
    try {
        const apiKeys = await getAllApiKeysForCustomer(customerId, env);
        
        // Remove encrypted keys from response for security
        const safeApiKeys = apiKeys.map(key => ({
            keyId: key.keyId,
            name: key.name,
            status: key.status,
            createdAt: key.createdAt,
            lastUsed: key.lastUsed,
            ssoConfig: key.ssoConfig
        }));
        
        return new Response(JSON.stringify({
            keys: safeApiKeys,
            total: safeApiKeys.length
        }), {
            status: 200,
            headers: {
                ...getCorsHeaders(env, request),
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('[SSO Config Routes] Error listing API keys:', error);
        return new Response(JSON.stringify({
            error: 'Failed to list API keys',
            details: error instanceof Error ? error.message : String(error)
        }), {
            status: 500,
            headers: {
                ...getCorsHeaders(env, request),
                'Content-Type': 'application/json'
            }
        });
    }
}

/**
 * Get SSO configuration for a specific API key
 * GET /auth/api-key/:keyId/sso-config
 */
async function handleGetSSOConfig(
    request: Request,
    env: Env,
    customerId: string,
    keyId: string
): Promise<Response> {
    try {
        const apiKey = await getApiKeyById(customerId, keyId, env);
        
        if (!apiKey) {
            return new Response(JSON.stringify({
                error: 'API key not found',
                keyId
            }), {
                status: 404,
                headers: {
                    ...getCorsHeaders(env, request),
                    'Content-Type': 'application/json'
                }
            });
        }
        
        // Get list of compatible keys for UI display
        const compatibleKeys = await getSSOCompatibleKeys(customerId, keyId, env);
        
        return new Response(JSON.stringify({
            keyId: apiKey.keyId,
            name: apiKey.name,
            ssoConfig: apiKey.ssoConfig,
            compatibleKeys
        }), {
            status: 200,
            headers: {
                ...getCorsHeaders(env, request),
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('[SSO Config Routes] Error getting SSO config:', error);
        return new Response(JSON.stringify({
            error: 'Failed to get SSO configuration',
            details: error instanceof Error ? error.message : String(error)
        }), {
            status: 500,
            headers: {
                ...getCorsHeaders(env, request),
                'Content-Type': 'application/json'
            }
        });
    }
}

/**
 * Update SSO configuration for a specific API key
 * PUT /auth/api-key/:keyId/sso-config
 */
async function handleUpdateSSOConfig(
    request: Request,
    env: Env,
    customerId: string,
    keyId: string
): Promise<Response> {
    try {
        // Parse request body
        const body = await request.json() as Partial<SSOConfig>;
        
        // Validate required fields
        if (body.isolationMode && !['none', 'selective', 'complete'].includes(body.isolationMode)) {
            return new Response(JSON.stringify({
                error: 'Invalid isolation mode',
                validValues: ['none', 'selective', 'complete']
            }), {
                status: 400,
                headers: {
                    ...getCorsHeaders(env, request),
                    'Content-Type': 'application/json'
                }
            });
        }
        
        // Validate allowedKeyIds if provided
        if (body.allowedKeyIds) {
            if (!Array.isArray(body.allowedKeyIds)) {
                return new Response(JSON.stringify({
                    error: 'allowedKeyIds must be an array'
                }), {
                    status: 400,
                    headers: {
                        ...getCorsHeaders(env, request),
                        'Content-Type': 'application/json'
                    }
                });
            }
            
            // Validate that all allowed keys belong to the customer
            const customerKeys = await getAllApiKeysForCustomer(customerId, env);
            const customerKeyIds = customerKeys.map(k => k.keyId);
            const invalidKeys = body.allowedKeyIds.filter(kid => !customerKeyIds.includes(kid) && kid !== keyId);
            
            if (invalidKeys.length > 0) {
                return new Response(JSON.stringify({
                    error: 'Invalid key IDs in allowedKeyIds',
                    invalidKeys,
                    hint: 'All key IDs must belong to the same customer'
                }), {
                    status: 400,
                    headers: {
                        ...getCorsHeaders(env, request),
                        'Content-Type': 'application/json'
                    }
                });
            }
        }
        
        // Update SSO configuration
        const success = await updateSSOConfig(customerId, keyId, body, env);
        
        if (!success) {
            return new Response(JSON.stringify({
                error: 'Failed to update SSO configuration'
            }), {
                status: 500,
                headers: {
                    ...getCorsHeaders(env, request),
                    'Content-Type': 'application/json'
                }
            });
        }
        
        // Fetch updated config
        const updatedKey = await getApiKeyById(customerId, keyId, env);
        
        return new Response(JSON.stringify({
            success: true,
            keyId,
            ssoConfig: updatedKey?.ssoConfig
        }), {
            status: 200,
            headers: {
                ...getCorsHeaders(env, request),
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('[SSO Config Routes] Error updating SSO config:', error);
        return new Response(JSON.stringify({
            error: 'Failed to update SSO configuration',
            details: error instanceof Error ? error.message : String(error)
        }), {
            status: 500,
            headers: {
                ...getCorsHeaders(env, request),
                'Content-Type': 'application/json'
            }
        });
    }
}

/**
 * Handle SSO configuration routes
 * @param request - HTTP request
 * @param path - Request path
 * @param env - Worker environment
 * @param customerId - Authenticated customer ID (from JWT)
 * @returns Response and customerId if route matched, null otherwise
 */
export async function handleSSOConfigRoutes(
    request: Request,
    path: string,
    env: Env,
    customerId: string | null
): Promise<RouteResult | null> {
    // All SSO config routes require authentication
    if (!customerId) {
        return {
            response: new Response(JSON.stringify({
                error: 'Authentication required'
            }), {
                status: 401,
                headers: {
                    ...getCorsHeaders(env, request),
                    'Content-Type': 'application/json'
                }
            }),
            customerId: null
        };
    }
    
    // GET /auth/api-keys - List all API keys
    if (path === '/auth/api-keys' && request.method === 'GET') {
        return {
            response: await handleListApiKeys(request, env, customerId),
            customerId
        };
    }
    
    // GET /auth/api-key/:keyId/sso-config - Get SSO config
    const getSSOConfigMatch = path.match(/^\/auth\/api-key\/([^/]+)\/sso-config$/);
    if (getSSOConfigMatch && request.method === 'GET') {
        const keyId = getSSOConfigMatch[1];
        return {
            response: await handleGetSSOConfig(request, env, customerId, keyId),
            customerId
        };
    }
    
    // PUT /auth/api-key/:keyId/sso-config - Update SSO config
    const updateSSOConfigMatch = path.match(/^\/auth\/api-key\/([^/]+)\/sso-config$/);
    if (updateSSOConfigMatch && request.method === 'PUT') {
        const keyId = updateSSOConfigMatch[1];
        return {
            response: await handleUpdateSSOConfig(request, env, customerId, keyId),
            customerId
        };
    }
    
    // No match
    return null;
}
