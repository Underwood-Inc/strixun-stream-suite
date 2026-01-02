/**
 * Authentication Utilities
 * 
 * Shared authentication functions for all workers
 */

/**
 * Hash email for storage key (SHA-256)
 */
export async function hashEmail(email) {
    const encoder = new TextEncoder();
    const data = encoder.encode(email.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Use shared JWT utilities from api-framework (canonical implementation)
import { verifyJWT as verifyJWTShared, getJWTSecret as getJWTSecretShared, createJWT as createJWTShared } from '@strixun/api-framework/jwt';

/**
 * Verify JWT token
 * Uses shared implementation from api-framework
 * @param {string} token - JWT token
 * @param {string} secret - Secret key for verification
 * @returns {Promise<object|null>} Decoded payload or null if invalid
 */
export async function verifyJWT(token, secret) {
    return verifyJWTShared(token, secret);
}

/**
 * Create JWT token
 * Uses shared implementation from api-framework
 * @param {object} payload - Token payload
 * @param {string} secret - Secret key for signing
 * @returns {Promise<string>} JWT token
 */
export async function createJWT(payload, secret) {
    return createJWTShared(payload, secret);
}

/**
 * Get JWT secret from environment
 * Uses shared implementation from api-framework
 */
export function getJWTSecret(env) {
    return getJWTSecretShared(env);
}

/**
 * Authenticate request and validate CSRF token for state-changing operations
 * @param {Request} request - HTTP request
 * @param {*} env - Worker environment
 * @param {boolean} requireCsrf - Whether to require CSRF token (for POST/PUT/DELETE)
 * @returns {Promise<{userId: string, email: string}|null>} User info or null if not authenticated
 */
export async function authenticateRequest(request, env, requireCsrf = false) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    
    const token = authHeader.substring(7);
    const jwtSecret = getJWTSecret(env);
    const payload = await verifyJWT(token, jwtSecret);
    
    if (!payload) {
        return null;
    }
    
    // Check if token is blacklisted
    const tokenHash = await hashEmail(token);
    const blacklistKey = `blacklist_${tokenHash}`;
    const blacklisted = await env.TWITCH_CACHE?.get(blacklistKey) || 
                        await env.OTP_AUTH_KV?.get(blacklistKey);
    if (blacklisted) {
        return null;
    }
    
    // Validate CSRF token for state-changing operations
    if (requireCsrf) {
        const csrfHeader = request.headers.get('X-CSRF-Token');
        if (!csrfHeader || csrfHeader !== payload.csrf) {
            return null; // CSRF token mismatch
        }
    }
    
    return {
        userId: payload.userId || payload.sub,
        email: payload.email
    };
}

