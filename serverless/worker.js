/**
 * Strixun Stream Suite - Serverless API Worker
 * Cloudflare Worker for Twitch API proxy + Cloud Storage
 * 
 * This worker handles:
 * - App Access Token management (cached)
 * - Clips fetching
 * - User following fetching
 * - Game data fetching
 * - Cloud Save System (backup/restore configs across devices)
 * - Email OTP Authentication System (secure user authentication)
 * 
 * @version 2.1.0
 */

import { handleScrollbar, handleScrollbarCustomizer, handleScrollbarCompensation } from './handlers/scrollbar.js';
import { handleClips, handleFollowing, handleGame, handleUser, getAppAccessToken } from './handlers/twitch.js';
import { handleCloudSave, handleCloudLoad, handleCloudList, handleCloudDelete } from './handlers/cloud-storage.js';
import { handleNotesSave, handleNotesLoad, handleNotesList, handleNotesDelete } from './handlers/notes.js';
import { handleOBSCredentialsSave, handleOBSCredentialsLoad, handleOBSCredentialsDelete } from './handlers/obs.js';
import { authenticateRequest, hashEmail, verifyJWT, getJWTSecret } from './utils/auth.js';
import { getCorsHeaders } from './utils/cors.js';

// All handlers and utilities are now imported from their respective modules

/**
 * Health check endpoint
 */
async function handleHealth(env, request) {
    try {
        // Test token generation
        await getAppAccessToken(env);
        return new Response(JSON.stringify({ 
            status: 'ok', 
            message: 'Strixun Stream Suite API is running',
            features: ['twitch-api', 'cloud-storage', 'scrollbar-customizer'],
            timestamp: new Date().toISOString()
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            status: 'error', 
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

// All handlers and utilities are now imported from their respective modules

/**
 * Check rate limit for OTP requests
 * @param {string} emailHash - Hashed email
 * @param {*} env - Worker environment
 * @returns {Promise<{allowed: boolean, remaining: number}>}
 */
async function checkOTPRateLimit(emailHash, env) {
    try {
        const rateLimitKey = `ratelimit_otp_${emailHash}`;
        const rateLimitData = await env.TWITCH_CACHE.get(rateLimitKey);
        let rateLimit = null;
        
        if (rateLimitData) {
            try {
                rateLimit = JSON.parse(rateLimitData);
            } catch (e) {
                // Invalid data, reset
                rateLimit = null;
            }
        }
        
        const now = Date.now();
        const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
        const MAX_ATTEMPTS = 5;
        
        if (rateLimit) {
            // Check if window has expired
            if (now - rateLimit.firstAttempt > RATE_LIMIT_WINDOW) {
                // Reset rate limit
                rateLimit = {
                    attempts: 0,
                    firstAttempt: now,
                    lastAttempt: now
                };
            } else if (rateLimit.attempts >= MAX_ATTEMPTS) {
                // Rate limited
                const resetAt = rateLimit.firstAttempt + RATE_LIMIT_WINDOW;
                return {
                    limited: true,
                    resetAt: resetAt,
                    attempts: rateLimit.attempts
                };
            }
        } else {
            // Initialize rate limit
            rateLimit = {
                attempts: 0,
                firstAttempt: now,
                lastAttempt: now
            };
        }
        
        // Increment attempts
        rateLimit.attempts++;
        rateLimit.lastAttempt = now;
        
        // Store updated rate limit
        await env.TWITCH_CACHE.put(rateLimitKey, JSON.stringify(rateLimit), {
            expirationTtl: Math.ceil(RATE_LIMIT_WINDOW / 1000)
        });
        
        return {
            limited: false,
            attempts: rateLimit.attempts,
            remaining: MAX_ATTEMPTS - rateLimit.attempts
        };
    } catch (error) {
        // On error, allow the request (fail open)
        return { limited: false, attempts: 0, remaining: 5 };
    }
}

/**
 * Send OTP email via Resend
 * @param {string} email - Recipient email
 * @param {string} otp - OTP code
 * @param {*} env - Worker environment
 * @returns {Promise<boolean>} Success status
 */
async function sendOTPEmail(email, otp, env) {
    try {
        if (!env.RESEND_API_KEY) {
            console.error('RESEND_API_KEY not configured');
            return false;
        }
        
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: 'Strixun <noreply@strixun.com>',
                to: [email],
                subject: 'Your OTP Code',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #edae49;">Your OTP Code</h2>
                        <p>Your one-time password is:</p>
                        <div style="background: #252017; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                            <h1 style="color: #edae49; font-size: 32px; letter-spacing: 4px; margin: 0;">${otp}</h1>
                        </div>
                        <p style="color: #888;">This code will expire in 10 minutes.</p>
                        <p style="color: #888; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
                    </div>
                `,
            }),
        });
        
        if (!response.ok) {
            const error = await response.text();
            console.error('Failed to send email:', error);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error sending OTP email:', error);
        return false;
    }
}

/**
 * Handle OTP request endpoint
 * POST /auth/request-otp
 * Body: { email: string }
 */
async function handleRequestOTP(request, env) {
    try {
        const body = await request.json();
        const { email } = body;
        
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return new Response(JSON.stringify({ error: 'Valid email required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const emailHash = await hashEmail(email);
        const rateLimitCheck = await checkOTPRateLimit(emailHash, env);
        
        if (!rateLimitCheck.allowed) {
            const resetAt = new Date(rateLimitCheck.resetAt);
            const locale = request.headers.get('Accept-Language') || 'en-US';
            const resetAtFormatted = resetAt.toLocaleString(locale, {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
            
            return new Response(JSON.stringify({
                error: 'Too many requests',
                detail: `Please try again later (at ${resetAtFormatted}).`,
                reset_at: rateLimitCheck.resetAt,
                reset_at_formatted: resetAtFormatted,
                rate_limit_details: {
                    emailLimit: { current: 3, max: 3, resetAt: rateLimitCheck.resetAt },
                    ipLimit: null,
                    quotaLimit: null,
                    failedAttempts: 0
                }
            }), {
                status: 429,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Generate OTP
        const otp = generateOTP();
        
        // Store OTP in KV (10 minute expiration)
        const otpKey = `otp_${emailHash}`;
        await env.TWITCH_CACHE.put(otpKey, JSON.stringify({
            otp,
            email,
            createdAt: Date.now(),
            attempts: 0
        }), { expirationTtl: 600 });
        
        // Send OTP email
        const emailSent = await sendOTPEmail(email, otp, env);
        
        if (!emailSent) {
            return new Response(JSON.stringify({ error: 'Failed to send OTP email' }), {
                status: 500,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify({ 
            success: true, 
            message: 'OTP sent to email',
            remaining: rateLimitCheck.remaining
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Internal server error', message: error.message }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Generate secure 6-digit OTP (cryptographically secure, no modulo bias)
 * @returns {string} 6-digit OTP code
 */
function generateOTP() {
    // Use 2 Uint32 values to get 64 bits, eliminating modulo bias
    const array = new Uint32Array(2);
    crypto.getRandomValues(array);
    // Combine two 32-bit values for 64-bit range (0 to 2^64-1)
    // Then modulo 1,000,000 for 6-digit code
    // This eliminates modulo bias since 2^64 is much larger than 1,000,000
    const value = (Number(array[0]) * 0x100000000 + Number(array[1])) % 1000000;
    return value.toString().padStart(6, '0');
}

// hashEmail is imported from ./utils/auth.js

/**
 * Create JWT token
 * @param {object} payload - Token payload
 * @param {string} secret - Secret key for signing
 * @returns {Promise<string>} JWT token
 */
async function createJWT(payload, secret) {
    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };
    
    const encoder = new TextEncoder();
    const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    const signatureInput = `${headerB64}.${payloadB64}`;
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureInput));
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    return `${signatureInput}.${signatureB64}`;
}

// verifyJWT and getJWTSecret are imported from ./utils/auth.js

// Duplicate checkOTPRateLimit, sendOTPEmail, and handleRequestOTP removed - using first definitions

// All OTP Auth handlers are imported from serverless/utils/auth.js
// All Notes handlers are imported from serverless/handlers/notes.js
// All OBS handlers are imported from serverless/handlers/obs.js

/**
 * Main request handler
 */
export default {
    try {
        const body = await request.json();
        const { email, otp } = body;
        
        // Validate input
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return new Response(JSON.stringify({ error: 'Valid email address required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        if (!otp || !/^\d{6}$/.test(otp)) {
            return new Response(JSON.stringify({ error: 'Valid 6-digit OTP required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const emailHash = await hashEmail(email);
        const emailLower = email.toLowerCase().trim();
        
        // Get latest OTP key
        const latestOtpKey = await env.TWITCH_CACHE.get(`otp_latest_${emailHash}`);
        if (!latestOtpKey) {
            return new Response(JSON.stringify({ error: 'OTP not found or expired' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Get OTP data
        const otpDataStr = await env.TWITCH_CACHE.get(latestOtpKey);
        if (!otpDataStr) {
            return new Response(JSON.stringify({ error: 'OTP not found or expired' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const otpData = JSON.parse(otpDataStr);
        
        // Verify email matches
        if (otpData.email !== emailLower) {
            return new Response(JSON.stringify({ error: 'Invalid OTP' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Check expiration
        if (new Date(otpData.expiresAt) < new Date()) {
            await env.TWITCH_CACHE.delete(latestOtpKey);
            await env.TWITCH_CACHE.delete(`otp_latest_${emailHash}`);
            return new Response(JSON.stringify({ error: 'OTP expired' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Check attempts
        if (otpData.attempts >= 5) {
            await env.TWITCH_CACHE.delete(latestOtpKey);
            await env.TWITCH_CACHE.delete(`otp_latest_${emailHash}`);
            return new Response(JSON.stringify({ error: 'Too many failed attempts' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Verify OTP using constant-time comparison to prevent timing attacks
        // Convert both to strings and pad to same length for comparison
        const expectedOtp = String(otpData.otp).padStart(6, '0');
        const providedOtp = String(otp).padStart(6, '0');
        
        // Constant-time string comparison
        let isValid = expectedOtp.length === providedOtp.length;
        for (let i = 0; i < expectedOtp.length; i++) {
            isValid = isValid && (expectedOtp.charCodeAt(i) === providedOtp.charCodeAt(i));
        }
        
        if (!isValid) {
            otpData.attempts++;
            await env.TWITCH_CACHE.put(latestOtpKey, JSON.stringify(otpData), { expirationTtl: 600 });
            return new Response(JSON.stringify({ 
                error: 'Invalid OTP',
                remainingAttempts: 5 - otpData.attempts
            }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // OTP is valid! Delete it (single-use)
        await env.TWITCH_CACHE.delete(latestOtpKey);
        await env.TWITCH_CACHE.delete(`otp_latest_${emailHash}`);
        
        // Get or create user
        const userId = await generateUserId(emailLower);
        const userKey = `user_${emailHash}`;
        let user = await env.TWITCH_CACHE.get(userKey, { type: 'json' });
        
        if (!user) {
            // Create new user
            user = {
                userId,
                email: emailLower,
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
            };
            await env.TWITCH_CACHE.put(userKey, JSON.stringify(user), { expirationTtl: 31536000 }); // 1 year
        } else {
            // Update last login
            user.lastLogin = new Date().toISOString();
            await env.TWITCH_CACHE.put(userKey, JSON.stringify(user), { expirationTtl: 31536000 });
        }
        
        // Generate CSRF token for this session
        const csrfToken = crypto.randomUUID ? crypto.randomUUID() : 
            Array.from(crypto.getRandomValues(new Uint8Array(16)))
                .map(b => b.toString(16).padStart(2, '0')).join('');
        
        // Generate JWT token (7 hours expiration for security)
        const expiresAt = new Date(Date.now() + 7 * 60 * 60 * 1000); // 7 hours
        const tokenPayload = {
            userId,
            email: emailLower,
            csrf: csrfToken, // CSRF token included in JWT
            exp: Math.floor(expiresAt.getTime() / 1000),
            iat: Math.floor(Date.now() / 1000),
        };
        
        const jwtSecret = getJWTSecret(env);
        const token = await createJWT(tokenPayload, jwtSecret);
        
        // Store session
        const sessionKey = `session_${userId}`;
        await env.TWITCH_CACHE.put(sessionKey, JSON.stringify({
            userId,
            email: emailLower,
            token: await hashEmail(token), // Store hash of token
            expiresAt: expiresAt.toISOString(),
            createdAt: new Date().toISOString(),
        }), { expirationTtl: 25200 }); // 7 hours (matches token expiration)
        
        return new Response(JSON.stringify({ 
            success: true,
            token,
            userId,
            email: emailLower,
            expiresAt: expiresAt.toISOString(),
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to verify OTP',
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Get current user endpoint
 * GET /auth/me
 */
async function handleGetMe(request, env) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Authorization header required' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const token = authHeader.substring(7);
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret);
        
        if (!payload) {
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Get user data
        const emailHash = await hashEmail(payload.email);
        const userKey = `user_${emailHash}`;
        const user = await env.TWITCH_CACHE.get(userKey, { type: 'json' });
        
        if (!user) {
            return new Response(JSON.stringify({ error: 'User not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify({ 
            success: true,
            userId: user.userId,
            email: user.email,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to get user info',
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Logout endpoint
 * POST /auth/logout
 */
async function handleLogout(request, env) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Authorization header required' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const token = authHeader.substring(7);
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret);
        
        if (!payload) {
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Add token to blacklist
        const tokenHash = await hashEmail(token);
        const blacklistKey = `blacklist_${tokenHash}`;
        await env.TWITCH_CACHE.put(blacklistKey, JSON.stringify({
            token: tokenHash,
            revokedAt: new Date().toISOString(),
        }), { expirationTtl: 25200 }); // 7 hours (matches token expiration) (same as token expiry)
        
        // Delete session
        const sessionKey = `session_${payload.userId}`;
        await env.TWITCH_CACHE.delete(sessionKey);
        
        return new Response(JSON.stringify({ 
            success: true,
            message: 'Logged out successfully'
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to logout',
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Refresh token endpoint
 * POST /auth/refresh
 */
async function handleRefresh(request, env) {
    try {
        const body = await request.json();
        const { token } = body;
        
        if (!token) {
            return new Response(JSON.stringify({ error: 'Token required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret);
        
        if (!payload) {
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Check if token is blacklisted
        const tokenHash = await hashEmail(token);
        const blacklistKey = `blacklist_${tokenHash}`;
        const blacklisted = await env.TWITCH_CACHE.get(blacklistKey);
        if (blacklisted) {
            return new Response(JSON.stringify({ error: 'Token has been revoked' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Generate new CSRF token for refreshed session
        const newCsrfToken = crypto.randomUUID ? crypto.randomUUID() : 
            Array.from(crypto.getRandomValues(new Uint8Array(16)))
                .map(b => b.toString(16).padStart(2, '0')).join('');
        
        // Generate new token (7 hours expiration)
        const expiresAt = new Date(Date.now() + 7 * 60 * 60 * 1000); // 7 hours
        const newTokenPayload = {
            userId: payload.userId,
            email: payload.email,
            csrf: newCsrfToken, // New CSRF token for refreshed session
            exp: Math.floor(expiresAt.getTime() / 1000),
            iat: Math.floor(Date.now() / 1000),
        };
        
        const newToken = await createJWT(newTokenPayload, jwtSecret);
        
        // Update session
        const sessionKey = `session_${payload.userId}`;
        await env.TWITCH_CACHE.put(sessionKey, JSON.stringify({
            userId: payload.userId,
            email: payload.email,
            token: await hashEmail(newToken),
            expiresAt: expiresAt.toISOString(),
            createdAt: new Date().toISOString(),
        }), { expirationTtl: 25200 }); // 7 hours
        
        return new Response(JSON.stringify({ 
            success: true,
            token: newToken,
            expiresAt: expiresAt.toISOString(),
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to refresh token',
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

// ============ Notes/Notebook System ============

/**
 * Authenticate request and get user info
 * @param {Request} request - HTTP request
 * @param {*} env - Worker environment
 * @returns {Promise<{userId: string, email: string}|null>} User info or null if not authenticated
 */
/**
 * Authenticate request and validate CSRF token for state-changing operations
 * @param {Request} request - HTTP request
 * @param {*} env - Worker environment
 * @param {boolean} requireCsrf - Whether to require CSRF token (for POST/PUT/DELETE)
 * @returns {Promise<{userId: string, email: string}|null>} User info or null if not authenticated
 */
async function authenticateRequest(request, env, requireCsrf = false) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    
    const token = authHeader.substring(7);
    const jwtSecret = getJWTSecret(env);
    const payload = await verifyJWT(token, jwtSecret);
    
    if (!payload) {
        return null;
    }
    
    // Check if token is blacklisted
    const tokenHash = await hashEmail(token);
    const blacklistKey = `blacklist_${tokenHash}`;
    const blacklisted = await env.TWITCH_CACHE.get(blacklistKey);
    if (blacklisted) {
        return null;
    }
    
    // Validate CSRF token for state-changing operations
    if (requireCsrf) {
        const csrfHeader = request.headers.get('X-CSRF-Token');
        if (!csrfHeader || csrfHeader !== payload.csrf) {
            return null; // CSRF token mismatch
        }
    }
    
    return {
        userId: payload.userId,
        email: payload.email
    };
}

/**
 * Compress content using gzip (client-side compression, but we can also compress server-side)
 * For now, we'll store as-is and rely on KV compression
 * @param {string} content - Content to compress
 * @returns {Promise<string>} Compressed content (base64)
 */
async function compressContent(content) {
    // KV automatically compresses, but we can add explicit compression if needed
    // For now, just return as-is
    return content;
}

/**
 * Get notes storage key
 * @param {string} userId - User ID
 * @param {string} notebookId - Notebook ID
 * @returns {string} Storage key
 */
function getNotesKey(userId, notebookId) {
    return `notes_${userId}_${notebookId}`;
}

/**
 * Get user's notebook list key
 * @param {string} userId - User ID
 * @returns {string} Storage key
 */
function getNotebookListKey(userId) {
    return `notes_list_${userId}`;
}

/**
 * Test email sending endpoint
 * GET /test/email?to=your@email.com
 */
async function handleTestEmail(request, env) {
    try {
        const url = new URL(request.url);
        const to = url.searchParams.get('to');
        
        if (!to) {
            return new Response(JSON.stringify({ error: 'to parameter required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
            return new Response(JSON.stringify({ error: 'Invalid email format' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Check if RESEND_API_KEY is configured
        if (!env.RESEND_API_KEY) {
            return new Response(JSON.stringify({ 
                error: 'RESEND_API_KEY not configured',
                message: 'Please add RESEND_API_KEY secret using: wrangler secret put RESEND_API_KEY'
            }), {
                status: 500,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Send test email via Resend
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: env.RESEND_FROM_EMAIL || (() => { throw new Error('RESEND_FROM_EMAIL must be set'); })(),
                to: to,
                subject: 'Test Email from Strixun Stream Suite',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>✅ Test Email Successful!</h1>
                            <div class="success">
                                <p><strong>If you're reading this, Resend is working correctly!</strong></p>
                                <p>This is a test email from your Cloudflare Worker.</p>
                            </div>
                            <p>Your email integration is set up and ready to use for OTP authentication.</p>
                            <hr>
                            <p style="font-size: 12px; color: #666;">
                                Strixun Stream Suite - Email Test<br>
                                Sent from Cloudflare Worker
                            </p>
                        </div>
                    </body>
                    </html>
                `,
            }),
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { message: errorText };
            }
            
            return new Response(JSON.stringify({ 
                error: 'Failed to send email',
                status: response.status,
                details: errorData
            }), {
                status: 500,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const data = await response.json();
        
        return new Response(JSON.stringify({ 
            success: true,
            message: 'Test email sent successfully!',
            emailId: data.id,
            to: to,
            timestamp: new Date().toISOString()
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to send email',
            message: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Main request handler
 */
export default {
    async fetch(request, env, ctx) {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: getCorsHeaders(env, request) });
        }

        const url = new URL(request.url);
        const path = url.pathname;

        try {
            // Twitch API endpoints
            if (path === '/clips') return handleClips(request, env);
            if (path === '/following') return handleFollowing(request, env);
            if (path === '/game') return handleGame(request, env);
            if (path === '/user') return handleUser(request, env);
            
            // Cloud Storage endpoints
            // Authenticated cloud save endpoints (replaces device-based /cloud/*)
            if (path === '/cloud-save/save' && request.method === 'POST') return handleCloudSave(request, env, authenticateRequest);
            if (path === '/cloud-save/load' && request.method === 'GET') return handleCloudLoad(request, env, authenticateRequest);
            if (path === '/cloud-save/list' && request.method === 'GET') return handleCloudList(request, env, authenticateRequest);
            if (path === '/cloud-save/delete' && request.method === 'DELETE') return handleCloudDelete(request, env, authenticateRequest);
            
            // Legacy device-based endpoints (kept for backward compatibility)
            if (path === '/cloud/save' && request.method === 'POST') return handleCloudSave(request, env, authenticateRequest);
            if (path === '/cloud/load' && request.method === 'GET') return handleCloudLoad(request, env, authenticateRequest);
            if (path === '/cloud/list' && request.method === 'GET') return handleCloudList(request, env, authenticateRequest);
            if (path === '/cloud/delete' && request.method === 'DELETE') return handleCloudDelete(request, env, authenticateRequest);
            
            // CDN endpoints
            if (path === '/cdn/scrollbar.js' && request.method === 'GET') return handleScrollbar(request, env);
            if (path === '/cdn/scrollbar-customizer.js' && request.method === 'GET') return handleScrollbarCustomizer(request, env);
            if (path === '/cdn/scrollbar-compensation.js' && request.method === 'GET') return handleScrollbarCompensation(request, env);
            
            // Authentication endpoints
            if (path === '/auth/request-otp' && request.method === 'POST') return handleRequestOTP(request, env);
            if (path === '/auth/verify-otp' && request.method === 'POST') return handleVerifyOTP(request, env);
            if (path === '/auth/me' && request.method === 'GET') return handleGetMe(request, env);
            if (path === '/auth/logout' && request.method === 'POST') return handleLogout(request, env);
            if (path === '/auth/refresh' && request.method === 'POST') return handleRefresh(request, env);
            
            // Notes/Notebook endpoints (require authentication)
            if (path === '/notes/save' && request.method === 'POST') return handleNotesSave(request, env, authenticateRequest);
            if (path === '/notes/load' && request.method === 'GET') return handleNotesLoad(request, env, authenticateRequest);
            if (path === '/notes/list' && request.method === 'GET') return handleNotesList(request, env, authenticateRequest);
            if (path === '/notes/delete' && request.method === 'DELETE') return handleNotesDelete(request, env, authenticateRequest);
            
            // OBS Credentials endpoints (require authentication, 7 hour expiration)
            if (path === '/obs-credentials/save' && request.method === 'POST') return handleOBSCredentialsSave(request, env, authenticateRequest);
            if (path === '/obs-credentials/load' && request.method === 'GET') return handleOBSCredentialsLoad(request, env, authenticateRequest);
            if (path === '/obs-credentials/delete' && request.method === 'DELETE') return handleOBSCredentialsDelete(request, env, authenticateRequest);
            
            // Test endpoints
            if (path === '/test/email' && request.method === 'GET') return handleTestEmail(request, env);
            
            // Debug: Clear rate limit (for testing)
            if (path === '/debug/clear-rate-limit' && request.method === 'POST') {
                try {
                    const body = await request.json();
                    const { email } = body;
                    if (!email) {
                        return new Response(JSON.stringify({ error: 'email required' }), {
                            status: 400,
                            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                        });
                    }
                    const emailHash = await hashEmail(email);
                    const rateLimitKey = `ratelimit_otp_${emailHash}`;
                    await env.TWITCH_CACHE.delete(rateLimitKey);
                    return new Response(JSON.stringify({ success: true, message: 'Rate limit cleared' }), {
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                } catch (error) {
                    return new Response(JSON.stringify({ error: error.message }), {
                        status: 500,
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                }
            }
            
            // Health check
            if (path === '/health' || path === '/') return handleHealth(env, request);
            
            // Not found
            return new Response(JSON.stringify({ error: 'Not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        } catch (error) {
            // Check if it's a JWT secret error (configuration issue)
            if (error.message && error.message.includes('JWT_SECRET')) {
                return new Response(JSON.stringify({ 
                    error: 'Server configuration error',
                    message: 'JWT_SECRET environment variable is required. Please contact the administrator.',
                    details: 'The server is not properly configured. JWT_SECRET must be set via: wrangler secret put JWT_SECRET'
                }), {
                    status: 500,
                    headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                });
            }
            
            return new Response(JSON.stringify({ error: 'Internal server error', message: error.message }), {
                status: 500,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
    },
};


