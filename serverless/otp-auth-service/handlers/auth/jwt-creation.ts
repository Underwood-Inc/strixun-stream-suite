/**
 * JWT Token Creation Utilities
 * 
 * Handles JWT token generation and session management for authenticated customers
 */

import { createJWT, getJWTSecret, hashEmail } from '../../utils/crypto.js';
import { getCustomerKey } from '../../services/customer.js';
import { getClientIP } from '../../utils/ip.js';
import { createFingerprintHash } from '@strixun/api-framework';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    [key: string]: any;
}

/**
 * Customer data structure (NOT User - we only use Customer)
 * CRITICAL: We ONLY use customerId - NO userId derived from email
 * customerId is MANDATORY - NOT optional
 * displayName is MANDATORY - NOT optional, globally unique
 */
interface Customer {
    customerId: string; // MANDATORY - Customer ID is the ONLY identifier (globally unique)
    email: string; // OTP email (used for authentication, NOT returned in responses)
    displayName: string; // MANDATORY - Display name (globally unique)
    createdAt?: string;
    lastLogin?: string;
}

interface TokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
    displayName: string; // MANDATORY - globally unique display name
    sub: string; // customerId - the ONLY identifier
    // CRITICAL: DO NOT include email - it's the OTP email and should not be exposed in response
    email_verified: boolean;
    token: string; // Backward compatibility
    customerId: string; // MANDATORY - the ONLY identifier (globally unique)
    expiresAt: string;
}

interface SessionData {
    customerId: string; // MANDATORY - the ONLY identifier
    email: string; // OTP email - stored for internal use only
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
 * Create JWT token and session for authenticated customer
 * 
 * @param customer - Customer data (NOT User - we only use Customer)
 * @param customerId - Customer ID (MANDATORY)
 * @param env - Worker environment
 * @param request - HTTP request (optional, for IP tracking)
 * @returns OAuth 2.0 token response (DOES NOT include OTP email)
 */
export async function createAuthToken(
    customer: Customer,
    customerId: string,
    env: Env,
    request?: Request
): Promise<TokenResponse> {
    // FAIL-FAST: customerId is MANDATORY
    if (!customerId) {
        throw new Error('Customer ID is MANDATORY for token creation');
    }
    
    // FAIL-FAST: displayName is MANDATORY - customer cannot exist without it
    if (!customer.displayName || customer.displayName.trim() === '') {
        throw new Error(`Display name is MANDATORY for customer ${customerId}. Customer cannot exist without a globally unique display name.`);
    }
    
    const emailLower = customer.email.toLowerCase().trim();
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
    
    // FAIL-FAST: Require customerId - MANDATORY
    if (!customerId) {
        throw new Error('Customer ID is MANDATORY for JWT creation. Customer account must be created before token generation.');
    }
    
    // AUTHORIZATION SERVICE INTEGRATION: Ensure customer has roles/permissions provisioned
    // This is called on every login to auto-provision new customers with default roles
    // Idempotent - safe to call multiple times (skips if already provisioned)
    try {
        const { ensureCustomerAccess } = await import('../../../shared/access-migration-helpers.js');
        await ensureCustomerAccess(customerId, emailLower, env);
    } catch (error) {
        console.error('[JWT] Failed to provision customer authorization:', error);
        // Don't throw - authorization provisioning failure shouldn't break login
        // Customer will still get JWT, but may have permission issues until manually provisioned
    }
    
    // Check if customer is a super admin (via Access Service)
    const { isSuperAdmin: checkSuperAdmin } = await import('../../utils/super-admin.js');
    const isSuperAdmin = await checkSuperAdmin(customerId, env);
    
    // FAIL-FAST: Ensure customerId matches
    if (customer.customerId !== customerId) {
        throw new Error(`Customer ID mismatch: expected ${customerId}, got ${customer.customerId}`);
    }
    
    // JWT Standard Claims (RFC 7519) + OAuth 2.0 + Custom
    // NOTE: Email is included in JWT payload for internal use, but NOT returned in response body
    // CRITICAL: sub (subject) is customerId - NO userId
    const tokenPayload = {
        // Standard JWT Claims
        sub: customerId, // Subject (customer ID - the ONLY identifier)
        iss: 'auth.idling.app', // Issuer
        aud: customerId, // Audience (customer/tenant) - REQUIRED
        exp: Math.floor(expiresAt.getTime() / 1000), // Expiration time
        iat: now, // Issued at
        jti: generateJWTId(), // JWT ID (unique token identifier)
        
        // OAuth 2.0 / OpenID Connect Claims
        // CRITICAL: Email is in JWT payload for internal use, but NOT exposed in response body
        email: emailLower,
        email_verified: true, // OTP verification confirms email
        
        // Custom Claims
        customerId: customerId, // MANDATORY - the ONLY identifier
        csrf: csrfToken, // CSRF token included in JWT
        isSuperAdmin: isSuperAdmin, // Super admin status
    };
    
    // Log JWT creation for debugging
    // CRITICAL: Do NOT log OTP email - it's sensitive data
    console.log(`[JWT Creation] Creating JWT with customerId: ${customerId} from IP: ${clientIP}`);
    
    const jwtSecret = getJWTSecret(env);
    const accessToken = await createJWT(tokenPayload, jwtSecret);
    
    // Store session with customer isolation (including IP address and fingerprint)
    const sessionKey = getCustomerKey(customerId, `session_${customerId}`);
    const sessionData: SessionData = {
        customerId: customerId, // MANDATORY - the ONLY identifier
        email: emailLower, // Stored for internal use only, NOT returned in responses
        token: await hashEmail(accessToken), // Store hash of token
        expiresAt: expiresAt.toISOString(),
        createdAt: new Date().toISOString(),
        ipAddress: clientIP,
        userAgent,
        country,
        fingerprint, // Device fingerprint for enhanced security
    };
    
    await env.OTP_AUTH_KV.put(sessionKey, JSON.stringify(sessionData), { expirationTtl: 25200 }); // 7 hours (matches token expiration)
    
    // CRITICAL: Do NOT log OTP email - it's sensitive data
    console.log(`[JWT Creation] ✓ Created session for customer: ${customerId} from IP: ${clientIP}`);
    
    // OAuth 2.0 Token Response (RFC 6749 Section 5.1)
    // CRITICAL: DO NOT return OTP email in response - it's sensitive data
    // Email is only in the JWT payload for internal use
    return {
        // OAuth 2.0 Standard Fields
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: expiresIn,
        
        // Additional Standard Fields
        scope: 'openid email profile', // OIDC scopes
        
        // Customer Information (NOT User - we only use Customer)
        displayName: customer.displayName, // MANDATORY - globally unique display name
        
        // Customer Information (OIDC UserInfo)
        sub: customerId, // Subject identifier (customer ID - the ONLY identifier)
        // DO NOT include email - it's the OTP email and should not be exposed
        email_verified: true,
        
        // Backward Compatibility (deprecated, use access_token)
        token: accessToken,
        customerId: customerId, // MANDATORY - the ONLY identifier
        expiresAt: expiresAt.toISOString(),
    };
}

