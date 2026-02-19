/**
 * OpenID Connect Discovery Endpoint
 *
 * Serves the provider configuration at /.well-known/openid-configuration
 * per OpenID Connect Discovery 1.0 Section 4.
 *
 * This document maps to the EXISTING /auth/* endpoints -- OTP-based
 * authentication rather than a redirect-based authorization code flow.
 */

import { getCorsHeadersRecord } from '../../utils/cors.js';

interface Env {
    AUTH_SERVICE_URL?: string;
    JWT_ISSUER?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

function getIssuer(env: Env): string {
    return env.JWT_ISSUER
        || env.AUTH_SERVICE_URL
        || (env.ENVIRONMENT === 'production' ? 'https://auth.idling.app' : 'http://localhost:8787');
}

/**
 * GET /.well-known/openid-configuration
 *
 * Returns the OpenID Provider metadata document.
 * Response is cacheable (configuration changes infrequently).
 */
export async function handleDiscovery(request: Request, env: Env): Promise<Response> {
    const issuer = getIssuer(env);

    const config = {
        issuer,

        // OTP-based auth -- no redirect authorization_endpoint
        token_endpoint: `${issuer}/auth/verify-otp`,
        userinfo_endpoint: `${issuer}/auth/me`,
        jwks_uri: `${issuer}/.well-known/jwks.json`,
        revocation_endpoint: `${issuer}/auth/logout`,
        introspection_endpoint: `${issuer}/auth/introspect`,

        grant_types_supported: [
            'urn:ietf:params:oauth:grant-type:otp',
            'refresh_token',
        ],

        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        token_endpoint_auth_methods_supported: [
            'client_secret_post',
            'none',
        ],

        scopes_supported: ['openid', 'profile'],
        claims_supported: [
            'sub',
            'iss',
            'aud',
            'exp',
            'iat',
            'at_hash',
            'email_verified',
            'name',
            'preferred_username',
        ],

        service_documentation: `${issuer}/`,
    };

    return new Response(JSON.stringify(config), {
        status: 200,
        headers: {
            ...getCorsHeadersRecord(env, request),
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600',
        },
    });
}
