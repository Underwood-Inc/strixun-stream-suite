/**
 * JWKS Endpoint Handler
 *
 * Serves the JSON Web Key Set at /.well-known/jwks.json
 * per OIDC Discovery 1.0 Section 3.
 *
 * Exposes only the public signing key(s) so relying parties
 * can verify ID Tokens and access tokens without shared secrets.
 */

import { getSigningContext } from '../../utils/asymmetric-jwt.js';
import { getCorsHeadersRecord } from '../../utils/cors.js';
import type { JWKSet } from '../../utils/asymmetric-jwt.js';

interface Env {
    OIDC_SIGNING_KEY?: string;
    [key: string]: any;
}

/**
 * GET /.well-known/jwks.json
 *
 * Returns the JWK Set containing all active public signing keys.
 * Response is cacheable (keys change infrequently).
 */
export async function handleJWKS(request: Request, env: Env): Promise<Response> {
    try {
        const ctx = await getSigningContext(env);

        const jwks: JWKSet = {
            keys: [ctx.publicJwk],
        };

        return new Response(JSON.stringify(jwks), {
            status: 200,
            headers: {
                ...getCorsHeadersRecord(env, request),
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=3600',
            },
        });
    } catch (error: any) {
        console.error('[JWKS] Failed to serve JWKS:', error.message);
        return new Response(JSON.stringify({
            type: 'https://tools.ietf.org/html/rfc7231#section-6.6.1',
            title: 'Internal Server Error',
            status: 500,
            detail: 'Failed to load signing keys.',
        }), {
            status: 500,
            headers: {
                ...getCorsHeadersRecord(env, request),
                'Content-Type': 'application/problem+json',
            },
        });
    }
}
