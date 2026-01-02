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
 * Check if email is in allowed list
 * @param email - Email address to check
 * @param env - Worker environment
 * @returns True if email is allowed (or no whitelist configured)
 */
export function isEmailAllowed(email: string | undefined, env: Env): boolean {
    if (!email) return false;
    
    // If no whitelist is configured, allow all authenticated users
    if (!env.ALLOWED_EMAILS) {
        return true;
    }
    
    // Parse comma-separated list of allowed emails
    const allowedEmails = env.ALLOWED_EMAILS.split(',').map(e => e.trim().toLowerCase());
    return allowedEmails.includes(email.toLowerCase());
}

/**
 * Fetch user email from auth service if missing from JWT
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
 * Authenticate request and extract user info
 * Returns auth object with userId, customerId, and jwtToken
 * If email is missing from JWT, attempts to fetch it from auth service
 * @param request - HTTP request
 * @param env - Worker environment
 * @returns Auth object or null if not authenticated
 */
export async function authenticateRequest(request: Request, env: Env): Promise<AuthResult | null> {
    try {
        const authHeader = request.headers.get('Authorization');
        console.debug(`[Auth] Authorization header check: hasHeader=${!!authHeader}, headerLength=${authHeader?.length || 0}, startsWithBearer=${authHeader?.startsWith('Bearer ') || false}, firstChars=${authHeader?.substring(0, 20) || 'none'}`);
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }

        // CRITICAL: Trim token to ensure it matches the token used for encryption
        const token = authHeader.substring(7).trim();
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

        return {
            userId: payload.sub,
            email: email,
            customerId: payload.customerId || null,
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
 */
export interface AuthResult {
    userId: string;
    email?: string;
    customerId: string | null;
    jwtToken: string;
}

/**
 * Environment interface
 */
interface Env {
    JWT_SECRET?: string;
    ALLOWED_EMAILS?: string; // Comma-separated list of allowed email addresses
    AUTH_API_URL?: string; // URL of the auth service (for fetching email if missing from JWT)
    [key: string]: any;
}

