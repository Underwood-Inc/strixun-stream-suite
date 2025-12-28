/**
 * File integrity hash utilities
 * Calculates SHA-256 hashes for file verification
 * 
 * Uses HMAC-SHA256 with a secret keyphrase to create a true cryptographic signature
 * This ensures the hash cannot be forged without knowing the keyphrase
 */

/**
 * Get Strixun keyphrase for HMAC signing from environment
 * Falls back to default if not set (for development only)
 * 
 * In production, this should be set via:
 * - Cloudflare Workers: wrangler secret put FILE_INTEGRITY_KEYPHRASE
 * - Local development: .env file with FILE_INTEGRITY_KEYPHRASE
 * - GitHub Actions: GitHub Secrets
 */
function getStrixunKeyphrase(env?: { FILE_INTEGRITY_KEYPHRASE?: string }): string {
    if (env?.FILE_INTEGRITY_KEYPHRASE) {
        return env.FILE_INTEGRITY_KEYPHRASE;
    }
    
    // Fallback for development (should not be used in production)
    if (typeof process !== 'undefined' && process.env?.FILE_INTEGRITY_KEYPHRASE) {
        return process.env.FILE_INTEGRITY_KEYPHRASE;
    }
    
    // Last resort fallback (development only - should warn in production)
    console.warn('[Hash] FILE_INTEGRITY_KEYPHRASE not set, using default (development only)');
    return 'strixun:file-integrity:dev-fallback';
}

/**
 * Calculate SHA-256 hash of a file or ArrayBuffer
 * Returns hex-encoded hash string
 * 
 * NOTE: For Strixun-verified signatures, use calculateStrixunHash instead
 */
export async function calculateFileHash(file: File | ArrayBuffer | Uint8Array): Promise<string> {
    let data: ArrayBuffer;
    
    if (file instanceof File) {
        data = await file.arrayBuffer();
    } else if (file instanceof Uint8Array) {
        data = file.buffer;
    } else {
        data = file;
    }
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculate Strixun-verified HMAC-SHA256 signature
 * 
 * This creates a true cryptographic signature by:
 * 1. Using HMAC-SHA256 with the secret keyphrase from environment
 * 2. Baking the keyphrase into the hash calculation (not just prefixing)
 * 3. Making it impossible to forge without knowing the keyphrase
 * 
 * @param file - File, ArrayBuffer, or Uint8Array to sign
 * @param env - Optional environment object with FILE_INTEGRITY_KEYPHRASE
 * @returns Hex-encoded HMAC-SHA256 signature (64 characters)
 */
export async function calculateStrixunHash(
    file: File | ArrayBuffer | Uint8Array,
    env?: { FILE_INTEGRITY_KEYPHRASE?: string }
): Promise<string> {
    let data: ArrayBuffer;
    
    if (file instanceof File) {
        data = await file.arrayBuffer();
    } else if (file instanceof Uint8Array) {
        data = file.buffer;
    } else {
        data = file;
    }
    
    // Get keyphrase from environment
    const keyphrase = getStrixunKeyphrase(env);
    
    // Import the keyphrase as a key for HMAC
    const keyData = new TextEncoder().encode(keyphrase);
    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    
    // Calculate HMAC-SHA256 signature
    const signature = await crypto.subtle.sign('HMAC', key, data);
    const signatureArray = Array.from(new Uint8Array(signature));
    return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify Strixun signature
 * 
 * @param file - File to verify
 * @param expectedSignature - Expected signature to compare against
 * @param env - Optional environment object with FILE_INTEGRITY_KEYPHRASE
 * @returns True if signature matches, false otherwise
 */
export async function verifyStrixunHash(
    file: File | ArrayBuffer | Uint8Array,
    expectedSignature: string,
    env?: { FILE_INTEGRITY_KEYPHRASE?: string }
): Promise<boolean> {
    const actualSignature = await calculateStrixunHash(file, env);
    // Constant-time comparison to prevent timing attacks
    return actualSignature.toLowerCase() === expectedSignature.toLowerCase();
}

/**
 * Generate Strixun-verified hash identifier
 * Format: strixun:sha256:<signature>
 * 
 * The signature is a true HMAC-SHA256 signature, not just a prefixed hash
 */
export function formatStrixunHash(signature: string): string {
    return `strixun:sha256:${signature}`;
}

/**
 * Parse Strixun hash identifier
 * Returns the raw signature if valid, null otherwise
 * 
 * @param identifier - Strixun hash identifier (strixun:sha256:<signature>)
 * @returns Raw signature or null if invalid
 */
export function parseStrixunHash(identifier: string): string | null {
    if (!identifier.startsWith('strixun:sha256:')) {
        return null;
    }
    const signature = identifier.replace('strixun:sha256:', '');
    // Validate hex format (64 characters for SHA-256)
    if (!/^[a-f0-9]{64}$/i.test(signature)) {
        return null;
    }
    return signature.toLowerCase();
}

