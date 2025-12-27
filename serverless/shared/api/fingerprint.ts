/**
 * User-Agent Fingerprinting Utility
 * 
 * Provides device/browser fingerprinting for enhanced session security.
 * This enables device-level isolation for session restoration, preventing
 * unauthorized access when multiple devices share the same IP address.
 * 
 * Features:
 * - User-Agent string analysis
 * - Browser characteristics extraction
 * - Secure fingerprint hashing (SHA-256)
 * - Request header parsing
 * 
 * Usage:
 * ```typescript
 * import { createFingerprint, validateFingerprint } from '@strixun/api-framework/fingerprint';
 * 
 * // Create fingerprint from request
 * const fingerprint = await createFingerprint(request);
 * 
 * // Validate fingerprint matches
 * const isValid = await validateFingerprint(storedFingerprint, requestFingerprint);
 * ```
 */

/**
 * Fingerprint data structure
 */
export interface FingerprintData {
    /** User-Agent string */
    userAgent: string;
    /** Accept-Language header */
    acceptLanguage?: string;
    /** Accept-Encoding header */
    acceptEncoding?: string;
    /** Screen width (if available via custom header) */
    screenWidth?: string;
    /** Screen height (if available via custom header) */
    screenHeight?: string;
    /** Timezone (if available via custom header) */
    timezone?: string;
    /** Platform (extracted from User-Agent) */
    platform?: string;
    /** Browser name (extracted from User-Agent) */
    browser?: string;
    /** Browser version (extracted from User-Agent) */
    browserVersion?: string;
}

/**
 * Fingerprint hash (SHA-256)
 */
export type FingerprintHash = string;

/**
 * Extract browser/platform information from User-Agent string
 */
function parseUserAgent(userAgent: string): {
    platform?: string;
    browser?: string;
    browserVersion?: string;
} {
    const ua = userAgent.toLowerCase();
    
    // Platform detection
    let platform: string | undefined;
    if (ua.includes('windows')) {
        platform = 'windows';
    } else if (ua.includes('mac')) {
        platform = 'mac';
    } else if (ua.includes('linux')) {
        platform = 'linux';
    } else if (ua.includes('android')) {
        platform = 'android';
    } else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
        platform = 'ios';
    }
    
    // Browser detection
    let browser: string | undefined;
    let browserVersion: string | undefined;
    
    if (ua.includes('chrome') && !ua.includes('edg')) {
        browser = 'chrome';
        const match = ua.match(/chrome\/([\d.]+)/);
        browserVersion = match ? match[1] : undefined;
    } else if (ua.includes('firefox')) {
        browser = 'firefox';
        const match = ua.match(/firefox\/([\d.]+)/);
        browserVersion = match ? match[1] : undefined;
    } else if (ua.includes('safari') && !ua.includes('chrome')) {
        browser = 'safari';
        const match = ua.match(/version\/([\d.]+)/);
        browserVersion = match ? match[1] : undefined;
    } else if (ua.includes('edg')) {
        browser = 'edge';
        const match = ua.match(/edg\/([\d.]+)/);
        browserVersion = match ? match[1] : undefined;
    } else if (ua.includes('opera') || ua.includes('opr')) {
        browser = 'opera';
        const match = ua.match(/(?:opera|opr)\/([\d.]+)/);
        browserVersion = match ? match[1] : undefined;
    }
    
    return { platform, browser, browserVersion };
}

/**
 * Create fingerprint from HTTP request
 * 
 * Extracts browser/device characteristics from request headers to create
 * a unique fingerprint for the device. This fingerprint is used to validate
 * that session restoration requests come from the same device.
 * 
 * @param request - HTTP request object
 * @returns Fingerprint data object
 */
export function createFingerprint(request: Request): FingerprintData {
    const userAgent = request.headers.get('User-Agent') || '';
    const acceptLanguage = request.headers.get('Accept-Language') || undefined;
    const acceptEncoding = request.headers.get('Accept-Encoding') || undefined;
    
    // Extract custom headers (if client sends them)
    const screenWidth = request.headers.get('X-Screen-Width') || undefined;
    const screenHeight = request.headers.get('X-Screen-Height') || undefined;
    const timezone = request.headers.get('X-Timezone') || undefined;
    
    // Parse User-Agent for additional info
    const { platform, browser, browserVersion } = parseUserAgent(userAgent);
    
    return {
        userAgent,
        acceptLanguage,
        acceptEncoding,
        screenWidth,
        screenHeight,
        timezone,
        platform,
        browser,
        browserVersion,
    };
}

/**
 * Hash fingerprint data to create a secure, comparable hash
 * 
 * Uses SHA-256 to hash the fingerprint data. The hash is deterministic
 * (same input = same output) and can be used for comparison.
 * 
 * @param fingerprint - Fingerprint data object
 * @returns SHA-256 hash of the fingerprint
 */
export async function hashFingerprint(fingerprint: FingerprintData): Promise<FingerprintHash> {
    // Create a normalized string representation of the fingerprint
    // Order matters for consistency
    const normalized = JSON.stringify({
        userAgent: fingerprint.userAgent,
        acceptLanguage: fingerprint.acceptLanguage || '',
        acceptEncoding: fingerprint.acceptEncoding || '',
        screenWidth: fingerprint.screenWidth || '',
        screenHeight: fingerprint.screenHeight || '',
        timezone: fingerprint.timezone || '',
        platform: fingerprint.platform || '',
        browser: fingerprint.browser || '',
        browserVersion: fingerprint.browserVersion || '',
    });
    
    // Hash using SHA-256
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create and hash fingerprint from request in one step
 * 
 * Convenience function that combines createFingerprint and hashFingerprint.
 * 
 * @param request - HTTP request object
 * @returns Fingerprint hash
 */
export async function createFingerprintHash(request: Request): Promise<FingerprintHash> {
    const fingerprint = createFingerprint(request);
    return await hashFingerprint(fingerprint);
}

/**
 * Validate that two fingerprints match
 * 
 * Compares two fingerprint hashes using constant-time comparison
 * to prevent timing attacks.
 * 
 * @param storedFingerprint - Fingerprint hash stored in session
 * @param requestFingerprint - Fingerprint hash from current request
 * @returns true if fingerprints match, false otherwise
 */
export async function validateFingerprint(
    storedFingerprint: FingerprintHash | undefined,
    requestFingerprint: FingerprintHash
): Promise<boolean> {
    // If no stored fingerprint, validation fails (strict mode)
    if (!storedFingerprint) {
        return false;
    }
    
    // Constant-time comparison to prevent timing attacks
    if (storedFingerprint.length !== requestFingerprint.length) {
        return false;
    }
    
    let result = 0;
    for (let i = 0; i < storedFingerprint.length; i++) {
        result |= storedFingerprint.charCodeAt(i) ^ requestFingerprint.charCodeAt(i);
    }
    
    return result === 0;
}

/**
 * Validate fingerprint with lenient mode
 * 
 * In lenient mode, if stored fingerprint is missing, validation passes.
 * This is useful for backward compatibility with existing sessions that
 * don't have fingerprints yet.
 * 
 * @param storedFingerprint - Fingerprint hash stored in session
 * @param requestFingerprint - Fingerprint hash from current request
 * @param lenient - If true, missing stored fingerprint passes validation
 * @returns true if fingerprints match or lenient mode allows, false otherwise
 */
export async function validateFingerprintLenient(
    storedFingerprint: FingerprintHash | undefined,
    requestFingerprint: FingerprintHash,
    lenient: boolean = true
): Promise<boolean> {
    // If no stored fingerprint and lenient mode, allow (backward compatibility)
    if (!storedFingerprint && lenient) {
        return true;
    }
    
    // Otherwise, use strict validation
    return await validateFingerprint(storedFingerprint, requestFingerprint);
}

