/**
 * Public Handlers
 * Handles public endpoints: signup, verify signup, register customer, health checks
 */

import { getCorsHeaders } from '../utils/cors.js';
import { hashEmail, generateOTP, hashPassword } from '../utils/crypto.js';
import { generateVerificationToken } from '../utils/validation.js';
import { generateCustomerId, storeCustomer } from '../services/customer.js';
import { createApiKeyForCustomer } from '../services/api-key.js';
import { getEmailProvider } from '../utils/email.js';
import { validateSecrets } from '../utils/validation.js';

/**
 * Public signup endpoint
 * POST /signup
 */
export async function handlePublicSignup(request, env) {
    try {
        const body = await request.json();
        const { email, companyName, password } = body;
        
        // Validate input
        if (!email || !companyName || !password) {
            return new Response(JSON.stringify({ error: 'Email, company name, and password are required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return new Response(JSON.stringify({ error: 'Valid email address required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        if (password.length < 8) {
            return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const emailLower = email.toLowerCase().trim();
        const emailHash = await hashEmail(emailLower);
        
        // Check if signup already exists
        const signupKey = `signup_${emailHash}`;
        const existingSignup = await env.OTP_AUTH_KV.get(signupKey, { type: 'json' });
        
        if (existingSignup && new Date(existingSignup.expiresAt) > new Date()) {
            return new Response(JSON.stringify({ 
                error: 'Signup already in progress. Check your email for verification.',
                expiresAt: existingSignup.expiresAt
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Generate verification token
        const verificationToken = generateVerificationToken();
        const verificationCode = generateOTP(); // 6-digit code
        
        // Hash password
        const passwordHash = await hashPassword(password);
        
        // Store signup data
        const signupData = {
            email: emailLower,
            companyName,
            passwordHash,
            verificationToken,
            verificationCode,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
        };
        
        await env.OTP_AUTH_KV.put(signupKey, JSON.stringify(signupData), { expirationTtl: 86400 });
        
        // Send verification email
        try {
            const emailProvider = getEmailProvider(null, env);
            await emailProvider.sendEmail({
                from: env.RESEND_FROM_EMAIL || 'noreply@otpauth.com',
                to: emailLower,
                subject: 'Verify your OTP Auth Service account',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="utf-8">
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; background: #f4f4f4; padding: 20px; border-radius: 8px; margin: 20px 0; font-family: monospace; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>Verify Your Account</h1>
                            <p>Your verification code is:</p>
                            <div class="code">${verificationCode}</div>
                            <p>Or click this link to verify: <a href="https://otpauth.com/verify?token=${verificationToken}">Verify Account</a></p>
                            <p>This code expires in 24 hours.</p>
                        </div>
                    </body>
                    </html>
                `,
                text: `Your verification code is: ${verificationCode}\n\nOr visit: https://otpauth.com/verify?token=${verificationToken}\n\nThis code expires in 24 hours.`
            });
        } catch (error) {
            console.error('Failed to send verification email:', error);
            return new Response(JSON.stringify({ 
                error: 'Failed to send verification email',
                message: error.message
            }), {
                status: 500,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify({
            success: true,
            message: 'Signup successful. Check your email for verification code.',
            expiresAt: signupData.expiresAt
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to sign up',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Verify signup
 * POST /signup/verify
 */
export async function handleVerifySignup(request, env) {
    try {
        const body = await request.json();
        const { email, token, code } = body;
        
        if (!email) {
            return new Response(JSON.stringify({ error: 'Email required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        if (!token && !code) {
            return new Response(JSON.stringify({ error: 'Token or code required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const emailLower = email.toLowerCase().trim();
        const emailHash = await hashEmail(emailLower);
        const signupKey = `signup_${emailHash}`;
        const signupData = await env.OTP_AUTH_KV.get(signupKey, { type: 'json' });
        
        if (!signupData) {
            return new Response(JSON.stringify({ error: 'Signup not found or expired' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Check expiration
        if (new Date(signupData.expiresAt) < new Date()) {
            await env.OTP_AUTH_KV.delete(signupKey);
            return new Response(JSON.stringify({ error: 'Verification expired' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Verify token or code
        const isValid = (token && signupData.verificationToken === token) || 
                       (code && signupData.verificationCode === code);
        
        if (!isValid) {
            return new Response(JSON.stringify({ error: 'Invalid verification token or code' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Create customer account
        const customerId = generateCustomerId();
        const customerData = {
            customerId,
            name: signupData.companyName,
            email: emailLower,
            companyName: signupData.companyName,
            plan: 'free',
            status: 'active',
            createdAt: new Date().toISOString(),
            passwordHash: signupData.passwordHash,
            configVersion: 1,
            config: {
                emailConfig: {
                    fromEmail: null,
                    fromName: signupData.companyName,
                    subjectTemplate: 'Your {{appName}} Verification Code',
                    htmlTemplate: null,
                    textTemplate: null,
                    variables: {
                        appName: signupData.companyName,
                        brandColor: '#007bff',
                        footerText: `© ${new Date().getFullYear()} ${signupData.companyName}`,
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
        
        await storeCustomer(customerId, customerData, env);
        
        // Generate initial API key
        const { apiKey, keyId } = await createApiKeyForCustomer(customerId, 'Initial API Key', env);
        
        // Delete signup data
        await env.OTP_AUTH_KV.delete(signupKey);
        
        return new Response(JSON.stringify({
            success: true,
            customerId,
            apiKey, // Only returned once!
            keyId,
            message: 'Account verified and created successfully. Save your API key - it will not be shown again.',
            customer: {
                customerId,
                name: customerData.name,
                email: customerData.email,
                companyName: customerData.companyName,
                plan: customerData.plan,
                status: customerData.status
            }
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to verify signup',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Register new customer (admin endpoint - kept for backward compatibility)
 * POST /admin/customers
 */
export async function handleRegisterCustomer(request, env) {
    try {
        const body = await request.json();
        const { name, email, companyName, plan = 'free' } = body;
        
        // Validate input
        if (!name || !email || !companyName) {
            return new Response(JSON.stringify({ error: 'Name, email, and company name are required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return new Response(JSON.stringify({ error: 'Valid email address required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Generate customer ID
        const customerId = generateCustomerId();
        
        // Create customer record with default configuration
        const customerData = {
            customerId,
            name,
            email: email.toLowerCase().trim(),
            companyName,
            plan,
            status: 'pending_verification',
            createdAt: new Date().toISOString(),
            configVersion: 1,
            config: {
                emailConfig: {
                    fromEmail: null, // Will be set when domain is verified
                    fromName: companyName,
                    subjectTemplate: 'Your {{appName}} Verification Code',
                    htmlTemplate: null, // Default template used if null
                    textTemplate: null,
                    variables: {
                        appName: companyName,
                        brandColor: '#007bff',
                        footerText: `© ${new Date().getFullYear()} ${companyName}`,
                        supportUrl: null,
                        logoUrl: null
                    }
                },
                rateLimits: {
                    otpRequestsPerHour: 10, // Default, will be overridden by plan
                    otpRequestsPerDay: 100,
                    maxUsers: 10000
                },
                webhookConfig: {
                    url: null,
                    secret: null,
                    events: []
                },
                allowedOrigins: [], // Empty = allow all (for development)
                allowedIPs: [] // Empty = allow all IPs
            },
            features: {
                customEmailTemplates: plan !== 'free',
                webhooks: plan !== 'free',
                analytics: plan !== 'free',
                sso: plan === 'enterprise'
            }
        };
        
        // Set plan-based defaults
        if (plan === 'free') {
            customerData.config.rateLimits = {
                otpRequestsPerHour: 3,
                otpRequestsPerDay: 50,
                maxUsers: 100
            };
        } else if (plan === 'starter') {
            customerData.config.rateLimits = {
                otpRequestsPerHour: 10,
                otpRequestsPerDay: 500,
                maxUsers: 1000
            };
        } else if (plan === 'pro') {
            customerData.config.rateLimits = {
                otpRequestsPerHour: 50,
                otpRequestsPerDay: 5000,
                maxUsers: 10000
            };
        } else if (plan === 'enterprise') {
            customerData.config.rateLimits = {
                otpRequestsPerHour: 1000,
                otpRequestsPerDay: 100000,
                maxUsers: 1000000
            };
        }
        
        await storeCustomer(customerId, customerData, env);
        
        // Generate initial API key
        const { apiKey, keyId } = await createApiKeyForCustomer(customerId, 'Initial API Key', env);
        
        return new Response(JSON.stringify({
            success: true,
            customerId,
            apiKey, // Only returned once!
            keyId,
            message: 'Customer registered successfully. Save your API key - it will not be shown again.',
            customer: {
                customerId,
                name,
                email: customerData.email,
                companyName,
                plan,
                status: customerData.status
            }
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Customer registration error:', error);
        return new Response(JSON.stringify({
            error: 'Failed to register customer',
            message: error.message,
            details: env.ENVIRONMENT === 'development' ? error.stack : undefined
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Health check endpoint
 * GET /health
 */
export async function handleHealth(request, env) {
    try {
        // Check KV access
        await env.OTP_AUTH_KV.get('health_check', { type: 'text' });
        
        // Validate secrets (but don't fail health check, just warn)
        const secretValidation = validateSecrets(env);
        
        const healthStatus = {
            status: secretValidation.valid ? 'healthy' : 'degraded',
            service: 'otp-auth-service',
            version: '2.0.0',
            timestamp: new Date().toISOString()
        };
        
        if (!secretValidation.valid) {
            healthStatus.warnings = {
                missing_secrets: secretValidation.missing,
                message: `Required secrets not configured: ${secretValidation.missing.join(', ')}. Set them via: wrangler secret put <SECRET_NAME>`
            };
        }
        
        if (secretValidation.warnings.length > 0) {
            healthStatus.warnings = healthStatus.warnings || {};
            healthStatus.warnings.recommended = secretValidation.warnings;
        }
        
        return new Response(JSON.stringify(healthStatus), {
            status: secretValidation.valid ? 200 : 503,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            status: 'unhealthy',
            service: 'otp-auth-service',
            error: 'KV check failed',
            details: env.ENVIRONMENT === 'development' ? error.message : undefined
        }), {
            status: 503,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Readiness check endpoint
 * GET /health/ready
 */
export async function handleHealthReady(request, env) {
    try {
        // Check KV access
        await env.OTP_AUTH_KV.get('health_check', { type: 'text' });
        
        // Validate required secrets
        const secretValidation = validateSecrets(env);
        
        if (!secretValidation.valid) {
            return new Response(JSON.stringify({ 
                status: 'not_ready',
                reason: 'missing_secrets',
                missing: secretValidation.missing,
                warnings: secretValidation.warnings,
                message: `Required secrets not configured: ${secretValidation.missing.join(', ')}. Set them via: wrangler secret put <SECRET_NAME>`
            }), {
                status: 503,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify({ 
            status: 'ready',
            warnings: secretValidation.warnings.length > 0 ? secretValidation.warnings : undefined
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            status: 'not_ready',
            reason: 'kv_check_failed',
            error: env.ENVIRONMENT === 'development' ? error.message : undefined
        }), {
            status: 503,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Liveness check endpoint
 * GET /health/live
 */
export async function handleHealthLive(request, env) {
    return new Response(JSON.stringify({ status: 'alive' }), {
        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
    });
}

