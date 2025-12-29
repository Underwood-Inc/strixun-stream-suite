/**
 * Session Management Handlers
 * Handles user session endpoints: me, logout, refresh
 */

import { getCustomerKey } from '../../services/customer.js';
import { getCorsHeaders } from '../../utils/cors.js';
import { getAuthCacheHeaders } from '../../utils/cache-headers.js';
import { createJWT, getJWTSecret, hashEmail, verifyJWT } from '../../utils/crypto.js';
import { buildCurrentUserResponse } from '../../utils/response-builder.js';
import { ensureCustomerAccount } from './customer-creation.js';
import { storeIPSessionMapping, deleteIPSessionMapping } from '../../services/ip-session-index.js';
import { getClientIP } from '../../utils/ip.js';
import { createFingerprintHash } from '@strixun/api-framework';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    JWT_SECRET?: string;
    [key: string]: any;
}

interface User {
    userId: string;
    email: string;
    displayName?: string | null;
    customerId?: string | null;
    createdAt?: string;
    lastLogin?: string;
    [key: string]: any;
}

interface SessionData {
    userId: string;
    email: string;
    token: string; // hashed
    expiresAt: string;
    createdAt: string;
    ipAddress?: string;
    userAgent?: string;
    country?: string;
    fingerprint?: string; // SHA-256 hash of device fingerprint
}

interface JWTPayload {
    userId?: string;
    sub?: string;
    email?: string;
    customerId?: string | null;
    [key: string]: any;
}

/**
 * Get current user endpoint
 * GET /auth/me
 */
export async function handleGetMe(request: Request, env: Env): Promise<Response> {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Authorization header required' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const token = authHeader.substring(7);
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret) as JWTPayload | null;
        
        if (!payload) {
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Get customer ID from token (for multi-tenant isolation)
        let customerId = payload.customerId || null;
        
        // Ensure customer account exists (backwards compatibility for users without customer accounts)
        if (!payload.email) {
            return new Response(JSON.stringify({ error: 'Email not found in token' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        const emailLower = payload.email.toLowerCase().trim();
        // BUSINESS RULE: Customer account MUST ALWAYS be created - ensureCustomerAccount throws if it fails
        let resolvedCustomerId: string;
        try {
            resolvedCustomerId = await ensureCustomerAccount(emailLower, customerId, env);
            customerId = resolvedCustomerId;
        } catch (error) {
            console.error(`[Session] Failed to ensure customer account for ${emailLower}:`, error);
            // If customer account creation fails, return error response
            return new Response(JSON.stringify({ 
                error: 'Failed to verify customer account. Please try again.',
                detail: env.ENVIRONMENT === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
            }), {
                status: 500,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Get user data with customer isolation
        const emailHash = await hashEmail(payload.email);
        let userKey = getCustomerKey(customerId, `user_${emailHash}`);
        let user = await env.OTP_AUTH_KV.get(userKey, { type: 'json' }) as User | null;
        
        // If user not found with customerId, try without customerId (backwards compatibility)
        if (!user && customerId) {
            const legacyUserKey = `user_${emailHash}`;
            user = await env.OTP_AUTH_KV.get(legacyUserKey, { type: 'json' }) as User | null;
            // If found, migrate user to customer-scoped key and update customerId
            if (user) {
                user.customerId = customerId;
                await env.OTP_AUTH_KV.put(userKey, JSON.stringify(user), { expirationTtl: 31536000 });
                // Update userId -> customerId index
                const { updateUserIndex } = await import('../../utils/user-index.js');
                await updateUserIndex(user.userId, customerId, env);
            }
        }
        
        if (!user) {
            return new Response(JSON.stringify({ error: 'User not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Ensure user has customerId set (update if missing)
        if (!user.customerId && customerId) {
            user.customerId = customerId;
            await env.OTP_AUTH_KV.put(userKey, JSON.stringify(user), { expirationTtl: 31536000 });
            // Update userId -> customerId index
            const { updateUserIndex } = await import('../../utils/user-index.js');
            await updateUserIndex(user.userId, customerId, env);
        }
        
        // CRITICAL: Verify session still exists (user might have logged out)
        // This prevents /auth/me from returning user data after logout
        const userId = payload.userId || payload.sub;
        if (userId) {
            const sessionKey = getCustomerKey(customerId, `session_${userId}`);
            const sessionData = await env.OTP_AUTH_KV.get(sessionKey, { type: 'json' }) as SessionData | null;
            
            if (!sessionData) {
                // Session was deleted (user logged out)
                return new Response(JSON.stringify({ error: 'Session not found. Please log in again.' }), {
                    status: 401,
                    headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                });
            }
            
            // Verify session hasn't expired
            const expiresAt = new Date(sessionData.expiresAt);
            if (expiresAt <= new Date()) {
                // Session expired
                return new Response(JSON.stringify({ error: 'Session expired. Please log in again.' }), {
                    status: 401,
                    headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                });
            }
        }
        
        // Reset preferences TTL on access to keep it in sync with user data
        const { getUserPreferences, storeUserPreferences } = await import('../../services/user-preferences.js');
        const preferences = await getUserPreferences(user.userId, customerId, env);
        await storeUserPreferences(user.userId, customerId, preferences, env);
        
        // Check if user is a super admin
        const { isSuperAdminEmail } = await import('../../utils/super-admin.js');
        const isSuperAdmin = await isSuperAdminEmail(user.email, env);
        
        // Generate request ID for root config
        const requestId = user.userId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Build response with proper encryption based on user preferences
        const responseData = await buildCurrentUserResponse(
            {
                id: requestId,
                customerId: user.customerId || customerId || null,
                // Standard OIDC Claims
                sub: user.userId, // Subject identifier (required)
                email: user.email,
                email_verified: true,
                // Additional Standard Claims
                iss: 'auth.idling.app', // Issuer
                aud: customerId || 'default', // Audience
                // Custom Claims (backward compatibility)
                userId: user.userId,
                displayName: user.displayName || null, // Anonymized display name
                createdAt: user.createdAt,
                lastLogin: user.lastLogin,
                isSuperAdmin: isSuperAdmin, // Super admin status
            },
            user.userId,
            token,
            customerId,
            env
        );
        
        // OpenID Connect UserInfo Response (RFC 7662)
        return new Response(JSON.stringify(responseData), {
            headers: { 
                ...getCorsHeaders(env, request), 
                'Content-Type': 'application/json',
                ...getAuthCacheHeaders(),
                'Pragma': 'no-cache',
            },
        });
    } catch (error: any) {
        // RFC 7807 Problem Details for HTTP APIs
        return new Response(JSON.stringify({ 
            type: 'https://tools.ietf.org/html/rfc7231#section-6.6.1',
            title: 'Internal Server Error',
            status: 500,
            detail: 'Failed to get user info',
            instance: request.url,
        }), {
            status: 500,
            headers: { 
                ...getCorsHeaders(env, request), 
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
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Authorization header required' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const token = authHeader.substring(7);
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret) as JWTPayload | null;
        
        if (!payload) {
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Get customer ID from token
        const customerId = payload.customerId || null;
        
        // Add token to blacklist with customer isolation
        const tokenHash = await hashEmail(token);
        const blacklistKey = getCustomerKey(customerId, `blacklist_${tokenHash}`);
        await env.OTP_AUTH_KV.put(blacklistKey, JSON.stringify({
            token: tokenHash,
            revokedAt: new Date().toISOString(),
        }), { expirationTtl: 25200 }); // 7 hours (matches token expiration)
        
        // Delete session with customer isolation
        const userId = payload.userId || payload.sub;
        if (userId) {
            const sessionKey = getCustomerKey(customerId, `session_${userId}`);
            
            // Get session to find IP address for cleanup
            const sessionData = await env.OTP_AUTH_KV.get(sessionKey, { type: 'json' }) as SessionData | null;
            
            // Delete IP-to-session mapping for this user from all IPs
            // We need to delete from the current session's IP, but also check if there are other sessions
            // Since we can't list all IPs, we'll delete from the known IP and rely on session restore
            // to validate sessions exist before restoring
            if (sessionData?.ipAddress) {
                // Delete IP-to-session mapping for this user from this IP
                await deleteIPSessionMapping(sessionData.ipAddress, userId, env);
            }
            
            // CRITICAL: Delete the session itself - this prevents /auth/me and session restore
            // from working with this session
            await env.OTP_AUTH_KV.delete(sessionKey);
            
            console.log(`[Logout] [SUCCESS] Deleted session for user: ${userId}, customerId: ${customerId}`);
        }
        
        return new Response(JSON.stringify({ 
            success: true,
            message: 'Logged out successfully'
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ 
            error: 'Failed to logout',
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
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
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret) as JWTPayload | null;
        
        if (!payload) {
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Get customer ID from token
        let customerId = payload.customerId || null;
        
        // Ensure customer account exists (backwards compatibility for users without customer accounts)
        if (!payload.email) {
            return new Response(JSON.stringify({ error: 'Email not found in token' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        const emailLower = payload.email.toLowerCase().trim();
        // BUSINESS RULE: Customer account MUST ALWAYS be created - ensureCustomerAccount throws if it fails
        let resolvedCustomerId: string;
        try {
            resolvedCustomerId = await ensureCustomerAccount(emailLower, customerId, env);
            customerId = resolvedCustomerId;
        } catch (error) {
            console.error(`[Session] Failed to ensure customer account for ${emailLower}:`, error);
            // If customer account creation fails, return error response
            return new Response(JSON.stringify({ 
                error: 'Failed to verify customer account. Please try again.',
                detail: env.ENVIRONMENT === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
            }), {
                status: 500,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Check if token is blacklisted with customer isolation
        const tokenHash = await hashEmail(token);
        const blacklistKey = getCustomerKey(customerId, `blacklist_${tokenHash}`);
        const blacklisted = await env.OTP_AUTH_KV.get(blacklistKey);
        if (blacklisted) {
            return new Response(JSON.stringify({ error: 'Token has been revoked' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Generate new CSRF token for refreshed session
        const newCsrfToken = crypto.randomUUID ? crypto.randomUUID() : 
            Array.from(crypto.getRandomValues(new Uint8Array(16)))
                .map(b => b.toString(16).padStart(2, '0')).join('');
        
        // Generate new token (7 hours expiration)
        const expiresAt = new Date(Date.now() + 7 * 60 * 60 * 1000); // 7 hours
        const userId = payload.userId || payload.sub;
        const newTokenPayload = {
            userId: userId,
            email: payload.email,
            customerId: customerId, // Preserve customer ID
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
        let existingSession: SessionData | null = null;
        if (userId) {
            const sessionKey = getCustomerKey(customerId, `session_${userId}`);
            existingSession = await env.OTP_AUTH_KV.get(sessionKey, { type: 'json' }) as SessionData | null;
        }
        
        // Use existing IP if new IP is unknown, otherwise use new IP
        const sessionIP = (clientIP === 'unknown' && existingSession?.ipAddress) ? existingSession.ipAddress : clientIP;
        
        // Update session with customer isolation (including IP tracking)
        if (userId) {
            const sessionKey = getCustomerKey(customerId, `session_${userId}`);
            const sessionData: SessionData = {
                userId: userId,
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
            
            // Update IP-to-session mapping (delete old IP if changed, add new IP)
            if (existingSession?.ipAddress && existingSession.ipAddress !== sessionIP) {
                await deleteIPSessionMapping(existingSession.ipAddress, userId, env);
            }
            
            if (sessionIP !== 'unknown') {
                await storeIPSessionMapping(
                    sessionIP,
                    userId,
                    customerId,
                    sessionKey,
                    expiresAt.toISOString(),
                    payload.email,
                    env
                );
            }
        }
        
        return new Response(JSON.stringify({ 
            success: true,
            token: newToken,
            expiresAt: expiresAt.toISOString(),
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ 
            error: 'Failed to refresh token',
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

