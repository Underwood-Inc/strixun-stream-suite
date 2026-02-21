/**
 * Authentication Utilities
 * 
 * Shared authentication functions for Suite API worker.
 * RS256 via JWKS only (OIDC).
 */

import { extractAuth } from '@strixun/api-framework';

/**
 * Hash email for storage key (SHA-256)
 */
export async function hashEmail(email) {
    const encoder = new TextEncoder();
    const data = encoder.encode(email.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Authenticate request via RS256 OIDC.
 * Extracts token from HttpOnly cookie or Authorization header,
 * then verifies RS256 via JWKS.
 */
export async function authenticateRequest(request, env, requireCsrf = false) {
    const auth = await extractAuth(request, env);
    if (!auth || !auth.customerId) {
        return null;
    }

    if (requireCsrf) {
        const csrfHeader = request.headers.get('X-CSRF-Token');
        const payload = decodeJWTPayload(auth.jwtToken);
        if (!csrfHeader || !payload || csrfHeader !== payload.csrf) {
            return null;
        }
    }

    return {
        userId: auth.customerId,
        customerId: auth.customerId,
        jwtToken: auth.jwtToken,
    };
}

/**
 * Decode JWT payload without re-verifying (safe after extractAuth has verified).
 */
function decodeJWTPayload(token) {
    if (!token) return null;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        return JSON.parse(atob(b64));
    } catch {
        return null;
    }
}
