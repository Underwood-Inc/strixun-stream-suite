/**
 * Authentication utilities
 * JWT verification for game API endpoints
 * Uses the same JWT_SECRET as the OTP auth service
 */

// Use shared JWT utilities from api-framework (canonical implementation)
import { verifyJWT as verifyJWTShared, getJWTSecret as getJWTSecretShared } from '@strixun/api-framework/jwt';

/**
 * Get JWT secret from environment
 * Uses shared implementation from api-framework
 * @param {*} env - Worker environment
 * @returns {string} JWT secret
 */
export function getJWTSecret(env) {
    return getJWTSecretShared(env);
}

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
 * Authenticate request and extract user info
 * Returns auth object with userId, customerId, and jwtToken
 * @param {Request} request - HTTP request
 * @param {*} env - Worker environment
 * @returns {Promise<object|null>} Auth object or null if not authenticated
 */
export async function authenticateRequest(request, env) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }

        const token = authHeader.substring(7);
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret);

        if (!payload || !payload.sub) {
            return null;
        }

        return {
            userId: payload.sub,
            email: payload.email,
            customerId: payload.customerId || null,
            jwtToken: token // Include JWT token for encryption
        };
    } catch (error) {
        console.error('Authentication error:', error);
        return null;
    }
}

