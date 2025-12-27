/**
 * Authentication utilities
 * JWT verification for mods API endpoints
 * Uses the same JWT_SECRET as the OTP auth service
 */

/**
 * Get JWT secret from environment
 * @param env - Worker environment
 * @returns JWT secret
 */
export function getJWTSecret(env: Env): string {
    if (!env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is required. Please set it via: wrangler secret put JWT_SECRET');
    }
    return env.JWT_SECRET;
}

/**
 * Verify JWT token
 * @param token - JWT token
 * @param secret - Secret key for verification
 * @returns Decoded payload or null if invalid
 */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
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
        const signature = Uint8Array.from(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
        
        // Verify signature
        const isValid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(signatureInput));
        if (!isValid) return null;
        
        // Decode payload
        const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
        const payload = JSON.parse(payloadJson) as JWTPayload;
        
        // Check expiration
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }
        
        return payload;
    } catch (error) {
        console.error('JWT verification error:', error);
        return null;
    }
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
 * Authenticate request and extract user info
 * Returns auth object with userId, customerId, and jwtToken
 * @param request - HTTP request
 * @param env - Worker environment
 * @returns Auth object or null if not authenticated
 */
export async function authenticateRequest(request: Request, env: Env): Promise<AuthResult | null> {
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

/**
 * JWT Payload interface
 */
interface JWTPayload {
    sub: string; // User ID
    email?: string;
    customerId?: string | null;
    exp?: number;
    iat?: number;
    [key: string]: any;
}

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
    [key: string]: any;
}

