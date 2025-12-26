/**
 * OTP Handlers
 * Handles OTP request and verification
 */

import { getCorsHeaders } from '../../utils/cors.js';
import {
    generateOTP,
    hashEmail,
    generateUserId,
    createJWT,
    getJWTSecret,
    constantTimeEquals
} from '../../utils/crypto.js';
import { getCustomerKey, generateCustomerId, storeCustomer, getCustomerByEmail } from '../../services/customer.js';
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
import { createApiKeyForCustomer } from '../../services/api-key.js';

// Wrapper for checkQuota to pass getPlanLimits
async function checkQuota(customerId, env) {
    return checkQuotaService(customerId, async (id) => await getCustomerCached(id, (cid) => getCustomer(cid, env)), getPlanLimits, env);
}

/**
 * Request OTP endpoint
 * POST /auth/request-otp
 */
export async function handleRequestOTP(request, env, customerId = null) {
    try {
        const body = await request.json();
        const { email } = body;
        
        // Validate email
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            // RFC 7807 Problem Details for HTTP APIs
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
            
            // RFC 7807 Problem Details for HTTP APIs
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
        const rateLimit = await checkOTPRateLimitService(emailHash, customerId, clientIP, (id) => getCustomerCached(id, env), env);
        
        if (!rateLimit.allowed) {
            // Record failed rate limit attempt
            await recordOTPFailureService(emailHash, clientIP, customerId, env);
            
            // Calculate time until reset
            const resetTime = new Date(rateLimit.resetAt);
            const now = new Date();
            const secondsUntilReset = Math.max(0, Math.ceil((resetTime.getTime() - now.getTime()) / 1000));
            
            // Format reset time for display using browser locale (will be localized on client)
            // Use ISO string and let client format it with their locale
            // Note: We don't include time in the error message - the client will display
            // a real-time countdown that's more accurate and updates dynamically
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
            
            // RFC 7807 Problem Details for HTTP APIs
            return new Response(JSON.stringify({ 
                type: 'https://tools.ietf.org/html/rfc6585#section-4',
                title: 'Too Many Requests',
                status: 429,
                detail: 'Too many requests. Please try again later.',
                instance: request.url,
                retry_after: secondsUntilReset,
                reset_at: rateLimit.resetAt,
                reset_at_iso: resetTimeFormatted, // ISO string for client-side localization
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
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        
        // Store OTP in KV with customer isolation
        const otpKey = getCustomerKey(customerId, `otp_${emailHash}_${Date.now()}`);
        await env.OTP_AUTH_KV.put(otpKey, JSON.stringify({
            email: email.toLowerCase().trim(),
            otp,
            expiresAt: expiresAt.toISOString(),
            attempts: 0,
        }), { expirationTtl: 600 }); // 10 minutes TTL
        
        // Also store latest OTP for quick lookup (overwrites previous)
        const latestOtpKey = getCustomerKey(customerId, `otp_latest_${emailHash}`);
        await env.OTP_AUTH_KV.put(latestOtpKey, otpKey, { expirationTtl: 600 });
        
        // Send email
        try {
            const { sendOTPEmail } = await import('../email.js');
            const emailResult = await sendOTPEmail(email, otp, customerId, env, {
                expiresAt: expiresAt.toISOString()
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
        } catch (error) {
            // Log the full error for debugging
            console.error('Failed to send OTP email:', {
                message: error.message,
                stack: error.stack,
                name: error.name,
                email: email.toLowerCase().trim(),
                hasResendKey: !!env.RESEND_API_KEY,
                hasResendFromEmail: !!env.RESEND_FROM_EMAIL,
                errorType: error.constructor?.name || typeof error
            });
            
            // Determine error type and provide appropriate message
            const isDev = !env.ENVIRONMENT || env.ENVIRONMENT === 'development' || env.ENVIRONMENT === 'local';
            const errorMessage = error.message || 'Unknown error';
            const errorName = error.name || '';
            
            // Extract HTTP status code from Resend API errors if present
            let httpStatus = 500;
            let resendStatusCode = null;
            let resendErrorDetails = null;
            
            // Parse Resend API error details
            if (errorMessage.includes('Resend API error:')) {
                const statusMatch = errorMessage.match(/Resend API error:\s*(\d+)/);
                if (statusMatch) {
                    resendStatusCode = parseInt(statusMatch[1], 10);
                    httpStatus = resendStatusCode >= 400 && resendStatusCode < 600 ? resendStatusCode : 500;
                }
                // Extract error message after status code
                const messageMatch = errorMessage.match(/Resend API error:\s*\d+\s*-\s*(.+)/);
                if (messageMatch) {
                    resendErrorDetails = messageMatch[1];
                }
            }
            
            // Check for network errors
            const isNetworkError = errorName === 'TypeError' && (
                errorMessage.includes('fetch') || 
                errorMessage.includes('network') || 
                errorMessage.includes('Failed to fetch') ||
                errorMessage.includes('NetworkError') ||
                errorMessage.includes('Network request failed')
            );
            
            // Check for timeout errors
            const isTimeoutError = errorName === 'AbortError' || 
                errorMessage.includes('timeout') || 
                errorMessage.includes('aborted');
            
            // Check for configuration errors
            let userMessage = 'Failed to send email. Please try again later.';
            let errorCode = 'email_send_failed';
            let httpStatusCode = httpStatus;
            
            if (errorMessage.includes('RESEND_API_KEY not configured') || !env.RESEND_API_KEY) {
                userMessage = 'Email service is not configured. Please contact support.';
                errorCode = 'email_service_not_configured';
                httpStatusCode = 500;
            } else if (errorMessage.includes('RESEND_FROM_EMAIL') || !env.RESEND_FROM_EMAIL) {
                userMessage = 'Email service is not configured. Please contact support.';
                errorCode = 'email_service_not_configured';
                httpStatusCode = 500;
            } else if (isNetworkError) {
                userMessage = 'Network error: Unable to connect to email service. Please check your internet connection and try again.';
                errorCode = 'network_error';
                httpStatusCode = 503; // Service Unavailable
            } else if (isTimeoutError) {
                userMessage = 'Request timeout: Email service took too long to respond. Please try again.';
                errorCode = 'timeout_error';
                httpStatusCode = 504; // Gateway Timeout
            } else if (errorMessage.includes('Resend API error')) {
                // Resend API returned an error - provide specific messages based on status code
                if (resendStatusCode === 400) {
                    userMessage = 'Invalid email request: The email address or email content is invalid. Please check your email address and try again.';
                    errorCode = 'invalid_email_request';
                } else if (resendStatusCode === 401) {
                    userMessage = 'Email service authentication failed: The email service API key is invalid or expired. Please contact support.';
                    errorCode = 'email_service_auth_failed';
                } else if (resendStatusCode === 403) {
                    userMessage = 'Email service access denied: The email service has restricted access. This may be due to an unverified domain or account limitations. Please contact support.';
                    errorCode = 'email_service_forbidden';
                } else if (resendStatusCode === 429) {
                    userMessage = 'Email service rate limit exceeded: Too many emails sent. Please wait a few minutes and try again.';
                    errorCode = 'email_service_rate_limited';
                    httpStatusCode = 429;
                } else if (resendStatusCode === 500 || resendStatusCode === 502 || resendStatusCode === 503) {
                    userMessage = `Email service error (${resendStatusCode}): The email service is experiencing issues. Please try again in a few moments.`;
                    errorCode = 'email_service_error';
                    httpStatusCode = 502; // Bad Gateway (upstream service error)
                } else if (resendStatusCode) {
                    userMessage = `Email service error (${resendStatusCode}): ${resendErrorDetails || 'An error occurred while sending the email. Please try again.'}`;
                    errorCode = 'email_api_error';
                    httpStatusCode = resendStatusCode >= 400 && resendStatusCode < 500 ? resendStatusCode : 502;
                } else {
                    userMessage = `Email service error: ${resendErrorDetails || 'An error occurred while sending the email. Please try again.'}`;
                    errorCode = 'email_api_error';
                }
            } else if (errorMessage.includes('email') && (errorMessage.includes('invalid') || errorMessage.includes('validation'))) {
                // Email validation error from provider
                userMessage = 'Invalid email address: The email address format is invalid. Please check your email address and try again.';
                errorCode = 'invalid_email';
                httpStatusCode = 400;
            } else if (errorMessage.includes('KV') || errorMessage.includes('storage') || errorMessage.includes('database')) {
                // Storage/KV errors
                userMessage = 'Storage error: Unable to save OTP code. Please try again.';
                errorCode = 'storage_error';
                httpStatusCode = 500;
            } else {
                // Generic error - provide more context
                userMessage = `Internal server error: ${isDev ? errorMessage : 'An unexpected error occurred while sending the email. Please try again.'}`;
                errorCode = 'internal_error';
                httpStatusCode = 500;
            }
            
            // Build error response with detailed information
            const errorResponse = {
                type: 'https://tools.ietf.org/html/rfc7231#section-6.6.1',
                title: httpStatusCode >= 500 ? 'Internal Server Error' : 
                       httpStatusCode === 429 ? 'Too Many Requests' :
                       httpStatusCode === 503 ? 'Service Unavailable' :
                       httpStatusCode === 504 ? 'Gateway Timeout' :
                       'Bad Request',
                status: httpStatusCode,
                detail: userMessage,
                error: userMessage, // Backward compatibility
                errorCode: errorCode,
                instance: request.url,
            };
            
            // Add detailed information in development
            if (isDev) {
                errorResponse.details = errorMessage;
                errorResponse.stack = error.stack;
                errorResponse.name = errorName;
                if (resendStatusCode) {
                    errorResponse.resendStatusCode = resendStatusCode;
                }
                if (resendErrorDetails) {
                    errorResponse.resendErrorDetails = resendErrorDetails;
                }
                if (!env.RESEND_API_KEY) {
                    errorResponse.hint = 'RESEND_API_KEY is not configured. Set it via: wrangler secret put RESEND_API_KEY';
                } else if (!env.RESEND_FROM_EMAIL) {
                    errorResponse.hint = 'RESEND_FROM_EMAIL is not configured. Set it via: wrangler secret put RESEND_FROM_EMAIL';
                }
            }
            
            // Return error response
            return new Response(JSON.stringify(errorResponse), {
                status: httpStatusCode,
                headers: { 
                    ...getCorsHeaders(env, request), 
                    'Content-Type': 'application/problem+json',
                },
            });
        }
        
        return new Response(JSON.stringify({ 
            success: true,
            message: 'OTP sent to email',
            expiresIn: 600,
            remaining: rateLimit.remaining
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('OTP request error:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            errorType: error.constructor?.name || typeof error
        });
        
        const isDev = !env.ENVIRONMENT || env.ENVIRONMENT === 'development' || env.ENVIRONMENT === 'local';
        const errorMessage = error.message || 'Unknown error';
        const errorName = error.name || '';
        
        // Determine error type
        let userMessage = 'Internal server error: An unexpected error occurred while processing your request.';
        let httpStatusCode = 500;
        let errorCode = 'internal_error';
        
        // Check for JSON parsing errors
        if (errorName === 'SyntaxError' && errorMessage.includes('JSON')) {
            userMessage = 'Invalid request: The request data is malformed. Please try again.';
            errorCode = 'invalid_request_format';
            httpStatusCode = 400;
        } else if (errorName === 'TypeError' && errorMessage.includes('fetch')) {
            userMessage = 'Network error: Unable to connect to the server. Please check your internet connection and try again.';
            errorCode = 'network_error';
            httpStatusCode = 503;
        } else if (errorMessage.includes('KV') || errorMessage.includes('storage')) {
            userMessage = 'Storage error: Unable to access data storage. Please try again.';
            errorCode = 'storage_error';
            httpStatusCode = 500;
        } else if (isDev) {
            userMessage = `Internal server error: ${errorMessage}`;
        }
        
        // RFC 7807 Problem Details for HTTP APIs
        const errorResponse = {
            type: 'https://tools.ietf.org/html/rfc7231#section-6.6.1',
            title: httpStatusCode >= 500 ? 'Internal Server Error' : 'Bad Request',
            status: httpStatusCode,
            detail: userMessage,
            error: userMessage, // Backward compatibility
            errorCode: errorCode,
            instance: request.url,
        };
        
        // Add detailed information in development
        if (isDev) {
            errorResponse.details = errorMessage;
            errorResponse.stack = error.stack;
            errorResponse.name = errorName;
        }
        
        return new Response(JSON.stringify(errorResponse), {
            status: httpStatusCode,
            headers: { 
                ...getCorsHeaders(env, request), 
                'Content-Type': 'application/problem+json',
            },
        });
    }
}

/**
 * Verify OTP endpoint
 * POST /auth/verify-otp
 */
export async function handleVerifyOTP(request, env, customerId = null) {
    try {
        const body = await request.json();
        const { email, otp } = body;
        
        // Validate input
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            // RFC 7807 Problem Details for HTTP APIs
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
            // RFC 7807 Problem Details for HTTP APIs
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
        
        const emailHash = await hashEmail(email);
        const emailLower = email.toLowerCase().trim();
        
        // Get client IP for statistics
        const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
        
        // Generic error message to prevent email enumeration
        const genericOTPError = {
            type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
            title: 'Unauthorized',
            status: 401,
            detail: 'Invalid or expired OTP code. Please request a new OTP code.',
            instance: request.url,
        };
        
        // Try to get latest OTP key - try with customer prefix first, then without (for backward compatibility)
        let latestOtpKey = getCustomerKey(customerId, `otp_latest_${emailHash}`);
        let latestOtpKeyValue = await env.OTP_AUTH_KV.get(latestOtpKey);
        
        // If not found with customer prefix and customerId is null, try without prefix
        // This handles cases where OTP was requested before customer isolation was implemented
        if (!latestOtpKeyValue && !customerId) {
            const fallbackKey = `otp_latest_${emailHash}`;
            latestOtpKeyValue = await env.OTP_AUTH_KV.get(fallbackKey);
            if (latestOtpKeyValue) {
                latestOtpKey = fallbackKey; // Use the fallback key for subsequent operations
            }
        }
        
        if (!latestOtpKeyValue) {
            // Record failure for statistics
            await recordOTPFailureService(emailHash, clientIP, customerId, env);
            
            // Use generic error to prevent email enumeration
            return new Response(JSON.stringify(genericOTPError), {
                status: 401,
                headers: { 
                    ...getCorsHeaders(env, request), 
                    'Content-Type': 'application/problem+json',
                },
            });
        }
        
        // Get OTP data
        const otpDataStr = await env.OTP_AUTH_KV.get(latestOtpKeyValue);
        if (!otpDataStr) {
            // Record failure for statistics
            await recordOTPFailureService(emailHash, clientIP, customerId, env);
            
            // Use generic error to prevent email enumeration
            return new Response(JSON.stringify(genericOTPError), {
                status: 401,
                headers: { 
                    ...getCorsHeaders(env, request), 
                    'Content-Type': 'application/problem+json',
                },
            });
        }
        
        let otpData;
        try {
            otpData = JSON.parse(otpDataStr);
        } catch (e) {
            // Record failure for statistics
            await recordOTPFailureService(emailHash, clientIP, customerId, env);
            
            // Use generic error to prevent email enumeration
            return new Response(JSON.stringify(genericOTPError), {
                status: 401,
                headers: { 
                    ...getCorsHeaders(env, request), 
                    'Content-Type': 'application/problem+json',
                },
            });
        }
        
        // Verify email matches (use constant-time comparison)
        if (!constantTimeEquals(otpData.email || '', emailLower)) {
            // Record failure for statistics
            await recordOTPFailureService(emailHash, clientIP, customerId, env);
            
            // Use generic error to prevent email enumeration
            return new Response(JSON.stringify(genericOTPError), {
                status: 401,
                headers: { 
                    ...getCorsHeaders(env, request), 
                    'Content-Type': 'application/problem+json',
                },
            });
        }
        
        // Check expiration
        if (new Date(otpData.expiresAt) < new Date()) {
            await env.OTP_AUTH_KV.delete(latestOtpKeyValue);
            await env.OTP_AUTH_KV.delete(latestOtpKey);
            
            // Record failure for statistics
            await recordOTPFailureService(emailHash, clientIP, customerId, env);
            
            // Use generic error to prevent email enumeration
            return new Response(JSON.stringify(genericOTPError), {
                status: 401,
                headers: { 
                    ...getCorsHeaders(env, request), 
                    'Content-Type': 'application/problem+json',
                },
            });
        }
        
        // Check attempts
        if (otpData.attempts >= 5) {
            await env.OTP_AUTH_KV.delete(latestOtpKeyValue);
            await env.OTP_AUTH_KV.delete(latestOtpKey);
            
            // Record failure for statistics
            await recordOTPFailureService(emailHash, clientIP, customerId, env);
            
            // RFC 7807 Problem Details for HTTP APIs
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
            otpData.attempts++;
            await env.OTP_AUTH_KV.put(latestOtpKeyValue, JSON.stringify(otpData), { expirationTtl: 600 });
            
            // Track failed attempt
            if (customerId) {
                await trackUsage(customerId, 'failedAttempts', 1, env);
                
                // Send webhook for failed attempt
                await sendWebhook(customerId, 'otp.failed', {
                    email: emailLower,
                    remainingAttempts: 5 - otpData.attempts
                }, env);
            }
            
            // Record failure for statistics
            await recordOTPFailureService(emailHash, clientIP, customerId, env);
            
            // Use generic error to prevent email enumeration
            return new Response(JSON.stringify({
                ...genericOTPError,
                remaining_attempts: 5 - otpData.attempts,
            }), {
                status: 401,
                headers: { 
                    ...getCorsHeaders(env, request), 
                    'Content-Type': 'application/problem+json',
                },
            });
        }
        
        // OTP is valid! Delete it (single-use)
        await env.OTP_AUTH_KV.delete(latestOtpKeyValue);
        await env.OTP_AUTH_KV.delete(latestOtpKey);
        
        // ALWAYS ensure user has a customer account (past, present, future)
        // This is safe - customer accounts are just organizational data, not a security concern
        // Wrap in try-catch to prevent customer creation failures from blocking OTP verification
        let resolvedCustomerId = customerId;
        if (!resolvedCustomerId) {
            try {
                console.log(`[OTP Verify] No customerId provided, looking up customer by email: ${emailLower}`);
                const existingCustomer = await getCustomerByEmail(emailLower, env);
                if (existingCustomer) {
                    resolvedCustomerId = existingCustomer.customerId;
                    console.log(`[OTP Verify] Found existing customer: ${resolvedCustomerId}`);
                } else {
                    // ALWAYS create customer account for ALL users (dashboard or API end-users)
                    // This ensures every user has a customer ID for consistent data organization
                    console.log(`[OTP Verify] No existing customer found, auto-creating customer account for: ${emailLower}`);
                    resolvedCustomerId = generateCustomerId();
                    const emailDomain = emailLower.split('@')[1] || 'unknown';
                    const companyName = emailDomain.split('.')[0] || 'My App';
                    
                    const customerData = {
                        customerId: resolvedCustomerId,
                        name: emailLower.split('@')[0], // Use email prefix as name
                        email: emailLower,
                        companyName: companyName.charAt(0).toUpperCase() + companyName.slice(1),
                        plan: 'free',
                        status: 'active',
                        createdAt: new Date().toISOString(),
                        configVersion: 1,
                        config: {
                            emailConfig: {
                                fromEmail: null,
                                fromName: companyName.charAt(0).toUpperCase() + companyName.slice(1),
                                subjectTemplate: 'Your {{appName}} Verification Code',
                                htmlTemplate: null,
                                textTemplate: null,
                                variables: {
                                    appName: companyName.charAt(0).toUpperCase() + companyName.slice(1),
                                    brandColor: '#007bff',
                                    footerText: `© ${new Date().getFullYear()} ${companyName.charAt(0).toUpperCase() + companyName.slice(1)}`,
                                    supportUrl: null,
                                    logoUrl: null
                                }
                            },
                            rateLimits: {
                                otpRequestsPerHour: 3,
                                otpRequestsPerDay: 50,
                                maxUsers: 100
                            },
                            webhookConfig: {
                                url: null,
                                secret: null,
                                events: []
                            },
                            allowedOrigins: []
                        },
                        features: {
                            customEmailTemplates: false,
                            webhooks: false,
                            analytics: false,
                            sso: false
                        }
                    };
                    
                    // Store customer BEFORE creating JWT to ensure it exists
                    await storeCustomer(resolvedCustomerId, customerData, env);
                    console.log(`[OTP Verify] Customer account created and stored: ${resolvedCustomerId} for ${emailLower}`);
                    
                    // Verify the customer was stored correctly (with retry for eventual consistency)
                    let verifyCustomer = await getCustomerByEmail(emailLower, env);
                    if (!verifyCustomer || verifyCustomer.customerId !== resolvedCustomerId) {
                        // Wait a bit and retry (KV eventual consistency)
                        await new Promise(resolve => setTimeout(resolve, 100));
                        verifyCustomer = await getCustomerByEmail(emailLower, env);
                    }
                    
                    if (!verifyCustomer || verifyCustomer.customerId !== resolvedCustomerId) {
                        console.warn(`[OTP Verify] WARNING: Customer account verification failed! Expected ${resolvedCustomerId}, got ${verifyCustomer?.customerId || 'null'}. Continuing anyway.`);
                        // Don't throw - continue with OTP verification even if customer creation had issues
                    }
                    
                    // Generate initial API key for the customer (only for dashboard users, but safe to do for all)
                    // This allows users to immediately use the API without additional signup steps
                    // Wrap in try-catch to prevent API key creation failures from blocking OTP verification
                    try {
                        await createApiKeyForCustomer(resolvedCustomerId, 'Initial API Key', env);
                        console.log(`[OTP Verify] API key created for customer: ${resolvedCustomerId}`);
                    } catch (apiKeyError) {
                        console.error(`[OTP Verify] WARNING: Failed to create API key for customer ${resolvedCustomerId}:`, apiKeyError.message);
                        // Don't throw - continue with OTP verification even if API key creation failed
                    }
                }
            } catch (customerError) {
                console.error(`[OTP Verify] ERROR: Customer account creation/lookup failed:`, customerError);
                // Don't throw - continue with OTP verification using null customerId
                // The user can still authenticate, they just won't have a customer account
                resolvedCustomerId = null;
            }
        }
        
        // Record successful OTP verification for statistics
        await recordOTPRequestService(emailHash, clientIP, resolvedCustomerId, env);
        
        // Get or create user with customer isolation
        const userId = await generateUserId(emailLower);
        const userKey = getCustomerKey(resolvedCustomerId, `user_${emailHash}`);
        let user = await env.OTP_AUTH_KV.get(userKey, { type: 'json' });
        
        if (!user) {
            // Generate unique display name for new user
            const { generateUniqueDisplayName, reserveDisplayName } = await import('../services/nameGenerator.js');
            const displayName = await generateUniqueDisplayName({
                customerId: resolvedCustomerId,
                maxAttempts: 10,
                includeNumber: true
            }, env);
            
            // Reserve the display name
            await reserveDisplayName(displayName, userId, resolvedCustomerId, env);
            
            // Create new user
            user = {
                userId,
                email: emailLower,
                displayName, // Anonymized display name
                customerId: resolvedCustomerId || null,
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
            };
            await env.OTP_AUTH_KV.put(userKey, JSON.stringify(user), { expirationTtl: 31536000 }); // 1 year
        } else {
            // Ensure displayName exists (for users created before this feature)
            if (!user.displayName) {
                const { generateUniqueDisplayName, reserveDisplayName } = await import('../services/nameGenerator.js');
                const displayName = await generateUniqueDisplayName({
                    customerId: resolvedCustomerId,
                    maxAttempts: 10,
                    includeNumber: true
                }, env);
                await reserveDisplayName(displayName, userId, resolvedCustomerId, env);
                user.displayName = displayName;
            }
            
            // Ensure customerId is set (for users created before customer isolation)
            if (!user.customerId && resolvedCustomerId) {
                user.customerId = resolvedCustomerId;
            }
            
            // Update last login
            user.lastLogin = new Date().toISOString();
            await env.OTP_AUTH_KV.put(userKey, JSON.stringify(user), { expirationTtl: 31536000 });
        }
        
        // Track usage
        if (resolvedCustomerId) {
            await trackUsage(resolvedCustomerId, 'otpVerifications', 1, env);
            await trackUsage(resolvedCustomerId, 'successfulLogins', 1, env);
            
            // Send webhooks
            await sendWebhook(resolvedCustomerId, 'otp.verified', {
                userId,
                email: emailLower
            }, env);
            
            // Check if new user
            const wasNewUser = !user || !user.createdAt || 
                new Date(user.createdAt).toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
            
            if (wasNewUser) {
                await sendWebhook(resolvedCustomerId, 'user.created', {
                    userId,
                    email: emailLower
                }, env);
            }
            
            await sendWebhook(resolvedCustomerId, 'user.logged_in', {
                userId,
                email: emailLower
            }, env);
        }
        
        // Generate CSRF token for this session
        const csrfToken = crypto.randomUUID ? crypto.randomUUID() : 
            Array.from(crypto.getRandomValues(new Uint8Array(16)))
                .map(b => b.toString(16).padStart(2, '0')).join('');
        
        // Generate JWT token (7 hours expiration for security)
        const expiresAt = new Date(Date.now() + 7 * 60 * 60 * 1000); // 7 hours
        const expiresIn = 7 * 60 * 60; // 7 hours in seconds
        const now = Math.floor(Date.now() / 1000);
        
        // JWT Standard Claims (RFC 7519) + OAuth 2.0 + Custom
        const tokenPayload = {
            // Standard JWT Claims
            sub: userId, // Subject (user identifier)
            iss: 'auth.idling.app', // Issuer
            aud: resolvedCustomerId || 'default', // Audience (customer/tenant)
            exp: Math.floor(expiresAt.getTime() / 1000), // Expiration time
            iat: now, // Issued at
            jti: crypto.randomUUID ? crypto.randomUUID() : // JWT ID (unique token identifier)
                Array.from(crypto.getRandomValues(new Uint8Array(16)))
                    .map(b => b.toString(16).padStart(2, '0')).join(''),
            
            // OAuth 2.0 / OpenID Connect Claims
            email: emailLower,
            email_verified: true, // OTP verification confirms email
            
            // Custom Claims
            userId, // Backward compatibility
            customerId: resolvedCustomerId || null, // Multi-tenant customer ID
            csrf: csrfToken, // CSRF token included in JWT
        };
        
        // Log JWT creation for debugging
        if (resolvedCustomerId) {
            console.log(`[OTP Verify] Creating JWT with customerId: ${resolvedCustomerId} for user: ${emailLower}`);
        } else {
            console.log(`[OTP Verify] WARNING: Creating JWT WITHOUT customerId for user: ${emailLower}`);
        }
        
        const jwtSecret = getJWTSecret(env);
        const accessToken = await createJWT(tokenPayload, jwtSecret);
        
        // Store session with customer isolation
        const sessionKey = getCustomerKey(resolvedCustomerId, `session_${userId}`);
        await env.OTP_AUTH_KV.put(sessionKey, JSON.stringify({
            userId,
            email: emailLower,
            token: await hashEmail(accessToken), // Store hash of token
            expiresAt: expiresAt.toISOString(),
            createdAt: new Date().toISOString(),
        }), { expirationTtl: 25200 }); // 7 hours (matches token expiration)
        
        // OAuth 2.0 Token Response (RFC 6749 Section 5.1)
        return new Response(JSON.stringify({ 
            // OAuth 2.0 Standard Fields
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: expiresIn,
            
            // Additional Standard Fields
            scope: 'openid email profile', // OIDC scopes
            
            // User Information
            displayName: user.displayName || null, // Anonymized display name
            
            // User Information (OIDC UserInfo)
            sub: userId, // Subject identifier
            email: emailLower,
            email_verified: true,
            
            // Backward Compatibility (deprecated, use access_token)
            token: accessToken,
            userId,
            expiresAt: expiresAt.toISOString(),
        }), {
            headers: { 
                ...getCorsHeaders(env, request), 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store', // OAuth 2.0 requirement
                'Pragma': 'no-cache',
            },
        });
    } catch (error) {
        // Log detailed error for debugging
        console.error('[OTP Verify] Error:', error);
        console.error('[OTP Verify] Stack:', error.stack);
        
        // Return detailed error in development, generic in production
        const errorResponse = {
            error: 'Failed to verify OTP',
            ...(env.ENVIRONMENT === 'development' || env.ENVIRONMENT === 'dev' ? {
                message: error.message,
                stack: error.stack,
                name: error.name
            } : {
                message: 'An internal error occurred. Please try again.'
            })
        };
        
        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { 
                ...getCorsHeaders(env, request), 
                'Content-Type': 'application/json' 
            },
        });
    }
}

