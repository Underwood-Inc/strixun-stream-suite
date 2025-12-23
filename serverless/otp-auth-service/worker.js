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
 * @version 2.0.0
 */

// CORS headers for cross-origin requests
function getCorsHeaders(env, request, customer = null) {
    const origin = request.headers.get('Origin');
    
    // Get customer-specific allowed origins if customer is provided
    let allowedOrigins = [];
    
    if (customer && customer.config && customer.config.allowedOrigins) {
        allowedOrigins = customer.config.allowedOrigins;
    }
    
    // Fallback to environment variable if no customer-specific config
    if (allowedOrigins.length === 0) {
        allowedOrigins = env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : [];
    }
    
    // If no origins configured, allow all (for development only)
    // In production, you MUST set ALLOWED_ORIGINS via: wrangler secret put ALLOWED_ORIGINS
    let allowOrigin = '*'; // Default fallback
    
    if (allowedOrigins.length > 0) {
        // Check for exact match or wildcard patterns
        const matchedOrigin = allowedOrigins.find(allowed => {
            if (allowed === '*') return true;
            if (allowed.endsWith('*')) {
                const prefix = allowed.slice(0, -1);
                return origin && origin.startsWith(prefix);
            }
            return origin === allowed;
        });
        allowOrigin = matchedOrigin === '*' ? '*' : (matchedOrigin || null);
    }
    
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
        // Get customer configuration for rate limits
        let rateLimitPerHour = 3; // Default
        if (customerId) {
            const customer = await getCustomer(customerId, env);
            if (customer && customer.config && customer.config.rateLimits) {
                rateLimitPerHour = customer.config.rateLimits.otpRequestsPerHour || 3;
            }
        }
        
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
            if (rateLimit.otpRequests >= rateLimitPerHour) {
                return { allowed: false, remaining: 0, resetAt: rateLimit.resetAt };
            }
            
            // Increment counter (this request counts)
            rateLimit.otpRequests = (rateLimit.otpRequests || 0) + 1;
            await env.OTP_AUTH_KV.put(rateLimitKey, JSON.stringify(rateLimit), { expirationTtl: 3600 });
            
            return { allowed: true, remaining: rateLimitPerHour - rateLimit.otpRequests, resetAt: rateLimit.resetAt };
        }
        
        // No rate limit or expired - create new one (this request counts as 1)
        const resetAt = new Date(now + oneHour).toISOString();
        const newRateLimit = {
            otpRequests: 1,
            failedAttempts: 0,
            resetAt: resetAt
        };
        await env.OTP_AUTH_KV.put(rateLimitKey, JSON.stringify(newRateLimit), { expirationTtl: 3600 });
        
        return { allowed: true, remaining: rateLimitPerHour - 1, resetAt: resetAt };
    } catch (error) {
        console.error('Rate limit check error:', error);
        // On error, allow the request (fail open for availability)
        return { allowed: true, remaining: 3, resetAt: new Date(Date.now() + 3600000).toISOString() };
    }
}

/**
 * Escape HTML entities
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
    if (!str) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(str).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Render email template with variables
 * @param {string} template - Template string
 * @param {object} variables - Variables to substitute
 * @param {boolean} isHtml - Whether this is an HTML template (escape variables)
 * @returns {string} Rendered template
 */
function renderEmailTemplate(template, variables, isHtml = false) {
    if (!template) return '';
    
    let rendered = template;
    
    // Replace all variables (case-insensitive)
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
        // For HTML templates, escape variables to prevent XSS (except for otp which is safe)
        // For text templates, use as-is
        const replacement = isHtml && key !== 'otp' ? escapeHtml(value || '') : (value || '');
        rendered = rendered.replace(regex, replacement);
    }
    
    return rendered;
}

/**
 * Get default email template
 * @returns {string} Default HTML template
 */
function getDefaultEmailTemplate() {
    return `
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
                <div class="otp-code">{{otp}}</div>
                <p>This code will expire in <strong>{{expiresIn}} minutes</strong>.</p>
                <p>If you didn't request this code, please ignore this email.</p>
                <div class="footer">
                    <p>{{appName}}</p>
                    <p>This is an automated message, please do not reply.</p>
                </div>
            </div>
        </body>
        </html>
    `;
}

/**
 * Get default text email template
 * @returns {string} Default text template
 */
function getDefaultTextTemplate() {
    return `Your Verification Code

Use this code to verify your email address: {{otp}}

This code will expire in {{expiresIn}} minutes.

If you didn't request this code, please ignore this email.

{{appName}}
This is an automated message, please do not reply.`;
}

/**
 * Resend email provider
 */
class ResendProvider {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.resend.com';
    }
    
    async sendEmail({ from, to, subject, html, text }) {
        const response = await fetch(`${this.baseUrl}/emails`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from,
                to,
                subject,
                html,
                text,
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
            
            throw new Error(`Resend API error: ${response.status} - ${errorData.message || errorText}`);
        }
        
        return await response.json();
    }
}

/**
 * SendGrid email provider
 */
class SendGridProvider {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.sendgrid.com/v3';
    }
    
    async sendEmail({ from, to, subject, html, text }) {
        const response = await fetch(`${this.baseUrl}/mail/send`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                personalizations: [{
                    to: [{ email: to }]
                }],
                from: { email: from },
                subject: subject,
                content: [
                    { type: 'text/plain', value: text },
                    { type: 'text/html', value: html }
                ]
            }),
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SendGrid API error: ${response.status} - ${errorText}`);
        }
        
        return { success: true };
    }
}

/**
 * AWS SES email provider
 */
class SESProvider {
    constructor(accessKeyId, secretAccessKey, region = 'us-east-1') {
        this.accessKeyId = accessKeyId;
        this.secretAccessKey = secretAccessKey;
        this.region = region;
    }
    
    async sendEmail({ from, to, subject, html, text }) {
        // Note: AWS SES requires AWS SDK or manual signature generation
        // For now, this is a placeholder - would need AWS SDK or manual signing
        throw new Error('AWS SES provider not yet implemented. Use Resend or SendGrid.');
    }
}

/**
 * SMTP email provider (generic)
 */
class SMTPProvider {
    constructor(config) {
        this.host = config.host;
        this.port = config.port;
        this.secure = config.secure || false;
        this.auth = config.auth;
    }
    
    async sendEmail({ from, to, subject, html, text }) {
        // Note: SMTP requires a library like nodemailer
        // Cloudflare Workers don't support SMTP directly
        // Would need to use a third-party service or Durable Objects
        throw new Error('SMTP provider not supported in Cloudflare Workers. Use Resend or SendGrid.');
    }
}

/**
 * Get email provider for customer
 * @param {object} customer - Customer object
 * @param {*} env - Worker environment
 * @returns {object} Email provider instance
 */
function getEmailProvider(customer, env) {
    // Check if customer has custom email provider config
    if (customer && customer.config && customer.config.emailProvider) {
        const providerConfig = customer.config.emailProvider;
        
        if (providerConfig.type === 'resend' && providerConfig.apiKey) {
            return new ResendProvider(providerConfig.apiKey);
        }
        
        if (providerConfig.type === 'sendgrid' && providerConfig.apiKey) {
            return new SendGridProvider(providerConfig.apiKey);
        }
        
        if (providerConfig.type === 'ses') {
            return new SESProvider(
                providerConfig.accessKeyId,
                providerConfig.secretAccessKey,
                providerConfig.region
            );
        }
        
        if (providerConfig.type === 'smtp') {
            return new SMTPProvider(providerConfig);
        }
    }
    
    // Default to Resend using environment variables
    if (!env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY not configured and no customer email provider set');
    }
    
    return new ResendProvider(env.RESEND_API_KEY);
}

/**
 * Send OTP email
 * @param {string} email - Recipient email
 * @param {string} otp - OTP code
 * @param {string} customerId - Customer ID (optional)
 * @param {*} env - Worker environment
 * @returns {Promise<object>} Email provider response
 */
async function sendOTPEmail(email, otp, customerId, env) {
    if (!env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY not configured');
    }
    
    // Get customer configuration if customerId provided
    let customer = null;
    let emailConfig = null;
    let fromEmail = env.RESEND_FROM_EMAIL;
    let fromName = 'OTP Auth Service';
    let subjectTemplate = 'Your Verification Code - {{appName}}';
    let htmlTemplate = null;
    let textTemplate = null;
    let templateVariables = {
        appName: 'OTP Auth Service',
        brandColor: '#007bff',
        footerText: 'This is an automated message, please do not reply.',
        supportUrl: null,
        logoUrl: null
    };
    
    if (customerId) {
        customer = await getCustomer(customerId, env);
        if (customer && customer.config && customer.config.emailConfig) {
            emailConfig = customer.config.emailConfig;
            
            // Use customer's email config
            if (emailConfig.fromEmail) {
                fromEmail = emailConfig.fromEmail;
            }
            if (emailConfig.fromName) {
                fromName = emailConfig.fromName;
            }
            if (emailConfig.subjectTemplate) {
                subjectTemplate = emailConfig.subjectTemplate;
            }
            if (emailConfig.htmlTemplate) {
                htmlTemplate = emailConfig.htmlTemplate;
            }
            if (emailConfig.textTemplate) {
                textTemplate = emailConfig.textTemplate;
            }
            if (emailConfig.variables) {
                templateVariables = { ...templateVariables, ...emailConfig.variables };
            }
        }
    }
    
    // Fallback to default if no customer email configured
    if (!fromEmail) {
        throw new Error('RESEND_FROM_EMAIL must be set to your verified domain email (e.g., noreply@yourdomain.com). Set it via: wrangler secret put RESEND_FROM_EMAIL');
    }
    
    // Prepare template variables
    const variables = {
        ...templateVariables,
        otp,
        expiresIn: '10',
        userEmail: email,
        appName: templateVariables.appName || customer?.companyName || 'OTP Auth Service'
    };
    
    // Render templates (HTML template escapes variables for security, text does not)
    const html = renderEmailTemplate(htmlTemplate || getDefaultEmailTemplate(), variables, true);
    const text = renderEmailTemplate(textTemplate || getDefaultTextTemplate(), variables, false);
    const subject = renderEmailTemplate(subjectTemplate, variables, false);
    
    // Build from field
    const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
    
    // Get email provider
    const provider = getEmailProvider(customer, env);
    
    try {
        // Send email using provider
        const result = await provider.sendEmail({
            from: from,
            to: email,
            subject: subject,
            html: html,
            text: text
        });
        
        console.log('Email sent successfully:', result);
        return result;
    } catch (error) {
        // Log detailed error for debugging
        console.error('Email sending error:', {
            message: error.message,
            stack: error.stack,
            email: email.toLowerCase().trim(),
            customerId: customerId,
            provider: customer?.config?.emailProvider?.type || 'resend'
        });
        
        throw error;
    }
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
    
    // Check if customer exists and is active
    const customer = await getCustomer(keyData.customerId, env);
    if (!customer) {
        return null;
    }
    
    // Only allow active customers
    if (customer.status !== 'active') {
        return null;
    }
    
    return {
        customerId: keyData.customerId,
        keyId: keyData.keyId
    };
}

/**
 * Hash password (simple SHA-256 for now - in production use bcrypt/argon2)
 * @param {string} password - Password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Public signup endpoint
 * POST /signup
 */
async function handlePublicSignup(request, env) {
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
async function handleVerifySignup(request, env) {
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
                allowedOrigins: [] // Empty = allow all (for development)
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
 * Validate email template
 * @param {string} template - Email template
 * @returns {boolean} True if valid
 */
function validateEmailTemplate(template) {
    if (!template) return true; // Null means use default
    // Must contain {{otp}} variable
    return template.includes('{{otp}}');
}

/**
 * Validate customer configuration
 * @param {object} config - Configuration object
 * @param {object} customer - Customer data
 * @returns {Promise<{valid: boolean, errors: string[]}>}
 */
async function validateCustomerConfig(config, customer) {
    const errors = [];
    
    // Validate email config
    if (config.emailConfig) {
        if (config.emailConfig.fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.emailConfig.fromEmail)) {
            errors.push('Invalid fromEmail format');
        }
        
        if (config.emailConfig.htmlTemplate && !validateEmailTemplate(config.emailConfig.htmlTemplate)) {
            errors.push('HTML template must contain {{otp}} variable');
        }
        
        if (config.emailConfig.textTemplate && !validateEmailTemplate(config.emailConfig.textTemplate)) {
            errors.push('Text template must contain {{otp}} variable');
        }
    }
    
    // Validate rate limits (must not exceed plan limits)
    if (config.rateLimits) {
        const planLimits = getPlanLimits(customer.plan);
        
        if (config.rateLimits.otpRequestsPerHour > planLimits.otpRequestsPerHour) {
            errors.push(`otpRequestsPerHour cannot exceed plan limit of ${planLimits.otpRequestsPerHour}`);
        }
        
        if (config.rateLimits.otpRequestsPerDay > planLimits.otpRequestsPerDay) {
            errors.push(`otpRequestsPerDay cannot exceed plan limit of ${planLimits.otpRequestsPerDay}`);
        }
        
        if (config.rateLimits.maxUsers > planLimits.maxUsers) {
            errors.push(`maxUsers cannot exceed plan limit of ${planLimits.maxUsers}`);
        }
    }
    
    // Validate webhook URL
    if (config.webhookConfig && config.webhookConfig.url) {
        try {
            new URL(config.webhookConfig.url);
        } catch (e) {
            errors.push('Invalid webhook URL format');
        }
    }
    
    // Validate allowed origins
    if (config.allowedOrigins && !Array.isArray(config.allowedOrigins)) {
        errors.push('allowedOrigins must be an array');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Get plan limits
 * @param {string} plan - Plan name
 * @returns {object} Plan limits
 */
function getPlanLimits(plan) {
    const limits = {
        free: {
            otpRequestsPerHour: 3,
            otpRequestsPerDay: 50,
            maxUsers: 100
        },
        starter: {
            otpRequestsPerHour: 10,
            otpRequestsPerDay: 500,
            maxUsers: 1000
        },
        pro: {
            otpRequestsPerHour: 50,
            otpRequestsPerDay: 5000,
            maxUsers: 10000
        },
        enterprise: {
            otpRequestsPerHour: 1000,
            otpRequestsPerDay: 100000,
            maxUsers: 1000000
        }
    };
    
    return limits[plan] || limits.free;
}

/**
 * Get customer configuration
 * GET /admin/config
 */
async function handleGetConfig(request, env, customerId) {
    try {
        const customer = await getCustomer(customerId, env);
        if (!customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify({
            success: true,
            config: customer.config || {},
            configVersion: customer.configVersion || 1,
            plan: customer.plan,
            features: customer.features
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to get configuration',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Update customer configuration
 * PUT /admin/config
 */
async function handleUpdateConfig(request, env, customerId) {
    try {
        const customer = await getCustomer(customerId, env);
        if (!customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const body = await request.json();
        const { config } = body;
        
        if (!config) {
            return new Response(JSON.stringify({ error: 'Configuration object required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Merge with existing config (partial updates allowed)
        const existingConfig = customer.config || {};
        const mergedConfig = {
            emailConfig: { ...existingConfig.emailConfig, ...(config.emailConfig || {}) },
            rateLimits: { ...existingConfig.rateLimits, ...(config.rateLimits || {}) },
            webhookConfig: { ...existingConfig.webhookConfig, ...(config.webhookConfig || {}) },
            allowedOrigins: config.allowedOrigins !== undefined ? config.allowedOrigins : existingConfig.allowedOrigins
        };
        
        // Validate configuration
        const validation = await validateCustomerConfig(mergedConfig, customer);
        if (!validation.valid) {
            return new Response(JSON.stringify({
                error: 'Invalid configuration',
                errors: validation.errors
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Update customer with new config
        customer.config = mergedConfig;
        customer.configVersion = (customer.configVersion || 1) + 1;
        customer.updatedAt = new Date().toISOString();
        
        await storeCustomer(customerId, customer, env);
        
        return new Response(JSON.stringify({
            success: true,
            config: customer.config,
            configVersion: customer.configVersion,
            message: 'Configuration updated successfully'
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to update configuration',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Update email configuration
 * PUT /admin/config/email
 */
async function handleUpdateEmailConfig(request, env, customerId) {
    try {
        const customer = await getCustomer(customerId, env);
        if (!customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const body = await request.json();
        const emailConfig = body;
        
        // Merge with existing email config
        const existingConfig = customer.config || {};
        const existingEmailConfig = existingConfig.emailConfig || {};
        const mergedEmailConfig = { ...existingEmailConfig, ...emailConfig };
        
        // Validate
        const validation = await validateCustomerConfig({ emailConfig: mergedEmailConfig }, customer);
        if (!validation.valid) {
            return new Response(JSON.stringify({
                error: 'Invalid email configuration',
                errors: validation.errors
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Update
        if (!customer.config) customer.config = {};
        customer.config.emailConfig = mergedEmailConfig;
        customer.configVersion = (customer.configVersion || 1) + 1;
        customer.updatedAt = new Date().toISOString();
        
        await storeCustomer(customerId, customer, env);
        
        return new Response(JSON.stringify({
            success: true,
            emailConfig: customer.config.emailConfig,
            message: 'Email configuration updated successfully'
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to update email configuration',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Update customer status
 * PUT /admin/customers/{customerId}/status
 */
async function handleUpdateCustomerStatus(request, env, customerId, newStatus) {
    try {
        const customer = await getCustomer(customerId, env);
        if (!customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Validate status
        const validStatuses = ['active', 'suspended', 'cancelled', 'pending_verification'];
        if (!validStatuses.includes(newStatus)) {
            return new Response(JSON.stringify({ 
                error: 'Invalid status',
                validStatuses 
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Update status
        const oldStatus = customer.status;
        customer.status = newStatus;
        customer.statusChangedAt = new Date().toISOString();
        customer.updatedAt = new Date().toISOString();
        
        await storeCustomer(customerId, customer, env);
        
        // Log status change
        console.log(`Customer ${customerId} status changed from ${oldStatus} to ${newStatus}`);
        
        return new Response(JSON.stringify({
            success: true,
            customerId,
            oldStatus,
            newStatus,
            statusChangedAt: customer.statusChangedAt,
            message: `Customer status updated to ${newStatus}`
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to update customer status',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Suspend customer
 * POST /admin/customers/{customerId}/suspend
 */
async function handleSuspendCustomer(request, env, customerId) {
    return handleUpdateCustomerStatus(request, env, customerId, 'suspended');
}

/**
 * Activate customer
 * POST /admin/customers/{customerId}/activate
 */
async function handleActivateCustomer(request, env, customerId) {
    return handleUpdateCustomerStatus(request, env, customerId, 'active');
}

/**
 * Get current customer info
 * GET /admin/customers/me
 */
async function handleGetMe(request, env, customerId) {
    try {
        const customer = await getCustomer(customerId, env);
        if (!customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Don't expose sensitive data
        return new Response(JSON.stringify({
            success: true,
            customer: {
                customerId: customer.customerId,
                name: customer.name,
                email: customer.email,
                companyName: customer.companyName,
                plan: customer.plan,
                status: customer.status,
                createdAt: customer.createdAt,
                features: customer.features
            }
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to get customer info',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Update customer info
 * PUT /admin/customers/me
 */
async function handleUpdateMe(request, env, customerId) {
    try {
        const customer = await getCustomer(customerId, env);
        if (!customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const body = await request.json();
        const { name, companyName } = body;
        
        // Update allowed fields only
        if (name !== undefined) {
            customer.name = name;
        }
        if (companyName !== undefined) {
            customer.companyName = companyName;
        }
        
        customer.updatedAt = new Date().toISOString();
        await storeCustomer(customerId, customer, env);
        
        return new Response(JSON.stringify({
            success: true,
            customer: {
                customerId: customer.customerId,
                name: customer.name,
                email: customer.email,
                companyName: customer.companyName,
                plan: customer.plan,
                status: customer.status
            },
            message: 'Customer info updated successfully'
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to update customer info',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Generate domain verification token
 * @returns {string} Verification token
 */
function generateVerificationToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Verify domain via DNS lookup
 * @param {string} domain - Domain to verify
 * @param {string} token - Verification token
 * @returns {Promise<boolean>} True if verified
 */
async function verifyDomainDNS(domain, token) {
    try {
        // Use Cloudflare's DNS-over-HTTPS API
        const dnsQuery = `_otpauth-verify.${domain}`;
        const dohUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(dnsQuery)}&type=TXT`;
        
        const response = await fetch(dohUrl, {
            headers: {
                'Accept': 'application/dns-json'
            }
        });
        
        if (!response.ok) {
            return false;
        }
        
        const data = await response.json();
        
        // Check if TXT record exists and contains token
        if (data.Answer && Array.isArray(data.Answer)) {
            for (const answer of data.Answer) {
                if (answer.type === 16 && answer.data) {
                    // TXT record data is in quotes, remove them
                    const recordValue = answer.data.replace(/^"|"$/g, '');
                    if (recordValue === token) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    } catch (error) {
        console.error('DNS verification error:', error);
        return false;
    }
}

/**
 * Request domain verification
 * POST /admin/domains/verify
 */
async function handleRequestDomainVerification(request, env, customerId) {
    try {
        const body = await request.json();
        const { domain } = body;
        
        if (!domain || !/^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/.test(domain)) {
            return new Response(JSON.stringify({ error: 'Valid domain name required' }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Generate verification token
        const token = generateVerificationToken();
        
        // Store verification record
        const domainKey = `domain_${domain}`;
        const verificationData = {
            domain,
            customerId,
            token,
            status: 'pending',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
        };
        
        await env.OTP_AUTH_KV.put(domainKey, JSON.stringify(verificationData), { expirationTtl: 604800 }); // 7 days
        
        // DNS record instructions
        const dnsRecord = {
            type: 'TXT',
            name: `_otpauth-verify.${domain}`,
            value: token,
            ttl: 3600
        };
        
        return new Response(JSON.stringify({
            success: true,
            domain,
            status: 'pending',
            dnsRecord,
            instructions: `Add a TXT record to your DNS with name "_otpauth-verify.${domain}" and value "${token}". Then call POST /admin/domains/${domain}/verify to check verification.`
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to request domain verification',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Check domain verification status
 * GET /admin/domains/{domain}/status
 */
async function handleGetDomainStatus(request, env, domain) {
    try {
        const domainKey = `domain_${domain}`;
        const verificationData = await env.OTP_AUTH_KV.get(domainKey, { type: 'json' });
        
        if (!verificationData) {
            return new Response(JSON.stringify({ 
                error: 'Domain verification not found',
                domain,
                status: 'not_started'
            }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        return new Response(JSON.stringify({
            success: true,
            domain: verificationData.domain,
            status: verificationData.status,
            createdAt: verificationData.createdAt,
            verifiedAt: verificationData.verifiedAt || null,
            expiresAt: verificationData.expiresAt
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to get domain status',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Verify domain (check DNS and update status)
 * POST /admin/domains/{domain}/verify
 */
async function handleVerifyDomain(request, env, customerId, domain) {
    try {
        const domainKey = `domain_${domain}`;
        const verificationData = await env.OTP_AUTH_KV.get(domainKey, { type: 'json' });
        
        if (!verificationData) {
            return new Response(JSON.stringify({ 
                error: 'Domain verification not found. Request verification first.',
                domain
            }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Verify customer owns this domain
        if (verificationData.customerId !== customerId) {
            return new Response(JSON.stringify({ error: 'Forbidden' }), {
                status: 403,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Check if already verified
        if (verificationData.status === 'verified') {
            return new Response(JSON.stringify({
                success: true,
                domain,
                status: 'verified',
                verifiedAt: verificationData.verifiedAt,
                message: 'Domain is already verified'
            }), {
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Check expiration
        if (new Date(verificationData.expiresAt) < new Date()) {
            return new Response(JSON.stringify({
                error: 'Verification expired. Please request a new verification.',
                domain
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Verify DNS record
        const isVerified = await verifyDomainDNS(domain, verificationData.token);
        
        if (isVerified) {
            // Update verification status
            verificationData.status = 'verified';
            verificationData.verifiedAt = new Date().toISOString();
            await env.OTP_AUTH_KV.put(domainKey, JSON.stringify(verificationData));
            
            // Update customer email config to use verified domain
            const customer = await getCustomer(customerId, env);
            if (customer) {
                if (!customer.config) customer.config = {};
                if (!customer.config.emailConfig) customer.config.emailConfig = {};
                
                // Set fromEmail if not already set
                if (!customer.config.emailConfig.fromEmail) {
                    customer.config.emailConfig.fromEmail = `noreply@${domain}`;
                }
                
                await storeCustomer(customerId, customer, env);
            }
            
            return new Response(JSON.stringify({
                success: true,
                domain,
                status: 'verified',
                verifiedAt: verificationData.verifiedAt,
                message: 'Domain verified successfully'
            }), {
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        } else {
            return new Response(JSON.stringify({
                success: false,
                domain,
                status: 'pending',
                message: 'DNS record not found or token mismatch. Please check your DNS configuration.'
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to verify domain',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Track response time
 * @param {string} customerId - Customer ID
 * @param {string} endpoint - Endpoint name
 * @param {number} responseTime - Response time in milliseconds
 * @param {*} env - Worker environment
 * @returns {Promise<void>}
 */
async function trackResponseTime(customerId, endpoint, responseTime, env) {
    if (!customerId) return;
    
    try {
        const today = new Date().toISOString().split('T')[0];
        const metricsKey = `metrics_${customerId}_${today}_${endpoint}`;
        
        const existing = await env.OTP_AUTH_KV.get(metricsKey, { type: 'json' }) || {
            endpoint,
            date: today,
            responseTimes: [],
            count: 0,
            sum: 0
        };
        
        existing.responseTimes.push(responseTime);
        existing.count++;
        existing.sum += responseTime;
        
        // Keep only last 1000 samples
        if (existing.responseTimes.length > 1000) {
            existing.responseTimes = existing.responseTimes.slice(-1000);
        }
        
        // Calculate percentiles
        const sorted = [...existing.responseTimes].sort((a, b) => a - b);
        existing.avgResponseTime = existing.sum / existing.count;
        existing.p50ResponseTime = sorted[Math.floor(sorted.length * 0.5)] || 0;
        existing.p95ResponseTime = sorted[Math.floor(sorted.length * 0.95)] || 0;
        existing.p99ResponseTime = sorted[Math.floor(sorted.length * 0.99)] || 0;
        
        await env.OTP_AUTH_KV.put(metricsKey, JSON.stringify(existing), { expirationTtl: 2592000 });
    } catch (error) {
        console.error('Response time tracking error:', error);
    }
}

/**
 * Track error
 * @param {string} customerId - Customer ID
 * @param {string} category - Error category
 * @param {string} message - Error message
 * @param {string} endpoint - Endpoint where error occurred
 * @param {*} env - Worker environment
 * @returns {Promise<void>}
 */
async function trackError(customerId, category, message, endpoint, env) {
    if (!customerId) return;
    
    try {
        const today = new Date().toISOString().split('T')[0];
        const errorKey = `errors_${customerId}_${today}`;
        
        const existing = await env.OTP_AUTH_KV.get(errorKey, { type: 'json' }) || {
            customerId,
            date: today,
            errors: [],
            byCategory: {},
            byEndpoint: {},
            total: 0
        };
        
        existing.errors.push({
            category,
            message,
            endpoint,
            timestamp: new Date().toISOString()
        });
        
        existing.byCategory[category] = (existing.byCategory[category] || 0) + 1;
        existing.byEndpoint[endpoint] = (existing.byEndpoint[endpoint] || 0) + 1;
        existing.total++;
        
        // Keep only last 1000 errors
        if (existing.errors.length > 1000) {
            existing.errors = existing.errors.slice(-1000);
        }
        
        await env.OTP_AUTH_KV.put(errorKey, JSON.stringify(existing), { expirationTtl: 2592000 });
    } catch (error) {
        console.error('Error tracking error:', error);
    }
}

/**
 * Track usage metric
 * @param {string} customerId - Customer ID
 * @param {string} metric - Metric name (otpRequests, otpVerifications, etc.)
 * @param {number} increment - Amount to increment (default 1)
 * @param {*} env - Worker environment
 * @returns {Promise<void>}
 */
async function trackUsage(customerId, metric, increment = 1, env) {
    if (!customerId) return; // Skip tracking for non-authenticated requests
    
    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const usageKey = `usage_${customerId}_${today}`;
        
        // Get existing usage
        const existingUsage = await env.OTP_AUTH_KV.get(usageKey, { type: 'json' }) || {
            customerId,
            date: today,
            otpRequests: 0,
            otpVerifications: 0,
            successfulLogins: 0,
            failedAttempts: 0,
            emailsSent: 0,
            apiCalls: 0,
            storageUsed: 0,
            lastUpdated: new Date().toISOString()
        };
        
        // Increment metric
        if (existingUsage[metric] !== undefined) {
            existingUsage[metric] = (existingUsage[metric] || 0) + increment;
        } else {
            existingUsage[metric] = increment;
        }
        
        existingUsage.lastUpdated = new Date().toISOString();
        
        // Store with 30-day TTL
        await env.OTP_AUTH_KV.put(usageKey, JSON.stringify(existingUsage), { expirationTtl: 2592000 });
    } catch (error) {
        console.error('Usage tracking error:', error);
        // Don't throw - usage tracking shouldn't break the request
    }
}

/**
 * Get usage for date range
 * @param {string} customerId - Customer ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {*} env - Worker environment
 * @returns {Promise<object>} Aggregated usage data
 */
async function getUsage(customerId, startDate, endDate, env) {
    const usage = {
        customerId,
        period: { start: startDate, end: endDate },
        otpRequests: 0,
        otpVerifications: 0,
        successfulLogins: 0,
        failedAttempts: 0,
        emailsSent: 0,
        apiCalls: 0,
        storageUsed: 0,
        dailyBreakdown: []
    };
    
    // Iterate through date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const usageKey = `usage_${customerId}_${dateStr}`;
        const dayUsage = await env.OTP_AUTH_KV.get(usageKey, { type: 'json' });
        
        if (dayUsage) {
            usage.otpRequests += dayUsage.otpRequests || 0;
            usage.otpVerifications += dayUsage.otpVerifications || 0;
            usage.successfulLogins += dayUsage.successfulLogins || 0;
            usage.failedAttempts += dayUsage.failedAttempts || 0;
            usage.emailsSent += dayUsage.emailsSent || 0;
            usage.apiCalls += dayUsage.apiCalls || 0;
            usage.storageUsed += dayUsage.storageUsed || 0;
            
            usage.dailyBreakdown.push({
                date: dateStr,
                otpRequests: dayUsage.otpRequests || 0,
                otpVerifications: dayUsage.otpVerifications || 0,
                successfulLogins: dayUsage.successfulLogins || 0,
                failedAttempts: dayUsage.failedAttempts || 0,
                emailsSent: dayUsage.emailsSent || 0
            });
        }
    }
    
    // Calculate success rate
    usage.successRate = usage.otpRequests > 0 
        ? ((usage.otpVerifications / usage.otpRequests) * 100).toFixed(2)
        : 0;
    
    return usage;
}

/**
 * Get current month usage
 * @param {string} customerId - Customer ID
 * @param {*} env - Worker environment
 * @returns {Promise<object>} Monthly usage
 */
async function getMonthlyUsage(customerId, env) {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];
    
    return getUsage(customerId, startDate, endDate, env);
}

/**
 * Check quota for customer
 * @param {string} customerId - Customer ID
 * @param {*} env - Worker environment
 * @returns {Promise<{allowed: boolean, reason?: string, quota?: object, usage?: object}>}
 */
async function checkQuota(customerId, env) {
    if (!customerId) {
        return { allowed: true }; // No quota check for non-authenticated (backward compat)
    }
    
    try {
        const customer = await getCustomer(customerId, env);
        if (!customer) {
            return { allowed: false, reason: 'customer_not_found' };
        }
        
        const planLimits = getPlanLimits(customer.plan);
        const customerLimits = customer.config?.rateLimits || {};
        
        // Use customer limits if set, otherwise plan limits
        const quota = {
            otpRequestsPerDay: customerLimits.otpRequestsPerDay ?? planLimits.otpRequestsPerDay,
            otpRequestsPerMonth: customerLimits.otpRequestsPerMonth ?? planLimits.otpRequestsPerMonth,
            maxUsers: customerLimits.maxUsers ?? planLimits.maxUsers
        };
        
        // Check daily quota
        const today = new Date().toISOString().split('T')[0];
        const todayUsage = await env.OTP_AUTH_KV.get(`usage_${customerId}_${today}`, { type: 'json' });
        const dailyRequests = todayUsage?.otpRequests || 0;
        
        if (dailyRequests >= quota.otpRequestsPerDay) {
            return {
                allowed: false,
                reason: 'daily_quota_exceeded',
                quota,
                usage: { daily: dailyRequests, monthly: null }
            };
        }
        
        // Check monthly quota
        const monthlyUsage = await getMonthlyUsage(customerId, env);
        if (monthlyUsage.otpRequests >= quota.otpRequestsPerMonth) {
            return {
                allowed: false,
                reason: 'monthly_quota_exceeded',
                quota,
                usage: { daily: dailyRequests, monthly: monthlyUsage.otpRequests }
            };
        }
        
        return {
            allowed: true,
            quota,
            usage: {
                daily: dailyRequests,
                monthly: monthlyUsage.otpRequests,
                remainingDaily: quota.otpRequestsPerDay - dailyRequests,
                remainingMonthly: quota.otpRequestsPerMonth - monthlyUsage.otpRequests
            }
        };
    } catch (error) {
        console.error('Quota check error:', error);
        // Fail open for availability
        return { allowed: true };
    }
}

/**
 * Get analytics
 * GET /admin/analytics
 */
async function handleGetAnalytics(request, env, customerId) {
    try {
        const url = new URL(request.url);
        const startDate = url.searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = url.searchParams.get('endDate') || new Date().toISOString().split('T')[0];
        const granularity = url.searchParams.get('granularity') || 'day';
        
        const usage = await getUsage(customerId, startDate, endDate, env);
        
        // Calculate metrics
        const metrics = {
            otpRequests: usage.otpRequests,
            otpVerifications: usage.otpVerifications,
            successRate: parseFloat(usage.successRate),
            emailsSent: usage.emailsSent,
            uniqueUsers: 0, // TODO: Track unique users
            newUsers: 0 // TODO: Track new users
        };
        
        // Format response based on granularity
        const response = {
            success: true,
            period: {
                start: startDate,
                end: endDate
            },
            metrics,
            dailyBreakdown: granularity === 'day' ? usage.dailyBreakdown : undefined
        };
        
        return new Response(JSON.stringify(response), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to get analytics',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Get real-time analytics
 * GET /admin/analytics/realtime
 */
async function handleGetRealtimeAnalytics(request, env, customerId) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        
        // Get today's usage
        const todayUsage = await env.OTP_AUTH_KV.get(`usage_${customerId}_${today}`, { type: 'json' }) || {};
        
        // Get last 24 hours (approximate - would need hourly tracking for exact)
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const yesterdayUsage = await env.OTP_AUTH_KV.get(`usage_${customerId}_${yesterdayStr}`, { type: 'json' }) || {};
        
        // Calculate last 24 hours (today + partial yesterday)
        const last24Hours = {
            otpRequests: (todayUsage.otpRequests || 0) + (yesterdayUsage.otpRequests || 0),
            otpVerifications: (todayUsage.otpVerifications || 0) + (yesterdayUsage.otpVerifications || 0)
        };
        
        // Get response time metrics for today
        const responseTimeMetrics = {};
        const endpoints = ['request-otp', 'verify-otp', 'me', 'logout', 'refresh'];
        for (const endpoint of endpoints) {
            const metricsKey = `metrics_${customerId}_${today}_${endpoint}`;
            const metrics = await env.OTP_AUTH_KV.get(metricsKey, { type: 'json' });
            if (metrics) {
                responseTimeMetrics[endpoint] = {
                    avg: metrics.avgResponseTime || 0,
                    p50: metrics.p50ResponseTime || 0,
                    p95: metrics.p95ResponseTime || 0,
                    p99: metrics.p99ResponseTime || 0
                };
            }
        }
        
        // Get error rate for today
        const errorKey = `errors_${customerId}_${today}`;
        const errorData = await env.OTP_AUTH_KV.get(errorKey, { type: 'json' }) || { total: 0 };
        const totalRequests = todayUsage.otpRequests || 0;
        const errorRate = totalRequests > 0 ? ((errorData.total / totalRequests) * 100).toFixed(2) : 0;
        
        return new Response(JSON.stringify({
            success: true,
            currentHour: {
                otpRequests: todayUsage.otpRequests || 0,
                otpVerifications: todayUsage.otpVerifications || 0,
                activeUsers: 0 // TODO: Track active users
            },
            last24Hours,
            responseTimeMetrics,
            errorRate: parseFloat(errorRate),
            lastUpdated: new Date().toISOString()
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to get real-time analytics',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Get error analytics
 * GET /admin/analytics/errors
 */
async function handleGetErrorAnalytics(request, env, customerId) {
    try {
        const url = new URL(request.url);
        const startDate = url.searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = url.searchParams.get('endDate') || new Date().toISOString().split('T')[0];
        const category = url.searchParams.get('category');
        
        const errors = [];
        const byCategory = {};
        const byEndpoint = {};
        let total = 0;
        
        // Iterate through date range
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const errorKey = `errors_${customerId}_${dateStr}`;
            const dayErrors = await env.OTP_AUTH_KV.get(errorKey, { type: 'json' });
            
            if (dayErrors) {
                // Filter by category if specified
                const filteredErrors = category 
                    ? dayErrors.errors.filter(e => e.category === category)
                    : dayErrors.errors;
                
                errors.push(...filteredErrors);
                
                // Aggregate by category
                for (const [cat, count] of Object.entries(dayErrors.byCategory || {})) {
                    if (!category || cat === category) {
                        byCategory[cat] = (byCategory[cat] || 0) + count;
                    }
                }
                
                // Aggregate by endpoint
                for (const [ep, count] of Object.entries(dayErrors.byEndpoint || {})) {
                    byEndpoint[ep] = (byEndpoint[ep] || 0) + count;
                }
                
                total += category ? filteredErrors.length : dayErrors.total;
            }
        }
        
        return new Response(JSON.stringify({
            success: true,
            period: { start: startDate, end: endDate },
            total,
            byCategory,
            byEndpoint,
            recentErrors: errors.slice(-100) // Last 100 errors
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to get error analytics',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Sign webhook payload
 * @param {object} payload - Webhook payload
 * @param {string} secret - Webhook secret
 * @returns {Promise<string>} HMAC-SHA256 signature
 */
async function signWebhook(payload, secret) {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));
    const keyData = encoder.encode(secret);
    
    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, data);
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Send webhook event
 * @param {string} customerId - Customer ID
 * @param {string} event - Event type
 * @param {object} data - Event data
 * @param {*} env - Worker environment
 * @returns {Promise<void>}
 */
async function sendWebhook(customerId, event, data, env) {
    try {
        const customer = await getCustomer(customerId, env);
        if (!customer || !customer.config || !customer.config.webhookConfig) {
            return; // No webhook configured
        }
        
        const webhookConfig = customer.config.webhookConfig;
        if (!webhookConfig.url) {
            return; // No webhook URL
        }
        
        // Check if event is subscribed
        if (webhookConfig.events && webhookConfig.events.length > 0) {
            if (!webhookConfig.events.includes(event) && !webhookConfig.events.includes('*')) {
                return; // Event not subscribed
            }
        }
        
        // Build payload
        const payload = {
            event,
            timestamp: new Date().toISOString(),
            customerId,
            data
        };
        
        // Sign payload
        const signature = webhookConfig.secret 
            ? await signWebhook(payload, webhookConfig.secret)
            : null;
        
        // Send webhook
        const response = await fetch(webhookConfig.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-OTP-Event': event,
                'X-OTP-Timestamp': payload.timestamp,
                ...(signature && { 'X-OTP-Signature': signature })
            },
            body: JSON.stringify(payload)
        });
        
        // Log result
        if (!response.ok) {
            console.error('Webhook delivery failed:', {
                customerId,
                event,
                url: webhookConfig.url,
                status: response.status,
                statusText: response.statusText
            });
            
            // Store failed webhook for retry (simplified - would use queue in production)
            const retryKey = `webhook_retry_${customerId}_${Date.now()}`;
            await env.OTP_AUTH_KV.put(retryKey, JSON.stringify({
                customerId,
                event,
                data,
                url: webhookConfig.url,
                attempts: 1,
                nextRetry: new Date(Date.now() + 60000).toISOString() // 1 minute
            }), { expirationTtl: 86400 }); // 24 hours
        } else {
            console.log('Webhook delivered successfully:', { customerId, event });
        }
    } catch (error) {
        console.error('Webhook error:', error);
        // Don't throw - webhooks shouldn't break the main flow
    }
}

/**
 * Rotate API key
 * POST /admin/customers/{customerId}/api-keys/{keyId}/rotate
 */
async function handleRotateApiKey(request, env, customerId, keyId) {
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
        
        // Create new API key
        const { apiKey: newApiKey, keyId: newKeyId } = await createApiKeyForCustomer(
            customerId, 
            `${customerKeys[keyIndex].name} (rotated)`, 
            env
        );
        
        // Mark old key as rotated (keep for 7 days grace period)
        customerKeys[keyIndex].status = 'rotated';
        customerKeys[keyIndex].rotatedAt = new Date().toISOString();
        customerKeys[keyIndex].replacedBy = newKeyId;
        await env.OTP_AUTH_KV.put(customerApiKeysKey, JSON.stringify(customerKeys));
        
        // Log rotation
        await logSecurityEvent(customerId, 'api_key_rotated', {
            oldKeyId: keyId,
            newKeyId: newKeyId
        }, env);
        
        return new Response(JSON.stringify({
            success: true,
            apiKey: newApiKey, // Only returned once!
            keyId: newKeyId,
            oldKeyId: keyId,
            message: 'API key rotated successfully. Old key will work for 7 days. Save your new API key - it will not be shown again.'
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to rotate API key',
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
                error: 'Quota exceeded',
                reason: quotaCheck.reason,
                quota: quotaCheck.quota,
                usage: quotaCheck.usage
            }), {
                status: 429,
                headers: { 
                    ...getCorsHeaders(env, request), 
                    'Content-Type': 'application/json',
                    'X-Quota-Limit': quotaCheck.quota?.otpRequestsPerDay?.toString() || '',
                    'X-Quota-Remaining': quotaCheck.usage?.remainingDaily?.toString() || '0'
                },
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
            
            // Track failed attempt
            if (customerId) {
                await trackUsage(customerId, 'failedAttempts', 1, env);
                
                // Send webhook for failed attempt
                await sendWebhook(customerId, 'otp.failed', {
                    email: emailLower,
                    remainingAttempts: 5 - otpData.attempts
                }, env);
            }
            
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
        
        // Track usage
        if (customerId) {
            await trackUsage(customerId, 'otpVerifications', 1, env);
            await trackUsage(customerId, 'successfulLogins', 1, env);
            
            // Send webhooks
            await sendWebhook(customerId, 'otp.verified', {
                userId,
                email: emailLower
            }, env);
            
            // Check if new user
            const wasNewUser = !user || !user.createdAt || 
                new Date(user.createdAt).toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
            
            if (wasNewUser) {
                await sendWebhook(customerId, 'user.created', {
                    userId,
                    email: emailLower
                }, env);
            }
            
            await sendWebhook(customerId, 'user.logged_in', {
                userId,
                email: emailLower
            }, env);
        }
        
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
 * Log security event
 * @param {string} customerId - Customer ID
 * @param {string} eventType - Event type
 * @param {object} details - Event details
 * @param {*} env - Worker environment
 * @returns {Promise<void>}
 */
async function logSecurityEvent(customerId, eventType, details, env) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const auditKey = `audit_${customerId}_${today}`;
        
        const existing = await env.OTP_AUTH_KV.get(auditKey, { type: 'json' }) || {
            customerId,
            date: today,
            events: []
        };
        
        existing.events.push({
            eventType,
            timestamp: new Date().toISOString(),
            ...details
        });
        
        // Keep only last 1000 events
        if (existing.events.length > 1000) {
            existing.events = existing.events.slice(-1000);
        }
        
        await env.OTP_AUTH_KV.put(auditKey, JSON.stringify(existing), { expirationTtl: 7776000 }); // 90 days
    } catch (error) {
        console.error('Security logging error:', error);
    }
}

/**
 * Main request handler
 */
export default {
    async fetch(request, env, ctx) {
        const startTime = performance.now();
        const url = new URL(request.url);
        const path = url.pathname;
        let customerId = null;
        let endpoint = path.split('/').pop() || 'unknown';
        
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: getCorsHeaders(env, request),
            });
        }
        
        try {
            // Public endpoints (no auth required)
            if (path === '/signup' && request.method === 'POST') {
                return handlePublicSignup(request, env);
            }
            
            if (path === '/signup/verify' && request.method === 'POST') {
                return handleVerifySignup(request, env);
            }
            
            if (path === '/admin/customers' && request.method === 'POST') {
                return handleRegisterCustomer(request, env);
            }
            
            if (path === '/health' && request.method === 'GET') {
                try {
                    await env.OTP_AUTH_KV.get('health_check', { type: 'text' });
                    return new Response(JSON.stringify({ 
                        status: 'healthy',
                        service: 'otp-auth-service',
                        version: '2.0.0',
                        timestamp: new Date().toISOString()
                    }), {
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                } catch (error) {
                    return new Response(JSON.stringify({ 
                        status: 'unhealthy',
                        service: 'otp-auth-service',
                        error: 'KV check failed'
                    }), {
                        status: 503,
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                }
            }
            
            if (path === '/health/ready' && request.method === 'GET') {
                try {
                    await env.OTP_AUTH_KV.get('health_check', { type: 'text' });
                    return new Response(JSON.stringify({ status: 'ready' }), {
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                } catch (error) {
                    return new Response(JSON.stringify({ status: 'not_ready' }), {
                        status: 503,
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                }
            }
            
            if (path === '/health/live' && request.method === 'GET') {
                return new Response(JSON.stringify({ status: 'alive' }), {
                    headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                });
            }
            
            // Customer admin endpoints (require API key auth)
            if (path === '/admin/customers/me' && request.method === 'GET') {
                const auth = await authenticateRequest(request, env);
                if (!auth) {
                    return new Response(JSON.stringify({ error: 'Authentication required' }), {
                        status: 401,
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                }
                return handleGetMe(request, env, auth.customerId);
            }
            
            if (path === '/admin/customers/me' && request.method === 'PUT') {
                const auth = await authenticateRequest(request, env);
                if (!auth) {
                    return new Response(JSON.stringify({ error: 'Authentication required' }), {
                        status: 401,
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                }
                return handleUpdateMe(request, env, auth.customerId);
            }
            
            // Domain verification endpoints (require API key auth)
            if (path === '/admin/domains/verify' && request.method === 'POST') {
                const auth = await authenticateRequest(request, env);
                if (!auth) {
                    return new Response(JSON.stringify({ error: 'Authentication required' }), {
                        status: 401,
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                }
                return handleRequestDomainVerification(request, env, auth.customerId);
            }
            
            const domainStatusMatch = path.match(/^\/admin\/domains\/([^\/]+)\/status$/);
            if (domainStatusMatch && request.method === 'GET') {
                const domain = domainStatusMatch[1];
                const auth = await authenticateRequest(request, env);
                if (!auth) {
                    return new Response(JSON.stringify({ error: 'Authentication required' }), {
                        status: 401,
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                }
                return handleGetDomainStatus(request, env, domain);
            }
            
            const domainVerifyMatch = path.match(/^\/admin\/domains\/([^\/]+)\/verify$/);
            if (domainVerifyMatch && request.method === 'POST') {
                const domain = domainVerifyMatch[1];
                const auth = await authenticateRequest(request, env);
                if (!auth) {
                    return new Response(JSON.stringify({ error: 'Authentication required' }), {
                        status: 401,
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                }
                return handleVerifyDomain(request, env, auth.customerId, domain);
            }
            
            // Analytics endpoints (require API key auth)
            if (path === '/admin/analytics' && request.method === 'GET') {
                const auth = await authenticateRequest(request, env);
                if (!auth) {
                    return new Response(JSON.stringify({ error: 'Authentication required' }), {
                        status: 401,
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                }
                return handleGetAnalytics(request, env, auth.customerId);
            }
            
            if (path === '/admin/analytics/realtime' && request.method === 'GET') {
                const auth = await authenticateRequest(request, env);
                if (!auth) {
                    return new Response(JSON.stringify({ error: 'Authentication required' }), {
                        status: 401,
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                }
                return handleGetRealtimeAnalytics(request, env, auth.customerId);
            }
            
            if (path === '/admin/analytics/errors' && request.method === 'GET') {
                const auth = await authenticateRequest(request, env);
                if (!auth) {
                    return new Response(JSON.stringify({ error: 'Authentication required' }), {
                        status: 401,
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                }
                return handleGetErrorAnalytics(request, env, auth.customerId);
            }
            
            // Configuration endpoints (require API key auth)
            if (path === '/admin/config' && request.method === 'GET') {
                const auth = await authenticateRequest(request, env);
                if (!auth) {
                    return new Response(JSON.stringify({ error: 'Authentication required' }), {
                        status: 401,
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                }
                return handleGetConfig(request, env, auth.customerId);
            }
            
            if (path === '/admin/config' && request.method === 'PUT') {
                const auth = await authenticateRequest(request, env);
                if (!auth) {
                    return new Response(JSON.stringify({ error: 'Authentication required' }), {
                        status: 401,
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                }
                return handleUpdateConfig(request, env, auth.customerId);
            }
            
            if (path === '/admin/config/email' && request.method === 'PUT') {
                const auth = await authenticateRequest(request, env);
                if (!auth) {
                    return new Response(JSON.stringify({ error: 'Authentication required' }), {
                        status: 401,
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                }
                return handleUpdateEmailConfig(request, env, auth.customerId);
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
            
            const rotateApiKeyMatch = path.match(/^\/admin\/customers\/([^\/]+)\/api-keys\/([^\/]+)\/rotate$/);
            if (rotateApiKeyMatch && request.method === 'POST') {
                const pathCustomerId = rotateApiKeyMatch[1];
                const keyId = rotateApiKeyMatch[2];
                const auth = await authenticateRequest(request, env);
                if (!auth) {
                    return new Response(JSON.stringify({ error: 'Authentication required' }), {
                        status: 401,
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                }
                if (auth.customerId !== pathCustomerId) {
                    return new Response(JSON.stringify({ error: 'Forbidden' }), {
                        status: 403,
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                }
                return handleRotateApiKey(request, env, auth.customerId, keyId);
            }
            
            // Customer status management endpoints (require API key auth)
            const suspendCustomerMatch = path.match(/^\/admin\/customers\/([^\/]+)\/suspend$/);
            if (suspendCustomerMatch && request.method === 'POST') {
                const pathCustomerId = suspendCustomerMatch[1];
                const auth = await authenticateRequest(request, env);
                if (!auth) {
                    return new Response(JSON.stringify({ error: 'Authentication required' }), {
                        status: 401,
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                }
                // Note: In production, only admins should be able to suspend customers
                // For now, allow customer to suspend themselves (for testing)
                return handleSuspendCustomer(request, env, pathCustomerId);
            }
            
            const activateCustomerMatch = path.match(/^\/admin\/customers\/([^\/]+)\/activate$/);
            if (activateCustomerMatch && request.method === 'POST') {
                const pathCustomerId = activateCustomerMatch[1];
                const auth = await authenticateRequest(request, env);
                if (!auth) {
                    return new Response(JSON.stringify({ error: 'Authentication required' }), {
                        status: 401,
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                }
                // Note: In production, only admins should be able to activate customers
                return handleActivateCustomer(request, env, pathCustomerId);
            }
            
            const updateStatusMatch = path.match(/^\/admin\/customers\/([^\/]+)\/status$/);
            if (updateStatusMatch && request.method === 'PUT') {
                const pathCustomerId = updateStatusMatch[1];
                const auth = await authenticateRequest(request, env);
                if (!auth) {
                    return new Response(JSON.stringify({ error: 'Authentication required' }), {
                        status: 401,
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                }
                const body = await request.json();
                const { status } = body;
                if (!status) {
                    return new Response(JSON.stringify({ error: 'Status required' }), {
                        status: 400,
                        headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
                    });
                }
                return handleUpdateCustomerStatus(request, env, pathCustomerId, status);
            }
            
            // Authentication endpoints (require API key for multi-tenant)
            // For backward compatibility, allow requests without API key (customerId will be null)
            let customer = null;
            const auth = await authenticateRequest(request, env);
            if (auth) {
                customerId = auth.customerId;
                customer = await getCustomer(customerId, env);
                
                // Log API key authentication
                await logSecurityEvent(customerId, 'api_key_auth', {
                    keyId: auth.keyId,
                    endpoint: path,
                    method: request.method,
                    ip: request.headers.get('CF-Connecting-IP') || 'unknown'
                }, env);
            } else if (path.startsWith('/auth/') || path.startsWith('/admin/')) {
                // Log failed authentication attempt
                await logSecurityEvent(null, 'auth_failed', {
                    endpoint: path,
                    method: request.method,
                    ip: request.headers.get('CF-Connecting-IP') || 'unknown'
                }, env);
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
            
            // Track error
            if (customerId) {
                await trackError(customerId, 'internal', error.message, endpoint, env);
            }
            
            const errorResponse = new Response(JSON.stringify({ 
                error: 'Internal server error',
                message: env.ENVIRONMENT === 'development' ? error.message : undefined
            }), {
                status: 500,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
            
            // Track response time even for errors
            const responseTime = performance.now() - startTime;
            if (customerId) {
                await trackResponseTime(customerId, endpoint, responseTime, env);
            }
            
            return errorResponse;
        } finally {
            // Track response time
            const responseTime = performance.now() - startTime;
            if (customerId && path.startsWith('/auth/')) {
                await trackResponseTime(customerId, endpoint, responseTime, env);
            }
        }
    }
};

