/**
 * Cross-registrable-domain session bridge (idling.app ↔ short.army).
 *
 * Browsers never send .idling.app HttpOnly cookies to short.army. This flow:
 * 1. POST /auth/session/bridge-code on auth.idling.app (credentialed) — validates idling session server-side, returns a single-use opaque code (not a JWT).
 * 2. POST /auth/session/from-idling on the target host via /auth-api proxy — redeems code, mints fresh tokens, Set-Cookie for the request host only.
 */

import { entityKey } from '@strixun/kv-entities';
import { hashEmail } from '../../utils/crypto.js';
import { getClientIP } from '../../utils/ip.js';
import { createFingerprintHash } from '@strixun/api-framework';
import { getSigningContext, signJWT, computeHashClaim, verifyAsymmetricJWT, importPublicKey } from '../../utils/asymmetric-jwt.js';
import { getCorsHeadersRecord } from '../../utils/cors.js';
import { extractRootDomainFromHostname, getCookieDomainForRequestHost } from '../../utils/cookie-domains.js';
import { checkIPRateLimit } from '../../services/rate-limit.js';
import { getCustomerCached } from '../../utils/cache.js';
import { setLastSuccessfulAuth } from '../../services/rate-limit.js';
import { ACCESS_TOKEN_TTL_SECONDS, SESSION_TTL_SECONDS } from './jwt-creation.js';

const BRIDGE_CODE_TTL_SECONDS = 120;
const BRIDGE_RATE_LIMIT_PER_HOUR = 30;

interface Env {
    OTP_AUTH_KV: KVNamespace;
    ENVIRONMENT?: string;
    JWT_ISSUER?: string;
    AUTH_SERVICE_URL?: string;
    [key: string]: unknown;
}

interface BridgeCodeRecord {
    customerId: string;
    email: string;
    targetCookieDomain: string;
    absoluteExpiresAt: string;
    keyId: string | null;
    ssoScope: string[];
}

interface SessionData {
    customerId: string;
    email: string;
    token: string;
    expiresAt: string;
    createdAt: string;
    ipAddress?: string;
    userAgent?: string;
    country?: string;
    fingerprint?: string;
}

interface RefreshTokenData {
    customerId: string;
    email: string;
    absoluteExpiresAt: string;
    createdAt: string;
    ipAddress: string;
    keyId: string | null;
    ssoScope: string[];
}

function jsonResponse(
    body: Record<string, unknown>,
    status: number,
    env: Env,
    request: Request,
    extraHeaders?: [string, string][],
): Response {
    const baseHeaders: Record<string, string> = {
        ...getCorsHeadersRecord(env, request),
        'Content-Type': 'application/json',
    };
    const entries: [string, string][] = Object.entries(baseHeaders);
    if (extraHeaders) {
        for (const pair of extraHeaders) {
            entries.push(pair);
        }
    }
    return new Response(JSON.stringify(body), { status, headers: entries });
}

function generateOpaqueCode(): string {
    const bytes = new Uint8Array(48);
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
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

function generateCSRFToken(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

function generateRefreshToken(): string {
    const bytes = new Uint8Array(64);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function parseAuthToken(cookieHeader: string | null): string | null {
    if (!cookieHeader) return null;
    const cookies = cookieHeader.split(';').map((c) => c.trim());
    const authCookie = cookies.find((c) => c.startsWith('auth_token='));
    if (!authCookie) return null;
    return authCookie.substring('auth_token='.length).trim();
}

function parseRefreshToken(cookieHeader: string | null): string | null {
    if (!cookieHeader) return null;
    const cookies = cookieHeader.split(';').map((c) => c.trim());
    const rt = cookies.find((c) => c.startsWith('refresh_token='));
    if (!rt) return null;
    return rt.substring('refresh_token='.length).trim();
}

async function validateAccessSession(
    token: string,
    env: Env,
): Promise<{ customerId: string; email: string; absoluteExpiresAt: string; keyId: string | null; ssoScope: string[] } | null> {
    let payload: { customerId?: string; sub?: string; keyId?: string | null; ssoScope?: string[] } | null = null;
    try {
        const ctx = await getSigningContext(env);
        const pubKey = await importPublicKey(ctx.publicJwk);
        const rs256Result = await verifyAsymmetricJWT(token, pubKey);
        if (rs256Result) payload = rs256Result as typeof payload;
    } catch {
        return null;
    }
    if (!payload?.customerId || payload.sub !== payload.customerId) {
        return null;
    }
    const sessionKey = entityKey('otp-auth', 'session', payload.customerId).key;
    const sessionData = (await env.OTP_AUTH_KV.get(sessionKey, { type: 'json' })) as SessionData | null;
    if (!sessionData) return null;
    const expiresAt = new Date(sessionData.expiresAt);
    if (expiresAt <= new Date()) return null;
    return {
        customerId: payload.customerId,
        email: sessionData.email,
        absoluteExpiresAt: sessionData.expiresAt,
        keyId: (payload.keyId as string | null) ?? null,
        ssoScope: Array.isArray(payload.ssoScope) ? (payload.ssoScope as string[]) : [],
    };
}

async function validateRefreshSession(
    rawRefresh: string,
    env: Env,
): Promise<{ customerId: string; email: string; absoluteExpiresAt: string; keyId: string | null; ssoScope: string[] } | null> {
    const tokenHash = await hashEmail(rawRefresh);
    const refreshKey = entityKey('otp-auth', 'refresh-token', tokenHash).key;
    const stored = (await env.OTP_AUTH_KV.get(refreshKey, { type: 'json' })) as RefreshTokenData | null;
    if (!stored) return null;
    if (Date.now() >= new Date(stored.absoluteExpiresAt).getTime()) return null;
    return {
        customerId: stored.customerId,
        email: stored.email,
        absoluteExpiresAt: stored.absoluteExpiresAt,
        keyId: stored.keyId,
        ssoScope: stored.ssoScope,
    };
}

async function resolveActiveSession(
    request: Request,
    env: Env,
): Promise<{ customerId: string; email: string; absoluteExpiresAt: string; keyId: string | null; ssoScope: string[] } | null> {
    const cookieHeader = request.headers.get('Cookie');
    const accessToken = parseAuthToken(cookieHeader);
    if (accessToken) {
        const fromAccess = await validateAccessSession(accessToken, env);
        if (fromAccess) return fromAccess;
    }
    const refreshRaw = parseRefreshToken(cookieHeader);
    if (refreshRaw) {
        return validateRefreshSession(refreshRaw, env);
    }
    return null;
}

function normalizeTargetHost(raw: string): string | null {
    const trimmed = raw.trim().toLowerCase();
    if (!trimmed || trimmed.includes('/') || trimmed.includes(':')) {
        return null;
    }
    if (trimmed === 'short.army' || trimmed.endsWith('.short.army')) {
        return 'short.army';
    }
    if (trimmed === 'idling.app' || trimmed.endsWith('.idling.app')) {
        return 'idling.app';
    }
    return null;
}

/**
 * POST /auth/session/bridge-code
 * Body: { target_host: "short.army" }
 */
export async function handleIssueSessionBridge(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
        return jsonResponse({ error: 'method_not_allowed' }, 405, env, request);
    }

    const clientIP = getClientIP(request);
    const rate = await checkIPRateLimit(
        clientIP,
        null,
        getCustomerCached,
        env,
        'session-bridge-issue',
        BRIDGE_RATE_LIMIT_PER_HOUR,
    );
    if (!rate.allowed) {
        return jsonResponse({ error: 'rate_limit_exceeded', error_description: rate.reason }, 429, env, request);
    }

    let body: { target_host?: string };
    try {
        body = (await request.json()) as { target_host?: string };
    } catch {
        return jsonResponse({ error: 'invalid_json' }, 400, env, request);
    }

    const targetHost = body.target_host ? normalizeTargetHost(body.target_host) : null;
    if (!targetHost) {
        return jsonResponse({ error: 'invalid_target_host' }, 400, env, request);
    }

    const session = await resolveActiveSession(request, env);
    if (!session) {
        return jsonResponse({ error: 'no_idling_session' }, 401, env, request);
    }

    const targetCookieDomain = extractRootDomainFromHostname(targetHost);
    const bridgeCode = generateOpaqueCode();
    const bridgeHash = await hashEmail(bridgeCode);
    const bridgeKey = entityKey('otp-auth', 'session-bridge', bridgeHash).key;

    const record: BridgeCodeRecord = {
        customerId: session.customerId,
        email: session.email,
        targetCookieDomain,
        absoluteExpiresAt: session.absoluteExpiresAt,
        keyId: session.keyId,
        ssoScope: session.ssoScope,
    };

    await env.OTP_AUTH_KV.put(bridgeKey, JSON.stringify(record), { expirationTtl: BRIDGE_CODE_TTL_SECONDS });

    return jsonResponse({ bridge_code: bridgeCode, expires_in: BRIDGE_CODE_TTL_SECONDS }, 200, env, request);
}

async function mintHostScopedCookies(
    request: Request,
    env: Env,
    record: BridgeCodeRecord,
    cookieDomain: string,
): Promise<{ accessToken: string; setCookieHeaders: string[] }> {
    const customerId = record.customerId;
    const clientIP = getClientIP(request);
    const userAgent = request.headers.get('User-Agent') || undefined;
    const country = request.headers.get('CF-IPCountry') || undefined;
    const fingerprint = await createFingerprintHash(request);
    const nowMs = Date.now();
    const absoluteExpiresAt = new Date(record.absoluteExpiresAt);
    const now = Math.floor(nowMs / 1000);
    const expiresAt = new Date(nowMs + ACCESS_TOKEN_TTL_SECONDS * 1000);

    let displayName = 'Unknown';
    try {
        const { fetchDisplayNameByCustomerId } = await import('@strixun/api-framework');
        const fetched = await fetchDisplayNameByCustomerId(customerId, env);
        if (fetched?.trim()) displayName = fetched;
    } catch (error) {
        console.warn('[SessionBridge] display name fetch failed:', error);
    }

    let isSuperAdmin = false;
    try {
        const { isSuperAdmin: checkSuperAdmin } = await import('../../utils/super-admin.js');
        isSuperAdmin = await checkSuperAdmin(customerId, env);
    } catch {
        /* best-effort */
    }

    const issuer =
        env.JWT_ISSUER ||
        env.AUTH_SERVICE_URL ||
        (env.ENVIRONMENT === 'production' ? 'https://auth.idling.app' : 'http://localhost:8787');
    const signingContext = await getSigningContext(env);
    const csrfToken = generateCSRFToken();

    const accessPayload: Record<string, unknown> = {
        sub: customerId,
        iss: issuer,
        aud: record.keyId || customerId,
        exp: Math.floor(expiresAt.getTime() / 1000),
        iat: now,
        jti: generateJWTId(),
        email_verified: true,
        scope: (await import('../../shared/oidc-constants.js')).getDefaultScope(),
        customerId,
        client_id: record.keyId || null,
        csrf: csrfToken,
        isSuperAdmin,
        displayName,
        keyId: record.keyId || null,
        ssoScope: record.ssoScope,
    };

    const accessToken = await signJWT(accessPayload, signingContext);
    const atHash = await computeHashClaim(accessToken);
    const idTokenPayload: Record<string, unknown> = {
        iss: issuer,
        sub: customerId,
        aud: record.keyId || customerId,
        exp: Math.floor(expiresAt.getTime() / 1000),
        iat: now,
        at_hash: atHash,
        email_verified: true,
    };
    await signJWT(idTokenPayload, signingContext);

    const newRawRefreshToken = generateRefreshToken();
    const newRefreshHash = await hashEmail(newRawRefreshToken);
    const newRefreshKey = entityKey('otp-auth', 'refresh-token', newRefreshHash).key;
    const refreshTtlSeconds = Math.max(1, Math.floor((absoluteExpiresAt.getTime() - nowMs) / 1000));

    const newRefreshData: RefreshTokenData = {
        customerId,
        email: record.email,
        absoluteExpiresAt: record.absoluteExpiresAt,
        createdAt: new Date().toISOString(),
        ipAddress: clientIP,
        keyId: record.keyId,
        ssoScope: record.ssoScope,
    };
    await env.OTP_AUTH_KV.put(newRefreshKey, JSON.stringify(newRefreshData), { expirationTtl: refreshTtlSeconds });

    const sessionKey = entityKey('otp-auth', 'session', customerId).key;
    const sessionData: SessionData = {
        customerId,
        email: record.email,
        token: await hashEmail(accessToken),
        expiresAt: record.absoluteExpiresAt,
        createdAt: new Date().toISOString(),
        ipAddress: clientIP,
        userAgent,
        country,
        fingerprint,
    };
    await env.OTP_AUTH_KV.put(sessionKey, JSON.stringify(sessionData), { expirationTtl: SESSION_TTL_SECONDS });

    const emailHash = await hashEmail(record.email);
    setLastSuccessfulAuth(emailHash, customerId, env).catch((err) =>
        console.warn('[SessionBridge] setLastSuccessfulAuth failed:', err?.message),
    );

    const isProduction = env.ENVIRONMENT === 'production';
    const sameSite = isProduction ? 'SameSite=None' : 'SameSite=Lax';
    const base = [`Domain=${cookieDomain}`, 'Path=/', 'HttpOnly', sameSite];
    if (isProduction) base.push('Secure');

    const setCookieHeaders: string[] = [
        [`refresh_token=${newRawRefreshToken}`, ...base, `Max-Age=${refreshTtlSeconds}`].join('; '),
        [`auth_token=${accessToken}`, ...base, `Max-Age=${ACCESS_TOKEN_TTL_SECONDS}`].join('; '),
    ];

    return { accessToken, setCookieHeaders };
}

/**
 * POST /auth/session/from-idling
 * Body: { bridge_code: string }
 */
export async function handleRedeemSessionBridge(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
        return jsonResponse({ error: 'method_not_allowed' }, 405, env, request);
    }

    const clientIP = getClientIP(request);
    const rate = await checkIPRateLimit(
        clientIP,
        null,
        getCustomerCached,
        env,
        'session-bridge-redeem',
        BRIDGE_RATE_LIMIT_PER_HOUR,
    );
    if (!rate.allowed) {
        return jsonResponse({ error: 'rate_limit_exceeded', error_description: rate.reason }, 429, env, request);
    }

    let body: { bridge_code?: string };
    try {
        body = (await request.json()) as { bridge_code?: string };
    } catch {
        return jsonResponse({ error: 'invalid_json' }, 400, env, request);
    }

    const bridgeCode = typeof body.bridge_code === 'string' ? body.bridge_code.trim() : '';
    if (!bridgeCode || bridgeCode.length < 32) {
        return jsonResponse({ error: 'invalid_bridge_code' }, 400, env, request);
    }

    const bridgeHash = await hashEmail(bridgeCode);
    const bridgeKey = entityKey('otp-auth', 'session-bridge', bridgeHash).key;
    const record = (await env.OTP_AUTH_KV.get(bridgeKey, { type: 'json' })) as BridgeCodeRecord | null;
    if (!record) {
        return jsonResponse({ error: 'bridge_code_invalid_or_expired' }, 401, env, request);
    }

    await env.OTP_AUTH_KV.delete(bridgeKey);

    let requestCookieDomain: string;
    try {
        requestCookieDomain = getCookieDomainForRequestHost(request, env);
    } catch {
        return jsonResponse({ error: 'host_not_allowed' }, 403, env, request);
    }

    if (requestCookieDomain !== record.targetCookieDomain) {
        return jsonResponse({ error: 'bridge_target_mismatch' }, 403, env, request);
    }

    const { setCookieHeaders } = await mintHostScopedCookies(request, env, record, requestCookieDomain);
    const headerTuples: [string, string][] = [];
    for (const cookie of setCookieHeaders) {
        headerTuples.push(['Set-Cookie', cookie]);
    }

    return jsonResponse({ ok: true, customerId: record.customerId }, 200, env, request, headerTuples);
}