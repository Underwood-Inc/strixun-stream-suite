/**
 * Request OTP Handler
 * 
 * Handles OTP request endpoint with validation, rate limiting, and email sending
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { generateOTP, hashEmail } from '../../utils/crypto.js';
import {
    checkOTPRateLimit as checkOTPRateLimitService,
    recordOTPFailure as recordOTPFailureService,
    recordOTPRequest as recordOTPRequestService
} from '../../services/rate-limit.js';
import { checkQuota as checkQuotaService } from '../../services/analytics.js';
import { sendWebhook } from '../../services/webhooks.js';
import { trackUsage } from '../../services/analytics.js';
import { getCustomerCached } from '../../utils/cache.js';
import { getCustomer } from '../../services/customer.js';
import { getPlanLimits } from '../../utils/validation.js';
import { storeOTP } from './otp-storage.js';
import { createEmailErrorResponse, createInternalErrorResponse } from './otp-errors.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    ENVIRONMENT?: string;
    RESEND_API_KEY?: string;
    RESEND_FROM_EMAIL?: string;
    [key: string]: any;
}

// Wrapper for checkQuota to pass getPlanLimits
async function checkQuota(customerId: string | null, env: Env) {
    return checkQuotaService(
        customerId,
        async (id) => await getCustomerCached(id, (cid) => getCustomer(cid, env)),
        getPlanLimits,
        env
    );
}

/**
 * Request OTP endpoint
 * POST /auth/request-otp
 */
export async function handleRequestOTP(
    request: Request,
    env: Env,
    customerId: string | null = null
): Promise<Response> {
    try {
        const body = await request.json();
        const { email } = body;
        
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
        
        // Check quota first
        const quotaCheck = await checkQuota(customerId, env);
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
        
        // Check rate limit
        const emailHash = await hashEmail(email);
        const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
        const rateLimit = await checkOTPRateLimitService(
            emailHash,
            customerId,
            clientIP,
            (id) => getCustomerCached(id, env),
            env
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
        const otp = generateOTP();
        
        // Store OTP in KV with customer isolation
        const { otpKey, expiresAt } = await storeOTP(email, otp, customerId, env);
        
        // Get base URL from request for tracking pixel
        const url = new URL(request.url);
        const baseUrl = `${url.protocol}//${url.host}`;
        
        // Send email with tracking data
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
        
        return new Response(JSON.stringify({ 
            success: true,
            message: 'OTP sent to email',
            expiresIn: 600,
            remaining: rateLimit.remaining
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
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

