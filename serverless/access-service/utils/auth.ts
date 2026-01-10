/**
 * Authentication utilities for Authorization Service
 * Validates service-to-service calls using JWT or X-Service-Key
 */

import { verifyJWT as verifyJWTShared, getJWTSecret as getJWTSecretShared } from '@strixun/api-framework/jwt';
import type { Env } from '../types/authorization.js';

export interface AuthResult {
    customerId: string | null;
    jwtToken?: string;
    isServiceCall: boolean;
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
            },
        });
    }
    
    return null;
}
