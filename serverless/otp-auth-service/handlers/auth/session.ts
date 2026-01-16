/**
 * Session Management Handlers
 * Handles customer session endpoints: me, logout, refresh
 */

import { getCustomerKey } from '../../services/customer.js';
import { getCorsHeaders, getCorsHeadersRecord } from '../../utils/cors.js';
import { getAuthCacheHeaders } from '../../utils/cache-headers.js';
import { createJWT, getJWTSecret, hashEmail, verifyJWT } from '../../utils/crypto.js';
import { getClientIP } from '../../utils/ip.js';
import { createFingerprintHash } from '@strixun/api-framework';
import { getCookieDomains } from '../../utils/cookie-domains.js';

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
        // ONLY check HttpOnly cookie - NO Authorization header fallback
        const cookieHeader = request.headers.get('Cookie');
        console.log('[handleGetMe] Cookie header:', cookieHeader ? 'present' : 'missing');
        if (!cookieHeader) {
            console.log('[handleGetMe] Returning 401 - no cookie header');
            return new Response(JSON.stringify({ error: 'Authentication required (HttpOnly cookie)' }), {
                status: 401,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const cookies = cookieHeader.split(';').map(c => c.trim());
        const authCookie = cookies.find(c => c.startsWith('auth_token='));
        if (!authCookie) {
            return new Response(JSON.stringify({ error: 'Authentication required (auth_token cookie missing)' }), {
                status: 401,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }

        const token = authCookie.substring('auth_token='.length).trim();
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret) as JWTPayload | null;
        
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
        
        const sessionKey = getCustomerKey(customerId, `session_${customerId}`);
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
        
        // Build response with ONLY JWT payload data
        // DO NOT include email - it's sensitive OTP email data
        // CRITICAL: Use customerId as the ONLY identifier - NO customerId
        const responseData: any = {
            id: customerId, // customerId is the ONLY identifier
            customerId: customerId, // MANDATORY
            // Standard OIDC Claims (from JWT only - all required, no fallbacks)
            sub: customerId, // customerId is the subject
            // DO NOT return email - it's the OTP email and should not be exposed
            email_verified: payload.email_verified ?? false, // Explicit false if missing, not true fallback
            // Additional Standard Claims (from JWT only - all required)
            iss: payload.iss,
            aud: payload.aud,
            // Custom Claims (from JWT only)
            isSuperAdmin: payload.isSuperAdmin ?? false, // Explicit false if missing
            // CSRF token for state-changing operations (POST, PUT, DELETE)
            csrf: payload.csrf || null, // Extract from JWT payload for HttpOnly cookie compatibility
        };
        
        // OpenID Connect UserInfo Response (RFC 7662)
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
export async function handleLogout(request: Request, env: Env): Promise<Response> {
    try {
        // Clear HttpOnly cookies for all root domains from ALLOWED_ORIGINS
        // CRITICAL: Browser security - can only clear cookies for domains matching response origin
        const isProduction = env.ENVIRONMENT === 'production';
        
        // Get all root domains from ALLOWED_ORIGINS
        const allCookieDomains = getCookieDomains(env, null);
        
        // Extract current request's root domain to determine which cookies we can clear
        const url = new URL(request.url);
        const hostname = url.hostname;
        
        // Determine current response's root domain
        let currentRootDomain: string;
        if (hostname === 'localhost' || hostname === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
            currentRootDomain = 'localhost';
        } else {
            const parts = hostname.split('.');
            currentRootDomain = parts.slice(-2).join('.');
        }
        
        // Filter cookie domains to only those matching current response origin (browser security)
        const cookieDomainsToClear = allCookieDomains.filter(domain => {
            if (domain === 'localhost') {
                return currentRootDomain === 'localhost';
            }
            // Remove leading dot for comparison
            const domainWithoutDot = domain.startsWith('.') ? domain.substring(1) : domain;
            return domainWithoutDot === currentRootDomain;
        });
        
        // If no matching domain found, fall back to current root domain
        if (cookieDomainsToClear.length === 0) {
            cookieDomainsToClear.push(currentRootDomain === 'localhost' ? 'localhost' : `.${currentRootDomain}`);
        }
        
        // Create Set-Cookie headers to clear cookies for all matching domains
        const clearCookieHeaders: string[] = [];
        for (const cookieDomain of cookieDomainsToClear) {
            const clearCookieParts = isProduction ? [
                'auth_token=',
                `Domain=${cookieDomain}`,
                'Path=/',
                'HttpOnly',
                'Secure',
                'SameSite=Lax',
                'Max-Age=0'
            ] : [
                'auth_token=',
                `Domain=${cookieDomain}`,
                'Path=/',
                'HttpOnly',
                'SameSite=Lax',
                'Max-Age=0'
            ];
            clearCookieHeaders.push(clearCookieParts.join('; '));
        }

        // ONLY check HttpOnly cookie - NO Authorization header fallback
        const cookieHeader = request.headers.get('Cookie');
        if (!cookieHeader) {
            const response = new Response(JSON.stringify({ success: true, message: 'Logged out (no active session)' }), {
                status: 200,
                headers: {
                    ...getCorsHeadersRecord(env, request),
                    'Content-Type': 'application/json',
                },
            });
            
            // Add all Set-Cookie headers to clear cookies
            for (const clearCookie of clearCookieHeaders) {
                response.headers.append('Set-Cookie', clearCookie);
            }
            
            return response;
        }

        const cookies = cookieHeader.split(';').map(c => c.trim());
        const authCookie = cookies.find(c => c.startsWith('auth_token='));
        if (!authCookie) {
            const response = new Response(JSON.stringify({ success: true, message: 'Logged out (no auth cookie)' }), {
                status: 200,
                headers: {
                    ...getCorsHeadersRecord(env, request),
                    'Content-Type': 'application/json',
                },
            });
            
            // Add all Set-Cookie headers to clear cookies
            for (const clearCookie of clearCookieHeaders) {
                response.headers.append('Set-Cookie', clearCookie);
            }
            
            return response;
        }

        const token = authCookie.substring('auth_token='.length).trim();
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret) as JWTPayload | null;

        if (!payload) {
            const response = new Response(JSON.stringify({ success: true, message: 'Logged out (invalid/expired token)' }), {
                status: 200,
                headers: {
                    ...getCorsHeadersRecord(env, request),
                    'Content-Type': 'application/json',
                },
            });
            
            // Add all Set-Cookie headers to clear cookies
            for (const clearCookie of clearCookieHeaders) {
                response.headers.append('Set-Cookie', clearCookie);
            }
            
            return response;
        }
        
        // Get customer ID from token - MANDATORY
        const customerId = payload.customerId;
        if (!customerId) {
            return new Response(JSON.stringify({ error: 'Invalid token: missing customer ID' }), {
                status: 401,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Add token to blacklist with customer isolation
        const tokenHash = await hashEmail(token);
        const blacklistKey = getCustomerKey(customerId, `blacklist_${tokenHash}`);
        await env.OTP_AUTH_KV.put(blacklistKey, JSON.stringify({
            token: tokenHash,
            revokedAt: new Date().toISOString(),
        }), { expirationTtl: 25200 }); // 7 hours (matches token expiration)
        
        // Delete session with customer isolation
        // Use customerId as the ONLY identifier
        if (customerId) {
            const sessionKey = getCustomerKey(customerId, `session_${customerId}`);
            
            // Get session to find IP address for cleanup
            const sessionData = await env.OTP_AUTH_KV.get(sessionKey, { type: 'json' }) as SessionData | null;
            
            // CRITICAL: Delete the session itself - this prevents /auth/me from working with this session
            await env.OTP_AUTH_KV.delete(sessionKey);
            
            // CRITICAL: Do NOT log OTP email - it's sensitive data
            console.log(`[Logout] ✓ Deleted session for customer: ${customerId}`);
        }
        
        const response = new Response(JSON.stringify({
            success: true,
            message: 'Logged out successfully'
        }), {
            status: 200,
            headers: {
                ...getCorsHeadersRecord(env, request),
                'Content-Type': 'application/json',
            },
        });
        
        // Add all Set-Cookie headers to clear cookies
        for (const clearCookie of clearCookieHeaders) {
            response.headers.append('Set-Cookie', clearCookie);
        }
        
        return response;
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

/**
 * Refresh token endpoint
 * POST /auth/refresh
 */
export async function handleRefresh(request: Request, env: Env): Promise<Response> {
    try {
        const body = await request.json() as { token?: string };
        const { token } = body;
        
        if (!token) {
            return new Response(JSON.stringify({ error: 'Token required' }), {
                status: 400,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret) as JWTPayload | null;
        
        if (!payload) {
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
                status: 401,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Get customer ID from token
        let customerId = payload.customerId || null;
        
        // Check if token is blacklisted with customer isolation
        const tokenHash = await hashEmail(token);
        const blacklistKey = getCustomerKey(customerId, `blacklist_${tokenHash}`);
        const blacklisted = await env.OTP_AUTH_KV.get(blacklistKey);
        if (blacklisted) {
            return new Response(JSON.stringify({ error: 'Token has been revoked' }), {
                status: 401,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Generate new CSRF token for refreshed session
        const newCsrfToken = crypto.randomUUID ? crypto.randomUUID() : 
            Array.from(crypto.getRandomValues(new Uint8Array(16)))
                .map(b => b.toString(16).padStart(2, '0')).join('');
        
        // FAIL-FAST: Require customerId - MANDATORY
        if (!customerId) {
            return new Response(JSON.stringify({ error: 'Invalid token: missing customer ID' }), {
                status: 401,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Generate new token (7 hours expiration)
        const expiresAt = new Date(Date.now() + 7 * 60 * 60 * 1000); // 7 hours
        const newTokenPayload = {
            sub: customerId, // customerId is the ONLY identifier
            email: payload.email,
            customerId: customerId, // MANDATORY
            csrf: newCsrfToken, // New CSRF token for refreshed session
            exp: Math.floor(expiresAt.getTime() / 1000),
            iat: Math.floor(Date.now() / 1000),
        };
        
        const newToken = await createJWT(newTokenPayload, jwtSecret);
        
        // Extract IP address and metadata from request
        const clientIP = getClientIP(request);
        const userAgent = request.headers.get('User-Agent') || undefined;
        const country = request.headers.get('CF-IPCountry') || undefined;
        
        // Create device fingerprint for enhanced session security
        const fingerprint = await createFingerprintHash(request);
        
        // Get existing session to preserve original IP if new IP is unknown
        const sessionKey = getCustomerKey(customerId, `session_${customerId}`);
        const existingSession = await env.OTP_AUTH_KV.get(sessionKey, { type: 'json' }) as SessionData | null;
        
        // Use existing IP if new IP is unknown, otherwise use new IP
        const sessionIP = (clientIP === 'unknown' && existingSession?.ipAddress) ? existingSession.ipAddress : clientIP;
        
        // Update session with customer isolation (including IP tracking)
        const sessionData: SessionData = {
            customerId: customerId, // MANDATORY - the ONLY identifier
            email: payload.email,
            token: await hashEmail(newToken),
            expiresAt: expiresAt.toISOString(),
            createdAt: existingSession?.createdAt || new Date().toISOString(),
            ipAddress: sessionIP,
            userAgent: userAgent || existingSession?.userAgent,
            country: country || existingSession?.country,
            fingerprint, // Update fingerprint on refresh
        };
        
        await env.OTP_AUTH_KV.put(sessionKey, JSON.stringify(sessionData), { expirationTtl: 25200 }); // 7 hours
        
        return new Response(JSON.stringify({ 
            success: true,
            token: newToken,
            expiresAt: expiresAt.toISOString(),
        }), {
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ 
            error: 'Failed to refresh token',
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}

