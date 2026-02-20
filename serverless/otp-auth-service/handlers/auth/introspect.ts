/**
 * Token Introspection Handler (RFC 7662)
 *
 * POST /auth/introspect
 *
 * Allows resource servers (identified by a valid API key) to validate
 * an access token and retrieve its associated metadata. RS256 (OIDC) only.
 *
 * Per RFC 7662 §2.1, this endpoint REQUIRES authorization — callers must
 * present a valid API key via X-OTP-API-Key, and the body's client_id
 * must match the authenticated key's keyId to prevent cross-tenant
 * token scanning.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7662
 */

import { getCorsHeadersRecord } from '../../utils/cors.js';
import { hashEmail } from '../../utils/crypto.js';
import { getSigningContext, verifyAsymmetricJWT, importPublicKey } from '../../utils/asymmetric-jwt.js';
import { entityKey } from '@strixun/kv-entities';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    OIDC_SIGNING_KEY?: string;
    [key: string]: any;
}

interface IntrospectCallerAuth {
    keyId: string;
    customerId: string;
}

/**
 * @param callerAuth - Pre-authenticated API key identity from the router.
 *                     If null, the request is rejected (RFC 7662 §2.1).
 */
export async function handleIntrospect(
    request: Request,
    env: Env,
    callerAuth: IntrospectCallerAuth | null,
): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }

    // RFC 7662 §2.1: "To prevent token scanning attacks, the endpoint MUST
    // also require some form of authorization to access this endpoint."
    if (!callerAuth) {
        return new Response(
            JSON.stringify({ error: 'unauthorized', error_description: 'A valid API key (X-OTP-API-Key) is required to call the introspection endpoint' }),
            { status: 401, headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' } },
        );
    }

    let body: { token?: string; client_id?: string };
    try {
        body = await request.json() as { token?: string; client_id?: string };
    } catch {
        return inactiveResponse(env, request);
    }

    const token = body.token;
    if (!token || typeof token !== 'string') {
        return inactiveResponse(env, request);
    }

    // Validate client_id matches the caller's authenticated key
    if (body.client_id && body.client_id !== callerAuth.keyId) {
        return inactiveResponse(env, request);
    }

    // Verify the token via RS256 (OIDC)
    let payload: Record<string, unknown> | null = null;
    try {
        const ctx = await getSigningContext(env);
        const pubKey = await importPublicKey(ctx.publicJwk);
        payload = await verifyAsymmetricJWT(token, pubKey);
    } catch {
        // RS256 verification failed
    }

    if (!payload) {
        return inactiveResponse(env, request);
    }

    // Check the JWT deny-list (tokens revoked via /auth/logout)
    const customerId = (payload.customerId || payload.sub) as string | undefined;
    if (customerId) {
        try {
            const tokenHash = await hashEmail(token);
            const denyListKey = entityKey('otp-auth', 'jwt-denylist', `${customerId}_${tokenHash}`).key;
            const denied = await env.OTP_AUTH_KV.get(denyListKey);
            if (denied) {
                return inactiveResponse(env, request);
            }
        } catch {
            // Deny-list check failure should not block introspection
        }
    }

    // RFC 7662 introspection response
    const response: Record<string, unknown> = {
        active: true,
        sub: payload.sub,
        client_id: payload.client_id ?? payload.keyId ?? null,
        scope: payload.scope ?? 'openid profile',
        token_type: 'Bearer',
        exp: payload.exp,
        iat: payload.iat,
        iss: payload.iss,
        aud: payload.aud,
        email_verified: payload.email_verified,
        customerId: payload.customerId,
    };

    return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
    });
}

function inactiveResponse(env: Env, request: Request): Response {
    return new Response(JSON.stringify({ active: false }), {
        status: 200,
        headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
    });
}
