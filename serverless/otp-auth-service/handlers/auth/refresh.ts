/**
 * Refresh Token Handler
 *
 * POST /auth/refresh -- exchanges an opaque refresh token (HttpOnly cookie)
 * for a new access token + rotated refresh token.
 *
 * Rotation: every successful refresh invalidates the old token and issues
 * a new one. The absolute expiry (7 days from original login) is inherited
 * across rotations so there is a hard cap on session extension.
 */

import { entityKey } from '@strixun/kv-entities';
import { hashEmail } from '../../utils/crypto.js';
import { getClientIP } from '../../utils/ip.js';
import { createFingerprintHash } from '@strixun/api-framework';
import { getSigningContext, signJWT, computeHashClaim } from '../../utils/asymmetric-jwt.js';
import { getCorsHeadersRecord } from '../../utils/cors.js';
import { getCookieDomains } from '../../utils/cookie-domains.js';
import { ACCESS_TOKEN_TTL_SECONDS, SESSION_TTL_SECONDS } from './jwt-creation.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    ENVIRONMENT?: string;
    JWT_ISSUER?: string;
    AUTH_SERVICE_URL?: string;
    [key: string]: any;
}

interface RefreshTokenData {
    customerId: string;
    email: string; // plaintext lowercase -- server-side only, carried to session KV on refresh
    absoluteExpiresAt: string;
    createdAt: string;
    ipAddress: string;
    keyId: string | null;
    ssoScope: string[];
}

interface SessionData {
    customerId: string;
    email: string;
    token: string;
    expiresAt: string;
    createdAt: string;
    ipAddress: string;
    userAgent?: string;
    country?: string;
    fingerprint?: string;
}

/**
 * Generate a cryptographically secure opaque refresh token (64 random bytes, base64url).
 */
function generateRefreshToken(): string {
    const bytes = new Uint8Array(64);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function generateJWTId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateCSRFToken(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Resolve cookie domains to set.
 * NOTE: wrangler dev with [[routes]] rewrites request.url hostname to the
 * production domain even in dev, so we MUST check env.ENVIRONMENT explicitly.
 */
function resolveCookieDomains(env: Env, _request: Request): string[] {
    if (env.ENVIRONMENT !== 'production') {
        return ['localhost'];
    }
    return getCookieDomains(env, null);
}

export async function handleRefresh(request: Request, env: Env): Promise<Response> {
    try {
        // 1. Extract refresh_token from cookie first, then fall back to request body.
        //    Body fallback is necessary for file:// test pages that cannot store cookies.
        const cookieHeader = request.headers.get('Cookie');
        let rawToken: string | null = null;

        if (cookieHeader) {
            const cookies = cookieHeader.split(';').map(c => c.trim());
            const rt = cookies.find(c => c.startsWith('refresh_token='));
            if (rt) rawToken = rt.substring('refresh_token='.length).trim();
        }

        if (!rawToken) {
            try {
                const body = await request.clone().json() as { refresh_token?: string };
                if (body?.refresh_token) rawToken = body.refresh_token;
            } catch { /* no body or not JSON -- fine */ }
        }

        if (!rawToken) {
            return new Response(JSON.stringify({ error: 'missing_refresh_token', error_description: 'No refresh_token cookie found' }), {
                status: 401,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }

        // 2. Hash and look up in KV
        const tokenHash = await hashEmail(rawToken);
        const refreshKey = entityKey('otp-auth', 'refresh-token', tokenHash).key;
        const stored = await env.OTP_AUTH_KV.get(refreshKey, { type: 'json' }) as RefreshTokenData | null;

        if (!stored) {
            return new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'Refresh token not found or already used' }), {
                status: 401,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }

        // 3. Validate absolute expiry has not passed
        const absoluteExpiresAt = new Date(stored.absoluteExpiresAt);
        const nowMs = Date.now();

        if (nowMs >= absoluteExpiresAt.getTime()) {
            await env.OTP_AUTH_KV.delete(refreshKey);
            return new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'Refresh token max lifetime exceeded — re-authenticate via OTP' }), {
                status: 401,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }

        // 4. Rotation: delete old refresh token
        await env.OTP_AUTH_KV.delete(refreshKey);

        const customerId = stored.customerId;
        const clientIP = getClientIP(request);
        const userAgent = request.headers.get('User-Agent') || undefined;
        const country = request.headers.get('CF-IPCountry') || undefined;
        const fingerprint = await createFingerprintHash(request);
        const now = Math.floor(nowMs / 1000);
        const expiresAt = new Date(nowMs + ACCESS_TOKEN_TTL_SECONDS * 1000);

        // Retrieve customer display name for the token response
        const customerKey = entityKey('otp-auth', 'customer', customerId).key;
        const customerRaw = await env.OTP_AUTH_KV.get(customerKey, { type: 'json' }) as { displayName?: string } | null;
        const displayName = customerRaw?.displayName || 'Unknown';

        // Check if customer is a super admin
        let isSuperAdmin = false;
        try {
            const { isSuperAdmin: checkSuperAdmin } = await import('../../utils/super-admin.js');
            isSuperAdmin = await checkSuperAdmin(customerId, env);
        } catch { /* best-effort */ }

        const issuer = env.JWT_ISSUER || env.AUTH_SERVICE_URL || (env.ENVIRONMENT === 'production' ? 'https://auth.idling.app' : 'http://localhost:8787');
        const csrfToken = generateCSRFToken();

        // 5. Generate new access token (RS256, 15 min)
        const signingContext = await getSigningContext(env);

        const accessPayload: Record<string, unknown> = {
            sub: customerId,
            iss: issuer,
            aud: stored.keyId || customerId,
            exp: Math.floor(expiresAt.getTime() / 1000),
            iat: now,
            jti: generateJWTId(),
            email_verified: true,
            scope: 'openid profile',
            customerId,
            client_id: stored.keyId || null,
            csrf: csrfToken,
            isSuperAdmin,
            displayName,
            keyId: stored.keyId || null,
            ssoScope: stored.ssoScope,
        };

        const accessToken = await signJWT(accessPayload, signingContext);

        // ID Token
        const atHash = await computeHashClaim(accessToken);
        const idTokenPayload: Record<string, unknown> = {
            iss: issuer,
            sub: customerId,
            aud: stored.keyId || customerId,
            exp: Math.floor(expiresAt.getTime() / 1000),
            iat: now,
            at_hash: atHash,
            email_verified: true,
        };
        const idToken = await signJWT(idTokenPayload, signingContext);

        // 6. Generate new refresh token (same absolute expiry)
        const newRawRefreshToken = generateRefreshToken();
        const newRefreshHash = await hashEmail(newRawRefreshToken);
        const newRefreshKey = entityKey('otp-auth', 'refresh-token', newRefreshHash).key;
        const refreshTtlSeconds = Math.max(1, Math.floor((absoluteExpiresAt.getTime() - nowMs) / 1000));

        const newRefreshData: RefreshTokenData = {
            customerId,
            email: stored.email,
            absoluteExpiresAt: stored.absoluteExpiresAt,
            createdAt: new Date().toISOString(),
            ipAddress: clientIP,
            keyId: stored.keyId,
            ssoScope: stored.ssoScope,
        };

        await env.OTP_AUTH_KV.put(newRefreshKey, JSON.stringify(newRefreshData), { expirationTtl: refreshTtlSeconds });

        // 7. Update session KV (reset 7-hour TTL)
        const sessionKey = entityKey('otp-auth', 'session', customerId).key;
        const sessionData: SessionData = {
            customerId,
            email: stored.email,
            token: await hashEmail(accessToken),
            expiresAt: expiresAt.toISOString(),
            createdAt: new Date().toISOString(),
            ipAddress: clientIP,
            userAgent,
            country,
            fingerprint,
        };

        await env.OTP_AUTH_KV.put(sessionKey, JSON.stringify(sessionData), { expirationTtl: SESSION_TTL_SECONDS });

        console.log(`[Refresh] ✓ Rotated tokens for customer: ${customerId} from IP: ${clientIP}`);

        // 8. Build token response body
        const tokenResponse = {
            access_token: accessToken,
            id_token: idToken,
            refresh_token: newRawRefreshToken,
            token_type: 'Bearer',
            expires_in: ACCESS_TOKEN_TTL_SECONDS,
            refresh_expires_in: refreshTtlSeconds,
            scope: 'openid profile',
            displayName,
            sub: customerId,
            email_verified: true,
            token: accessToken,
            customerId,
            expiresAt: expiresAt.toISOString(),
        };

        // 9. Set cookies
        const isProduction = env.ENVIRONMENT === 'production';
        const cookieDomains = resolveCookieDomains(env, request);
        const setCookieHeaders: string[] = [];

        // CRITICAL: SameSite=None required for cross-origin fetch (mods.idling.app → auth.idling.app)
        const sameSite = isProduction ? 'SameSite=None' : 'SameSite=Lax';
        for (const cookieDomain of cookieDomains) {
            const base = [
                `Domain=${cookieDomain}`,
                'Path=/',
                'HttpOnly',
                sameSite,
            ];
            if (isProduction) base.push('Secure');

            // refresh_token FIRST, auth_token LAST -- miniflare keeps only the
            // final Set-Cookie, and auth_token is the critical one for /auth/me
            setCookieHeaders.push([`refresh_token=${newRawRefreshToken}`, ...base, `Max-Age=${refreshTtlSeconds}`].join('; '));
            setCookieHeaders.push([`auth_token=${accessToken}`, ...base, `Max-Age=${ACCESS_TOKEN_TTL_SECONDS}`].join('; '));
        }

        const baseHeaders: Record<string, string> = {
            ...getCorsHeadersRecord(env, request),
            'Content-Type': 'application/json',
        };
        const headerEntries: [string, string][] = Object.entries(baseHeaders);
        for (const cookie of setCookieHeaders) {
            headerEntries.push(['Set-Cookie', cookie]);
        }

        return new Response(JSON.stringify(tokenResponse), {
            headers: headerEntries,
        });
    } catch (error: any) {
        console.error('[Refresh] Error:', error?.message, error?.stack);
        return new Response(JSON.stringify({ error: 'server_error', error_description: 'Refresh failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
