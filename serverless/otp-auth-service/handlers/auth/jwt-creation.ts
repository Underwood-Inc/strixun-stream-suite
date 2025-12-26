/**
 * JWT Token Creation Utilities
 * 
 * Handles JWT token generation and session management for authenticated users
 */

import { createJWT, getJWTSecret, hashEmail } from '../../utils/crypto.js';
import { getCustomerKey } from '../../services/customer.js';
import { storeIPSessionMapping } from '../../services/ip-session-index.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    [key: string]: any;
}

interface User {
    userId: string;
    email: string;
    displayName?: string;
    customerId?: string | null;
    createdAt?: string;
    lastLogin?: string;
}

interface TokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
    displayName: string | null;
    sub: string;
    email: string;
    email_verified: boolean;
    token: string; // Backward compatibility
    userId: string;
    expiresAt: string;
}

interface SessionData {
    userId: string;
    email: string;
    token: string; // hashed
    expiresAt: string;
    createdAt: string;
    ipAddress: string;
    userAgent?: string;
    country?: string;
}

/**
 * Generate CSRF token
 */
function generateCSRFToken(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate JWT ID
 */
function generateJWTId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create JWT token and session for authenticated user
 * 
 * @param user - User data
 * @param customerId - Customer ID (optional)
 * @param env - Worker environment
 * @param request - HTTP request (optional, for IP tracking)
 * @returns OAuth 2.0 token response
 */
export async function createAuthToken(
    user: User,
    customerId: string | null,
    env: Env,
    request?: Request
): Promise<TokenResponse> {
    const emailLower = user.email.toLowerCase().trim();
    const expiresAt = new Date(Date.now() + 7 * 60 * 60 * 1000); // 7 hours
    const expiresIn = 7 * 60 * 60; // 7 hours in seconds
    const now = Math.floor(Date.now() / 1000);
    
    // Extract IP address and metadata from request
    const clientIP = request 
        ? (request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown')
        : 'unknown';
    const userAgent = request?.headers.get('User-Agent') || undefined;
    const country = request?.headers.get('CF-IPCountry') || undefined;
    
    // Generate CSRF token for this session
    const csrfToken = generateCSRFToken();
    
    // JWT Standard Claims (RFC 7519) + OAuth 2.0 + Custom
    const tokenPayload = {
        // Standard JWT Claims
        sub: user.userId, // Subject (user identifier)
        iss: 'auth.idling.app', // Issuer
        aud: customerId || 'default', // Audience (customer/tenant)
        exp: Math.floor(expiresAt.getTime() / 1000), // Expiration time
        iat: now, // Issued at
        jti: generateJWTId(), // JWT ID (unique token identifier)
        
        // OAuth 2.0 / OpenID Connect Claims
        email: emailLower,
        email_verified: true, // OTP verification confirms email
        
        // Custom Claims
        userId: user.userId, // Backward compatibility
        customerId: customerId || null, // Multi-tenant customer ID
        csrf: csrfToken, // CSRF token included in JWT
    };
    
    // Log JWT creation for debugging
    if (customerId) {
        console.log(`[JWT Creation] Creating JWT with customerId: ${customerId} for user: ${emailLower} from IP: ${clientIP}`);
    } else {
        console.log(`[JWT Creation] WARNING: Creating JWT WITHOUT customerId for user: ${emailLower} from IP: ${clientIP}`);
    }
    
    const jwtSecret = getJWTSecret(env);
    const accessToken = await createJWT(tokenPayload, jwtSecret);
    
    // Store session with customer isolation (including IP address)
    const sessionKey = getCustomerKey(customerId, `session_${user.userId}`);
    const sessionData: SessionData = {
        userId: user.userId,
        email: emailLower,
        token: await hashEmail(accessToken), // Store hash of token
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString(),
        ipAddress: clientIP,
        userAgent,
        country,
    };
    
    await env.OTP_AUTH_KV.put(sessionKey, JSON.stringify(sessionData), { expirationTtl: 25200 }); // 7 hours (matches token expiration)
    
    // Store IP-to-session mapping for cross-application session discovery
    await storeIPSessionMapping(
        clientIP,
        user.userId,
        customerId,
        sessionKey,
        expiresAt.toISOString(),
        emailLower,
        env
    );
    
    // OAuth 2.0 Token Response (RFC 6749 Section 5.1)
    return {
        // OAuth 2.0 Standard Fields
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: expiresIn,
        
        // Additional Standard Fields
        scope: 'openid email profile', // OIDC scopes
        
        // User Information
        displayName: user.displayName || null, // Anonymized display name
        
        // User Information (OIDC UserInfo)
        sub: user.userId, // Subject identifier
        email: emailLower,
        email_verified: true,
        
        // Backward Compatibility (deprecated, use access_token)
        token: accessToken,
        userId: user.userId,
        expiresAt: expiresAt.toISOString(),
    };
}

