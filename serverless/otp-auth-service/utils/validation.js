/**
 * Validation utilities
 * Functions for validating secrets, templates, configs, etc.
 */

/**
 * Validate required secrets are configured
 * @param {*} env - Worker environment
 * @returns {object} Validation result with missing secrets
 */
export function validateSecrets(env) {
    const missing = [];
    const warnings = [];
    
    // Required secrets
    if (!env.JWT_SECRET) {
        missing.push('JWT_SECRET');
    }
    if (!env.RESEND_API_KEY) {
        missing.push('RESEND_API_KEY');
    }
    if (!env.RESEND_FROM_EMAIL) {
        missing.push('RESEND_FROM_EMAIL');
    }
    
    // Optional but recommended
    if (!env.ALLOWED_ORIGINS && env.ENVIRONMENT === 'production') {
        warnings.push('ALLOWED_ORIGINS (recommended for production)');
    }
    
    return {
        valid: missing.length === 0,
        missing,
        warnings
    };
}

/**
 * Generate verification token for signup
 * @returns {string} Verification token
 */
export function generateVerificationToken() {
    return crypto.randomUUID ? crypto.randomUUID() : 
        Array.from(crypto.getRandomValues(new Uint8Array(16)))
            .map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate email template structure
 * @param {string} template - Email template string
 * @returns {boolean} True if valid
 */
export function validateEmailTemplate(template) {
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
export async function validateCustomerConfig(config, customer) {
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
export function getPlanLimits(plan) {
    const limits = {
        free: {
            otpRequestsPerHour: 3,
            otpRequestsPerDay: 1000,      // Hard cap for free tier
            otpRequestsPerMonth: 10000,    // Hard cap for free tier
            ipRequestsPerHour: 10,
            ipRequestsPerDay: 50,
            maxUsers: 100
        },
        starter: {
            otpRequestsPerHour: 10,
            otpRequestsPerDay: 500,
            otpRequestsPerMonth: 5000,
            ipRequestsPerHour: 20,
            ipRequestsPerDay: 200,
            maxUsers: 1000
        },
        pro: {
            otpRequestsPerHour: 50,
            otpRequestsPerDay: 5000,
            otpRequestsPerMonth: 100000,
            ipRequestsPerHour: 200,
            ipRequestsPerDay: 2000,
            maxUsers: 10000
        },
        enterprise: {
            otpRequestsPerHour: 1000,
            otpRequestsPerDay: 100000,
            otpRequestsPerMonth: 1000000,
            ipRequestsPerHour: 5000,
            ipRequestsPerDay: 50000,
            maxUsers: 1000000
        }
    };
    
    return limits[plan] || limits.free;
}

