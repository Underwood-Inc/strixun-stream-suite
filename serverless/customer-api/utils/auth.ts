/**
 * Authentication utilities
 * JWT verification for customer API endpoints
 * Uses the same JWT_SECRET as the OTP auth service
 */

// Use shared JWT utilities from api-framework (canonical implementation)
import { verifyJWT as verifyJWTShared, getJWTSecret as getJWTSecretShared } from '@strixun/api-framework/jwt';

interface Env {
    JWT_SECRET?: string;
    [key: string]: any;
}

interface AuthResult {
    customerId: string | null; // PRIMARY IDENTITY - we ONLY use customerId (null for service calls)
    jwtToken: string;
    // SECURITY: Email is NEVER included - use getCustomerEmail() utility when needed
}

/**
 * Get JWT secret from environment
 * Uses shared implementation from api-framework
 */
export function getJWTSecret(env: Env): string {
    return getJWTSecretShared(env);
}

/**
 * Verify JWT token
 * Uses shared implementation from api-framework
 */
export async function verifyJWT(token: string, secret: string): Promise<any | null> {
    return verifyJWTShared(token, secret);
}

/**
 * Authenticate request and extract customer info
 * Uses JWT tokens only - all requests must be authenticated with JWT
 * Returns auth object with customerId and jwtToken
 */
export async function authenticateRequest(request: Request, env: Env): Promise<AuthResult | null> {
    // JWT authentication only
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

        // Debug logging
        // console.log(`[Customer API Auth] JWT payload extracted: {
        //   sub: '${payload.sub}',
        //   email: '${payload.email}',
        //   customerId: '${payload.customerId || 'null'}',
        //   iss: '${payload.iss}',
        //   aud: '${payload.aud}'
        // }`);

        // CRITICAL: payload.sub IS the customerId (not userId - we don't have users)
        const customerId = payload.customerId || payload.sub;
        
        if (!customerId) {
            console.error('[Customer API Auth] No customerId found in JWT payload');
            return null;
        }
        
        return {
            customerId,
            jwtToken: token // Include JWT token for encryption
        };
    } catch (error) {
        console.error('Authentication error:', error);
        return null;
    }
}

