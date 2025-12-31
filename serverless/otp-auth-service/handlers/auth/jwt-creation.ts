/**
 * JWT Token Creation Utilities
 * 
 * Handles JWT token generation and session management for authenticated users
 */

import { createJWT, getJWTSecret, hashEmail } from '../../utils/crypto.js';
import { getCustomerKey } from '../../services/customer.js';
import { storeIPSessionMapping } from '../../services/ip-session-index.js';
import { getClientIP } from '../../utils/ip.js';
import { createFingerprintHash } from '@strixun/api-framework';

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
    fingerprint?: string; // SHA-256 hash of device fingerprint
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
    const clientIP = getClientIP(request);
    const userAgent = request?.headers.get('User-Agent') || undefined;
    const country = request?.headers.get('CF-IPCountry') || undefined;
    
    // Create device fingerprint for enhanced session security
    // This enables device-level isolation when multiple devices share the same IP
    const fingerprint = request ? await createFingerprintHash(request) : undefined;
    
    // Generate CSRF token for this session
    const csrfToken = generateCSRFToken();
    
    // Check if user is a super admin
    const { isSuperAdminEmail } = await import('../../utils/super-admin.js');
    const isSuperAdmin = await isSuperAdminEmail(emailLower, env);
    
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
        isSuperAdmin: isSuperAdmin, // Super admin status
    };
    
    // Log JWT creation for debugging
    if (customerId) {
        console.log(`[JWT Creation] Creating JWT with customerId: ${customerId} for user: ${emailLower} from IP: ${clientIP}`);
    } else {
        console.log(`[JWT Creation] WARNING: Creating JWT WITHOUT customerId for user: ${emailLower} from IP: ${clientIP}`);
    }
    
    const jwtSecret = getJWTSecret(env);
    const accessToken = await createJWT(tokenPayload, jwtSecret);
    
    // Store session with customer isolation (including IP address and fingerprint)
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
        fingerprint, // Device fingerprint for enhanced security
    };
    
    await env.OTP_AUTH_KV.put(sessionKey, JSON.stringify(sessionData), { expirationTtl: 25200 }); // 7 hours (matches token expiration)
    
    // Store IP-to-session mapping for cross-application session discovery
    // This enables SSO - other apps can discover this session by IP address
    if (clientIP !== 'unknown') {
        await storeIPSessionMapping(
            clientIP,
            user.userId,
            customerId,
            sessionKey,
            expiresAt.toISOString(),
            emailLower,
            env
        );
        console.log(`[JWT Creation] [OK] Created session and IP mapping for user: ${emailLower} from IP: ${clientIP}`);
    } else {
        console.warn(`[JWT Creation] [WARNING] Created session but could not create IP mapping (IP unknown) for user: ${emailLower}. SSO will not work for this session.`);
    }
    
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

