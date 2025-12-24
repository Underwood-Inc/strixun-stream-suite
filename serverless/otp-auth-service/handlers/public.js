/**
 * Public Handlers
 * Handles public endpoints: signup, verify signup, register customer, health checks
 */

import { getCorsHeaders } from '../utils/cors.js';
import { hashEmail } from '../utils/crypto.js';
import { generateCustomerId, storeCustomer } from '../services/customer.js';
import { createApiKeyForCustomer } from '../services/api-key.js';
import { validateSecrets } from '../utils/validation.js';
import { handleRequestOTP, handleVerifyOTP } from './auth.js';

/**
 * Public signup endpoint - Uses secure OTP system
 * POST /signup
 * 
 * This endpoint leverages the OTP auth system for maximum security:
 * - Rate limiting (3 requests/hour per email)
 * - Brute force protection (5 attempts max)
 * - 10-minute expiration (vs 24 hours in old system)
 * - Quota checks
 * - Customer isolation ready
 */
export async function handlePublicSignup(request, env) {
    try {
        const body = await request.json();
        const { email, companyName } = body;
        
        // Validate input
        if (!email || !companyName) {
            return new Response(JSON.stringify({ error: 'Email and company name are required' }), {
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
        
        const emailLower = email.toLowerCase().trim();
        const emailHash = await hashEmail(emailLower);
        
        // Check if signup already in progress (store company name temporarily)
        const signupKey = `signup_${emailHash}`;
        const existingSignup = await env.OTP_AUTH_KV.get(signupKey, { type: 'json' });
        
        // Check if there's an active OTP for this email (from previous signup attempt)
        // OTP system uses customerId=null for pre-signup, so we check that
        const latestOtpKey = `otp_latest_${emailHash}`; // No customer prefix when customerId=null
        const existingOtp = await env.OTP_AUTH_KV.get(latestOtpKey);
        
        if (existingOtp) {
            // OTP already exists - check if it's still valid
            const otpData = await env.OTP_AUTH_KV.get(existingOtp, { type: 'json' });
            if (otpData && new Date(otpData.expiresAt) > new Date()) {
                // Signup already in progress - update signup data and return success
                // This allows user to proceed to verification step
                const existingSignupData = await env.OTP_AUTH_KV.get(signupKey, { type: 'json' });
                if (!existingSignupData) {
                    // Store signup data if it doesn't exist
                    const signupData = {
                        email: emailLower,
                        companyName: companyName.trim(),
                        createdAt: new Date().toISOString(),
                        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
                    };
                    await env.OTP_AUTH_KV.put(signupKey, JSON.stringify(signupData), { expirationTtl: 600 });
                } else {
                    // Update company name if it changed
                    existingSignupData.companyName = companyName.trim();
                    await env.OTP_AUTH_KV.put(signupKey, JSON.stringify(existingSignupData), { expirationTtl: 600 });
                }
                
                // Return success so user can proceed to verification
                return new Response(JSON.stringify({
                    success: true,
                    message: 'Signup already in progress. Check your email for the OTP code.',
                    expiresIn: Math.floor((new Date(otpData.expiresAt).getTime() - Date.now()) / 1000),
                    alreadyInProgress: true
                }), {
                    headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                });
            }
        }
        
        // Store signup data (company name) temporarily - expires in 10 minutes (matches OTP expiration)
        const signupData = {
            email: emailLower,
            companyName: companyName.trim(),
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes (matches OTP)
        };
        
        await env.OTP_AUTH_KV.put(signupKey, JSON.stringify(signupData), { expirationTtl: 600 }); // 10 minutes
        
        // Use the secure OTP system to send verification code
        // Pass customerId=null since customer doesn't exist yet
        // Create a new request for the OTP endpoint
        const otpUrl = new URL(request.url);
        otpUrl.pathname = '/auth/request-otp';
        const otpRequest = new Request(otpUrl.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(request.headers.entries())
            },
            body: JSON.stringify({ email: emailLower })
        });
        
        const otpResponse = await handleRequestOTP(otpRequest, env, null); // null = no customerId yet
        
        // If OTP request failed, return the error
        if (!otpResponse.ok) {
            // Clean up signup data if OTP request failed
            await env.OTP_AUTH_KV.delete(signupKey);
            return otpResponse; // Return the OTP system's error response (includes rate limiting, etc.)
        }
        
        // OTP sent successfully - return success
        const otpResponseData = await otpResponse.json();
        return new Response(JSON.stringify({
            success: true,
            message: 'Signup initiated. Check your email for the OTP verification code.',
            expiresIn: otpResponseData.expiresIn || 600, // 10 minutes
            remaining: otpResponseData.remaining
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Signup error:', error);
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
 * Verify signup - Uses secure OTP system
 * POST /signup/verify
 * 
 * This endpoint leverages the OTP auth system for maximum security:
 * - Brute force protection (5 attempts max)
 * - Constant-time comparison
 * - Single-use OTP codes
 * - Automatic cleanup after verification
 */
export async function handleVerifySignup(request, env) {
    try {
        const body = await request.json();
        const { email, otp } = body;
        
        if (!email) {
            return new Response(JSON.stringify({ error: 'Email required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        if (!otp) {
            return new Response(JSON.stringify({ error: 'OTP code required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const emailLower = email.toLowerCase().trim();
        const emailHash = await hashEmail(emailLower);
        
        // Get signup data (company name)
        const signupKey = `signup_${emailHash}`;
        const signupData = await env.OTP_AUTH_KV.get(signupKey, { type: 'json' });
        
        if (!signupData) {
            return new Response(JSON.stringify({ error: 'Signup not found or expired. Please start the signup process again.' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Check if signup data expired
        if (new Date(signupData.expiresAt) < new Date()) {
            await env.OTP_AUTH_KV.delete(signupKey);
            return new Response(JSON.stringify({ error: 'Signup expired. Please start the signup process again.' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Use the secure OTP system to verify the code
        // Pass customerId=null since customer doesn't exist yet
        // Create a new request for the OTP endpoint
        const otpUrl = new URL(request.url);
        otpUrl.pathname = '/auth/verify-otp';
        const otpVerifyRequest = new Request(otpUrl.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(request.headers.entries())
            },
            body: JSON.stringify({ email: emailLower, otp })
        });
        
        const otpResponse = await handleVerifyOTP(otpVerifyRequest, env, null); // null = no customerId yet
        
        // If OTP verification failed, return the error (includes brute force protection, etc.)
        if (!otpResponse.ok) {
            return otpResponse; // Return the OTP system's error response
        }
        
        // OTP verified successfully! Now create the customer account
        const customerId = generateCustomerId();
        const customerData = {
            customerId,
            name: signupData.companyName,
            email: emailLower,
            companyName: signupData.companyName,
            plan: 'free',
            status: 'active',
            createdAt: new Date().toISOString(),
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
        
        // Clean up signup data
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
        console.error('Signup verification error:', error);
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

