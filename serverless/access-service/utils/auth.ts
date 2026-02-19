/**
 * Authentication utilities for Authorization Service
 * Validates service-to-service calls using JWT or X-Service-Key.
 * RS256 via JWKS only (OIDC).
 */

import { extractAuth } from '@strixun/api-framework';
import type { Env } from '../types/authorization.js';
import { createCORSHeaders } from './cors.js';

export interface AuthResult {
    customerId: string | null;
    jwtToken?: string;
    /** Decoded (already-verified) JWT payload — used to read claims like isSuperAdmin */
    jwtPayload?: Record<string, any>;
    isServiceCall: boolean;
    type: 'jwt' | 'service';
}

/**
 * Decode JWT payload without re-verifying the signature.
 * Safe to call only AFTER the token has already been verified by extractAuth.
 */
function decodeJWTPayload(token: string): Record<string, any> | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        return JSON.parse(atob(b64));
    } catch {
        return null;
    }
}

function authenticateServiceKey(request: Request, env: Env): boolean {
    const serviceKey = request.headers.get('X-Service-Key');
    if (!serviceKey) return false;
    if (!env.SERVICE_API_KEY) {
        console.error('[AccessAuth] SERVICE_API_KEY not configured');
        return false;
    }
    return serviceKey === env.SERVICE_API_KEY;
}

/**
 * Authenticate request using service key or JWT (RS256 via JWKS).
 */
export async function authenticateRequest(request: Request, env: Env): Promise<AuthResult | null> {
    if (authenticateServiceKey(request, env)) {
        console.log('[AccessAuth] Service key authentication successful');
        return {
            customerId: null,
            isServiceCall: true,
            type: 'service',
        };
    }

    try {
        const auth = await extractAuth(request, env as any);
        if (auth && auth.customerId) {
            console.log('[AccessAuth] JWT authentication successful:', auth.customerId);
            const jwtPayload = auth.jwtToken ? decodeJWTPayload(auth.jwtToken) : undefined;
            return {
                customerId: auth.customerId,
                jwtToken: auth.jwtToken,
                jwtPayload: jwtPayload ?? undefined,
                isServiceCall: false,
                type: 'jwt',
            };
        }
    } catch (error) {
        console.error('[AccessAuth] JWT verification failed:', error);
    }

    return null;
}

/**
 * Require authentication for write operations
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
 * Require super-admin authentication.
 * Trusts isSuperAdmin JWT claim first (RS256-verified), then KV fallback for
 * dynamically-assigned super-admin roles.
 */
export async function requireSuperAdmin(auth: AuthResult | null, request: Request, env: Env): Promise<Response | null> {
    const authError = requireAuth(auth, request, env);
    if (authError) {
        return authError;
    }
    
    if (auth!.type === 'service') {
        return null;
    }
    
    if (auth!.type === 'jwt' && auth!.customerId) {
        if (auth!.jwtPayload?.isSuperAdmin === true) {
            console.log('[Auth] Super-admin granted via JWT isSuperAdmin claim:', auth!.customerId);
            return null;
        }

        try {
            const rolesKey = `customer:${auth!.customerId}:roles`;
            const roles = await env.ACCESS_KV.get(rolesKey, { type: 'json' }) as string[] | null;
            
            if (roles && roles.includes('super-admin')) {
                return null;
            }
        } catch (error) {
            console.error('[Auth] Error checking super-admin role:', error);
        }
    }
    
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
