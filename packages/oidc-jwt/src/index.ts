/**
 * @strixun/oidc-jwt
 *
 * Shared OIDC/JWT utilities - RS256 signing and verification.
 * Canonical implementation extracted from auth service dashboard.
 */

export {
    getSigningContext,
    signJWT,
    verifyAsymmetricJWT,
    importPublicKey,
    toPublicJwk,
    computeHashClaim,
    resetSigningContext,
    type RSAPrivateJWK,
    type RSAPublicJWK,
    type JWKSet,
    type OIDCSigningContext,
} from './asymmetric.js';

export { verifyTokenOIDC, extractAuthToken } from './verify-token.js';

export {
    verifyWithJWKS,
    decodeJWTHeader,
    type JWKSEnv,
} from './jwks.js';

export {
    extractTokenFromRequest,
    hasAuthTokenCookie,
} from './extract.js';
