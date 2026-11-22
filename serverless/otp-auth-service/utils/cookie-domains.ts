/**
 * Cookie Domains Utility
 * 
 * Extracts unique root domains from ALLOWED_ORIGINS for multi-domain SSO.
 * Returns all root domains to set multiple cookies.
 */

interface Env {
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

interface Customer {
    config?: {
        allowedOrigins?: string[];
        [key: string]: any;
    };
    [key: string]: any;
}

/**
 * Extract root domain from hostname
 * 
 * Examples:
 * - mods.idling.app → .idling.app
 * - short.army → .short.army
 * - www.example.com → .example.com
 */
function extractRootDomain(hostname: string): string {
    const parts = hostname.split('.');
    
    // If only 1 part (e.g., localhost), return as-is
    if (parts.length === 1) {
        return hostname;
    }
    
    // Take last 2 parts and prepend dot
    const rootDomain = parts.slice(-2).join('.');
    return `.${rootDomain}`;
}

/** Public helper for session bridge target validation. */
export function extractRootDomainFromHostname(hostname: string): string {
    const host = hostname.toLowerCase().split(':')[0];
    if (host === 'localhost' || host === '127.0.0.1') {
        return 'localhost';
    }
    return extractRootDomain(host);
}

function requestHostname(request: Request): string {
    const host = request.headers.get('Host');
    if (host) {
        return host.split(':')[0].toLowerCase();
    }
    const origin = request.headers.get('Origin');
    if (origin) {
        try {
            return new URL(origin).hostname.toLowerCase();
        } catch {
            // ignore
        }
    }
    try {
        return new URL(request.url).hostname.toLowerCase();
    } catch {
        return '';
    }
}

/**
 * Cookie Domain= for the browser host that invoked this request (single TLD only).
 * Used when minting cookies on short.army without leaking .idling.app Set-Cookie lines.
 */
export function getCookieDomainForRequestHost(request: Request, env: Env): string {
    if (env.ENVIRONMENT === 'development') {
        return 'localhost';
    }
    const hostname = requestHostname(request);
    if (!hostname) {
        throw new Error('Cannot resolve request hostname');
    }
    const domain = extractRootDomainFromHostname(hostname);
    const allowed = new Set(getCookieDomains(env, null));
    if (!allowed.has(domain)) {
        throw new Error(`Host ${hostname} is not in ALLOWED_ORIGINS cookie domains`);
    }
    return domain;
}

/**
 * Get all unique root domains from ALLOWED_ORIGINS
 * 
 * Returns array of domains to set cookies for.
 * This enables SSO across ALL domains in ALLOWED_ORIGINS.
 * 
 * @param env - Worker environment
 * @param customer - Customer/tenant object (optional)
 * @returns Array of root domains (e.g., ['.idling.app', '.short.army'])
 */
export function getCookieDomains(env: Env, customer: Customer | null = null): string[] {
    // Development: return localhost only when explicitly development
    // CRITICAL: env.ENVIRONMENT undefined (e.g. default wrangler deploy) must NOT yield localhost,
    // or cookie Domain=localhost breaks mods-api SSO (cookie never sent to mods-api.idling.app)
    if (env.ENVIRONMENT === 'development') {
        return ['localhost'];
    }
    
    // CRITICAL: env.ALLOWED_ORIGINS is ALWAYS checked first for cookie domains
    // Cookie domains use env.ALLOWED_ORIGINS only (not customer config) to enable SSO across all allowed origins
    let allowedOrigins: string[] = [];
    
    if (env.ALLOWED_ORIGINS) {
        allowedOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(o => o.length > 0);
    }
    
    if (allowedOrigins.length === 0) {
        console.error('[Cookie Domains] ALLOWED_ORIGINS not configured');
        throw new Error('ALLOWED_ORIGINS not configured');
    }
    
    // Extract unique root domains
    const rootDomains = new Set<string>();
    
    for (const origin of allowedOrigins) {
        try {
            const url = new URL(origin);
            const hostname = url.hostname;
            
            // Skip localhost/IP addresses
            if (hostname === 'localhost' || hostname === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
                continue;
            }
            
            const rootDomain = extractRootDomain(hostname);
            rootDomains.add(rootDomain);
        } catch (error) {
            console.warn('[Cookie Domains] Failed to parse origin:', origin, error);
        }
    }
    
    const domains = Array.from(rootDomains);
    
    console.log('[Cookie Domains] Extracted domains:', {
        allowedOrigins,
        cookieDomains: domains,
    });
    
    return domains;
}
