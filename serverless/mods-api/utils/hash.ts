/**
 * File integrity hash utilities
 * Calculates SHA-256 hashes for file verification
 */

/**
 * Calculate SHA-256 hash of a file or ArrayBuffer
 * Returns hex-encoded hash string
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
 * Generate Strixun-verified hash identifier
 * Format: strixun:sha256:<hash>
 * This marker ties the hash back to Strixun's verification service
 */
export function formatStrixunHash(hash: string): string {
    return `strixun:sha256:${hash}`;
}

/**
 * Parse Strixun hash identifier
 * Returns the raw SHA-256 hash if valid, null otherwise
 */
export function parseStrixunHash(identifier: string): string | null {
    if (!identifier.startsWith('strixun:sha256:')) {
        return null;
    }
    const hash = identifier.replace('strixun:sha256:', '');
    // Validate hex format (64 characters for SHA-256)
    if (!/^[a-f0-9]{64}$/i.test(hash)) {
        return null;
    }
    return hash.toLowerCase();
}

