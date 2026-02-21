/**
 * Session Management Handlers
 * Handles customer session endpoints: me, logout
 */

import { entityKey } from '@strixun/kv-entities';
import { getCorsHeaders, getCorsHeadersRecord } from '../../utils/cors.js';
import { getAuthCacheHeaders } from '../../utils/cache-headers.js';
import { hashEmail } from '../../utils/crypto.js';
import { getClientIP } from '../../utils/ip.js';
import { createFingerprintHash } from '@strixun/api-framework';
import { getCookieDomains } from '../../utils/cookie-domains.js';
import { getSigningContext, verifyAsymmetricJWT, importPublicKey } from '../../utils/asymmetric-jwt.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    JWT_SECRET?: string;
    [key: string]: any;
}

interface SessionData {
    customerId: string; // MANDATORY - the ONLY identifier
    email: string; // OTP email - stored for internal use only
    token: string; // hashed
    expiresAt: string;
    createdAt: string;
    ipAddress?: string;
    userAgent?: string;
    country?: string;
    fingerprint?: string; // SHA-256 hash of device fingerprint
}

interface JWTPayload {
    sub?: string; // customerId - the ONLY identifier
    email?: string;
    customerId?: string; // MANDATORY
    [key: string]: any;
}

/**
 * Get current customer endpoint
 * GET /auth/me
 * 
 * CRITICAL: This endpoint MUST ONLY return JWT payload data.
 * It MUST NOT make service-to-service calls to customer-api.
 * It MUST NOT fetch customer data from KV or any other storage.
 * It MUST NOT return OTP email addresses.
 * 
 * This endpoint is for getting information from the JWT token ONLY.
 */
export async function handleGetMe(request: Request, env: Env): Promise<Response> {
    try {
        console.log('[handleGetMe] Starting request processing');
        let token: string | null = null;
        
        const cookieHeader = request.headers.get('Cookie');
        if (cookieHeader) {
            const cookieNames = cookieHeader.split(';').map(c => c.trim().split('=')[0]);
            console.log('[handleGetMe] Cookie names present:', cookieNames);
            const cookies = cookieHeader.split(';').map(c => c.trim());
            const authCookie = cookies.find(c => c.startsWith('auth_token='));
            if (authCookie) {
                token = authCookie.substring('auth_token='.length).trim();
                console.log('[handleGetMe] auth_token extracted, length:', token.length);
            } else {
                console.log('[handleGetMe] auth_token NOT found in cookies');
            }
        } else {
            console.log('[handleGetMe] No Cookie header at all');
        }
        
        // Fallback to Authorization header for service-to-service calls
        if (!token) {
            const authHeader = request.headers.get('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring('Bearer '.length).trim();
                console.log('[handleGetMe] Token extracted from Authorization header (service-to-service)');
            }
        }
        
        if (!token) {
            console.log('[handleGetMe] Returning 401 - no authentication found');
            return new Response(JSON.stringify({ error: 'Authentication required (HttpOnly cookie or Authorization header)' }), {
                status: 401,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        // Verify token via RS256 (OIDC)
        let payload: JWTPayload | null = null;
        try {
            const ctx = await getSigningContext(env);
            const pubKey = await importPublicKey(ctx.publicJwk);
            const rs256Result = await verifyAsymmetricJWT(token, pubKey);
            if (rs256Result) {
                payload = rs256Result as JWTPayload;
                console.log('[handleGetMe] Token verified via RS256');
            }
        } catch (err) {
            console.error('[handleGetMe] RS256 verification error:', err);
        }
        
        if (!payload) {
            console.log('[handleGetMe] Returning 401 - invalid or expired token');
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
                status: 401,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // CRITICAL: Verify session still exists (customer might have logged out)
        // This prevents /auth/me from returning customer data after logout
        // FAIL-FAST: Require customerId - MANDATORY
        const customerId = payload.customerId;
        if (!customerId) {
            return new Response(JSON.stringify({ error: 'Invalid token: missing customer ID' }), {
                status: 401,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // FAIL-FAST: Ensure sub matches customerId (sub should be customerId)
        if (!payload.sub) {
            return new Response(JSON.stringify({ error: 'Invalid token: missing subject' }), {
                status: 401,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        if (payload.sub !== customerId) {
            return new Response(JSON.stringify({ error: 'Invalid token: subject mismatch' }), {
                status: 401,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const sessionKey = entityKey('otp-auth', 'session', customerId).key;
        const sessionData = await env.OTP_AUTH_KV.get(sessionKey, { type: 'json' }) as SessionData | null;
        
        if (!sessionData) {
            // Session was deleted (customer logged out)
            return new Response(JSON.stringify({ error: 'Session not found. Please log in again.' }), {
                status: 401,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Verify session hasn't expired
        const expiresAt = new Date(sessionData.expiresAt);
        if (expiresAt <= new Date()) {
            // Session expired
            return new Response(JSON.stringify({ error: 'Session expired. Please log in again.' }), {
                status: 401,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // CRITICAL: Return ONLY JWT payload data - no service calls, no KV lookups, no OTP email
        // FAIL-FAST: Require all critical JWT fields - no fallbacks that mask issues
        // FAIL-FAST: Require issuer - no default fallback
        if (!payload.iss) {
            return new Response(JSON.stringify({ 
                error: 'Invalid token: missing issuer',
                detail: 'JWT token must contain iss claim'
            }), {
                status: 401,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // FAIL-FAST: Require audience - no default fallback
        if (!payload.aud) {
            return new Response(JSON.stringify({ 
                error: 'Invalid token: missing audience',
                detail: 'JWT token must contain aud claim'
            }), {
                status: 401,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Parse scopes from token; use shared constants for scope-based claim filtering
        const scopeStr: string = (payload.scope as string) || 'openid';
        const scopes = new Set(scopeStr.split(/\s+/).filter(Boolean));

        const { CLAIMS_BY_SCOPE, SCOPE_OPENID } = await import('../../shared/oidc-constants.js');

        const responseData: Record<string, unknown> = { sub: customerId };

        // Apply claims per granted scope (openid always gets core identity)
        const claimToValue: Record<string, unknown> = {
            sub: customerId,
            id: customerId,
            customerId: customerId,
            iss: payload.iss,
            aud: payload.aud,
            isSuperAdmin: payload.isSuperAdmin ?? false,
            csrf: payload.csrf ?? null,
            email_verified: payload.email_verified ?? false,
            name: payload.displayName ?? null,
            preferred_username: payload.displayName ?? null,
            displayName: payload.displayName ?? null,
        };
        for (const scope of scopes) {
            const claimNames = CLAIMS_BY_SCOPE[scope];
            if (!claimNames) continue;
            for (const claim of claimNames) {
                const v = claimToValue[claim];
                if (v !== undefined && v !== null) (responseData as any)[claim] = v;
            }
        }
        if (payload.displayName) responseData.displayName = payload.displayName;

        console.log('[handleGetMe] Returning SUCCESS 200 with customer data:', {
            customerId: responseData.customerId,
            isSuperAdmin: responseData.isSuperAdmin
        });
        return new Response(JSON.stringify(responseData), {
            headers: { 
                ...getCorsHeadersRecord(env, request), 
                'Content-Type': 'application/json',
                ...getAuthCacheHeaders(),
                'Pragma': 'no-cache',
            },
        });
    } catch (error: any) {
        // RFC 7807 Problem Details for HTTP APIs
        console.error('[handleGetMe] EXCEPTION caught:', error instanceof Error ? error.message : String(error));
        console.error('[handleGetMe] Error stack:', error instanceof Error ? error.stack : 'No stack');
        return new Response(JSON.stringify({ 
            type: 'https://tools.ietf.org/html/rfc7231#section-6.6.1',
            title: 'Internal Server Error',
            status: 500,
            detail: 'Failed to get customer info',
            instance: request.url,
        }), {
            status: 500,
            headers: { 
                ...getCorsHeadersRecord(env, request), 
                'Content-Type': 'application/problem+json',
            },
        });
    }
}

/**
 * Logout endpoint
 * POST /auth/logout
 */
function buildLogoutResponse(
    body: Record<string, unknown>,
    clearCookieHeaders: string[],
    env: Env,
    request: Request,
): Response {
    const tuples: [string, string][] = Object.entries({
        ...getCorsHeadersRecord(env, request),
        'Content-Type': 'application/json',
    });
    for (const cookie of clearCookieHeaders) {
        tuples.push(['Set-Cookie', cookie]);
    }
    return new Response(JSON.stringify(body), { status: 200, headers: tuples });
}

export async function handleLogout(request: Request, env: Env): Promise<Response> {
    try {
        // NOTE: wrangler dev with [[routes]] rewrites request.url hostname to the
        // production domain even in dev, so we MUST check env.ENVIRONMENT explicitly.
        const isProduction = env.ENVIRONMENT === 'production';
        const cookieDomainsToClear = isProduction ? getCookieDomains(env, null) : ['localhost'];
        
        // SameSite=None required for cross-origin logout (mods.idling.app → auth.idling.app)
        const sameSite = isProduction ? 'SameSite=None' : 'SameSite=Lax';
        const clearCookieHeaders: string[] = [];
        for (const cookieDomain of cookieDomainsToClear) {
            const baseParts = [
                `Domain=${cookieDomain}`,
                'Path=/',
                'HttpOnly',
                sameSite,
                'Max-Age=0',
            ];
            if (isProduction) baseParts.push('Secure');

            clearCookieHeaders.push(['auth_token=', ...baseParts].join('; '));
            clearCookieHeaders.push(['refresh_token=', ...baseParts].join('; '));
        }

        // PRIORITY 1: Check HttpOnly cookie (browser requests)
        // PRIORITY 2: Check Authorization header (service-to-service calls)
        let token: string | null = null;
        let rawRefreshToken: string | null = null;
        
        const cookieHeader = request.headers.get('Cookie');
        if (cookieHeader) {
            const cookies = cookieHeader.split(';').map(c => c.trim());
            const authCookie = cookies.find(c => c.startsWith('auth_token='));
            if (authCookie) {
                token = authCookie.substring('auth_token='.length).trim();
            }
            const rtCookie = cookies.find(c => c.startsWith('refresh_token='));
            if (rtCookie) {
                rawRefreshToken = rtCookie.substring('refresh_token='.length).trim();
            }
        }
        
        // Fallback to Authorization header for service-to-service logout
        if (!token) {
            const authHeader = request.headers.get('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring('Bearer '.length).trim();
            }
        }
        
        if (!token) {
            return buildLogoutResponse(
                { success: true, message: 'Logged out (no active session)' },
                clearCookieHeaders, env, request,
            );
        }
        // Verify token via RS256 (OIDC)
        let payload: JWTPayload | null = null;
        try {
            const ctx = await getSigningContext(env);
            const pubKey = await importPublicKey(ctx.publicJwk);
            const rs256Result = await verifyAsymmetricJWT(token, pubKey);
            if (rs256Result) {
                payload = rs256Result as JWTPayload;
            }
        } catch {
            // RS256 verification failed
        }

        if (!payload) {
            return buildLogoutResponse(
                { success: true, message: 'Logged out (invalid/expired token)' },
                clearCookieHeaders, env, request,
            );
        }
        
        // Get customer ID from token - MANDATORY
        const customerId = payload.customerId;
        if (!customerId) {
            return new Response(JSON.stringify({ error: 'Invalid token: missing customer ID' }), {
                status: 401,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Add token to deny list with customer isolation
        const tokenHash = await hashEmail(token);
        const denyListKey = entityKey('otp-auth', 'jwt-denylist', `${customerId}_${tokenHash}`).key;
        await env.OTP_AUTH_KV.put(denyListKey, JSON.stringify({
            token: tokenHash,
            revokedAt: new Date().toISOString(),
        }), { expirationTtl: 25200 }); // 7 hours (matches token expiration)
        
        // Delete session with customer isolation
        // Use customerId as the ONLY identifier
        if (customerId) {
            const sessionKey = entityKey('otp-auth', 'session', customerId).key;
            
            // Get session to find IP address for cleanup
            const sessionData = await env.OTP_AUTH_KV.get(sessionKey, { type: 'json' }) as SessionData | null;
            
            // CRITICAL: Delete the session itself - this prevents /auth/me from working with this session
            await env.OTP_AUTH_KV.delete(sessionKey);
            
            // Delete refresh token from KV (if present)
            if (rawRefreshToken) {
                const rtHash = await hashEmail(rawRefreshToken);
                const rtKey = entityKey('otp-auth', 'refresh-token', rtHash).key;
                await env.OTP_AUTH_KV.delete(rtKey);
            }
            
            console.log(`[Logout] ✓ Deleted session + refresh token for customer: ${customerId}`);
        }
        
        return buildLogoutResponse(
            { success: true, message: 'Logged out successfully' },
            clearCookieHeaders, env, request,
        );
    } catch (error: any) {
        return new Response(JSON.stringify({ 
            error: 'Failed to logout',
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}


