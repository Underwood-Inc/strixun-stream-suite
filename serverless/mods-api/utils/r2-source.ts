/**
 * R2 Source Detection and Tagging
 * 
 * Utilities to detect if R2 is using local storage vs cloud storage,
 * and to tag R2 objects with their source location.
 */

/**
 * Detect if R2 is using local storage (wrangler dev --local)
 * 
 * @param env - Environment variables
 * @param request - Optional request object to check hostname
 * @returns true if R2 is local, false if cloud
 */
export function isLocalR2(
    env: { ENVIRONMENT?: string },
    request?: Request
): boolean {
    // Check environment variable first (most reliable)
    const envMode = env.ENVIRONMENT?.toLowerCase();
    if (envMode === 'test' || envMode === 'development') {
        return true;
    }
    
    // Fallback: Check request hostname (for runtime detection)
    if (request) {
        const url = new URL(request.url);
        const isLocalhost = url.hostname === 'localhost' || 
                          url.hostname === '127.0.0.1' ||
                          url.hostname.startsWith('localhost:');
        if (isLocalhost) {
            return true;
        }
    }
    
    // Default to false (assume cloud/production)
    return false;
}

/**
 * Get R2 source tag for metadata
 * 
 * @param env - Environment variables
 * @param request - Optional request object
 * @returns Source tag string: 'local-dev' or 'cloud-production'
 */
export function getR2SourceTag(
    env: { ENVIRONMENT?: string },
    request?: Request
): string {
    return isLocalR2(env, request) ? 'local-dev' : 'cloud-production';
}

/**
 * Get detailed R2 source information for logging
 * 
 * @param env - Environment variables
 * @param request - Optional request object
 * @returns Detailed source information object
 */
export function getR2SourceInfo(
    env: { ENVIRONMENT?: string },
    request?: Request
): {
    isLocal: boolean;
    source: 'local-dev' | 'cloud-production';
    environment: string;
    hostname?: string;
    storageLocation?: string;
} {
    const isLocal = isLocalR2(env, request);
    const source = isLocal ? 'local-dev' : 'cloud-production';
    const envMode = env.ENVIRONMENT || 'production';
    
    let hostname: string | undefined;
    let storageLocation: string | undefined;
    
    if (request) {
        const url = new URL(request.url);
        hostname = url.hostname;
    }
    
    if (isLocal) {
        // Local storage location (wrangler dev --local)
        // Note: In Workers environment, we can't access process.env, so we use a generic path
        storageLocation = '.wrangler/state/v3/r2/ (local)';
    } else {
        storageLocation = 'Cloudflare R2 (cloud)';
    }
    
    return {
        isLocal,
        source,
        environment: envMode,
        hostname,
        storageLocation,
    };
}

/**
 * Add R2 source metadata to customMetadata object
 * 
 * @param existingMetadata - Existing customMetadata object
 * @param env - Environment variables
 * @param request - Optional request object
 * @returns Enhanced metadata with source tags
 */
export function addR2SourceMetadata(
    existingMetadata: Record<string, string> = {},
    env: { ENVIRONMENT?: string },
    request?: Request
): Record<string, string> {
    const sourceInfo = getR2SourceInfo(env, request);
    
    return {
        ...existingMetadata,
        'r2-source': sourceInfo.source,
        'r2-environment': sourceInfo.environment,
        'r2-is-local': sourceInfo.isLocal ? 'true' : 'false',
        'r2-storage-location': sourceInfo.storageLocation || 'unknown',
        'r2-tagged-at': new Date().toISOString(),
    };
}

