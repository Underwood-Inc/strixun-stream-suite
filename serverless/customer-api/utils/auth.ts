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
 * Supports BOTH HttpOnly cookies (browser) and Authorization header (service-to-service)
 * Returns auth object with customerId and jwtToken
 */
export async function authenticateRequest(request: Request, env: Env): Promise<AuthResult | null> {
    try {
        let token: string | null = null;
        
        // PRIORITY 1: Check HttpOnly cookie (browser requests)
        const cookieHeader = request.headers.get('Cookie');
        if (cookieHeader) {
            const cookies = cookieHeader.split(';').map(c => c.trim());
            const authCookie = cookies.find(c => c.startsWith('auth_token='));
            
            if (authCookie) {
                token = authCookie.substring('auth_token='.length).trim();
            }
        }
        
        // PRIORITY 2: Check Authorization header (service-to-service calls)
        // This supports SUPER_ADMIN_API_KEY and SERVICE_API_KEY from ServiceClient
        if (!token) {
            const authHeader = request.headers.get('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring('Bearer '.length).trim();
            }
        }
        
        // No authentication provided
        if (!token) {
            return null;
        }

        token = token.trim();
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret);

        if (!payload || !payload.sub) {
            return null;
        }

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

