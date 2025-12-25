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

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @param {string} secret - Secret key for verification
 * @returns {Promise<object|null>} Decoded payload or null if invalid
 */
export async function verifyJWT(token, secret) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        const [headerB64, payloadB64, signatureB64] = parts;
        
        // Verify signature
        const encoder = new TextEncoder();
        const signatureInput = `${headerB64}.${payloadB64}`;
        const keyData = encoder.encode(secret);
        const key = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );
        
        // Decode signature
        const signature = Uint8Array.from(
            atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')),
            c => c.charCodeAt(0)
        );
        
        const isValid = await crypto.subtle.verify(
            'HMAC',
            key,
            signature,
            encoder.encode(signatureInput)
        );
        
        if (!isValid) return null;
        
        // Decode payload
        const payload = JSON.parse(
            atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
        );
        
        // Check expiration
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }
        
        return payload;
    } catch (error) {
        return null;
    }
}

/**
 * Get JWT secret from environment
 */
export function getJWTSecret(env) {
    if (!env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is required. Set it via: wrangler secret put JWT_SECRET');
    }
    return env.JWT_SECRET;
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

