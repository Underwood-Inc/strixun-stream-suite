/**
 * Authentication utilities for Authorization Service
 * Validates service-to-service calls using JWT or X-Service-Key
 */

import { verifyJWT as verifyJWTShared, getJWTSecret as getJWTSecretShared } from '@strixun/api-framework/jwt';
import type { Env } from '../types/authorization.js';
import { createCORSHeaders } from './cors.js';

export interface AuthResult {
    customerId: string | null;
    jwtToken?: string;
    isServiceCall: boolean;
    type: 'jwt' | 'service';
}

/**
 * Get JWT secret from environment
 */
export function getJWTSecret(env: Env): string {
    return getJWTSecretShared(env);
}

/**
 * Verify JWT token
 */
export async function verifyJWT(token: string, secret: string): Promise<any | null> {
    return await verifyJWTShared(token, secret);
}

/**
 * Authenticate service-to-service request
 * Validates X-Service-Key header for internal service calls
 */
function authenticateServiceKey(request: Request, env: Env): boolean {
    const serviceKey = request.headers.get('X-Service-Key');
    if (!serviceKey) {
        return false;
    }
    
    // Validate against SERVICE_API_KEY secret
    if (!env.SERVICE_API_KEY) {
        console.error('[AccessAuth] SERVICE_API_KEY not configured');
        return false;
    }
    
    return serviceKey === env.SERVICE_API_KEY;
}

/**
 * Authenticate request using JWT or service key
 * Returns auth object with customerId or service indicator
 */
export async function authenticateRequest(request: Request, env: Env): Promise<AuthResult | null> {
    // Option 1: Service-to-service authentication (X-Service-Key)
    if (authenticateServiceKey(request, env)) {
        console.log('[AccessAuth] Service key authentication successful');
        return {
            customerId: null,
            isServiceCall: true,
            type: 'service',
        };
    }
    
    // Option 2: JWT authentication (for debugging/testing only)
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        
        try {
            const jwtSecret = getJWTSecret(env);
            const payload = await verifyJWT(token, jwtSecret);
            
            if (payload && payload.sub) {
                console.log('[AccessAuth] JWT authentication successful:', payload.sub);
                return {
                    customerId: payload.sub,
                    jwtToken: token,
                    isServiceCall: false,
                    type: 'jwt',
                };
            }
        } catch (error) {
            console.error('[AccessAuth] JWT verification failed:', error);
        }
    }
    
    return null;
}

/**
 * Require authentication for write operations
 * Returns 401 response if not authenticated
 */
export function requireAuth(auth: AuthResult | null, request: Request, env: Env): Response | null {
    if (!auth) {
        return new Response(JSON.stringify({
            error: 'Unauthorized',
            message: 'Authentication required. Provide X-Service-Key header for service calls or Bearer token for user calls.',
            code: 'AUTH_REQUIRED',
        }), {
            status: 401,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(createCORSHeaders(request, env).entries()),
            },
        });
    }
    
    return null;
}

/**
 * Require super-admin authentication
 * CRITICAL SECURITY: Returns error response if not authenticated OR not a super-admin
 */
export async function requireSuperAdmin(auth: AuthResult | null, request: Request, env: Env): Promise<Response | null> {
    // First check basic auth
    const authError = requireAuth(auth, request, env);
    if (authError) {
        return authError;
    }
    
    // Service keys are always allowed (for service-to-service calls)
    if (auth!.type === 'service') {
        return null;
    }
    
    // For JWT auth, check if customer has super-admin role
    if (auth!.type === 'jwt' && auth!.customerId) {
        try {
            // Get customer's roles from KV
            const rolesKey = `customer:${auth!.customerId}:roles`;
            const roles = await env.ACCESS_KV.get(rolesKey, { type: 'json' }) as string[] | null;
            
            // Check if customer has super-admin role
            if (roles && roles.includes('super-admin')) {
                return null;
            }
        } catch (error) {
            console.error('[Auth] Error checking super-admin role:', error);
        }
    }
    
    // Not a super-admin
    return new Response(JSON.stringify({
        error: 'Forbidden',
        message: 'Super admin access required',
        code: 'SUPER_ADMIN_REQUIRED',
    }), {
        status: 403,
        headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(createCORSHeaders(request, env).entries()),
        },
    });
}
