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
            const secondsUntilReset = Math.ceil((resetTime.getTime() - now.getTime()) / 1000);
            
            // Format human-readable reset time
            let resetMessage = '';
            if (secondsUntilReset < 60) {
                resetMessage = `in ${secondsUntilReset} second${secondsUntilReset !== 1 ? 's' : ''}`;
            } else if (secondsUntilReset < 3600) {
                const minutes = Math.floor(secondsUntilReset / 60);
                resetMessage = `in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
            } else {
                const hours = Math.floor(secondsUntilReset / 3600);
                const minutes = Math.floor((secondsUntilReset % 3600) / 60);
                if (minutes > 0) {
                    resetMessage = `in ${hours} hour${hours !== 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
                } else {
                    resetMessage = `in ${hours} hour${hours !== 1 ? 's' : ''}`;
                }
            }
            
            // Format reset time for display
            const resetTimeFormatted = resetTime.toLocaleString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
            
            // RFC 7807 Problem Details for HTTP APIs
            return new Response(JSON.stringify({ 
                type: 'https://tools.ietf.org/html/rfc6585#section-4',
                title: 'Too Many Requests',
                status: 429,
                detail: `Too many requests. Please try again ${resetMessage} (at ${resetTimeFormatted}).`,
                instance: request.url,
                retry_after: secondsUntilReset,
                reset_at: rateLimit.resetAt,
                reset_at_formatted: resetTimeFormatted,
                remaining: rateLimit.remaining,
                reason: rateLimit.reason || 'rate_limit_exceeded',
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
            const emailResult = await sendOTPEmail(email, otp, customerId, env);
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
                email: email.toLowerCase().trim(),
                hasResendKey: !!env.RESEND_API_KEY
            });
            // Return error so user knows email failed
            // Show details in development/local mode for easier debugging
            const isDev = !env.ENVIRONMENT || env.ENVIRONMENT === 'development' || env.ENVIRONMENT === 'local';
            return new Response(JSON.stringify({ 
                error: 'Failed to send email. Please check your email address and try again.',
                details: isDev ? error.message : undefined,
                hint: isDev && !env.RESEND_API_KEY ? 'RESEND_API_KEY is not configured. Create a .dev.vars file with your Resend API key.' : undefined
            }), {
                status: 500,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
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
            name: error.name
        });
        // RFC 7807 Problem Details for HTTP APIs
        return new Response(JSON.stringify({ 
            type: 'https://tools.ietf.org/html/rfc7231#section-6.6.1',
            title: 'Internal Server Error',
            status: 500,
            detail: 'Failed to request OTP',
            instance: request.url,
        }), {
            status: 500,
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
        
        // Get latest OTP key with customer isolation
        const latestOtpKey = getCustomerKey(customerId, `otp_latest_${emailHash}`);
        const latestOtpKeyValue = await env.OTP_AUTH_KV.get(latestOtpKey);
        
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
        
        // If no customerId provided, check if customer exists by email, or create one
        // BUT only auto-create if this is a dashboard request (not an API customer's end-user)
        let resolvedCustomerId = customerId;
        if (!resolvedCustomerId) {
            const existingCustomer = await getCustomerByEmail(emailLower, env);
            if (existingCustomer) {
                resolvedCustomerId = existingCustomer.customerId;
            } else {
                // Only auto-create customer for dashboard requests
                // Dashboard requests include X-Dashboard-Request header
                // API customer requests will have an API key (customerId would be set)
                const dashboardHeader = request.headers.get('X-Dashboard-Request');
                const isDashboardRequest = dashboardHeader === 'true';
                
                if (isDashboardRequest) {
                    // Auto-create customer account for dashboard access
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
                    
                    await storeCustomer(resolvedCustomerId, customerData, env);
                    
                    // Generate initial API key for the customer
                    await createApiKeyForCustomer(resolvedCustomerId, 'Initial API Key', env);
                }
                // If not a dashboard request, resolvedCustomerId stays null (API customer's end-user)
            }
        }
        
        // Record successful OTP verification for statistics
        await recordOTPRequestService(emailHash, clientIP, resolvedCustomerId, env);
        
        // Get or create user with customer isolation
        const userId = await generateUserId(emailLower);
        const userKey = getCustomerKey(resolvedCustomerId, `user_${emailHash}`);
        let user = await env.OTP_AUTH_KV.get(userKey, { type: 'json' });
        
        if (!user) {
            // Create new user
            user = {
                userId,
                email: emailLower,
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
            };
            await env.OTP_AUTH_KV.put(userKey, JSON.stringify(user), { expirationTtl: 31536000 }); // 1 year
        } else {
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
        return new Response(JSON.stringify({ 
            error: 'Failed to verify OTP',
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

