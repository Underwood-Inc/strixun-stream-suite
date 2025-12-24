/**
 * Rate limiting service
 * OTP request rate limiting with customer-specific configurations
 */

/**
 * Check rate limit for OTP requests
 * @param {string} emailHash - Hashed email
 * @param {string} customerId - Customer ID (for multi-tenant isolation)
 * @param {Function} getCustomerCachedFn - Function to get cached customer
 * @param {*} env - Worker environment
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: string}>}
 */
export async function checkOTPRateLimit(emailHash, customerId, getCustomerCachedFn, env) {
    try {
        // Get customer configuration for rate limits
        let rateLimitPerHour = 3; // Default
        if (customerId) {
            const customer = await getCustomerCachedFn(customerId);
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

