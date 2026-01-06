/**
 * Verify OTP Handler
 * 
 * Handles OTP verification, user creation, and JWT token generation
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { getOtpCacheHeaders } from '../../utils/cache-headers.js';
import { hashEmail, constantTimeEquals } from '../../utils/crypto.js';
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
import { storeUserPreferences, getDefaultPreferences, getCustomerPreferences } from '../../services/user-preferences.js';
import { createGenericOTPError, createInternalErrorResponse } from './otp-errors.js';
// decryptWithServiceKey removed - service key encryption was obfuscation only

interface Env {
    OTP_AUTH_KV: KVNamespace;
    ENVIRONMENT?: string;
    [key: string]: any;
}

/**
 * Customer session data structure (authentication only - stored in OTP_AUTH_KV)
 * CRITICAL: We ONLY use customerId - NO userId derived from email
 * CRITICAL: NO customer data (displayName, preferences) - only auth session data
 * Customer data belongs in CUSTOMER_KV and is managed by customer-api
 */
interface CustomerSession {
    customerId: string; // MANDATORY - Customer ID is the ONLY identifier (globally unique)
    email: string; // OTP email (used for authentication, NOT returned in responses)
    createdAt: string;
    lastLogin: string;
    // NO displayName - that's in CUSTOMER_KV
    // NO preferences - those are in CUSTOMER_KV
}

/**
 * Get or create customer data with customer isolation
 * 
 * CRITICAL: This is NOT "User" - we ONLY use Customer.
 * This function manages customer session data in OTP auth KV.
 * 
 * Implements smart account recovery:
 * - If customer session data was deleted (expired TTL) but customer account exists,
 *   the session data is recreated with the recovered customerId
 * - This allows retaining customer information indefinitely while still
 *   having automated cleanup of session data
 */
async function getOrCreateCustomerSession(
    email: string,
    customerId: string, // MANDATORY - no null
    env: Env
): Promise<CustomerSession> {
    // FAIL-FAST: customerId is MANDATORY
    if (!customerId) {
        throw new Error('Customer ID is MANDATORY. Customer account must be created first via ensureCustomerAccount.');
    }
    
    const emailHash = await hashEmail(email);
    const emailLower = email.toLowerCase().trim();
    // Keep key as `user_` for backward compatibility with existing data
    const customerKey = getCustomerKey(customerId, `user_${emailHash}`);
    
    let session = await env.OTP_AUTH_KV.get(customerKey, { type: 'json' }) as CustomerSession | null;
    
    if (!session) {
        // Create new customer session data - ONLY authentication data
        // NO displayName - that's managed by CUSTOMER_KV via customer-api
        // NO preferences - those are managed by CUSTOMER_KV via customer-api
        session = {
            customerId: customerId, // MANDATORY - the ONLY identifier (globally unique)
            email: emailLower, // OTP email - stored for internal use only
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
        };
        await env.OTP_AUTH_KV.put(customerKey, JSON.stringify(session), { expirationTtl: 31536000 }); // 1 year
    } else {
        // FAIL-FAST: Ensure customerId matches - no fallback
        if (session.customerId !== customerId) {
            throw new Error(`Customer ID mismatch: expected ${customerId}, got ${session.customerId}`);
        }
        
        // Update last login
        session.lastLogin = new Date().toISOString();
        await env.OTP_AUTH_KV.put(customerKey, JSON.stringify(session), { expirationTtl: 31536000 });
    }
    
    return session;
}

/**
 * Decrypt request body if encrypted, otherwise parse as plain JSON
 * Supports both encrypted (using API framework) and plain JSON requests
 * Backend accepts both for backward compatibility
 */
async function decryptRequestBody(request: Request, env: Env): Promise<{ email: string; otp: string }> {
    const bodyText = await request.text();
    let body: any;
    
    try {
        body = JSON.parse(bodyText);
    } catch {
        throw new Error('Invalid JSON in request body');
    }
    
    // Parse as plain JSON
    if (body.email && body.otp) {
        return { email: body.email, otp: body.otp };
    }
    
    throw new Error('Missing email or otp in request body');
}

/**
 * Verify OTP endpoint
 * POST /auth/verify-otp
 */
export async function handleVerifyOTP(request: Request, env: Env, customerId: string | null = null): Promise<Response> {
    // NOTE: customerId parameter may be null initially, but ensureCustomerAccount will resolve it to MANDATORY value
    try {
        // Decrypt/parse request body
        const { email, otp } = await decryptRequestBody(request, env);
        
        // Validate email
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
        // EXCEPTION: In test mode with E2E_TEST_OTP_CODE, don't delete so tests can reuse it
        if (!isTestOTP) {
            await deleteOTP(otpKey, latestOtpKey, env);
        }
        
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
        
        // Get or create customer session data (NOT user - we only use Customer)
        // CRITICAL: This only stores authentication session data in OTP_AUTH_KV
        // Customer data (displayName, preferences) is managed by CUSTOMER_KV via customer-api
        const session = await getOrCreateCustomerSession(emailLower, resolvedCustomerId, env);
        
        // Track usage
        if (resolvedCustomerId) {
            await trackUsage(resolvedCustomerId, 'otpVerifications', 1, env);
            await trackUsage(resolvedCustomerId, 'successfulLogins', 1, env);
            
            // Send webhooks (internal use - email is okay for webhooks)
            await sendWebhook(resolvedCustomerId, 'otp.verified', {
                customerId: session.customerId,
                email: emailLower // Internal webhook - email is acceptable
            }, env);
            
            // Check if new customer
            const wasNewCustomer = !session.createdAt || 
                new Date(session.createdAt).toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
            
            if (wasNewCustomer) {
                await sendWebhook(resolvedCustomerId, 'customer.created', {
                    customerId: session.customerId,
                    email: emailLower // Internal webhook - email is acceptable
                }, env);
            }
            
            await sendWebhook(resolvedCustomerId, 'customer.logged_in', {
                customerId: session.customerId,
                email: emailLower // Internal webhook - email is acceptable
            }, env);
        }
        
        // Create JWT token and session (with IP tracking)
        // Fetch customer display name from CUSTOMER_KV via customer-api
        // CRITICAL: Display name is NOT stored in OTP_AUTH_KV - it's in CUSTOMER_KV
        const { fetchDisplayNameByCustomerId } = await import('@strixun/api-framework');
        let displayName: string | null = null;
        try {
            displayName = await fetchDisplayNameByCustomerId(session.customerId, env);
        } catch (error) {
            console.error('[OTP Verify] Failed to fetch display name:', error);
            // Continue without display name - not critical for login
        }
        
        // CRITICAL: createAuthToken expects Customer object with displayName
        // Create a temporary object for token creation (displayName is required for token payload)
        const customerForToken = {
            customerId: session.customerId,
            email: session.email,
            displayName: displayName || 'Unknown', // Fallback if fetch failed
            createdAt: session.createdAt,
            lastLogin: session.lastLogin,
        };
        
        // CRITICAL: This will NOT return OTP email in response body
        const tokenResponse = await createAuthToken(customerForToken, session.customerId, env, request);
        
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

