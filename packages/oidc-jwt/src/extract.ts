/**
 * Token extraction from request.
 *
 * Cookie first (auth_token), then Authorization Bearer header.
 * Canonical pattern from auth service auth-routes.
 */

/**
 * Extract auth token from request (cookie or Bearer header).
 */
export function extractTokenFromRequest(request: Request): string | null {
    const cookieHeader = request.headers.get('Cookie');
    if (cookieHeader) {
        const cookies = cookieHeader.split(';').map(c => c.trim());
        const authCookie = cookies.find(c => c.startsWith('auth_token='));
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
 * Check if request has auth_token cookie (for HttpOnly detection).
 */
export function hasAuthTokenCookie(request: Request): boolean {
    const cookieHeader = request.headers.get('Cookie');
    return !!(cookieHeader && cookieHeader.includes('auth_token='));
}
