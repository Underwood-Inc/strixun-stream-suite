/**
 * Authentication utilities
 * Delegates to auth service for verification (same as auth dashboard).
 * Extracts token from cookie, calls auth /auth/me with Bearer - uses identical verification path.
 */

function extractTokenFromRequest(request: Request): string | null {
    const cookieHeader = request.headers.get('Cookie');
    if (cookieHeader) {
        const cookies = cookieHeader.split(';').map((c) => c.trim());
        const authCookie = cookies.find((c) => c.startsWith('auth_token='));
        if (authCookie) {
            return authCookie.substring('auth_token='.length).trim();
        }
    }
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.substring(7).trim();
    }
    return null;
}

/**
 * Authenticate request by delegating to auth service.
 * Same verification path as auth dashboard - no JWKS, no key mismatch.
 */
export async function authenticateRequest(request: Request, env: Env): Promise<AuthResult | null> {
    const token = extractTokenFromRequest(request);
    if (!token || token.startsWith('otp_live_sk_') || token.startsWith('otp_test_sk_')) {
        return null;
    }

    const authUrl = env.JWT_ISSUER || env.AUTH_SERVICE_URL || 'https://auth.idling.app';
    try {
        const res = await fetch(`${authUrl}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { customerId?: string; isSuperAdmin?: boolean };
        if (!data?.customerId) return null;
        return { customerId: data.customerId, jwtToken: token, isSuperAdmin: data.isSuperAdmin ?? false };
    } catch (error) {
        console.error('[ModsAPI Auth] Verification failed:', error);
        return null;
    }
}

export type { JWTPayload } from '@strixun/api-framework/jwt';

export interface AuthResult {
    customerId: string;
    jwtToken: string;
    isSuperAdmin: boolean;
}

interface Env {
    JWT_ISSUER?: string;
    AUTH_SERVICE_URL?: string;
    AUTH_API_URL?: string;
    [key: string]: any;
}
