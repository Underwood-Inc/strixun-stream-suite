/**
 * OTP Authentication Service - Standalone Worker
 * Cloudflare Worker for multi-tenant OTP authentication
 * 
 * This worker handles:
 * - Email OTP Authentication System (secure user authentication)
 * - Multi-tenant customer isolation
 * - API key management
 * - JWT token generation and validation
 * 
 * @version 1.0.0
 */

// CORS headers for cross-origin requests
function getCorsHeaders(env, request) {
    const origin = request.headers.get('Origin');
    
    // Get allowed origins from environment (comma-separated)
    const allowedOrigins = env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : [];
    
    // If no origins configured, allow all (for development only)
    // In production, you MUST set ALLOWED_ORIGINS via: wrangler secret put ALLOWED_ORIGINS
    const allowOrigin = allowedOrigins.length > 0 
        ? (origin && allowedOrigins.includes(origin) ? origin : null)
        : '*'; // Fallback for development
    
    return {
        'Access-Control-Allow-Origin': allowOrigin || 'null',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-OTP-API-Key, X-Requested-With, X-CSRF-Token',
        'Access-Control-Allow-Credentials': allowOrigin !== '*' ? 'true' : 'false',
        'Access-Control-Max-Age': '86400',
        // Security headers
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    };
}

/**
 * Generate 6-digit OTP code
 * Uses cryptographically secure random number generation
 * @returns {string} 6-digit OTP code
 */
function generateOTP() {
    // Use 2 Uint32 values to get 64 bits, eliminating modulo bias
    const array = new Uint32Array(2);
    crypto.getRandomValues(array);
    // Combine two 32-bit values for 64-bit range (0 to 2^64-1)
    // Then modulo 1,000,000 for 6-digit code
    // This eliminates modulo bias since 2^64 is much larger than 1,000,000
    const value = (Number(array[0]) * 0x100000000 + Number(array[1])) % 1000000;
    return value.toString().padStart(6, '0');
}

/**
 * Hash email for storage key (SHA-256)
 * @param {string} email - Email address
 * @returns {Promise<string>} Hex-encoded hash
 */
async function hashEmail(email) {
    const encoder = new TextEncoder();
    const data = encoder.encode(email.toLowerCase().trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate user ID from email
 * @param {string} email - Email address
 * @returns {Promise<string>} User ID
 */
async function generateUserId(email) {
    const hash = await hashEmail(email);
    return `user_${hash.substring(0, 12)}`;
}

/**
 * Create JWT token
 * @param {object} payload - Token payload
 * @param {string} secret - Secret key for signing
 * @returns {Promise<string>} JWT token
 */
async function createJWT(payload, secret) {
    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };
    
    const encoder = new TextEncoder();
    const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    const signatureInput = `${headerB64}.${payloadB64}`;
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureInput));
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/_/g, '/');
    
    return `${signatureInput}.${signatureB64}`;
}

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @param {string} secret - Secret key for verification
 * @returns {Promise<object|null>} Decoded payload or null if invalid
 */
async function verifyJWT(token, secret) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        const [headerB64, payloadB64, signatureB64] = parts;
        
        // Verify signature
        const encoder = new TextEncoder();
        const signatureInput = `${headerB64}.${payloadB64}`;
        const keyData = encoder.encode(secret);
        const key = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );
        
        // Decode signature
        const signature = Uint8Array.from(
            atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')),
            c => c.charCodeAt(0)
        );
        
        const isValid = await crypto.subtle.verify(
            'HMAC',
            key,
            signature,
            encoder.encode(signatureInput)
        );
        
        if (!isValid) return null;
        
        // Decode payload
        const payload = JSON.parse(
            atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
        );
        
        // Check expiration
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }
        
        return payload;
    } catch (error) {
        return null;
    }
}

/**
 * Get JWT secret from environment
 * @param {*} env - Worker environment
 * @returns {string} JWT secret
 * @throws {Error} If JWT_SECRET is not set
 */
function getJWTSecret(env) {
    if (!env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is required. Set it via: wrangler secret put JWT_SECRET');
    }
    return env.JWT_SECRET;
}

/**
 * Check rate limit for OTP requests
 * @param {string} emailHash - Hashed email
 * @param {string} customerId - Customer ID (for multi-tenant isolation)
 * @param {*} env - Worker environment
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: string}>}
 */
async function checkOTPRateLimit(emailHash, customerId, env) {
    try {
        // Use customer-prefixed key for isolation
        const rateLimitKey = customerId 
            ? `cust_${customerId}_ratelimit_otp_${emailHash}`
            : `ratelimit_otp_${emailHash}`;
        
        const rateLimitData = await env.OTP_AUTH_KV.get(rateLimitKey);
        let rateLimit = null;
        
        if (rateLimitData) {
            try {
                rateLimit = typeof rateLimitData === 'string' ? JSON.parse(rateLimitData) : rateLimitData;
            } catch (e) {
                // Invalid JSON, treat as no rate limit
                rateLimit = null;
            }
        }
        
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        
        // Check if rate limit exists and is still valid
        if (rateLimit && rateLimit.resetAt && now <= new Date(rateLimit.resetAt).getTime()) {
            // Rate limit exists and is valid
            if (rateLimit.otpRequests >= 3) {
                return { allowed: false, remaining: 0, resetAt: rateLimit.resetAt };
            }
            
            // Increment counter (this request counts)
            rateLimit.otpRequests = (rateLimit.otpRequests || 0) + 1;
            await env.OTP_AUTH_KV.put(rateLimitKey, JSON.stringify(rateLimit), { expirationTtl: 3600 });
            
            return { allowed: true, remaining: 3 - rateLimit.otpRequests, resetAt: rateLimit.resetAt };
        }
        
        // No rate limit or expired - create new one (this request counts as 1)
        const resetAt = new Date(now + oneHour).toISOString();
        const newRateLimit = {
            otpRequests: 1,
            failedAttempts: 0,
            resetAt: resetAt
        };
        await env.OTP_AUTH_KV.put(rateLimitKey, JSON.stringify(newRateLimit), { expirationTtl: 3600 });
        
        return { allowed: true, remaining: 2, resetAt: resetAt };
    } catch (error) {
        console.error('Rate limit check error:', error);
        // On error, allow the request (fail open for availability)
        return { allowed: true, remaining: 3, resetAt: new Date(Date.now() + 3600000).toISOString() };
    }
}

/**
 * Send OTP email via Resend
 * @param {string} email - Recipient email
 * @param {string} otp - OTP code
 * @param {*} env - Worker environment
 * @returns {Promise<object>} Resend API response
 */
async function sendOTPEmail(email, otp, env) {
    if (!env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY not configured');
    }
    
    // REQUIRED: Use your verified domain email to avoid test mode restrictions
    if (!env.RESEND_FROM_EMAIL) {
        throw new Error('RESEND_FROM_EMAIL must be set to your verified domain email (e.g., noreply@yourdomain.com). Set it via: wrangler secret put RESEND_FROM_EMAIL');
    }
    
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: env.RESEND_FROM_EMAIL,
            to: email,
            subject: 'Your Verification Code - Strixun Stream Suite',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                        .otp-code { 
                            font-size: 32px; 
                            font-weight: bold; 
                            letter-spacing: 8px; 
                            text-align: center;
                            background: #f4f4f4;
                            padding: 20px;
                            border-radius: 8px;
                            margin: 20px 0;
                            font-family: monospace;
                        }
                        .footer { 
                            margin-top: 30px; 
                            font-size: 12px; 
                            color: #666; 
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Your Verification Code</h1>
                        <p>Use this code to verify your email address:</p>
                        <div class="otp-code">${otp}</div>
                        <p>This code will expire in <strong>10 minutes</strong>.</p>
                        <p>If you didn't request this code, please ignore this email.</p>
                        <div class="footer">
                            <p>Strixun Stream Suite</p>
                            <p>This is an automated message, please do not reply.</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
        }),
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
            errorData = JSON.parse(errorText);
        } catch (e) {
            errorData = { message: errorText };
        }
        
        // Log detailed error for debugging
        console.error('Resend API error:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
            errorCode: errorData.code || errorData.name,
            errorMessage: errorData.message
        });
        
        // Provide more helpful error messages for common issues
        let errorMessage = errorData.message || errorText;
        if (errorData.code === 'restricted_to_test_environment' || 
            errorMessage.includes('test') || 
            errorMessage.includes('verified') ||
            errorMessage.includes('restricted')) {
            errorMessage = `Email sending restricted: ${errorMessage}. You may need to verify recipient email addresses in Resend dashboard or upgrade your Resend account.`;
        }
        
        throw new Error(`Resend API error: ${response.status} - ${errorMessage}`);
    }
    
    const result = await response.json();
    console.log('Email sent successfully via Resend:', result);
    return result;
}

/**
 * Get customer key with prefix for isolation
 * @param {string} customerId - Customer ID (optional for backward compatibility)
 * @param {string} key - Base key
 * @returns {string} Prefixed key
 */
function getCustomerKey(customerId, key) {
    return customerId ? `cust_${customerId}_${key}` : key;
}

/**
 * Generate cryptographically secure API key
 * @param {string} prefix - Key prefix (e.g., 'otp_live_sk_')
 * @returns {Promise<string>} API key
 */
async function generateApiKey(prefix = 'otp_live_sk_') {
    // Generate 32 random bytes (256 bits)
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    
    // Convert to base64url (URL-safe base64)
    const base64 = btoa(String.fromCharCode(...array))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    
    return `${prefix}${base64}`;
}

/**
 * Hash API key for storage (SHA-256)
 * @param {string} apiKey - API key
 * @returns {Promise<string>} Hex-encoded hash
 */
async function hashApiKey(apiKey) {
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate customer ID
 * @returns {string} Customer ID
 */
function generateCustomerId() {
    // Generate 12 random hex characters
    const array = new Uint8Array(6);
    crypto.getRandomValues(array);
    const hex = Array.from(array)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    return `cust_${hex}`;
}

/**
 * Get customer by ID
 * @param {string} customerId - Customer ID
 * @param {*} env - Worker environment
 * @returns {Promise<object|null>} Customer data or null
 */
async function getCustomer(customerId, env) {
    const customerKey = `customer_${customerId}`;
    const customer = await env.OTP_AUTH_KV.get(customerKey, { type: 'json' });
    return customer;
}

/**
 * Store customer
 * @param {string} customerId - Customer ID
 * @param {object} customerData - Customer data
 * @param {*} env - Worker environment
 * @returns {Promise<void>}
 */
async function storeCustomer(customerId, customerData, env) {
    const customerKey = `customer_${customerId}`;
    await env.OTP_AUTH_KV.put(customerKey, JSON.stringify(customerData));
}

/**
 * Create API key for customer
 * @param {string} customerId - Customer ID
 * @param {string} name - API key name
 * @param {string} env - Worker environment
 * @returns {Promise<{apiKey: string, keyId: string}>} API key and key ID
 */
async function createApiKeyForCustomer(customerId, name, env) {
    // Generate API key
    const apiKey = await generateApiKey('otp_live_sk_');
    const apiKeyHash = await hashApiKey(apiKey);
    
    // Generate key ID
    const keyId = `key_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Store API key hash
    const apiKeyData = {
        customerId,
        keyId,
        name: name || 'Default API Key',
        createdAt: new Date().toISOString(),
        lastUsed: null,
        status: 'active'
    };
    
    const apiKeyKey = `apikey_${apiKeyHash}`;
    await env.OTP_AUTH_KV.put(apiKeyKey, JSON.stringify(apiKeyData));
    
    // Also store key ID to hash mapping for customer
    const customerApiKeysKey = `customer_${customerId}_apikeys`;
    const existingKeys = await env.OTP_AUTH_KV.get(customerApiKeysKey, { type: 'json' }) || [];
    existingKeys.push({
        keyId,
        name: apiKeyData.name,
        createdAt: apiKeyData.createdAt,
        lastUsed: null,
        status: 'active'
    });
    await env.OTP_AUTH_KV.put(customerApiKeysKey, JSON.stringify(existingKeys));
    
    return { apiKey, keyId };
}

/**
 * Verify API key and get customer ID
 * @param {string} apiKey - API key
 * @param {*} env - Worker environment
 * @returns {Promise<{customerId: string, keyId: string}|null>} Customer ID and key ID or null
 */
async function verifyApiKey(apiKey, env) {
    const apiKeyHash = await hashApiKey(apiKey);
    const apiKeyKey = `apikey_${apiKeyHash}`;
    const keyData = await env.OTP_AUTH_KV.get(apiKeyKey, { type: 'json' });
    
    if (!keyData || keyData.status !== 'active') {
        return null;
    }
    
    // Update last used timestamp
    keyData.lastUsed = new Date().toISOString();
    await env.OTP_AUTH_KV.put(apiKeyKey, JSON.stringify(keyData));
    
    // Also update in customer's key list
    const customerApiKeysKey = `customer_${keyData.customerId}_apikeys`;
    const customerKeys = await env.OTP_AUTH_KV.get(customerApiKeysKey, { type: 'json' }) || [];
    const keyIndex = customerKeys.findIndex(k => k.keyId === keyData.keyId);
    if (keyIndex >= 0) {
        customerKeys[keyIndex].lastUsed = keyData.lastUsed;
        await env.OTP_AUTH_KV.put(customerApiKeysKey, JSON.stringify(customerKeys));
    }
    
    // Check if customer is active
    const customer = await getCustomer(keyData.customerId, env);
    if (!customer || customer.status !== 'active') {
        return null;
    }
    
    return {
        customerId: keyData.customerId,
        keyId: keyData.keyId
    };
}

/**
 * Register new customer
 * POST /admin/customers
 */
async function handleRegisterCustomer(request, env) {
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
        
        // Create customer record
        const customerData = {
            customerId,
            name,
            email: email.toLowerCase().trim(),
            companyName,
            plan,
            status: 'pending_verification',
            createdAt: new Date().toISOString(),
            features: {
                customEmailTemplates: plan !== 'free',
                webhooks: plan !== 'free',
                analytics: plan !== 'free',
                sso: plan === 'enterprise'
            }
        };
        
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
 * List customer API keys
 * GET /admin/customers/{customerId}/api-keys
 */
async function handleListApiKeys(request, env, customerId) {
    try {
        const customerApiKeysKey = `customer_${customerId}_apikeys`;
        const keys = await env.OTP_AUTH_KV.get(customerApiKeysKey, { type: 'json' }) || [];
        
        // Don't expose key hashes, just metadata
        const keysMetadata = keys.map(k => ({
            keyId: k.keyId,
            name: k.name,
            createdAt: k.createdAt,
            lastUsed: k.lastUsed,
            status: k.status
        }));
        
        return new Response(JSON.stringify({
            success: true,
            keys: keysMetadata
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to list API keys',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Create new API key for customer
 * POST /admin/customers/{customerId}/api-keys
 */
async function handleCreateApiKey(request, env, customerId) {
    try {
        const body = await request.json();
        const { name = 'New API Key' } = body;
        
        // Verify customer exists
        const customer = await getCustomer(customerId, env);
        if (!customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Create API key
        const { apiKey, keyId } = await createApiKeyForCustomer(customerId, name, env);
        
        return new Response(JSON.stringify({
            success: true,
            apiKey, // Only returned once!
            keyId,
            name,
            message: 'API key created successfully. Save your API key - it will not be shown again.'
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to create API key',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Revoke API key
 * DELETE /admin/customers/{customerId}/api-keys/{keyId}
 */
async function handleRevokeApiKey(request, env, customerId, keyId) {
    try {
        // Find the API key in customer's list
        const customerApiKeysKey = `customer_${customerId}_apikeys`;
        const customerKeys = await env.OTP_AUTH_KV.get(customerApiKeysKey, { type: 'json' }) || [];
        const keyIndex = customerKeys.findIndex(k => k.keyId === keyId);
        
        if (keyIndex < 0) {
            return new Response(JSON.stringify({ error: 'API key not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Mark as revoked in customer's list
        customerKeys[keyIndex].status = 'revoked';
        customerKeys[keyIndex].revokedAt = new Date().toISOString();
        await env.OTP_AUTH_KV.put(customerApiKeysKey, JSON.stringify(customerKeys));
        
        // Note: We can't delete the hash->keyId mapping without the original key
        // But we check status in verifyApiKey, so revoked keys won't work
        
        return new Response(JSON.stringify({
            success: true,
            message: 'API key revoked successfully'
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to revoke API key',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Request OTP endpoint
 * POST /auth/request-otp
 */
async function handleRequestOTP(request, env, customerId = null) {
    try {
        const body = await request.json();
        const { email } = body;
        
        // Validate email
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return new Response(JSON.stringify({ error: 'Valid email address required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Check rate limit
        const emailHash = await hashEmail(email);
        const rateLimit = await checkOTPRateLimit(emailHash, customerId, env);
        
        if (!rateLimit.allowed) {
            return new Response(JSON.stringify({ 
                error: 'Too many requests. Please try again later.',
                resetAt: rateLimit.resetAt,
                remaining: rateLimit.remaining
            }), {
                status: 429,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
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
            const emailResult = await sendOTPEmail(email, otp, env);
            console.log('OTP email sent successfully:', emailResult);
        } catch (error) {
            // Log the full error for debugging
            console.error('Failed to send OTP email:', {
                message: error.message,
                stack: error.stack,
                email: email.toLowerCase().trim(),
                hasResendKey: !!env.RESEND_API_KEY
            });
            // Return error so user knows email failed
            return new Response(JSON.stringify({ 
                error: 'Failed to send email. Please check your email address and try again.',
                details: env.ENVIRONMENT === 'development' ? error.message : undefined
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
        return new Response(JSON.stringify({ 
            error: 'Failed to request OTP',
            message: error.message,
            details: env.ENVIRONMENT === 'development' ? error.stack : undefined
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Verify OTP endpoint
 * POST /auth/verify-otp
 */
async function handleVerifyOTP(request, env, customerId = null) {
    try {
        const body = await request.json();
        const { email, otp } = body;
        
        // Validate input
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return new Response(JSON.stringify({ error: 'Valid email address required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        if (!otp || !/^\d{6}$/.test(otp)) {
            return new Response(JSON.stringify({ error: 'Valid 6-digit OTP required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const emailHash = await hashEmail(email);
        const emailLower = email.toLowerCase().trim();
        
        // Get latest OTP key with customer isolation
        const latestOtpKey = getCustomerKey(customerId, `otp_latest_${emailHash}`);
        const latestOtpKeyValue = await env.OTP_AUTH_KV.get(latestOtpKey);
        
        if (!latestOtpKeyValue) {
            return new Response(JSON.stringify({ error: 'OTP not found or expired' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Get OTP data
        const otpDataStr = await env.OTP_AUTH_KV.get(latestOtpKeyValue);
        if (!otpDataStr) {
            return new Response(JSON.stringify({ error: 'OTP not found or expired' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const otpData = JSON.parse(otpDataStr);
        
        // Verify email matches
        if (otpData.email !== emailLower) {
            return new Response(JSON.stringify({ error: 'Invalid OTP' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Check expiration
        if (new Date(otpData.expiresAt) < new Date()) {
            await env.OTP_AUTH_KV.delete(latestOtpKeyValue);
            await env.OTP_AUTH_KV.delete(latestOtpKey);
            return new Response(JSON.stringify({ error: 'OTP expired' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Check attempts
        if (otpData.attempts >= 5) {
            await env.OTP_AUTH_KV.delete(latestOtpKeyValue);
            await env.OTP_AUTH_KV.delete(latestOtpKey);
            return new Response(JSON.stringify({ error: 'Too many failed attempts' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Verify OTP
        if (otpData.otp !== otp) {
            otpData.attempts++;
            await env.OTP_AUTH_KV.put(latestOtpKeyValue, JSON.stringify(otpData), { expirationTtl: 600 });
            return new Response(JSON.stringify({ 
                error: 'Invalid OTP',
                remainingAttempts: 5 - otpData.attempts
            }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // OTP is valid! Delete it (single-use)
        await env.OTP_AUTH_KV.delete(latestOtpKeyValue);
        await env.OTP_AUTH_KV.delete(latestOtpKey);
        
        // Get or create user with customer isolation
        const userId = await generateUserId(emailLower);
        const userKey = getCustomerKey(customerId, `user_${emailHash}`);
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
        
        // Generate CSRF token for this session
        const csrfToken = crypto.randomUUID ? crypto.randomUUID() : 
            Array.from(crypto.getRandomValues(new Uint8Array(16)))
                .map(b => b.toString(16).padStart(2, '0')).join('');
        
        // Generate JWT token (7 hours expiration for security)
        const expiresAt = new Date(Date.now() + 7 * 60 * 60 * 1000); // 7 hours
        const tokenPayload = {
            userId,
            email: emailLower,
            customerId: customerId, // Include customer ID in token
            csrf: csrfToken, // CSRF token included in JWT
            exp: Math.floor(expiresAt.getTime() / 1000),
            iat: Math.floor(Date.now() / 1000),
        };
        
        const jwtSecret = getJWTSecret(env);
        const token = await createJWT(tokenPayload, jwtSecret);
        
        // Store session with customer isolation
        const sessionKey = getCustomerKey(customerId, `session_${userId}`);
        await env.OTP_AUTH_KV.put(sessionKey, JSON.stringify({
            userId,
            email: emailLower,
            token: await hashEmail(token), // Store hash of token
            expiresAt: expiresAt.toISOString(),
            createdAt: new Date().toISOString(),
        }), { expirationTtl: 25200 }); // 7 hours (matches token expiration)
        
        return new Response(JSON.stringify({ 
            success: true,
            token,
            userId,
            email: emailLower,
            expiresAt: expiresAt.toISOString(),
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
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

/**
 * Get current user endpoint
 * GET /auth/me
 */
async function handleGetMe(request, env) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Authorization header required' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const token = authHeader.substring(7);
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret);
        
        if (!payload) {
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Get customer ID from token (for multi-tenant isolation)
        const customerId = payload.customerId || null;
        
        // Get user data with customer isolation
        const emailHash = await hashEmail(payload.email);
        const userKey = getCustomerKey(customerId, `user_${emailHash}`);
        const user = await env.OTP_AUTH_KV.get(userKey, { type: 'json' });
        
        if (!user) {
            return new Response(JSON.stringify({ error: 'User not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify({ 
            success: true,
            userId: user.userId,
            email: user.email,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to get user info',
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Logout endpoint
 * POST /auth/logout
 */
async function handleLogout(request, env) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Authorization header required' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const token = authHeader.substring(7);
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret);
        
        if (!payload) {
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Get customer ID from token
        const customerId = payload.customerId || null;
        
        // Add token to blacklist with customer isolation
        const tokenHash = await hashEmail(token);
        const blacklistKey = getCustomerKey(customerId, `blacklist_${tokenHash}`);
        await env.OTP_AUTH_KV.put(blacklistKey, JSON.stringify({
            token: tokenHash,
            revokedAt: new Date().toISOString(),
        }), { expirationTtl: 25200 }); // 7 hours (matches token expiration)
        
        // Delete session with customer isolation
        const sessionKey = getCustomerKey(customerId, `session_${payload.userId}`);
        await env.OTP_AUTH_KV.delete(sessionKey);
        
        return new Response(JSON.stringify({ 
            success: true,
            message: 'Logged out successfully'
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to logout',
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Refresh token endpoint
 * POST /auth/refresh
 */
async function handleRefresh(request, env) {
    try {
        const body = await request.json();
        const { token } = body;
        
        if (!token) {
            return new Response(JSON.stringify({ error: 'Token required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const jwtSecret = getJWTSecret(env);
        const payload = await verifyJWT(token, jwtSecret);
        
        if (!payload) {
            return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Get customer ID from token
        const customerId = payload.customerId || null;
        
        // Check if token is blacklisted with customer isolation
        const tokenHash = await hashEmail(token);
        const blacklistKey = getCustomerKey(customerId, `blacklist_${tokenHash}`);
        const blacklisted = await env.OTP_AUTH_KV.get(blacklistKey);
        if (blacklisted) {
            return new Response(JSON.stringify({ error: 'Token has been revoked' }), {
                status: 401,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Generate new CSRF token for refreshed session
        const newCsrfToken = crypto.randomUUID ? crypto.randomUUID() : 
            Array.from(crypto.getRandomValues(new Uint8Array(16)))
                .map(b => b.toString(16).padStart(2, '0')).join('');
        
        // Generate new token (7 hours expiration)
        const expiresAt = new Date(Date.now() + 7 * 60 * 60 * 1000); // 7 hours
        const newTokenPayload = {
            userId: payload.userId,
            email: payload.email,
            customerId: customerId, // Preserve customer ID
            csrf: newCsrfToken, // New CSRF token for refreshed session
            exp: Math.floor(expiresAt.getTime() / 1000),
            iat: Math.floor(Date.now() / 1000),
        };
        
        const newToken = await createJWT(newTokenPayload, jwtSecret);
        
        // Update session with customer isolation
        const sessionKey = getCustomerKey(customerId, `session_${payload.userId}`);
        await env.OTP_AUTH_KV.put(sessionKey, JSON.stringify({
            userId: payload.userId,
            email: payload.email,
            token: await hashEmail(newToken),
            expiresAt: expiresAt.toISOString(),
            createdAt: new Date().toISOString(),
        }), { expirationTtl: 25200 }); // 7 hours
        
        return new Response(JSON.stringify({ 
            success: true,
            token: newToken,
            expiresAt: expiresAt.toISOString(),
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to refresh token',
            message: error.message 
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Authenticate request using API key
 * @param {Request} request - HTTP request
 * @param {*} env - Worker environment
 * @returns {Promise<{customerId: string, keyId: string}|null>} Customer info or null if not authenticated
 */
async function authenticateRequest(request, env) {
    // Try Authorization header first
    const authHeader = request.headers.get('Authorization');
    let apiKey = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.substring(7);
    } else {
        // Try X-OTP-API-Key header as alternative
        apiKey = request.headers.get('X-OTP-API-Key');
    }
    
    if (!apiKey) {
        return null;
    }
    
    // Verify API key
    const authResult = await verifyApiKey(apiKey, env);
    return authResult;
}

/**
 * Main request handler
 */
export default {
    async fetch(request, env, ctx) {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: getCorsHeaders(env, request),
            });
        }
        
        const url = new URL(request.url);
        const path = url.pathname;
        
        try {
            // Public endpoints (no auth required)
            if (path === '/admin/customers' && request.method === 'POST') {
                return handleRegisterCustomer(request, env);
            }
            
            if (path === '/health' && request.method === 'GET') {
                return new Response(JSON.stringify({ 
                    status: 'healthy',
                    service: 'otp-auth-service',
                    version: '1.0.0'
                }), {
                    headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                });
            }
            
            // API key management endpoints (require API key auth)
            const customerApiKeysMatch = path.match(/^\/admin\/customers\/([^\/]+)\/api-keys$/);
            if (customerApiKeysMatch) {
                const pathCustomerId = customerApiKeysMatch[1];
                
                // Authenticate request
                const auth = await authenticateRequest(request, env);
                if (!auth) {
                    return new Response(JSON.stringify({ error: 'Authentication required' }), {
                        status: 401,
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                }
                
                // Verify customer ID matches (prevent access to other customers' keys)
                if (auth.customerId !== pathCustomerId) {
                    return new Response(JSON.stringify({ error: 'Forbidden' }), {
                        status: 403,
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                }
                
                if (request.method === 'GET') {
                    return handleListApiKeys(request, env, auth.customerId);
                }
                if (request.method === 'POST') {
                    return handleCreateApiKey(request, env, auth.customerId);
                }
            }
            
            const revokeApiKeyMatch = path.match(/^\/admin\/customers\/([^\/]+)\/api-keys\/([^\/]+)$/);
            if (revokeApiKeyMatch && request.method === 'DELETE') {
                const pathCustomerId = revokeApiKeyMatch[1];
                const keyId = revokeApiKeyMatch[2];
                
                // Authenticate request
                const auth = await authenticateRequest(request, env);
                if (!auth) {
                    return new Response(JSON.stringify({ error: 'Authentication required' }), {
                        status: 401,
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                }
                
                // Verify customer ID matches
                if (auth.customerId !== pathCustomerId) {
                    return new Response(JSON.stringify({ error: 'Forbidden' }), {
                        status: 403,
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                }
                
                return handleRevokeApiKey(request, env, auth.customerId, keyId);
            }
            
            // Authentication endpoints (require API key for multi-tenant)
            // For backward compatibility, allow requests without API key (customerId will be null)
            let customerId = null;
            const auth = await authenticateRequest(request, env);
            if (auth) {
                customerId = auth.customerId;
            }
            
            // Attach customerId to request context by wrapping handlers
            if (path === '/auth/request-otp' && request.method === 'POST') {
                // Inject customerId into handler
                const originalHandler = handleRequestOTP;
                return originalHandler(request, env, customerId);
            }
            if (path === '/auth/verify-otp' && request.method === 'POST') {
                const originalHandler = handleVerifyOTP;
                return originalHandler(request, env, customerId);
            }
            if (path === '/auth/me' && request.method === 'GET') {
                return handleGetMe(request, env);
            }
            if (path === '/auth/logout' && request.method === 'POST') {
                return handleLogout(request, env);
            }
            if (path === '/auth/refresh' && request.method === 'POST') {
                return handleRefresh(request, env);
            }
            
            // 404 for unknown routes
            return new Response(JSON.stringify({ error: 'Not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        } catch (error) {
            console.error('Request handler error:', error);
            return new Response(JSON.stringify({ 
                error: 'Internal server error',
                message: env.ENVIRONMENT === 'development' ? error.message : undefined
            }), {
                status: 500,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
    }
};

