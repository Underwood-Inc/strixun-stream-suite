/**
 * Re-export from shared OIDC/JWT package.
 * @deprecated Import from @strixun/oidc-jwt directly.
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
} from '@strixun/oidc-jwt';
