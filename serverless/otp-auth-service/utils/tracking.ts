/**
 * Email Tracking Utilities
 * 
 * Generates and decodes tracking tokens for email open tracking
 * Privacy-compliant: only stores non-identifiable metadata
 */

/**
 * Generate a tracking token for email open tracking
 * Token encodes: emailHash, customerId (optional), timestamp, otpKey
 */
export function generateTrackingToken(
    emailHash: string,
    customerId: string | null,
    otpKey: string
): string {
    const timestamp = Date.now();
    const payload = {
        h: emailHash, // email hash (non-identifiable)
        c: customerId || null, // customer ID (optional)
        t: timestamp, // timestamp
        k: otpKey // OTP key for linking
    };
    
    // Base64 encode the payload (URL-safe)
    const encoded = btoa(JSON.stringify(payload))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    
    return encoded;
}

/**
 * Decode a tracking token
 * Returns null if token is invalid
 */
export function decodeTrackingToken(token: string): {
    emailHash: string;
    customerId: string | null;
    timestamp: number;
    otpKey: string;
} | null {
    try {
        // Decode from URL-safe base64
        const decoded = atob(
            token
                .replace(/-/g, '+')
                .replace(/_/g, '/')
                .padEnd(token.length + (4 - (token.length % 4)) % 4, '=')
        );
        
        const payload = JSON.parse(decoded);
        
        if (!payload.h || !payload.t || !payload.k) {
            return null;
        }
        
        return {
            emailHash: payload.h,
            customerId: payload.c || null,
            timestamp: payload.t,
            otpKey: payload.k
        };
    } catch (e) {
        return null;
    }
}

/**
 * Generate tracking pixel HTML
 * Returns a 1x1 transparent PNG image tag with tracking URL
 * Standard email tracking pixel - placed at end of body
 * 
 * Note: Some email clients may display the raw HTML tag as text if they're in
 * plain text mode or don't support images. The tracking will still work when
 * the image URL is requested by the email client.
 */
export function generateTrackingPixel(baseUrl: string, trackingToken: string): string {
    const trackingUrl = `${baseUrl}/track/email-open?t=${encodeURIComponent(trackingToken)}`;
    // Standard email tracking pixel format
    return `<img src="${trackingUrl}" width="1" height="1" border="0" style="display:block;width:1px;height:1px;border:0;margin:0;padding:0;" alt="" />`;
}

