/**
 * Authentication utilities
 * JWT verification for customer API endpoints
 * Uses the same JWT_SECRET as the OTP auth service
 */

interface Env {
    JWT_SECRET?: string;
    [key: string]: any;
}

interface AuthResult {
    userId: string;
    email?: string;
    customerId: string | null;
    jwtToken: string;
}

/**
 * Get JWT secret from environment
 */
export function getJWTSecret(env: Env): string {
    if (!env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is required. Please set it via: wrangler secret put JWT_SECRET');
    }
    return env.JWT_SECRET;
}

/**
 * Verify JWT token
 */
export async function verifyJWT(token: string, secret: string): Promise<any | null> {
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
        const payload = JSON.parse(payloadJson);
        
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
 * Authenticate service-to-service request using API key
 * Used for internal service calls (e.g., OTP auth service calling customer-api)
 */
export async function authenticateServiceRequest(request: Request, env: Env): Promise<AuthResult | null> {
    try {
        // Check for X-Service-Key header (primary method)
        let serviceKey = request.headers.get('X-Service-Key');
        
        // Also check Authorization header in case it's being sent there
        if (!serviceKey) {
            const authHeader = request.headers.get('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                // Extract token from Bearer token
                serviceKey = authHeader.substring(7);
                console.log('[Customer API Auth] Found service key in Authorization header (Bearer token)');
            } else if (authHeader && !authHeader.startsWith('Bearer ')) {
                // Might be the service key directly in Authorization header
                serviceKey = authHeader;
                console.log('[Customer API Auth] Found service key in Authorization header (direct)');
            }
        }
        
        // Debug logging for authentication issues
        console.log('[Customer API Auth] Service authentication attempt', {
            hasServiceKeyHeader: !!serviceKey,
            serviceKeyLength: serviceKey?.length || 0,
            hasEnvServiceApiKey: !!env.SERVICE_API_KEY,
            envServiceApiKeyLength: env.SERVICE_API_KEY?.length || 0,
            allHeaders: Array.from(request.headers.entries()).map(([k]) => k),
        });
        
        if (!serviceKey) {
            console.warn('[Customer API Auth] X-Service-Key header is missing');
            return null;
        }
        
        if (!env.SERVICE_API_KEY) {
            console.error('[Customer API Auth] SERVICE_API_KEY is not configured in customer-api worker. Set it via: wrangler secret put SERVICE_API_KEY');
            return null;
        }

        // Constant-time comparison to prevent timing attacks
        const encoder = new TextEncoder();
        const serviceKeyBytes = encoder.encode(serviceKey);
        const envKeyBytes = encoder.encode(env.SERVICE_API_KEY);
        
        if (serviceKeyBytes.length !== envKeyBytes.length) {
            console.warn('[Customer API Auth] Service key length mismatch', {
                receivedLength: serviceKeyBytes.length,
                expectedLength: envKeyBytes.length,
            });
            return null;
        }

        let match = true;
        for (let i = 0; i < serviceKeyBytes.length; i++) {
            match = match && (serviceKeyBytes[i] === envKeyBytes[i]);
        }

        if (!match) {
            console.warn('[Customer API Auth] Service key does not match. Keys must be identical in both otp-auth-service and customer-api workers.');
            return null;
        }

        console.log('[Customer API Auth] Service authentication successful');
        
        // Service authentication successful
        // Return a service auth result (no user JWT, but authenticated)
        return {
            userId: 'service', // Service identifier
            email: undefined,
            customerId: null, // Will be set by handler
            jwtToken: '' // No JWT for service calls
        };
    } catch (error) {
        console.error('[Customer API Auth] Service authentication error:', error);
        return null;
    }
}

/**
 * Authenticate request and extract user info
 * Supports both JWT tokens (user requests) and service keys (service-to-service)
 * Returns auth object with userId, customerId, and jwtToken
 */
export async function authenticateRequest(request: Request, env: Env): Promise<AuthResult | null> {
    // Try service authentication first (for internal calls)
    const serviceAuth = await authenticateServiceRequest(request, env);
    if (serviceAuth) {
        return serviceAuth;
    }

    // Try JWT authentication (for user requests)
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

