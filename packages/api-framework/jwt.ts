/**
 * JWT Utilities — RS256 (OIDC) Only
 *
 * JWT verification uses @strixun/oidc-jwt (verifyWithJWKS).
 * This module provides JWTPayload type for consumers.
 */

/**
 * JWT Payload interface
 * Covers standard JWT (RFC 7519), OAuth 2.0, and OIDC claims
 */
export interface JWTPayload {
    sub?: string;
    iss?: string;
    aud?: string | string[];
    exp?: number;
    iat?: number;
    jti?: string;
    email_verified?: boolean;
    customerId: string;
    scope?: string;
    client_id?: string | null;
    at_hash?: string;
    csrf?: string;
    isSuperAdmin?: boolean;
    [key: string]: any;
}
