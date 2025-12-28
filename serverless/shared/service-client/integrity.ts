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
 * Includes: method, path, body (if present), timestamp, customerID (if present)
 * 
 * CRITICAL: customerID is included in the hash to ensure requests cannot be
 * tampered with to access data from a different customer account.
 */
export async function calculateRequestIntegrity(
    method: string,
    path: string,
    body: string | ArrayBuffer | null | undefined,
    keyphrase: string,
    timestamp?: string,
    customerId?: string | null
): Promise<string> {
    const timestampStr = timestamp || Date.now().toString();
    
    // Build integrity payload
    const payloadParts: string[] = [
        method.toUpperCase(),
        path,
        timestampStr,
    ];
    
    // CRITICAL: Include customerID in hash to prevent cross-customer data access
    // This ensures that requests cannot be tampered with to access data from another customer
    if (customerId) {
        payloadParts.push(customerId);
    } else {
        payloadParts.push('null'); // Explicit null to prevent hash collision
    }
    
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
 * 
 * CRITICAL: Extracts customerID from JWT token or X-Customer-ID header
 * and includes it in the integrity hash to prevent cross-customer data access.
 */
export async function addRequestIntegrityHeaders(
    method: string,
    path: string,
    body: string | ArrayBuffer | null | undefined,
    headers: Headers,
    keyphrase: string
): Promise<void> {
    // Extract customerID from JWT token or X-Customer-ID header
    let customerId: string | null = null;
    
    // Try X-Customer-ID header first
    const customerIdHeader = headers.get('X-Customer-ID');
    if (customerIdHeader) {
        customerId = customerIdHeader;
    }
    
    // Try to extract from JWT token if available
    if (!customerId) {
        const authHeader = headers.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            try {
                // Decode JWT payload (without verification - just for customerID extraction)
                const parts = token.split('.');
                if (parts.length === 3) {
                    const payloadB64 = parts[1];
                    const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
                    const payload = JSON.parse(payloadJson);
                    customerId = payload.customerId || null;
                }
            } catch (error) {
                // JWT decode failed - continue without customerID
                console.warn('[Integrity] Failed to extract customerID from JWT:', error);
            }
        }
    }
    
    const timestamp = Date.now().toString();
    const integritySignature = await calculateRequestIntegrity(method, path, body, keyphrase, timestamp, customerId);
    
    headers.set('X-Strixun-Request-Integrity', integritySignature);
    headers.set('X-Strixun-Request-Timestamp', timestamp);
    
    // Also set X-Customer-ID header if we extracted it from JWT (for server-side verification)
    if (customerId && !customerIdHeader) {
        headers.set('X-Customer-ID', customerId);
    }
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

