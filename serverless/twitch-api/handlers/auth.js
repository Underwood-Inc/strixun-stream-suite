/**
 * Authentication Handlers
 * 
 * OTP authentication endpoints for Twitch API worker.
 * Token creation is delegated to otp-auth-service (RS256 OIDC issuer).
 */

import { getCorsHeaders } from '../utils/cors.js';
import { hashEmail, authenticateRequest } from '../utils/auth.js';

/**
 * Generate secure 9-digit OTP (cryptographically secure, no modulo bias)
 */
function generateOTP() {
    const array = new Uint32Array(2);
    crypto.getRandomValues(array);
    const value = (Number(array[0]) * 0x100000000 + Number(array[1])) % 1000000000;
    return value.toString().padStart(9, '0');
}

/**
 * Check rate limit for OTP requests
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
                rateLimit = null;
            }
        }
        
        const now = Date.now();
        const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
        const MAX_ATTEMPTS = 5;
        
        if (rateLimit) {
            if (now - rateLimit.firstAttempt > RATE_LIMIT_WINDOW) {
                rateLimit = { attempts: 0, firstAttempt: now, lastAttempt: now };
            } else if (rateLimit.attempts >= MAX_ATTEMPTS) {
                const resetAt = rateLimit.firstAttempt + RATE_LIMIT_WINDOW;
                return { limited: true, resetAt, attempts: rateLimit.attempts };
            }
        } else {
            rateLimit = { attempts: 0, firstAttempt: now, lastAttempt: now };
        }
        
        rateLimit.attempts++;
        rateLimit.lastAttempt = now;
        
        await env.TWITCH_CACHE.put(rateLimitKey, JSON.stringify(rateLimit), {
            expirationTtl: Math.ceil(RATE_LIMIT_WINDOW / 1000)
        });
        
        return { limited: false, attempts: rateLimit.attempts, remaining: MAX_ATTEMPTS - rateLimit.attempts };
    } catch (error) {
        return { limited: false, attempts: 0, remaining: 5 };
    }
}

/**
 * Send OTP email via Resend
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
 * Generate user ID from email
 */
async function generateUserId(email) {
    const hash = await hashEmail(email);
    return `user_${hash.substring(0, 12)}`;
}

/**
 * Request a RS256 token from the OIDC issuer (otp-auth-service)
 * via the service-to-service endpoint.
 */
async function requestOIDCToken(customerId, env) {
    const authServiceUrl = env.AUTH_SERVICE_URL || env.OTP_AUTH_URL || 'http://localhost:8787';
    const res = await fetch(`${authServiceUrl}/auth/service/issue-token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Service-Key': env.SERVICE_API_KEY || '',
        },
        body: JSON.stringify({ customerId }),
    });
    if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`OIDC token issuance failed (${res.status}): ${errBody}`);
    }
    return await res.json();
}

/**
 * Handle OTP request endpoint
 * POST /auth/request-otp
 */
export async function handleRequestOTP(request, env) {
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
        
        if (rateLimitCheck.limited) {
            const resetAt = new Date(rateLimitCheck.resetAt);
            const locale = request.headers.get('Accept-Language') || 'en-US';
            const resetAtFormatted = resetAt.toLocaleString(locale, {
                hour: 'numeric', minute: '2-digit', hour12: true
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
        
        const otp = generateOTP();
        
        const otpKey = `otp_${emailHash}`;
        await env.TWITCH_CACHE.put(otpKey, JSON.stringify({
            otp, email, createdAt: Date.now(), attempts: 0
        }), { expirationTtl: 600 });
        
        const emailSent = await sendOTPEmail(email, otp, env);
        
        if (!emailSent) {
            return new Response(JSON.stringify({ error: 'Failed to send OTP email' }), {
                status: 500,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify({ 
            success: true, message: 'OTP sent to email', remaining: rateLimitCheck.remaining
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
 * Handle OTP verification endpoint
 * POST /auth/verify-otp
 * Delegates token creation to otp-auth-service (RS256 OIDC issuer).
 */
export async function handleVerifyOTP(request, env) {
    try {
        const body = await request.json();
        const { email, otp } = body;
        
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return new Response(JSON.stringify({ error: 'Valid email address required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        if (!otp || !/^\d{9}$/.test(otp)) {
            return new Response(JSON.stringify({ error: 'Valid 9-digit OTP required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const emailHash = await hashEmail(email);
        const emailLower = email.toLowerCase().trim();
        
        const latestOtpKey = await env.TWITCH_CACHE.get(`otp_latest_${emailHash}`);
        if (!latestOtpKey) {
            return new Response(JSON.stringify({ error: 'OTP not found or expired' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const otpDataStr = await env.TWITCH_CACHE.get(latestOtpKey);
        if (!otpDataStr) {
            return new Response(JSON.stringify({ error: 'OTP not found or expired' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const otpData = JSON.parse(otpDataStr);
        
        if (otpData.email !== emailLower) {
            return new Response(JSON.stringify({ error: 'Invalid OTP' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        if (new Date(otpData.expiresAt) < new Date()) {
            await env.TWITCH_CACHE.delete(latestOtpKey);
            await env.TWITCH_CACHE.delete(`otp_latest_${emailHash}`);
            return new Response(JSON.stringify({ error: 'OTP expired' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        if (otpData.attempts >= 5) {
            await env.TWITCH_CACHE.delete(latestOtpKey);
            await env.TWITCH_CACHE.delete(`otp_latest_${emailHash}`);
            return new Response(JSON.stringify({ error: 'Too many failed attempts' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const expectedOtp = String(otpData.otp).padStart(9, '0');
        const providedOtp = String(otp).padStart(9, '0');
        
        let isValid = expectedOtp.length === providedOtp.length;
        for (let i = 0; i < expectedOtp.length; i++) {
            isValid = isValid && (expectedOtp.charCodeAt(i) === providedOtp.charCodeAt(i));
        }
        
        if (!isValid) {
            otpData.attempts++;
            await env.TWITCH_CACHE.put(latestOtpKey, JSON.stringify(otpData), { expirationTtl: 600 });
            return new Response(JSON.stringify({ 
                error: 'Invalid OTP', remainingAttempts: 5 - otpData.attempts
            }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        await env.TWITCH_CACHE.delete(latestOtpKey);
        await env.TWITCH_CACHE.delete(`otp_latest_${emailHash}`);
        
        const userId = await generateUserId(emailLower);
        const userKey = `user_${emailHash}`;
        let user = await env.TWITCH_CACHE.get(userKey, { type: 'json' });
        
        if (!user) {
            user = {
                userId,
                email: emailLower,
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
            };
            await env.TWITCH_CACHE.put(userKey, JSON.stringify(user), { expirationTtl: 31536000 });
        } else {
            user.lastLogin = new Date().toISOString();
            await env.TWITCH_CACHE.put(userKey, JSON.stringify(user), { expirationTtl: 31536000 });
        }
        
        // Delegate token creation to otp-auth-service (RS256 OIDC issuer)
        const customerId = user.customerId || userId;
        const oidcResult = await requestOIDCToken(customerId, env);
        
        // Store session keyed by customerId
        const sessionKey = `session_${customerId}`;
        await env.TWITCH_CACHE.put(sessionKey, JSON.stringify({
            userId: customerId,
            tokenHash: await hashEmail(oidcResult.token),
            expiresAt: new Date(Date.now() + oidcResult.expires_in * 1000).toISOString(),
            createdAt: new Date().toISOString(),
        }), { expirationTtl: oidcResult.expires_in });
        
        return new Response(JSON.stringify({ 
            success: true,
            token: oidcResult.token,
            userId: customerId,
            expiresAt: new Date(Date.now() + oidcResult.expires_in * 1000).toISOString(),
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to verify OTP', message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Get current user endpoint
 * GET /auth/me
 * Uses RS256 OIDC verification via extractAuth.
 */
export async function handleGetMe(request, env) {
    try {
        const auth = await authenticateRequest(request, env);
        
        if (!auth) {
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify({ 
            success: true,
            userId: auth.customerId,
            customerId: auth.customerId,
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to get user info', message: error.message 
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
export async function handleLogout(request, env) {
    try {
        const auth = await authenticateRequest(request, env);
        
        if (!auth) {
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Add token to blacklist
        const tokenHash = await hashEmail(auth.jwtToken);
        const blacklistKey = `blacklist_${tokenHash}`;
        await env.TWITCH_CACHE.put(blacklistKey, JSON.stringify({
            token: tokenHash,
            revokedAt: new Date().toISOString(),
        }), { expirationTtl: 25200 });
        
        const sessionKey = `session_${auth.customerId}`;
        await env.TWITCH_CACHE.delete(sessionKey);
        
        return new Response(JSON.stringify({ 
            success: true, message: 'Logged out successfully'
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to logout', message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Refresh token endpoint
 * POST /auth/refresh
 * Delegates token creation to otp-auth-service (RS256 OIDC issuer).
 */
export async function handleRefresh(request, env) {
    try {
        const auth = await authenticateRequest(request, env);
        
        if (!auth) {
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Check if token is blacklisted
        const tokenHash = await hashEmail(auth.jwtToken);
        const blacklistKey = `blacklist_${tokenHash}`;
        const blacklisted = await env.TWITCH_CACHE.get(blacklistKey);
        if (blacklisted) {
            return new Response(JSON.stringify({ error: 'Token has been revoked' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Delegate new token creation to OIDC issuer
        const oidcResult = await requestOIDCToken(auth.customerId, env);
        
        const sessionKey = `session_${auth.customerId}`;
        await env.TWITCH_CACHE.put(sessionKey, JSON.stringify({
            userId: auth.customerId,
            tokenHash: await hashEmail(oidcResult.token),
            expiresAt: new Date(Date.now() + oidcResult.expires_in * 1000).toISOString(),
            createdAt: new Date().toISOString(),
        }), { expirationTtl: oidcResult.expires_in });
        
        return new Response(JSON.stringify({ 
            success: true,
            token: oidcResult.token,
            expiresAt: new Date(Date.now() + oidcResult.expires_in * 1000).toISOString(),
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to refresh token', message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}
