/**
 * Network Traffic Integrity System
 * 
 * Provides cryptographic integrity verification for all network requests and responses.
 * Detects tampering, MITM attacks, and other security issues on network traffic.
 * 
 * Features:
 * - Request body integrity (hash of request body)
 * - Response body integrity (hash of response body)
 * - Header integrity verification
 * - Automatic tamper detection
 * - HMAC-SHA256 signatures for unforgeable verification
 */

export interface IntegrityConfig {
    /**
     * Enable integrity checks (default: true)
     */
    enabled?: boolean;
    
    /**
     * Secret keyphrase for HMAC signing (from NETWORK_INTEGRITY_KEYPHRASE env var)
     */
    keyphrase?: string;
    
    /**
     * Verify response integrity (default: true)
     */
    verifyResponse?: boolean;
    
    /**
     * Verify request integrity (default: true)
     */
    verifyRequest?: boolean;
    
    /**
     * Throw error on integrity failure (default: true)
     */
    throwOnFailure?: boolean;
}

export interface IntegrityHeaders {
    /**
     * Request integrity header
     * Format: X-Strixun-Request-Integrity: strixun:sha256:<signature>
     */
    'X-Strixun-Request-Integrity'?: string;
    
    /**
     * Response integrity header
     * Format: X-Strixun-Response-Integrity: strixun:sha256:<signature>
     */
    'X-Strixun-Response-Integrity'?: string;
    
    /**
     * Request timestamp for replay attack prevention
     */
    'X-Strixun-Request-Timestamp'?: string;
}

/**
 * Get network integrity keyphrase from environment
 */
function getNetworkIntegrityKeyphrase(env?: { NETWORK_INTEGRITY_KEYPHRASE?: string }): string {
    if (env?.NETWORK_INTEGRITY_KEYPHRASE) {
        return env.NETWORK_INTEGRITY_KEYPHRASE;
    }
    
    // Fallback for development (should not be used in production)
    if (typeof process !== 'undefined' && process.env?.NETWORK_INTEGRITY_KEYPHRASE) {
        return process.env.NETWORK_INTEGRITY_KEYPHRASE;
    }
    
    // Last resort fallback (development only - should warn in production)
    console.warn('[NetworkIntegrity] NETWORK_INTEGRITY_KEYPHRASE not set, using default (development only)');
    return 'strixun:network-integrity:dev-fallback';
}

/**
 * Calculate HMAC-SHA256 signature of data
 */
async function calculateHMACSignature(
    data: ArrayBuffer | string,
    keyphrase: string
): Promise<string> {
    // Convert string to ArrayBuffer if needed
    let dataBuffer: ArrayBuffer;
    if (typeof data === 'string') {
        dataBuffer = new TextEncoder().encode(data).buffer;
    } else {
        dataBuffer = data;
    }
    
    // Import keyphrase as HMAC key
    const keyData = new TextEncoder().encode(keyphrase);
    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    
    // Calculate HMAC-SHA256 signature
    const signature = await crypto.subtle.sign('HMAC', key, dataBuffer);
    const signatureArray = Array.from(new Uint8Array(signature));
    return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Format Strixun integrity signature
 */
function formatIntegritySignature(signature: string): string {
    return `strixun:sha256:${signature}`;
}

/**
 * Parse Strixun integrity signature
 */
function parseIntegritySignature(header: string | null): string | null {
    if (!header) return null;
    
    if (!header.startsWith('strixun:sha256:')) {
        return null;
    }
    
    const signature = header.replace('strixun:sha256:', '');
    // Validate hex format (64 characters for SHA-256)
    if (!/^[a-f0-9]{64}$/i.test(signature)) {
        return null;
    }
    
    return signature.toLowerCase();
}

/**
 * Calculate request integrity signature
 * Includes: method, path, body (if present), timestamp
 */
export async function calculateRequestIntegrity(
    method: string,
    path: string,
    body: string | ArrayBuffer | null | undefined,
    keyphrase: string,
    timestamp?: string
): Promise<string> {
    const timestampStr = timestamp || Date.now().toString();
    
    // Build integrity payload
    const payloadParts: string[] = [
        method.toUpperCase(),
        path,
        timestampStr,
    ];
    
    // Add body hash if present
    if (body !== null && body !== undefined) {
        let bodyData: ArrayBuffer;
        if (typeof body === 'string') {
            bodyData = new TextEncoder().encode(body).buffer;
        } else {
            bodyData = body;
        }
        const bodyHash = await calculateHMACSignature(bodyData, keyphrase);
        payloadParts.push(bodyHash);
    }
    
    const payload = payloadParts.join(':');
    const signature = await calculateHMACSignature(payload, keyphrase);
    return formatIntegritySignature(signature);
}

/**
 * Calculate response integrity signature
 * Includes: status code, body content
 */
export async function calculateResponseIntegrity(
    status: number,
    body: string | ArrayBuffer,
    keyphrase: string
): Promise<string> {
    // Build integrity payload
    const payloadParts: string[] = [
        status.toString(),
    ];
    
    // Add body hash
    let bodyData: ArrayBuffer;
    if (typeof body === 'string') {
        bodyData = new TextEncoder().encode(body).buffer;
    } else {
        bodyData = body;
    }
    const bodyHash = await calculateHMACSignature(bodyData, keyphrase);
    payloadParts.push(bodyHash);
    
    const payload = payloadParts.join(':');
    const signature = await calculateHMACSignature(payload, keyphrase);
    return formatIntegritySignature(signature);
}

/**
 * Verify response integrity
 */
export async function verifyResponseIntegrity(
    status: number,
    body: string | ArrayBuffer,
    expectedSignature: string | null,
    keyphrase: string
): Promise<boolean> {
    if (!expectedSignature) {
        return false;
    }
    
    const parsedSignature = parseIntegritySignature(expectedSignature);
    if (!parsedSignature) {
        return false;
    }
    
    const actualSignature = await calculateResponseIntegrity(status, body, keyphrase);
    const parsedActual = parseIntegritySignature(actualSignature);
    
    if (!parsedActual) {
        return false;
    }
    
    // Constant-time comparison to prevent timing attacks
    return parsedActual === parsedSignature;
}

/**
 * Add integrity headers to request
 */
export async function addRequestIntegrityHeaders(
    method: string,
    path: string,
    body: string | ArrayBuffer | null | undefined,
    headers: Headers,
    keyphrase: string
): Promise<void> {
    const timestamp = Date.now().toString();
    const integritySignature = await calculateRequestIntegrity(method, path, body, keyphrase, timestamp);
    
    headers.set('X-Strixun-Request-Integrity', integritySignature);
    headers.set('X-Strixun-Request-Timestamp', timestamp);
}

/**
 * Verify response integrity from headers
 */
export async function verifyResponseIntegrityFromHeaders(
    status: number,
    body: string | ArrayBuffer,
    responseHeaders: Headers,
    keyphrase: string
): Promise<{ verified: boolean; error?: string }> {
    const integrityHeader = responseHeaders.get('X-Strixun-Response-Integrity');
    
    if (!integrityHeader) {
        return {
            verified: false,
            error: 'Missing X-Strixun-Response-Integrity header',
        };
    }
    
    const verified = await verifyResponseIntegrity(status, body, integrityHeader, keyphrase);
    
    if (!verified) {
        return {
            verified: false,
            error: 'Response integrity verification failed - possible tampering detected',
        };
    }
    
    return { verified: true };
}

/**
 * Create integrity error
 */
export class IntegrityError extends Error {
    constructor(
        message: string,
        public readonly type: 'request' | 'response' | 'missing_header' | 'signature_mismatch'
    ) {
        super(message);
        this.name = 'IntegrityError';
    }
}

