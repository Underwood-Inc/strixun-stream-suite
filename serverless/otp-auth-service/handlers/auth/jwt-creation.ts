/**
 * JWT Token Creation Utilities
 * 
 * Handles JWT token generation and session management for authenticated customers
 */

import { hashEmail } from '../../utils/crypto.js';
import { entityKey } from '@strixun/kv-entities';
import { getClientIP } from '../../utils/ip.js';
import { createFingerprintHash } from '@strixun/api-framework';
import { getSigningContext, signJWT, computeHashClaim } from '../../utils/asymmetric-jwt.js';

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
    id_token: string; // RS256-signed OIDC ID Token
    refresh_token: string; // Opaque refresh token (stored hashed in KV)
    token_type: string;
    expires_in: number;
    refresh_expires_in: number; // Seconds until absolute refresh expiry (7 days from login)
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

interface RefreshTokenData {
    customerId: string;
    email: string; // plaintext lowercase -- server-side only, carried to session KV on refresh
    absoluteExpiresAt: string; // login time + 7 days -- immutable across rotations
    createdAt: string;
    ipAddress: string;
    keyId: string | null;
    ssoScope: string[];
}

export const ACCESS_TOKEN_TTL_SECONDS = 900; // 15 minutes
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days — matches refresh max lifetime so session KV is not removed while refresh is valid
export const REFRESH_TOKEN_MAX_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
 * Generate a cryptographically secure opaque refresh token.
 * 64 random bytes, base64url-encoded.
 */
function generateRefreshToken(): string {
    const bytes = new Uint8Array(64);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

/**
 * Create JWT token and session for authenticated customer
 *
 * @param customer - Customer data (NOT User - we only use Customer)
 * @param customerId - Customer ID (MANDATORY)
 * @param env - Worker environment
 * @param request - HTTP request (optional, for IP tracking)
 * @param keyId - API key ID (optional, for inter-tenant SSO scoping)
 * @param scopeOptions - Optional requested scope and key-allowed scopes (intersection used)
 * @returns OAuth 2.0 token response (DOES NOT include OTP email)
 */
export async function createAuthToken(
    customer: Customer,
    customerId: string,
    env: Env,
    request?: Request,
    keyId?: string,
    scopeOptions?: { requestedScope?: string; keyAllowedScopes?: string[] }
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
    const nowMs = Date.now();
    const expiresAt = new Date(nowMs + ACCESS_TOKEN_TTL_SECONDS * 1000); // 15 minutes
    const now = Math.floor(nowMs / 1000);
    const absoluteRefreshExpiresAt = new Date(nowMs + REFRESH_TOKEN_MAX_LIFETIME_MS); // 7 days from login
    
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
    // FAIL-FAST: Login must not succeed if customer cannot be found in Access Service.
    try {
        const { ensureCustomerAccess } = await import('../../../shared/access-migration-helpers.js');
        await ensureCustomerAccess(customerId, emailLower, env);
    } catch (error) {
        console.error('[JWT] Failed to provision customer authorization:', error);
        throw error;
    }
    
    // Check if customer is a super admin (via Access Service)
    const { isSuperAdmin: checkSuperAdmin } = await import('../../utils/super-admin.js');
    const isSuperAdmin = await checkSuperAdmin(customerId, env);
    
    // FAIL-FAST: Ensure customerId matches
    if (customer.customerId !== customerId) {
        throw new Error(`Customer ID mismatch: expected ${customerId}, got ${customer.customerId}`);
    }
    
    // Retrieve SSO config for the API key (if provided)
    // This enables inter-tenant SSO validation
    let ssoScope: string[] = [];
    if (keyId) {
        try {
            const { getApiKeyById } = await import('../../services/api-key-management.js');
            const keyData = await getApiKeyById(customerId, keyId, env);
            
            if (keyData && keyData.ssoConfig) {
                const ssoConfig = keyData.ssoConfig;
                
                // Build SSO scope based on isolation mode
                if (ssoConfig.isolationMode === 'none' && ssoConfig.globalSsoEnabled) {
                    // Global SSO: session can be used by ALL customer's keys
                    ssoScope = ['*']; // Wildcard means all keys for this customer
                } else if (ssoConfig.isolationMode === 'selective') {
                    // Selective SSO: session can be used by specific keys
                    ssoScope = [keyId, ...ssoConfig.allowedKeyIds];
                } else if (ssoConfig.isolationMode === 'complete') {
                    // Complete isolation: session ONLY for this key
                    ssoScope = [keyId];
                }
            } else {
                // No SSO config: default to key-only scope (complete isolation)
                ssoScope = [keyId];
            }
        } catch (error) {
            console.error(`[JWT Creation] Failed to retrieve SSO config for keyId ${keyId}:`, error);
            // Fail-safe: default to key-only scope
            ssoScope = keyId ? [keyId] : [];
        }
    }
    
    // Resolve scope: requested scope intersected with key's allowed scopes (if any)
    const { resolveScopeForKey, getDefaultScope } = await import('../../shared/oidc-constants.js');
    const resolvedScope = scopeOptions
        ? resolveScopeForKey(scopeOptions.requestedScope, scopeOptions.keyAllowedScopes)
        : getDefaultScope();

    // JWT Standard Claims (RFC 7519) + OAuth 2.0 + Custom
    // PRIVACY: email is NEVER included in JWT payloads -- customerId is the sole identifier
    const issuer = env.JWT_ISSUER || env.AUTH_SERVICE_URL || (env.ENVIRONMENT === 'production' ? 'https://auth.idling.app' : 'http://localhost:8787');
    const tokenPayload = {
        // Standard JWT Claims
        sub: customerId,
        iss: issuer,
        aud: keyId || customerId,
        exp: Math.floor(expiresAt.getTime() / 1000),
        iat: now,
        jti: generateJWTId(),
        
        // OIDC Claims (email intentionally omitted -- customerId is the identifier)
        email_verified: true,
        
        // Custom Claims (scope from shared constants / per-key config)
        scope: resolvedScope,
        customerId: customerId,
        client_id: keyId || null,
        csrf: csrfToken,
        isSuperAdmin: isSuperAdmin,
        displayName: customer.displayName, // Auth store uses this; avoids /customer/me fallback
        
        // Inter-Tenant SSO Claims (Multi-Tenant Architecture)
        keyId: keyId || null,
        ssoScope: ssoScope,
    };
    
    // Log JWT creation for debugging
    // CRITICAL: Do NOT log OTP email - it's sensitive data
    console.log(`[JWT Creation] Creating JWT with customerId: ${customerId} from IP: ${clientIP}`);
    
    // RS256 signing (OIDC-compliant) -- OIDC_SIGNING_KEY is REQUIRED
    const signingContext = await getSigningContext(env);

    const accessToken = await signJWT(tokenPayload as Record<string, unknown>, signingContext);
    
    // Generate OIDC ID Token (RS256-signed, separate from access_token)
    const atHash = await computeHashClaim(accessToken);
    const idTokenPayload: Record<string, unknown> = {
        iss: issuer,
        sub: customerId,
        aud: keyId || customerId,
        exp: Math.floor(expiresAt.getTime() / 1000),
        iat: now,
        at_hash: atHash,
        email_verified: true,
    };
    const idToken = await signJWT(idTokenPayload, signingContext);

    // Store session with customer isolation (including IP address and fingerprint)
    const sessionKey = entityKey('otp-auth', 'session', customerId).key;
    const sessionData: SessionData = {
        customerId: customerId, // MANDATORY - the ONLY identifier
        email: emailLower, // Stored for internal use only, NOT returned in responses
        token: await hashEmail(accessToken), // Store hash of token
        expiresAt: absoluteRefreshExpiresAt.toISOString(), // Session valid until refresh token absolute expiry (not access token)
        createdAt: new Date().toISOString(),
        ipAddress: clientIP,
        userAgent,
        country,
        fingerprint, // Device fingerprint for enhanced security
    };
    
    await env.OTP_AUTH_KV.put(sessionKey, JSON.stringify(sessionData), { expirationTtl: SESSION_TTL_SECONDS });
    
    // Generate and store opaque refresh token (single-use, rotated on each refresh)
    const rawRefreshToken = generateRefreshToken();
    const refreshTokenHash = await hashEmail(rawRefreshToken);
    const refreshTokenKey = entityKey('otp-auth', 'refresh-token', refreshTokenHash).key;
    const refreshTtlSeconds = Math.floor((absoluteRefreshExpiresAt.getTime() - nowMs) / 1000);

    const refreshTokenData: RefreshTokenData = {
        customerId,
        email: emailLower, // plaintext -- carried to session KV on refresh, never placed in JWTs
        absoluteExpiresAt: absoluteRefreshExpiresAt.toISOString(),
        createdAt: new Date().toISOString(),
        ipAddress: clientIP,
        keyId: keyId || null,
        ssoScope,
    };

    await env.OTP_AUTH_KV.put(refreshTokenKey, JSON.stringify(refreshTokenData), { expirationTtl: refreshTtlSeconds });
    
    // CRITICAL: Do NOT log OTP email - it's sensitive data
    console.log(`[JWT Creation] ✓ Created session + refresh token for customer: ${customerId} from IP: ${clientIP}`);
    
    // OAuth 2.0 Token Response (RFC 6749 Section 5.1)
    // PRIVACY: email is NEVER included in any response -- customerId is the sole identifier
    const tokenResponse: TokenResponse = {
        // OAuth 2.0 Standard Fields
        access_token: accessToken,
        id_token: idToken,
        refresh_token: rawRefreshToken,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        refresh_expires_in: refreshTtlSeconds,
        
        // Additional Standard Fields
        scope: resolvedScope,
        
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

    return tokenResponse;
}

