/**
 * IP Address Utilities
 * 
 * Extracts client IP address from request headers with fallback support
 */

/**
 * Get client IP address from request headers
 * 
 * Priority:
 * 1. CF-Connecting-IP (Cloudflare - most reliable, cannot be spoofed)
 * 2. X-Forwarded-For (first IP in chain, may be spoofed)
 * 3. X-Real-IP (some proxies)
 * 4. 'unknown' (fallback)
 * 
 * @param request - HTTP request
 * @returns Client IP address or 'unknown'
 */
export function getClientIP(request: Request | null | undefined): string {
    if (!request) {
        return 'unknown';
    }
    
    // CF-Connecting-IP is set by Cloudflare and is the authoritative source
    // It cannot be spoofed and represents the actual client IP
    const cfIP = request.headers.get('CF-Connecting-IP');
    if (cfIP) {
        return cfIP.trim();
    }
    
    // X-Forwarded-For may contain multiple IPs (proxy chain)
    // Take the first one (original client IP)
    const xForwardedFor = request.headers.get('X-Forwarded-For');
    if (xForwardedFor) {
        const ips = xForwardedFor.split(',').map(ip => ip.trim());
        if (ips.length > 0 && ips[0]) {
            return ips[0];
        }
    }
    
    // X-Real-IP is set by some reverse proxies
    const xRealIP = request.headers.get('X-Real-IP');
    if (xRealIP) {
        return xRealIP.trim();
    }
    
    return 'unknown';
}

/**
 * Check if an IP address is valid (not 'unknown' or empty)
 * 
 * @param ip - IP address to check
 * @returns true if IP is valid, false otherwise
 */
export function isValidIP(ip: string | null | undefined): boolean {
    return !!ip && ip !== 'unknown' && ip.trim().length > 0;
}

