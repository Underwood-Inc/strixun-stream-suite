/**
 * Email Tracking Handler
 * 
 * Handles email open tracking with privacy-compliant analytics
 * Tracks: IP, customer agent, country (from Cloudflare headers), timestamp
 * Does NOT track: email addresses, personal information
 */

import { decodeTrackingToken } from '../utils/tracking.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    [key: string]: any;
}

/**
 * 1x1 transparent PNG image (base64 encoded)
 * Generated from: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==
 */
const TRANSPARENT_PNG = Uint8Array.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
    0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
]);

interface TrackingData {
    emailHash: string;
    customerId: string | null;
    timestamp: number;
    otpKey: string;
    openedAt: number;
    ip: string;
    userAgent: string | null;
    country: string | null;
    city: string | null;
    timezone: string | null;
}

/**
 * Handle email open tracking
 * GET /track/email-open?t=<token>
 */
export async function handleEmailTracking(
    request: Request,
    env: Env
): Promise<Response> {
    try {
        const url = new URL(request.url);
        const token = url.searchParams.get('t');
        
        if (!token) {
            // Return transparent image even if token is missing (fail silently)
            return new Response(TRANSPARENT_PNG, {
                headers: {
                    'Content-Type': 'image/png',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                },
            });
        }
        
        // Decode tracking token
        const trackingData = decodeTrackingToken(token);
        if (!trackingData) {
            // Return transparent image even if token is invalid (fail silently)
            return new Response(TRANSPARENT_PNG, {
                headers: {
                    'Content-Type': 'image/png',
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                },
            });
        }
        
        // Extract client information from Cloudflare headers (privacy-compliant)
        // CF-Connecting-IP is set by Cloudflare and cannot be spoofed
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
        const userAgent = request.headers.get('User-Agent') || null;
        const country = request.headers.get('CF-IPCountry') || null;
        const city = request.headers.get('CF-IPCity') || null;
        const timezone = request.headers.get('CF-Timezone') || null;
        
        // Prepare tracking record
        const record: TrackingData = {
            emailHash: trackingData.emailHash,
            customerId: trackingData.customerId,
            timestamp: trackingData.timestamp,
            otpKey: trackingData.otpKey,
            openedAt: Date.now(),
            ip: clientIP,
            userAgent: userAgent,
            country: country,
            city: city,
            timezone: timezone,
        };
        
        // Store tracking data in KV (non-blocking)
        // Use a separate key for analytics aggregation
        const trackingKey = `email_tracking_${trackingData.emailHash}_${Date.now()}`;
        const analyticsKey = `email_analytics_${trackingData.customerId || 'default'}_${new Date().toISOString().split('T')[0]}`;
        
        // Store individual tracking record (expires in 90 days for analytics)
        env.OTP_AUTH_KV.put(trackingKey, JSON.stringify(record), { expirationTtl: 7776000 })
            .catch(err => console.error('Failed to store tracking record:', err));
        
        // Aggregate analytics by customer and date (for geographical usage analysis)
        // This is done asynchronously to not block the response
        env.OTP_AUTH_KV.get(analyticsKey)
            .then(existing => {
                const analytics = existing ? JSON.parse(existing) : { opens: 0, countries: {} as Record<string, number> };
                analytics.opens += 1;
                if (country) {
                    analytics.countries[country] = (analytics.countries[country] || 0) + 1;
                }
                return env.OTP_AUTH_KV.put(analyticsKey, JSON.stringify(analytics), { expirationTtl: 7776000 });
            })
            .catch(err => console.error('Failed to update analytics:', err));
        
        // Return transparent 1x1 PNG image
        return new Response(TRANSPARENT_PNG, {
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
        });
    } catch (error: any) {
        // Always return the image, even on error (fail silently for better UX)
        console.error('Email tracking error:', error);
        return new Response(TRANSPARENT_PNG, {
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
            },
        });
    }
}

