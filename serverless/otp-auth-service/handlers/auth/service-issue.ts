/**
 * Service-to-Service Token Issuance
 *
 * POST /auth/service/issue-token
 *
 * Allows trusted services (identified by X-Service-Key) to request a
 * standard RS256 access token for a given customerId. Used by services like
 * twitch-api and game-api that authenticate users externally (e.g. Twitch OAuth)
 * and need to mint an OIDC-compliant JWT without going through the OTP flow.
 *
 * Returns `{ token, expires_in }` -- no cookies, no refresh token.
 */

import { getCorsHeadersRecord } from '../../utils/cors.js';
import { getSigningContext, signJWT, computeHashClaim } from '../../utils/asymmetric-jwt.js';
import { ACCESS_TOKEN_TTL_SECONDS } from './jwt-creation.js';

interface Env {
    SERVICE_API_KEY?: string;
    JWT_ISSUER?: string;
    AUTH_SERVICE_URL?: string;
    ENVIRONMENT?: string;
    OTP_AUTH_KV: KVNamespace;
    [key: string]: any;
}

interface IssueTokenBody {
    customerId?: string;
}

export async function handleServiceIssueToken(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }

    const serviceKey = request.headers.get('X-Service-Key');
    if (!serviceKey || !env.SERVICE_API_KEY || serviceKey !== env.SERVICE_API_KEY) {
        return new Response(JSON.stringify({ error: 'Unauthorized', code: 'INVALID_SERVICE_KEY' }), {
            status: 401,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }

    let body: IssueTokenBody;
    try {
        body = await request.json() as IssueTokenBody;
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
            status: 400,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }

    const { customerId } = body;
    if (!customerId || typeof customerId !== 'string') {
        return new Response(JSON.stringify({ error: 'customerId is required' }), {
            status: 400,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }

    try {
        const issuer = env.JWT_ISSUER || env.AUTH_SERVICE_URL
            || (env.ENVIRONMENT === 'production' ? 'https://auth.idling.app' : 'http://localhost:8787');

        const now = Math.floor(Date.now() / 1000);
        const exp = now + ACCESS_TOKEN_TTL_SECONDS;

        const { isSuperAdmin: checkSuperAdmin } = await import('../../utils/super-admin.js');
        const isSuperAdmin = await checkSuperAdmin(customerId, env);

        const tokenPayload: Record<string, unknown> = {
            sub: customerId,
            iss: issuer,
            aud: customerId,
            exp,
            iat: now,
            jti: crypto.randomUUID(),
            email_verified: true,
            scope: 'openid profile',
            customerId,
            client_id: null,
            isSuperAdmin,
        };

        const signingContext = await getSigningContext(env);
        const accessToken = await signJWT(tokenPayload, signingContext);

        return new Response(JSON.stringify({
            token: accessToken,
            expires_in: ACCESS_TOKEN_TTL_SECONDS,
        }), {
            status: 200,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        console.error('[ServiceIssueToken] Failed to issue token:', error);
        return new Response(JSON.stringify({ error: 'Failed to issue token' }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}
