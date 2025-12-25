/**
 * Verify OTP Handler
 * 
 * Handles OTP verification, user creation, and JWT token generation
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { hashEmail, generateUserId, constantTimeEquals } from '../../utils/crypto.js';
import { getCustomerKey } from '../../services/customer.js';
import {
    recordOTPFailure as recordOTPFailureService,
    recordOTPRequest as recordOTPRequestService
} from '../../services/rate-limit.js';
import { sendWebhook } from '../../services/webhooks.js';
import { trackUsage } from '../../services/analytics.js';
import { retrieveOTP, deleteOTP, incrementOTPAttempts } from './otp-storage.js';
import { ensureCustomerAccount } from './customer-creation.js';
import { createAuthToken } from './jwt-creation.js';
import { storeUserPreferences, getDefaultPreferences, getUserPreferences } from '../../services/user-preferences.js';
import { createGenericOTPError, createInternalErrorResponse } from './otp-errors.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    ENVIRONMENT?: string;
    [key: string]: any;
}

interface User {
    userId: string;
    email: string;
    displayName?: string;
    customerId?: string | null;
    createdAt?: string;
    lastLogin?: string;
}

/**
 * Get or create user with customer isolation
 */
async function getOrCreateUser(
    email: string,
    customerId: string | null,
    env: Env
): Promise<User> {
    const emailHash = await hashEmail(email);
    const emailLower = email.toLowerCase().trim();
    const userId = await generateUserId(emailLower);
    const userKey = getCustomerKey(customerId, `user_${emailHash}`);
    
    let user = await env.OTP_AUTH_KV.get(userKey, { type: 'json' }) as User | null;
    
    if (!user) {
        // Generate unique display name for new user
        const { generateUniqueDisplayName, reserveDisplayName } = await import('../../services/nameGenerator.js');
        const displayName = await generateUniqueDisplayName({
            customerId: customerId,
            maxAttempts: 10,
            includeNumber: true
        }, env);
        
        // Reserve the display name
        await reserveDisplayName(displayName, userId, customerId, env);
        
        // Create new user
        user = {
            userId,
            email: emailLower,
            displayName,
            customerId: customerId || null,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
        };
        await env.OTP_AUTH_KV.put(userKey, JSON.stringify(user), { expirationTtl: 31536000 }); // 1 year
        
        // Initialize user preferences with default values and display name
        const preferences = getDefaultPreferences();
        preferences.displayName.current = displayName;
        preferences.displayName.previousNames.push({
            name: displayName,
            changedAt: new Date().toISOString(),
            reason: 'auto-generated',
        });
        preferences.displayName.lastChangedAt = new Date().toISOString();
        await storeUserPreferences(userId, customerId, preferences, env);
        
        // Initialize user preferences with default values and display name
        const preferences = getDefaultPreferences();
        preferences.displayName.current = displayName;
        preferences.displayName.previousNames.push({
            name: displayName,
            changedAt: new Date().toISOString(),
            reason: 'auto-generated',
        });
        preferences.displayName.lastChangedAt = new Date().toISOString();
        await storeUserPreferences(userId, customerId, preferences, env);
    } else {
        // Ensure displayName exists (for users created before this feature)
        if (!user.displayName) {
            const { generateUniqueDisplayName, reserveDisplayName } = await import('../../services/nameGenerator.js');
            const displayName = await generateUniqueDisplayName({
                customerId: customerId,
                maxAttempts: 10,
                includeNumber: true
            }, env);
            await reserveDisplayName(displayName, userId, customerId, env);
            user.displayName = displayName;
        }
        
        // Ensure customerId is set (for users created before customer isolation)
        if (!user.customerId && customerId) {
            user.customerId = customerId;
        }
        
        // Update last login
        user.lastLogin = new Date().toISOString();
        await env.OTP_AUTH_KV.put(userKey, JSON.stringify(user), { expirationTtl: 31536000 });
        
        // Reset preferences TTL on login to keep it in sync with user data
        const preferences = await getUserPreferences(userId, customerId, env);
        await storeUserPreferences(userId, customerId, preferences, env);
    }
    
    return user;
}

/**
 * Verify OTP endpoint
 * POST /auth/verify-otp
 */
export async function handleVerifyOTP(
    request: Request,
    env: Env,
    customerId: string | null = null
): Promise<Response> {
    try {
        const body = await request.json();
        const { email, otp } = body;
        
        // Validate input
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return new Response(JSON.stringify({ 
                type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
                title: 'Bad Request',
                status: 400,
                detail: 'Valid email address required',
                instance: request.url,
            }), {
                status: 400,
                headers: { 
                    ...getCorsHeaders(env, request), 
                    'Content-Type': 'application/problem+json',
                },
            });
        }
        
        if (!otp || !/^\d{6}$/.test(otp)) {
            return new Response(JSON.stringify({ 
                type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
                title: 'Bad Request',
                status: 400,
                detail: 'Valid 6-digit OTP required',
                instance: request.url,
            }), {
                status: 400,
                headers: { 
                    ...getCorsHeaders(env, request), 
                    'Content-Type': 'application/problem+json',
                },
            });
        }
        
        const emailLower = email.toLowerCase().trim();
        const emailHash = await hashEmail(email);
        const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
        
        // Retrieve OTP data
        const otpResult = await retrieveOTP(email, customerId, env);
        if (!otpResult) {
            await recordOTPFailureService(emailHash, clientIP, customerId, env);
            const errorResponse = createGenericOTPError(request);
            errorResponse.headers.set('Content-Type', 'application/problem+json');
            Object.entries(getCorsHeaders(env, request)).forEach(([key, value]) => {
                errorResponse.headers.set(key, value);
            });
            return errorResponse;
        }
        
        const { otpData, otpKey, latestOtpKey } = otpResult;
        
        // Verify email matches (use constant-time comparison)
        if (!constantTimeEquals(otpData.email || '', emailLower)) {
            await recordOTPFailureService(emailHash, clientIP, customerId, env);
            const errorResponse = createGenericOTPError(request);
            errorResponse.headers.set('Content-Type', 'application/problem+json');
            Object.entries(getCorsHeaders(env, request)).forEach(([key, value]) => {
                errorResponse.headers.set(key, value);
            });
            return errorResponse;
        }
        
        // Check expiration
        if (new Date(otpData.expiresAt) < new Date()) {
            await deleteOTP(otpKey, latestOtpKey, env);
            await recordOTPFailureService(emailHash, clientIP, customerId, env);
            const errorResponse = createGenericOTPError(request);
            errorResponse.headers.set('Content-Type', 'application/problem+json');
            Object.entries(getCorsHeaders(env, request)).forEach(([key, value]) => {
                errorResponse.headers.set(key, value);
            });
            return errorResponse;
        }
        
        // Check attempts
        if (otpData.attempts >= 5) {
            await deleteOTP(otpKey, latestOtpKey, env);
            await recordOTPFailureService(emailHash, clientIP, customerId, env);
            
            return new Response(JSON.stringify({ 
                type: 'https://tools.ietf.org/html/rfc6585#section-4',
                title: 'Too Many Requests',
                status: 429,
                detail: 'Too many attempts. Please request a new OTP.',
                instance: request.url,
                remaining_attempts: 0,
            }), {
                status: 429,
                headers: { 
                    ...getCorsHeaders(env, request), 
                    'Content-Type': 'application/problem+json',
                },
            });
        }
        
        // Verify OTP using constant-time comparison to prevent timing attacks
        const isValidOTP = constantTimeEquals(otpData.otp || '', otp);
        
        if (!isValidOTP) {
            await incrementOTPAttempts(otpKey, otpData, env);
            
            // Track failed attempt
            if (customerId) {
                await trackUsage(customerId, 'failedAttempts', 1, env);
                await sendWebhook(customerId, 'otp.failed', {
                    email: emailLower,
                    remainingAttempts: 5 - otpData.attempts
                }, env);
            }
            
            await recordOTPFailureService(emailHash, clientIP, customerId, env);
            
            const genericError = createGenericOTPError(request);
            const errorData = JSON.parse(await genericError.text());
            errorData.remaining_attempts = 5 - otpData.attempts;
            
            return new Response(JSON.stringify(errorData), {
                status: 401,
                headers: { 
                    ...getCorsHeaders(env, request), 
                    'Content-Type': 'application/problem+json',
                },
            });
        }
        
        // OTP is valid! Delete it (single-use)
        await deleteOTP(otpKey, latestOtpKey, env);
        
        // Ensure customer account exists
        const resolvedCustomerId = await ensureCustomerAccount(emailLower, customerId, env);
        
        // Record successful OTP verification for statistics
        await recordOTPRequestService(emailHash, clientIP, resolvedCustomerId, env);
        
        // Get or create user
        const user = await getOrCreateUser(emailLower, resolvedCustomerId, env);
        
        // Track usage
        if (resolvedCustomerId) {
            await trackUsage(resolvedCustomerId, 'otpVerifications', 1, env);
            await trackUsage(resolvedCustomerId, 'successfulLogins', 1, env);
            
            // Send webhooks
            await sendWebhook(resolvedCustomerId, 'otp.verified', {
                userId: user.userId,
                email: emailLower
            }, env);
            
            // Check if new user
            const wasNewUser = !user.createdAt || 
                new Date(user.createdAt).toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
            
            if (wasNewUser) {
                await sendWebhook(resolvedCustomerId, 'user.created', {
                    userId: user.userId,
                    email: emailLower
                }, env);
            }
            
            await sendWebhook(resolvedCustomerId, 'user.logged_in', {
                userId: user.userId,
                email: emailLower
            }, env);
        }
        
        // Create JWT token and session
        const tokenResponse = await createAuthToken(user, resolvedCustomerId, env);
        
        return new Response(JSON.stringify(tokenResponse), {
            headers: { 
                ...getCorsHeaders(env, request), 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store', // OAuth 2.0 requirement
                'Pragma': 'no-cache',
            },
        });
    } catch (error: any) {
        console.error('[OTP Verify] Error:', error);
        console.error('[OTP Verify] Stack:', error?.stack);
        
        return createInternalErrorResponse(request, error, env);
    }
}

