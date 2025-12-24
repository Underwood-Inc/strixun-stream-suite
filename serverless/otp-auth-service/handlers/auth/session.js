/**
 * Session Management Handlers
 * Handles user session endpoints: me, logout, refresh
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { hashEmail, verifyJWT, createJWT, getJWTSecret } from '../../utils/crypto.js';
import { getCustomerKey } from '../../services/customer.js';

/**
 * Get current user endpoint
 * GET /auth/me
 */
export async function handleGetMe(request, env) {
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
        const payload = await verifyJWT(token, jwtSecret);
        
        if (!payload) {
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Get customer ID from token (for multi-tenant isolation)
        const customerId = payload.customerId || null;
        
        // Get user data with customer isolation
        const emailHash = await hashEmail(payload.email);
        const userKey = getCustomerKey(customerId, `user_${emailHash}`);
        const user = await env.OTP_AUTH_KV.get(userKey, { type: 'json' });
        
        if (!user) {
            return new Response(JSON.stringify({ error: 'User not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // OpenID Connect UserInfo Response (RFC 7662)
        return new Response(JSON.stringify({ 
            // Standard OIDC Claims
            sub: user.userId, // Subject identifier (required)
            email: user.email,
            email_verified: true,
            
            // Additional Standard Claims
            iss: 'auth.idling.app', // Issuer
            aud: customerId || 'default', // Audience
            
            // Custom Claims (backward compatibility)
            userId: user.userId,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
        }), {
            headers: { 
                ...getCorsHeaders(env, request), 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store', // OAuth 2.0 requirement
                'Pragma': 'no-cache',
            },
        });
    } catch (error) {
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
export async function handleLogout(request, env) {
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
        const payload = await verifyJWT(token, jwtSecret);
        
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
        const sessionKey = getCustomerKey(customerId, `session_${payload.userId}`);
        await env.OTP_AUTH_KV.delete(sessionKey);
        
        return new Response(JSON.stringify({ 
            success: true,
            message: 'Logged out successfully'
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
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
export async function handleRefresh(request, env) {
    try {
        const body = await request.json();
        const { token } = body;
        
        if (!token) {
            return new Response(JSON.stringify({ error: 'Token required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret);
        
        if (!payload) {
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Get customer ID from token
        const customerId = payload.customerId || null;
        
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
        const newTokenPayload = {
            userId: payload.userId,
            email: payload.email,
            customerId: customerId, // Preserve customer ID
            csrf: newCsrfToken, // New CSRF token for refreshed session
            exp: Math.floor(expiresAt.getTime() / 1000),
            iat: Math.floor(Date.now() / 1000),
        };
        
        const newToken = await createJWT(newTokenPayload, jwtSecret);
        
        // Update session with customer isolation
        const sessionKey = getCustomerKey(customerId, `session_${payload.userId}`);
        await env.OTP_AUTH_KV.put(sessionKey, JSON.stringify({
            userId: payload.userId,
            email: payload.email,
            token: await hashEmail(newToken),
            expiresAt: expiresAt.toISOString(),
            createdAt: new Date().toISOString(),
        }), { expirationTtl: 25200 }); // 7 hours
        
        return new Response(JSON.stringify({ 
            success: true,
            token: newToken,
            expiresAt: expiresAt.toISOString(),
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to refresh token',
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

