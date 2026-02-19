/**
 * Authentication utilities for Authorization Service
 * Validates service-to-service calls using JWT or X-Service-Key.
 * Supports RS256 (OIDC / JWKS) and HS256 (legacy shared secret).
 */

import { extractAuth } from '@strixun/api-framework';
import { verifyJWT as verifyJWTShared, getJWTSecret as getJWTSecretShared } from '@strixun/api-framework/jwt';
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

export function getJWTSecret(env: Env): string {
    return getJWTSecretShared(env);
}

export async function verifyJWT(token: string, secret: string): Promise<any | null> {
    return await verifyJWTShared(token, secret);
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
 * Authenticate request using service key or JWT (RS256 via JWKS, then HS256 fallback).
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
        const auth = await extractAuth(request, env as any, verifyJWTShared);
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
        // JWT claim takes priority — isSuperAdmin is baked in at issuance time by the
        // OTP Auth Service (via OTP_SUPER_ADMIN_IDS env var) and the token is RS256-verified,
        // so it is safe to trust without an additional KV round-trip.
        if (auth!.jwtPayload?.isSuperAdmin === true) {
            console.log('[Auth] Super-admin granted via JWT isSuperAdmin claim:', auth!.customerId);
            return null;
        }

        try {
            // Fallback: KV-based role assignment (covers dynamically-assigned super-admin roles)
            const rolesKey = `customer:${auth!.customerId}:roles`;
            const roles = await env.ACCESS_KV.get(rolesKey, { type: 'json' }) as string[] | null;
            
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
