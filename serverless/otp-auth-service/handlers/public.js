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
        // handleVerifyOTP will now ALWAYS create a customer account if one doesn't exist
        // Create a new request for the OTP endpoint
        const otpUrl = new URL(request.url);
        otpUrl.pathname = '/auth/verify-otp';
        const otpVerifyRequest = new Request(otpUrl.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Dashboard-Request': 'true', // Ensure customer account is created
                ...Object.fromEntries(request.headers.entries())
            },
            body: JSON.stringify({ email: emailLower, otp })
        });
        
        const otpResponse = await handleVerifyOTP(otpVerifyRequest, env, null); // null = no customerId yet
        
        // If OTP verification failed, return the error (includes brute force protection, etc.)
        if (!otpResponse.ok) {
            return otpResponse; // Return the OTP system's error response
        }
        
        // OTP verified successfully! Customer account was already created by handleVerifyOTP
        // Now we need to update it with the company name from signup data
        const otpResponseData = await otpResponse.json();
        const customerId = otpResponseData.customerId || otpResponseData.userId; // Fallback to userId if needed
        
        // Get the customer account that was just created by handleVerifyOTP
        const { getCustomer, getCustomerByEmail, storeCustomer } = await import('../services/customer.js');
        let customer = await getCustomerByEmail(emailLower, env);
        
        if (!customer) {
            // Fallback: try to get by customerId from JWT token payload
            // Parse the JWT to get customerId
            try {
                const token = otpResponseData.access_token || otpResponseData.token;
                if (token) {
                    const parts = token.split('.');
                    if (parts.length === 3) {
                        const payload = JSON.parse(atob(parts[1]));
                        const jwtCustomerId = payload.customerId;
                        if (jwtCustomerId) {
                            customer = await getCustomer(jwtCustomerId, env);
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to parse JWT for customerId:', e);
            }
        }
        
        // Update customer with company name from signup
        if (customer && signupData.companyName) {
            customer.companyName = signupData.companyName;
            // Update email config with company name
            if (customer.config && customer.config.emailConfig) {
                customer.config.emailConfig.fromName = signupData.companyName;
                if (customer.config.emailConfig.variables) {
                    customer.config.emailConfig.variables.appName = signupData.companyName;
                    customer.config.emailConfig.variables.footerText = `© ${new Date().getFullYear()} ${signupData.companyName}`;
                }
            }
            await storeCustomer(customer.customerId, customer, env);
        }
        
        // Get API key (should already exist from handleVerifyOTP, but get it anyway)
        const { getApiKeysForCustomer } = await import('../services/api-keys.js');
        const finalCustomerId = customer?.customerId || customerId;
        const apiKeys = finalCustomerId ? await getApiKeysForCustomer(finalCustomerId, env) : null;
        const apiKey = apiKeys && apiKeys.length > 0 ? apiKeys[0].apiKey : null;
        const keyId = apiKeys && apiKeys.length > 0 ? apiKeys[0].keyId : null;
        
        // Clean up signup data
        await env.OTP_AUTH_KV.delete(signupKey);
        
        // Return success with JWT token for auto-login (saves API limits!)
        return new Response(JSON.stringify({
            success: true,
            customerId: customer?.customerId || customerId,
            apiKey, // API key (already created by handleVerifyOTP)
            keyId,
            // Include JWT token for auto-login (from OTP verification)
            access_token: otpResponseData.access_token || otpResponseData.token,
            token: otpResponseData.access_token || otpResponseData.token, // Backward compatibility
            token_type: 'Bearer',
            expires_in: otpResponseData.expires_in || 25200, // 7 hours
            userId: otpResponseData.userId || otpResponseData.sub,
            email: emailLower,
            message: 'Account verified and created successfully. You are now logged in! Your API key is also available in the API Keys tab of your dashboard.',
            customer: {
                customerId: customer?.customerId || customerId,
                email: customer?.email || emailLower,
                companyName: customer?.companyName || signupData.companyName,
                plan: customer?.plan || 'free',
                status: customer?.status || 'active'
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
            message: 'Customer registered successfully. Your API key is also available in the API Keys tab of your dashboard.',
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
 * CRITICAL: JWT encryption is MANDATORY for all endpoints, including /health
 */
export async function handleHealth(request, env) {
    // CRITICAL SECURITY: JWT encryption is MANDATORY for all endpoints
    // Get JWT token from request
    const authHeader = request.headers.get('Authorization');
    // CRITICAL: Trim token to ensure it matches the token used for encryption
    const jwtToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
    
    if (!jwtToken) {
        const errorResponse = {
            type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
            title: 'Unauthorized',
            status: 401,
            detail: 'JWT token is required for encryption/decryption. Please provide a valid JWT token in the Authorization header.',
            instance: request.url
        };
        const corsHeaders = getCorsHeaders(env, request);
        return new Response(JSON.stringify(errorResponse), {
            status: 401,
            headers: {
                'Content-Type': 'application/problem+json',
                ...corsHeaders,
            },
        });
    }

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
        
        const response = new Response(JSON.stringify(healthStatus), {
            status: secretValidation.valid ? 200 : 503,
            headers: { 'Content-Type': 'application/json' },
        });
        
        // Wrap with encryption
        const { wrapWithEncryption } = await import('@strixun/api-framework');
        const authForEncryption = { userId: 'anonymous', customerId: null, jwtToken };
        const encryptedResult = await wrapWithEncryption(response, authForEncryption, request, env);
        return encryptedResult.response;
    } catch (error) {
        const errorResponse = new Response(JSON.stringify({ 
            status: 'unhealthy',
            service: 'otp-auth-service',
            error: 'KV check failed',
            details: env.ENVIRONMENT === 'development' ? error.message : undefined
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        });
        
        // Wrap error response with encryption
        const { wrapWithEncryption } = await import('@strixun/api-framework');
        const authForEncryption = { userId: 'anonymous', customerId: null, jwtToken };
        const encryptedError = await wrapWithEncryption(errorResponse, authForEncryption, request, env, { requireJWT: false });
        return encryptedError.response;
    }
}

/**
 * Readiness check endpoint
 * GET /health/ready
 * CRITICAL: JWT encryption is MANDATORY for all endpoints, including /health/ready
 */
export async function handleHealthReady(request, env) {
    // CRITICAL SECURITY: JWT encryption is MANDATORY for all endpoints
    // Get JWT token from request
    const authHeader = request.headers.get('Authorization');
    // CRITICAL: Trim token to ensure it matches the token used for encryption
    const jwtToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
    
    if (!jwtToken) {
        const errorResponse = {
            type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
            title: 'Unauthorized',
            status: 401,
            detail: 'JWT token is required for encryption/decryption. Please provide a valid JWT token in the Authorization header.',
            instance: request.url
        };
        const corsHeaders = getCorsHeaders(env, request);
        return new Response(JSON.stringify(errorResponse), {
            status: 401,
            headers: {
                'Content-Type': 'application/problem+json',
                ...corsHeaders,
            },
        });
    }

    try {
        // Check KV access
        await env.OTP_AUTH_KV.get('health_check', { type: 'text' });
        
        // Validate required secrets
        const secretValidation = validateSecrets(env);
        
        let response;
        if (!secretValidation.valid) {
            response = new Response(JSON.stringify({ 
                status: 'not_ready',
                reason: 'missing_secrets',
                missing: secretValidation.missing,
                warnings: secretValidation.warnings,
                message: `Required secrets not configured: ${secretValidation.missing.join(', ')}. Set them via: wrangler secret put <SECRET_NAME>`
            }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
            });
        } else {
            response = new Response(JSON.stringify({ 
                status: 'ready',
                warnings: secretValidation.warnings.length > 0 ? secretValidation.warnings : undefined
            }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }
        
        // Wrap with encryption
        const { wrapWithEncryption } = await import('@strixun/api-framework');
        const authForEncryption = { userId: 'anonymous', customerId: null, jwtToken };
        const encryptedResult = await wrapWithEncryption(response, authForEncryption, request, env);
        return encryptedResult.response;
    } catch (error) {
        const errorResponse = new Response(JSON.stringify({ 
            status: 'not_ready',
            reason: 'kv_check_failed',
            error: env.ENVIRONMENT === 'development' ? error.message : undefined
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
        });
        
        // Wrap error response with encryption
        const { wrapWithEncryption } = await import('@strixun/api-framework');
        const authForEncryption = { userId: 'anonymous', customerId: null, jwtToken };
        const encryptedError = await wrapWithEncryption(errorResponse, authForEncryption, request, env, { requireJWT: false });
        return encryptedError.response;
    }
}

/**
 * Liveness check endpoint
 * GET /health/live
 * CRITICAL: JWT encryption is MANDATORY for all endpoints, including /health/live
 */
export async function handleHealthLive(request, env) {
    // CRITICAL SECURITY: JWT encryption is MANDATORY for all endpoints
    // Get JWT token from request
    const authHeader = request.headers.get('Authorization');
    // CRITICAL: Trim token to ensure it matches the token used for encryption
    const jwtToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
    
    if (!jwtToken) {
        const errorResponse = {
            type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
            title: 'Unauthorized',
            status: 401,
            detail: 'JWT token is required for encryption/decryption. Please provide a valid JWT token in the Authorization header.',
            instance: request.url
        };
        const corsHeaders = getCorsHeaders(env, request);
        return new Response(JSON.stringify(errorResponse), {
            status: 401,
            headers: {
                'Content-Type': 'application/problem+json',
                ...corsHeaders,
            },
        });
    }

    const response = new Response(JSON.stringify({ status: 'alive' }), {
        headers: { 'Content-Type': 'application/json' },
    });
    
    // Wrap with encryption
    const { wrapWithEncryption } = await import('@strixun/api-framework');
    const authForEncryption = { userId: 'anonymous', customerId: null, jwtToken };
    const encryptedResult = await wrapWithEncryption(response, authForEncryption, request, env);
    return encryptedResult.response;
}

