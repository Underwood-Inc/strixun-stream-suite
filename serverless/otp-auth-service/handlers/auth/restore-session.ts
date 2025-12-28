/**
 * Restore Session Handler
 * 
 * Allows unauthenticated requests to restore sessions based on IP address.
 * This enables cross-application session sharing for the same device/IP.
 * 
 * Security: Only restores sessions for the requesting IP address (same device).
 */

import { getSessionsByIP } from '../../services/ip-session-index.js';
import { getCorsHeaders } from '../../utils/cors.js';
import { getCustomerKey } from '../../services/customer.js';
import { createAuthToken } from './jwt-creation.js';
import { ensureCustomerAccount } from './customer-creation.js';
import { checkIPRateLimit, recordIPRequest } from '../../services/rate-limit.js';
import { getCustomerCached, type GetCustomerFn } from '../../utils/cache.js';
import { getCustomer } from '../../services/customer.js';
import { getClientIP, isValidIP } from '../../utils/ip.js';
import { createFingerprintHash, validateFingerprintLenient } from '@strixun/api-framework';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    ENVIRONMENT?: string;
    [key: string]: any;
}

interface SessionData {
    userId: string;
    email: string;
    token: string; // hashed
    expiresAt: string;
    createdAt: string;
    ipAddress?: string;
    userAgent?: string;
    country?: string;
    fingerprint?: string; // SHA-256 hash of device fingerprint
}

interface User {
    userId: string;
    email: string;
    displayName?: string | null;
    customerId?: string | null;
    createdAt?: string;
    lastLogin?: string;
}

/**
 * Restore session for the requesting IP address
 * POST /auth/restore-session
 * 
 * This endpoint allows unauthenticated requests to restore sessions based on IP.
 * It checks for active sessions for the requesting IP and creates a new JWT token
 * if a valid session is found.
 * 
 * Security:
 * - Only restores sessions for the requesting IP (same device)
 * - Rate limited to prevent abuse
 * - Creates a fresh JWT token (doesn't return stored token)
 */
export async function handleRestoreSession(request: Request, env: Env): Promise<Response> {
    try {
        // Only allow POST requests
        if (request.method !== 'POST') {
            return new Response(JSON.stringify({ 
                error: 'Method not allowed',
                detail: 'Only POST requests are allowed'
            }), {
                status: 405,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Get request IP from headers (with fallback support)
        const requestIP = getClientIP(request);
        
        if (!isValidIP(requestIP)) {
            console.warn('[Restore Session] Unable to determine IP address for session restoration');
            return new Response(JSON.stringify({ 
                error: 'Unable to determine IP address',
                detail: 'IP address is required for session restoration. This may occur if the request is not behind a proxy that sets IP headers.'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Check IP rate limit for session restoration endpoint
        // Use a more lenient rate limit (60/hour) since this is called during app initialization
        // and multiple apps might be initializing at the same time
        const getCustomerFn: GetCustomerFn = (cid: string) => getCustomer(cid, env);
        const rateLimit = await checkIPRateLimit(
            requestIP,
            null, // No customer ID for unauthenticated requests
            (id: string) => getCustomerCached(id, getCustomerFn),
            env,
            'session-restore',
            60, // 60 requests per hour (more lenient for SSO session restoration)
            undefined // No email for unauthenticated requests
        );
        
        if (!rateLimit.allowed) {
            // Record failed request for usage statistics
            await recordIPRequest(requestIP, null, env, false);
            
            return new Response(JSON.stringify({ 
                type: 'https://tools.ietf.org/html/rfc6585#section-4',
                title: 'Too Many Requests',
                status: 429,
                detail: 'Rate limit exceeded. Please try again later.',
                instance: request.url,
                reason: rateLimit.reason || 'rate_limit_exceeded',
                reset_at: rateLimit.resetAt,
                remaining: rateLimit.remaining,
            }), {
                status: 429,
                headers: { 
                    ...getCorsHeaders(env, request), 
                    'Content-Type': 'application/problem+json',
                    'Retry-After': '3600', // Retry after 1 hour
                    'X-RateLimit-Limit': rateLimit.ipLimit?.max?.toString() || '',
                    'X-RateLimit-Remaining': rateLimit.remaining?.toString() || '0',
                    'X-RateLimit-Reset': rateLimit.resetAt,
                },
            });
        }

        // Get active sessions for this IP
        const sessions = await getSessionsByIP(requestIP, env);
        
        if (sessions.length === 0) {
            // Record successful request (no session found is still a valid response)
            await recordIPRequest(requestIP, null, env, true);
            
            console.log(`[Restore Session] No active sessions found for IP: ${requestIP}`);
            
            return new Response(JSON.stringify({
                restored: false,
                message: 'No active session found for this IP address'
            }), {
                status: 200,
                headers: { 
                    ...getCorsHeaders(env, request), 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store',
                    'X-RateLimit-Limit': rateLimit.ipLimit?.max?.toString() || '',
                    'X-RateLimit-Remaining': rateLimit.remaining?.toString() || '0',
                    'X-RateLimit-Reset': rateLimit.resetAt,
                },
            });
        }
        
        console.log(`[Restore Session] Found ${sessions.length} active session(s) for IP: ${requestIP}`);

        // CRITICAL: Validate all sessions exist before using them
        // Filter out sessions that have been deleted (e.g., after logout)
        const validSessions: typeof sessions = [];
        for (const sessionMapping of sessions) {
            const sessionData = await env.OTP_AUTH_KV.get(sessionMapping.sessionKey, { type: 'json' }) as SessionData | null;
            if (sessionData) {
                // Verify session hasn't expired
                const expiresAt = new Date(sessionData.expiresAt);
                if (expiresAt > new Date()) {
                    validSessions.push(sessionMapping);
                }
            }
        }
        
        // If no valid sessions found, clean up the IP index and return
        if (validSessions.length === 0) {
            // All sessions in index were deleted or expired - clean up the index
            // Use the same hashing function as the IP session index service
            const encoder = new TextEncoder();
            const data = encoder.encode(requestIP);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const ipHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            const indexKey = `ip_session_${ipHash}`;
            await env.OTP_AUTH_KV.delete(indexKey);
            
            await recordIPRequest(requestIP, null, env, true);
            
            console.log(`[Restore Session] All sessions for IP ${requestIP} were deleted or expired`);
            
            return new Response(JSON.stringify({
                restored: false,
                message: 'No active session found for this IP address'
            }), {
                status: 200,
                headers: { 
                    ...getCorsHeaders(env, request), 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store',
                    'X-RateLimit-Limit': rateLimit.ipLimit?.max?.toString() || '',
                    'X-RateLimit-Remaining': rateLimit.remaining?.toString() || '0',
                    'X-RateLimit-Reset': rateLimit.resetAt,
                },
            });
        }
        
        // Use the first valid session (most recent)
        // In practice, there should only be one session per IP for same-device restoration
        const sessionMapping = validSessions[0];
        
        // Get the actual session data (we already validated it exists above)
        const sessionData = await env.OTP_AUTH_KV.get(sessionMapping.sessionKey, { type: 'json' }) as SessionData | null;
        
        // Double-check session still exists (race condition protection)
        if (!sessionData) {
            await recordIPRequest(requestIP, null, env, true);
            
            return new Response(JSON.stringify({
                restored: false,
                message: 'Session not found'
            }), {
                status: 200,
                headers: { 
                    ...getCorsHeaders(env, request), 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store',
                    'X-RateLimit-Limit': rateLimit.ipLimit?.max?.toString() || '',
                    'X-RateLimit-Remaining': rateLimit.remaining?.toString() || '0',
                    'X-RateLimit-Reset': rateLimit.resetAt,
                },
            });
        }

        // Validate session is not expired
        const expiresAt = new Date(sessionData.expiresAt);
        if (expiresAt <= new Date()) {
            // Session expired
            await recordIPRequest(requestIP, null, env, true);
            
            return new Response(JSON.stringify({
                restored: false,
                message: 'Session has expired'
            }), {
                status: 200,
                headers: { 
                    ...getCorsHeaders(env, request), 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store',
                    'X-RateLimit-Limit': rateLimit.ipLimit?.max?.toString() || '',
                    'X-RateLimit-Remaining': rateLimit.remaining?.toString() || '0',
                    'X-RateLimit-Reset': rateLimit.resetAt,
                },
            });
        }

        // Validate IP matches (security check)
        if (sessionData.ipAddress && sessionData.ipAddress !== requestIP && sessionData.ipAddress !== 'unknown') {
            // IP mismatch - don't restore session
            console.warn(`[Restore Session] IP mismatch: session IP ${sessionData.ipAddress} != request IP ${requestIP}`);
            await recordIPRequest(requestIP, null, env, true);
            
            return new Response(JSON.stringify({
                restored: false,
                message: 'IP address mismatch'
            }), {
                status: 200,
                headers: { 
                    ...getCorsHeaders(env, request), 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store',
                    'X-RateLimit-Limit': rateLimit.ipLimit?.max?.toString() || '',
                    'X-RateLimit-Remaining': rateLimit.remaining?.toString() || '0',
                    'X-RateLimit-Reset': rateLimit.resetAt,
                },
            });
        }

        // Validate device fingerprint (enhanced security for device-level isolation)
        // This prevents unauthorized session restoration when multiple devices share the same IP
        const requestFingerprint = await createFingerprintHash(request);
        const fingerprintValid = await validateFingerprintLenient(
            sessionData.fingerprint,
            requestFingerprint,
            true // Lenient mode: allow sessions without fingerprints (backward compatibility)
        );
        
        if (!fingerprintValid) {
            // Fingerprint mismatch - different device detected
            console.warn(`[Restore Session] Fingerprint mismatch: session fingerprint ${sessionData.fingerprint?.substring(0, 16)}... != request fingerprint ${requestFingerprint.substring(0, 16)}...`);
            await recordIPRequest(requestIP, null, env, true);
            
            return new Response(JSON.stringify({
                restored: false,
                message: 'Device fingerprint mismatch. Please log in again.',
                requiresLogin: true
            }), {
                status: 200,
                headers: { 
                    ...getCorsHeaders(env, request), 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store',
                    'X-RateLimit-Limit': rateLimit.ipLimit?.max?.toString() || '',
                    'X-RateLimit-Remaining': rateLimit.remaining?.toString() || '0',
                    'X-RateLimit-Reset': rateLimit.resetAt,
                },
            });
        }

        // Get user data from KV using email hash (not userId)
        const { hashEmail } = await import('../../utils/crypto.js');
        const emailHash = await hashEmail(sessionData.email);
        let userKey = getCustomerKey(sessionMapping.customerId, `user_${emailHash}`);
        let userData = await env.OTP_AUTH_KV.get(userKey, { type: 'json' }) as User | null;
        
        // If user not found with customerId, try without customerId (backwards compatibility)
        if (!userData && sessionMapping.customerId) {
            const legacyUserKey = `user_${emailHash}`;
            userData = await env.OTP_AUTH_KV.get(legacyUserKey, { type: 'json' }) as User | null;
            // If found, migrate user to customer-scoped key and update customerId
            if (userData) {
                userData.customerId = sessionMapping.customerId;
                await env.OTP_AUTH_KV.put(userKey, JSON.stringify(userData), { expirationTtl: 31536000 });
            }
        }
        
        if (!userData) {
            // User data not found
            await recordIPRequest(requestIP, null, env, true);
            
            return new Response(JSON.stringify({
                restored: false,
                message: 'User data not found'
            }), {
                status: 200,
                headers: { 
                    ...getCorsHeaders(env, request), 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store',
                    'X-RateLimit-Limit': rateLimit.ipLimit?.max?.toString() || '',
                    'X-RateLimit-Remaining': rateLimit.remaining?.toString() || '0',
                    'X-RateLimit-Reset': rateLimit.resetAt,
                },
            });
        }

        // Ensure customer account exists
        let customerId = sessionMapping.customerId;
        try {
            customerId = await ensureCustomerAccount(sessionData.email, customerId, env);
        } catch (error) {
            console.error(`[Restore Session] Failed to ensure customer account for ${sessionData.email}:`, error);
            await recordIPRequest(requestIP, null, env, true);
            
            return new Response(JSON.stringify({ 
                error: 'Failed to verify customer account. Please try again.',
                detail: env.ENVIRONMENT === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined
            }), {
                status: 500,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }

        // Create a new JWT token for the restored session
        // This is more secure than returning the stored token hash
        // NOTE: This will create a new session and update the IP mapping
        console.log(`[Restore Session] Creating new token for user: ${userData.email} (${userData.userId})`);
        const tokenResponse = await createAuthToken(
            {
                userId: userData.userId,
                email: userData.email,
                displayName: userData.displayName || null,
                customerId: customerId,
                createdAt: userData.createdAt,
                lastLogin: userData.lastLogin,
            },
            customerId,
            env,
            request // Pass request for IP tracking (will update IP mapping)
        );

        // Record successful request
        await recordIPRequest(requestIP, customerId, env, true);

        console.log(`[Restore Session] Successfully restored session for user: ${userData.email} from IP: ${requestIP}`);

        // Return token response
        return new Response(JSON.stringify({
            restored: true,
            ...tokenResponse
        }), {
            status: 200,
            headers: { 
                ...getCorsHeaders(env, request), 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
                'Pragma': 'no-cache',
                'X-RateLimit-Limit': rateLimit.ipLimit?.max?.toString() || '',
                'X-RateLimit-Remaining': rateLimit.remaining?.toString() || '0',
                'X-RateLimit-Reset': rateLimit.resetAt,
            },
        });
    } catch (error: any) {
        console.error('[Restore Session] Error:', error);
        console.error('[Restore Session] Error stack:', error?.stack);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isDev = env.ENVIRONMENT === 'development' || !env.ENVIRONMENT;
        return new Response(JSON.stringify({ 
            error: 'Failed to restore session',
            message: isDev ? errorMessage : undefined,
            detail: isDev ? (error?.stack || errorMessage) : undefined,
            hint: errorMessage.includes('JWT_SECRET') ? 'JWT_SECRET environment variable is required. Set it via: wrangler secret put JWT_SECRET' : undefined
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

