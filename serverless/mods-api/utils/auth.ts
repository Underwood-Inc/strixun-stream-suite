/**
 * Authentication utilities
 * JWT verification for mods API endpoints
 * Uses the same JWT_SECRET as the OTP auth service
 */

// Use shared JWT utilities from api-framework (canonical implementation)
import { verifyJWT as verifyJWTShared, getJWTSecret as getJWTSecretShared, type JWTPayload as JWTPayloadShared } from '@strixun/api-framework/jwt';
import { getAuthApiUrl } from '@strixun/api-framework';

/**
 * Get JWT secret from environment
 * @param env - Worker environment
 * @returns JWT secret
 */
export function getJWTSecret(env: Env): string {
    return getJWTSecretShared(env);
}

/**
 * Verify JWT token
 * Uses shared implementation from api-framework
 * @param token - JWT token
 * @param secret - Secret key for verification
 * @returns Decoded payload or null if invalid
 */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
    const payload = await verifyJWTShared(token, secret);
    if (!payload) {
        console.log('[Auth] JWT signature verification failed - signature does not match');
    }
    return payload;
}


/**
 * Fetch customer email from auth service if missing from JWT
 * This is a fallback for older tokens that don't include email
 */
/**
 * Get the auth API URL with auto-detection for local dev
 * Uses centralized service URL resolution utility from api-framework
 */
function getAuthApiUrlLocal(env: Env): string {
    return getAuthApiUrl(env);
}

async function fetchEmailFromAuthService(token: string, env: Env): Promise<string | undefined> {
    try {
        const authApiUrl = getAuthApiUrlLocal(env);
        const response = await fetch(`${authApiUrl}/auth/me`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (response.ok) {
            const data = await response.json() as { email?: string; [key: string]: any };
            return data.email;
        }
    } catch (error) {
        console.warn('[Auth] Failed to fetch email from auth service:', error);
    }
    return undefined;
}


/**
 * Authenticate request and extract customer info
 * Returns auth object with customerId and jwtToken
 * If email is missing from JWT, attempts to fetch it from auth service
 * @param request - HTTP request
 * @param env - Worker environment
 * @returns Auth object or null if not authenticated
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
                console.debug(`[Auth] Token from HttpOnly cookie: tokenLength=${token.length}`);
            }
        }
        
        // PRIORITY 2: Check Authorization header (service-to-service calls)
        // This supports JWT tokens from ServiceClient and other internal services
        if (!token) {
            const authHeader = request.headers.get('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring('Bearer '.length).trim();
                console.debug(`[Auth] Token from Authorization header: tokenLength=${token.length}`);
            }
        }
        
        // No authentication provided
        if (!token) {
            console.debug('[Auth] No authentication found - not authenticated');
            return null;
        }

        // CRITICAL: Trim token to ensure it matches the token used for encryption
        token = token.trim();
        const jwtSecret = getJWTSecret(env);
        console.debug(`[Auth] Verifying JWT: tokenLength=${token.length}, secretLength=${jwtSecret.length}, secretFirstChars=${jwtSecret.substring(0, 20)}`);
        const payload = await verifyJWT(token, jwtSecret);
        console.debug(`[Auth] JWT verification result: hasPayload=${!!payload}, hasSub=${!!payload?.sub}, sub=${payload?.sub || 'none'}`);

        if (!payload || !payload.sub) {
            console.error('[Auth] JWT verification failed: missing payload or sub');
            return null;
        }

        // If email is missing from JWT, try to fetch it from auth service
        let email = payload.email;
        if (!email) {
            console.warn('[Auth] Email missing from JWT payload, fetching from auth service...');
            email = await fetchEmailFromAuthService(token, env);
            if (email) {
                console.info('[Auth] Successfully fetched email from auth service');
            } else {
                console.warn('[Auth] Could not fetch email from auth service - admin checks may fail');
            }
        }

        // CRITICAL: payload.sub IS the customerId (set by OTP auth service)
        // NO separate userId exists - customerId is the ONLY identity
        // SECURITY: Email is NEVER returned in auth object - use getCustomerEmail() utility when needed
        return {
            customerId: payload.sub, // PRIMARY IDENTITY - MANDATORY
            jwtToken: token // Include JWT token for encryption
        };
    } catch (error) {
        console.error('Authentication error:', error);
        return null;
    }
}

/**
 * JWT Payload interface
 * Re-export from shared JWT utilities
 */
export type { JWTPayload } from '@strixun/api-framework/jwt';

/**
 * Auth result interface
 * SECURITY: Email is NEVER included - use getCustomerEmail() utility when needed
 */
export interface AuthResult {
    customerId: string; // PRIMARY IDENTITY - MANDATORY
    jwtToken: string;
}

/**
 * Environment interface
 */
interface Env {
    JWT_SECRET?: string;
    AUTH_API_URL?: string; // URL of the auth service (for fetching email if missing from JWT)
    [key: string]: any;
}

