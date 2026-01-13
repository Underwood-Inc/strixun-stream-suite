/**
 * Cookie utilities for HttpOnly cookie SSO
 * Client-side cookie reading and deletion
 */

/**
 * Get cookie value by name
 * Note: Can only read non-HttpOnly cookies from JavaScript
 * In production, auth_token is HttpOnly, so this won't work - it's for testing/fallback only
 */
export function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    
    return null;
}

/**
 * Delete cookie by setting expired date
 * Note: This is a best-effort client-side deletion
 * HttpOnly cookies can only be truly deleted by the server
 */
export function deleteCookie(name: string, domain: string, path: string): void {
    if (typeof document === 'undefined') return;
    
    document.cookie = `${name}=; Path=${path}; Domain=${domain}; Expires=Thu, 01 Jan 1970 00:00:01 GMT; Secure; HttpOnly; SameSite=Lax`;
}
