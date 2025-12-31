/**
 * Verify OTP Handler
 * 
 * Handles OTP verification, user creation, and JWT token generation
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { getOtpCacheHeaders } from '../../utils/cache-headers.js';
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
import { decryptWithServiceKey } from '@strixun/api-framework';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    ENVIRONMENT?: string;
    SERVICE_ENCRYPTION_KEY?: string; // Service encryption key for decrypting OTP requests (CRITICAL: Must match client VITE_SERVICE_ENCRYPTION_KEY)
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
 * 
 * Implements smart account recovery:
 * - If user account was deleted (expired TTL) but customer account exists,
 *   the user account is recreated with the recovered customerId
 * - This allows retaining customer information indefinitely while still
 *   having automated cleanup of user accounts
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
    
    // If user doesn't exist but we have a customerId, this is account recovery
    // The customer account was recovered by email in ensureCustomerAccount
    if (!user && customerId) {
        console.log(`[User Recovery] Recreating user account for ${emailLower} with recovered customerId: ${customerId}`);
    }
    
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
        
        // Update userId -> customerId index for O(1) lookups
        const { updateUserIndex } = await import('../../utils/user-index.js');
        await updateUserIndex(userId, customerId, env);
        
        // Initialize user preferences with default values and display name
        const preferences = getDefaultPreferences();
        preferences.displayName.current = displayName;
        preferences.displayName.previousNames.push({
            name: displayName,
            changedAt: new Date().toISOString(),
            reason: 'auto-generated',
        });
        // CRITICAL: Do NOT set lastChangedAt for auto-generated names
        // This allows users to change their name immediately after account creation
        // lastChangedAt should remain null until the user actually changes it themselves
        preferences.displayName.lastChangedAt = null;
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
        
        // Update userId -> customerId index (customerId may have changed)
        const { updateUserIndex } = await import('../../utils/user-index.js');
        await updateUserIndex(userId, user.customerId || customerId, env);
        
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
/**
 * Decrypt request body if encrypted, otherwise return as-is (backward compatibility)
 */
async function decryptRequestBody(request: Request, env: Env): Promise<{ email: string; otp: string }> {
    const body = await request.json();
    
    // Check if body is encrypted (has encrypted field)
    if (body && typeof body === 'object' && 'encrypted' in body && body.encrypted === true) {
        // Body is encrypted - decrypt using SERVICE_ENCRYPTION_KEY
        // In Cloudflare Workers, secrets are accessed via env.SECRET_NAME
        // NOTE: Frontend uses VITE_SERVICE_ENCRYPTION_KEY, but workers use SERVICE_ENCRYPTION_KEY
        const serviceKey = env.SERVICE_ENCRYPTION_KEY as string | undefined;
        if (!serviceKey || typeof serviceKey !== 'string') {
            throw new Error('SERVICE_ENCRYPTION_KEY is required for decrypting OTP requests. Set it via: wrangler secret put SERVICE_ENCRYPTION_KEY');
        }
        
        try {
            const decrypted = await decryptWithServiceKey(body, serviceKey);
            return decrypted as { email: string; otp: string };
        } catch (error: any) {
            const errorMessage = error?.message || String(error);
            console.error('[VerifyOTP] Decryption failed:', {
                error: errorMessage,
                hasKey: !!serviceKey,
                keyLength: serviceKey?.length || 0,
                encryptedFields: Object.keys(body || {}),
                errorType: error?.constructor?.name || typeof error
            });
            
            // Provide more specific error message
            if (errorMessage.includes('service key does not match')) {
                throw new Error('SERVICE_ENCRYPTION_KEY mismatch: The encryption key on the server does not match the client key. Please verify SERVICE_ENCRYPTION_KEY (worker) matches VITE_SERVICE_ENCRYPTION_KEY (frontend).');
            } else if (errorMessage.includes('Valid service key is required')) {
                throw new Error('SERVICE_ENCRYPTION_KEY not configured: Please set SERVICE_ENCRYPTION_KEY in Cloudflare Worker secrets via: wrangler secret put SERVICE_ENCRYPTION_KEY');
            } else {
                throw new Error(`Failed to decrypt OTP request: ${errorMessage}`);
            }
        }
    }
    
    // Body is not encrypted (backward compatibility)
    return body as { email: string; otp: string };
}

export async function handleVerifyOTP(
    request: Request,
    env: Env,
    customerId: string | null = null
): Promise<Response> {
    try {
        // Decrypt request body if encrypted
        const { email, otp } = await decryptRequestBody(request, env);
        
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
        
        // OTP length validation - matches shared-config/otp-config.ts
        // TODO: Import from shared-config/otp-config.ts when path resolution supports it
        const OTP_LENGTH = 9;
        const OTP_PATTERN = /^\d{9}$/;
        
        if (!otp || !OTP_PATTERN.test(otp)) {
            return new Response(JSON.stringify({ 
                type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
                title: 'Bad Request',
                status: 400,
                detail: `Valid ${OTP_LENGTH}-digit OTP required`,
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
        // CF-Connecting-IP is set by Cloudflare and cannot be spoofed
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
        
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
        
        // E2E TEST MODE: Accept E2E_TEST_OTP_CODE as valid OTP for testing
        // SECURITY: Only works when ENVIRONMENT=test (never set in production)
        // This allows tests to use a static OTP code from .dev.vars
        const isTestMode = env.ENVIRONMENT === 'test';
        const testOTPCode = env.E2E_TEST_OTP_CODE;
        const isTestOTP = isTestMode && testOTPCode && constantTimeEquals(otp, testOTPCode);
        
        // Verify OTP using constant-time comparison to prevent timing attacks
        // In test mode, also accept E2E_TEST_OTP_CODE
        const isValidOTP = constantTimeEquals(otpData.otp || '', otp) || isTestOTP;
        
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
        
        // BUSINESS RULE: Customer account MUST ALWAYS be created for users on login
        // ensureCustomerAccount will throw if it cannot create the account after retries
        let resolvedCustomerId: string;
        try {
            resolvedCustomerId = await ensureCustomerAccount(emailLower, customerId, env);
        } catch (customerError) {
            console.error(`[OTP Verify] CRITICAL: Failed to ensure customer account for ${emailLower}:`, customerError);
            // Return error response - customer account creation is required
            return new Response(JSON.stringify({
                type: 'https://tools.ietf.org/html/rfc7231#section-6.6.1',
                title: 'Internal Server Error',
                status: 500,
                detail: 'Failed to create customer account. Please try again or contact support.',
                instance: request.url,
            }), {
                status: 500,
                headers: {
                    ...getCorsHeaders(env, request),
                    'Content-Type': 'application/problem+json',
                },
            });
        }
        
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
        
        // Create JWT token and session (with IP tracking)
        const tokenResponse = await createAuthToken(user, resolvedCustomerId, env, request);
        
        return new Response(JSON.stringify(tokenResponse), {
            headers: { 
                ...getCorsHeaders(env, request), 
                ...getOtpCacheHeaders(),
                'Content-Type': 'application/json',
            },
        });
    } catch (error: any) {
        console.error('[OTP Verify] Error:', error);
        console.error('[OTP Verify] Stack:', error?.stack);
        
        return createInternalErrorResponse(request, error, env);
    }
}

