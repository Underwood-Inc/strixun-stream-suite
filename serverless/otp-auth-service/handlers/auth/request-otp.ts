/**
 * Request OTP Handler
 * 
 * Handles OTP request endpoint with validation, rate limiting, and email sending
 */

// Service key encryption removed - it's obfuscation only (key is in frontend bundle)
import { checkQuota as checkQuotaService, trackUsage } from '../../services/analytics.js';
import { getCustomer } from '../../services/customer.js';
import {
    checkOTPRateLimit as checkOTPRateLimitService,
    recordOTPFailure as recordOTPFailureService,
    recordOTPRequest as recordOTPRequestService
} from '../../services/rate-limit.js';
import { sendWebhook } from '../../services/webhooks.js';
import { getCustomerCached } from '../../utils/cache.js';
import { getCorsHeaders } from '../../utils/cors.js';
import { getOtpCacheHeaders } from '../../utils/cache-headers.js';
import { generateOTP, hashEmail } from '../../utils/crypto.js';
import { getPlanLimits } from '../../utils/validation.js';
import { createEmailErrorResponse, createInternalErrorResponse } from './otp-errors.js';
import { storeOTP } from './otp-storage.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    ENVIRONMENT?: string;
    RESEND_API_KEY?: string;
    RESEND_FROM_EMAIL?: string;
    [key: string]: any;
}

// Wrapper for checkQuota to pass getPlanLimits
async function checkQuota(customerId: string | null, env: Env, email?: string) {
    return checkQuotaService(
        customerId,
        async (id) => await getCustomerCached(id, (cid) => getCustomer(cid, env)),
        getPlanLimits,
        env,
        email
    );
}

/**
 * Request OTP endpoint
 * POST /auth/request-otp
 */
/**
 * Parse request body as plain JSON
 * HTTPS provides transport security
 */
async function parseRequestBody(request: Request): Promise<{ email: string }> {
    const bodyText = await request.text();
    let body: any;
    
    try {
        body = JSON.parse(bodyText);
    } catch {
        throw new Error('Invalid JSON in request body');
    }
    
    if (body.email) {
        return { email: body.email };
    }
    
    throw new Error('Request body must contain email field');
}

export async function handleRequestOTP(
    request: Request,
    env: Env,
    customerId: string | null = null
): Promise<Response> {
    try {
        // Parse request body as plain JSON - HTTPS provides transport security
        const { email } = await parseRequestBody(request);
        
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
        
        // Check quota first (super admins are exempt)
        // Bypass quota/rate limits in test/dev mode for integration tests
        const isTestMode = env.ENVIRONMENT === 'test' || env.ENVIRONMENT === 'development' || env.ENVIRONMENT === 'dev';
        const quotaCheck = isTestMode ? { allowed: true } : await checkQuota(customerId, env, email);
        if (!quotaCheck.allowed) {
            // Send webhook for quota exceeded
            if (customerId) {
                await sendWebhook(customerId, 'quota.exceeded', {
                    reason: quotaCheck.reason,
                    quota: quotaCheck.quota,
                    usage: quotaCheck.usage
                }, env);
            }
            
            return new Response(JSON.stringify({ 
                type: 'https://tools.ietf.org/html/rfc6585#section-4',
                title: 'Too Many Requests',
                status: 429,
                detail: 'Quota exceeded',
                instance: request.url,
                reason: quotaCheck.reason,
                quota: quotaCheck.quota,
                usage: quotaCheck.usage,
            }), {
                status: 429,
                headers: { 
                    ...getCorsHeaders(env, request), 
                    'Content-Type': 'application/problem+json',
                    'X-Quota-Limit': quotaCheck.quota?.otpRequestsPerDay?.toString() || '',
                    'X-Quota-Remaining': quotaCheck.usage?.remainingDaily?.toString() || '0',
                    'Retry-After': '3600', // Retry after 1 hour
                },
            });
        }
        
        // Check rate limit (super admins are exempt)
        // Bypass rate limits in test/dev mode for integration tests
        const emailHash = await hashEmail(email);
        // CF-Connecting-IP is set by Cloudflare and cannot be spoofed
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
        const getCustomerFn = (cid: string) => getCustomer(cid, env);
        const rateLimit = isTestMode ? { allowed: true, remaining: 999, resetAt: new Date().toISOString() } : await checkOTPRateLimitService(
            emailHash,
            customerId,
            clientIP,
            (id: string) => getCustomerCached(id, getCustomerFn),
            env,
            email
        );
        
        if (!rateLimit.allowed) {
            // Record failed rate limit attempt
            await recordOTPFailureService(emailHash, clientIP, customerId, env);
            
            // Calculate time until reset
            const resetTime = new Date(rateLimit.resetAt);
            const now = new Date();
            const secondsUntilReset = Math.max(0, Math.ceil((resetTime.getTime() - now.getTime()) / 1000));
            const resetTimeFormatted = resetTime.toISOString();
            
            // Get detailed rate limit information for the error response
            const rateLimitDetails = {
                reason: rateLimit.reason || 'rate_limit_exceeded',
                emailLimit: rateLimit.emailLimit || (rateLimit.reason === 'email_rate_limit_exceeded' ? {
                    current: 0,
                    max: 0,
                    resetAt: rateLimit.resetAt
                } : undefined),
                ipLimit: rateLimit.ipLimit || (rateLimit.reason === 'ip_rate_limit_exceeded' ? {
                    current: 0,
                    max: 0,
                    resetAt: rateLimit.resetAt
                } : undefined),
                quotaLimit: !quotaCheck.allowed ? {
                    daily: quotaCheck.usage?.daily ? {
                        current: quotaCheck.usage.daily,
                        max: quotaCheck.quota?.otpRequestsPerDay || 0
                    } : undefined,
                    monthly: quotaCheck.usage?.monthly ? {
                        current: quotaCheck.usage.monthly,
                        max: quotaCheck.quota?.otpRequestsPerMonth || 0
                    } : undefined
                } : undefined,
                failedAttempts: rateLimit.failedAttempts
            };
            
            return new Response(JSON.stringify({ 
                type: 'https://tools.ietf.org/html/rfc6585#section-4',
                title: 'Too Many Requests',
                status: 429,
                detail: 'Too many requests. Please try again later.',
                instance: request.url,
                retry_after: secondsUntilReset,
                reset_at: rateLimit.resetAt,
                reset_at_iso: resetTimeFormatted,
                remaining: rateLimit.remaining,
                reason: rateLimit.reason || 'rate_limit_exceeded',
                rate_limit_details: rateLimitDetails,
            }), {
                status: 429,
                headers: { 
                    ...getCorsHeaders(env, request), 
                    'Content-Type': 'application/problem+json',
                    'Retry-After': secondsUntilReset.toString(),
                },
            });
        }
        
        // Generate OTP
        // E2E TEST MODE: Use E2E_TEST_OTP_CODE if available (allows tests to use static code)
        // SECURITY: Only works when ENVIRONMENT=test (never set in production)
        let otp = generateOTP();
        if (env.ENVIRONMENT === 'test' && env.E2E_TEST_OTP_CODE) {
            otp = env.E2E_TEST_OTP_CODE;
            console.log('[E2E] Using E2E_TEST_OTP_CODE for test mode');
        }
        
        // Log OTP for dev convenience (only in test/development mode)
        if (env.ENVIRONMENT === 'test' || env.ENVIRONMENT === 'development') {
            console.log(`[DEV] Generated OTP for ${email}: ${otp}`);
            console.log(`[DEV] Retrieve OTP via: GET http://localhost:8787/dev/otp?email=${encodeURIComponent(email)}`);
        }
        
        // Store OTP in KV with customer isolation
        const { otpKey, expiresAt } = await storeOTP(email, otp, customerId, env);
        
        // Get base URL from request for tracking pixel
        const url = new URL(request.url);
        const baseUrl = `${url.protocol}//${url.host}`;
        
        // Send email with tracking data
        // In test/dev mode, skip email sending (OTP is available via /dev/otp endpoint)
        if (!isTestMode) {
            try {
                const { sendOTPEmail } = await import('../email.js');
                const emailResult = await sendOTPEmail(email, otp, customerId, env, {
                    emailHash,
                    otpKey,
                    baseUrl,
                    expiresAt
                });
                console.log('OTP email sent successfully:', emailResult);
                
                // Track usage
                if (customerId) {
                    await trackUsage(customerId, 'otpRequests', 1, env);
                    await trackUsage(customerId, 'emailsSent', 1, env);
                    
                    // Send webhook
                    await sendWebhook(customerId, 'otp.requested', {
                        email: email.toLowerCase().trim(),
                        expiresIn: 600
                    }, env);
                }
                
                // Record successful OTP request for statistics
                await recordOTPRequestService(emailHash, clientIP, customerId, env);
            } catch (error: any) {
                // Log the full error for debugging
                console.error('Failed to send OTP email:', {
                    message: error?.message,
                    stack: error?.stack,
                    name: error?.name,
                    email: email.toLowerCase().trim(),
                    hasResendKey: !!env.RESEND_API_KEY,
                    hasResendFromEmail: !!env.RESEND_FROM_EMAIL,
                    errorType: error?.constructor?.name || typeof error
                });
                
                // Use centralized error handling
                return createEmailErrorResponse(request, error, env);
            }
        } else {
            // Test/dev mode: Skip email sending, just log and record stats
            // For local testing, use E2E_TEST_OTP_CODE from .dev.vars
            console.log(`[TEST/DEV] Skipping email send for ${email}. Using E2E_TEST_OTP_CODE for local tests.`);
            await recordOTPRequestService(emailHash, clientIP, customerId, env);
        }
        
        return new Response(JSON.stringify({ 
            success: true,
            message: 'OTP sent to email',
            expiresIn: 600,
            remaining: rateLimit.remaining
        }), {
            headers: { 
                ...getCorsHeaders(env, request), 
                ...getOtpCacheHeaders(),
                'Content-Type': 'application/json' 
            },
        });
    } catch (error: any) {
        console.error('OTP request error:', {
            message: error?.message,
            stack: error?.stack,
            name: error?.name,
            errorType: error?.constructor?.name || typeof error
        });
        
        return createInternalErrorResponse(request, error, env);
    }
}

