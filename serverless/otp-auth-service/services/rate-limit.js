/**
 * Rate limiting service
 * OTP request rate limiting with customer-specific configurations
 * Includes IP-based rate limiting, dynamic throttling, and free tier hard caps
 */

/**
 * Get plan limits for customer
 * @param {string} plan - Plan name ('free', 'pro', 'enterprise')
 * @returns {object} Plan limits
 */
function getPlanLimits(plan = 'free') {
    const plans = {
        free: {
            otpRequestsPerHour: 3,
            otpRequestsPerDay: 1000,      // Hard cap for free tier
            otpRequestsPerMonth: 10000,    // Hard cap for free tier
            ipRequestsPerHour: 10,
            ipRequestsPerDay: 50,
            maxUsers: 100
        },
        pro: {
            otpRequestsPerHour: 10,
            otpRequestsPerDay: 10000,
            otpRequestsPerMonth: 100000,
            ipRequestsPerHour: 50,
            ipRequestsPerDay: 500,
            maxUsers: 1000
        },
        enterprise: {
            otpRequestsPerHour: 100,
            otpRequestsPerDay: 100000,
            otpRequestsPerMonth: 1000000,
            ipRequestsPerHour: 500,
            ipRequestsPerDay: 5000,
            maxUsers: 10000
        }
    };
    return plans[plan] || plans.free;
}

/**
 * Calculate dynamic rate limit adjustment based on usage patterns
 * @param {object} emailStats - Email usage statistics
 * @param {object} ipStats - IP usage statistics
 * @returns {number} Adjustment factor (-2 to +2)
 */
function calculateDynamicAdjustment(emailStats, ipStats) {
    let adjustment = 0;
    
    // New email bonus (< 3 requests in last 24h)
    if (emailStats.requestsLast24h < 3) {
        adjustment += 2;
    }
    
    // Frequent email penalty (> 10 requests in last 24h)
    if (emailStats.requestsLast24h > 10) {
        adjustment -= 1;
    }
    
    // High failure rate penalty (> 50% failure rate)
    if (emailStats.totalRequests > 0 && (emailStats.failedAttempts / emailStats.totalRequests) > 0.5) {
        adjustment -= 2;
    }
    
    // Verified email bonus (successful login in last 7 days)
    if (emailStats.lastSuccessfulLogin && 
        (Date.now() - new Date(emailStats.lastSuccessfulLogin).getTime()) < 7 * 24 * 60 * 60 * 1000) {
        adjustment += 1;
    }
    
    // IP-based penalties
    if (ipStats.requestsLast24h > 20) {
        adjustment -= 1;
    }
    
    if (ipStats.failedAttempts > 10) {
        adjustment -= 1;
    }
    
    // Clamp adjustment between -2 and +2
    return Math.max(-2, Math.min(2, adjustment));
}

/**
 * Get usage statistics for email and IP
 * @param {string} emailHash - Hashed email
 * @param {string} ipHash - Hashed IP address
 * @param {string} customerId - Customer ID
 * @param {*} env - Worker environment
 * @returns {Promise<{emailStats: object, ipStats: object}>}
 */
async function getUsageStats(emailHash, ipHash, customerId, env) {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    
    // Get email stats
    const emailStatsKey = customerId 
        ? `cust_${customerId}_stats_email_${emailHash}`
        : `stats_email_${emailHash}`;
    const emailStatsData = await env.OTP_AUTH_KV.get(emailStatsKey, { type: 'json' }) || {
        totalRequests: 0,
        requestsLast24h: 0,
        failedAttempts: 0,
        lastSuccessfulLogin: null,
        requestTimestamps: []
    };
    
    // Filter timestamps to last 24 hours
    emailStatsData.requestTimestamps = (emailStatsData.requestTimestamps || []).filter(ts => ts > oneDayAgo);
    emailStatsData.requestsLast24h = emailStatsData.requestTimestamps.length;
    
    // Get IP stats
    const ipStatsKey = customerId 
        ? `cust_${customerId}_stats_ip_${ipHash}`
        : `stats_ip_${ipHash}`;
    const ipStatsData = await env.OTP_AUTH_KV.get(ipStatsKey, { type: 'json' }) || {
        requestsLast24h: 0,
        failedAttempts: 0,
        requestTimestamps: []
    };
    
    // Filter timestamps to last 24 hours
    ipStatsData.requestTimestamps = (ipStatsData.requestTimestamps || []).filter(ts => ts > oneDayAgo);
    ipStatsData.requestsLast24h = ipStatsData.requestTimestamps.length;
    
    return {
        emailStats: emailStatsData,
        ipStats: ipStatsData
    };
}

/**
 * Update usage statistics
 * @param {string} emailHash - Hashed email
 * @param {string} ipHash - Hashed IP address
 * @param {string} customerId - Customer ID
 * @param {boolean} success - Whether request was successful
 * @param {*} env - Worker environment
 * @returns {Promise<void>}
 */
async function updateUsageStats(emailHash, ipHash, customerId, success, env) {
    const now = Date.now();
    
    // Update email stats
    const emailStatsKey = customerId 
        ? `cust_${customerId}_stats_email_${emailHash}`
        : `stats_email_${emailHash}`;
    const emailStats = await env.OTP_AUTH_KV.get(emailStatsKey, { type: 'json' }) || {
        totalRequests: 0,
        requestsLast24h: 0,
        failedAttempts: 0,
        lastSuccessfulLogin: null,
        requestTimestamps: []
    };
    
    emailStats.totalRequests = (emailStats.totalRequests || 0) + 1;
    emailStats.requestTimestamps = emailStats.requestTimestamps || [];
    emailStats.requestTimestamps.push(now);
    
    if (!success) {
        emailStats.failedAttempts = (emailStats.failedAttempts || 0) + 1;
    } else {
        emailStats.lastSuccessfulLogin = new Date().toISOString();
    }
    
    // Keep only last 1000 timestamps
    if (emailStats.requestTimestamps.length > 1000) {
        emailStats.requestTimestamps = emailStats.requestTimestamps.slice(-1000);
    }
    
    await env.OTP_AUTH_KV.put(emailStatsKey, JSON.stringify(emailStats), { expirationTtl: 2592000 }); // 30 days
    
    // Update IP stats
    const ipStatsKey = customerId 
        ? `cust_${customerId}_stats_ip_${ipHash}`
        : `stats_ip_${ipHash}`;
    const ipStats = await env.OTP_AUTH_KV.get(ipStatsKey, { type: 'json' }) || {
        requestsLast24h: 0,
        failedAttempts: 0,
        requestTimestamps: []
    };
    
    ipStats.requestTimestamps = ipStats.requestTimestamps || [];
    ipStats.requestTimestamps.push(now);
    
    if (!success) {
        ipStats.failedAttempts = (ipStats.failedAttempts || 0) + 1;
    }
    
    // Keep only last 1000 timestamps
    if (ipStats.requestTimestamps.length > 1000) {
        ipStats.requestTimestamps = ipStats.requestTimestamps.slice(-1000);
    }
    
    await env.OTP_AUTH_KV.put(ipStatsKey, JSON.stringify(ipStats), { expirationTtl: 2592000 }); // 30 days
}

/**
 * Hash IP address for storage
 * @param {string} ip - IP address
 * @returns {Promise<string>} Hashed IP
 */
export async function hashIP(ip) {
    const encoder = new TextEncoder();
    const data = encoder.encode(ip);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

/**
 * Check rate limit for OTP requests with IP-based and dynamic throttling
 * @param {string} emailHash - Hashed email
 * @param {string} customerId - Customer ID (for multi-tenant isolation)
 * @param {string} ipAddress - Client IP address
 * @param {Function} getCustomerCachedFn - Function to get cached customer
 * @param {*} env - Worker environment
 * @returns {Promise<{allowed: boolean, remaining: number, resetAt: string, reason?: string}>}
 */
export async function checkOTPRateLimit(emailHash, customerId, ipAddress, getCustomerCachedFn, env) {
    try {
        // Get customer configuration and plan
        let customer = null;
        let plan = 'free';
        let rateLimitPerHour = 3; // Default
        
        if (customerId) {
            customer = await getCustomerCachedFn(customerId);
            if (customer) {
                plan = customer.plan || 'free';
                if (customer.config && customer.config.rateLimits) {
                    rateLimitPerHour = customer.config.rateLimits.otpRequestsPerHour || 3;
                }
            }
        }
        
        const planLimits = getPlanLimits(plan);
        
        // Hash IP address
        const ipHash = await hashIP(ipAddress || 'unknown');
        
        // Get usage statistics for dynamic adjustment
        const { emailStats, ipStats } = await getUsageStats(emailHash, ipHash, customerId, env);
        
        // Calculate dynamic adjustment
        const adjustment = calculateDynamicAdjustment(emailStats, ipStats);
        const adjustedRateLimit = Math.max(1, rateLimitPerHour + adjustment);
        
        // Check IP-based rate limit (hard cap)
        const ipRateLimitKey = customerId 
            ? `cust_${customerId}_ratelimit_ip_${ipHash}`
            : `ratelimit_ip_${ipHash}`;
        
        const ipRateLimitData = await env.OTP_AUTH_KV.get(ipRateLimitKey);
        let ipRateLimit = null;
        
        if (ipRateLimitData) {
            try {
                ipRateLimit = typeof ipRateLimitData === 'string' ? JSON.parse(ipRateLimitData) : ipRateLimitData;
            } catch (e) {
                ipRateLimit = null;
            }
        }
        
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        
        // Check IP rate limit
        const ipRequests = ipRateLimit ? (ipRateLimit.requests || 0) : 0;
        if (ipRateLimit && ipRateLimit.resetAt && now <= new Date(ipRateLimit.resetAt).getTime()) {
            if (ipRequests >= planLimits.ipRequestsPerHour) {
                return { 
                    allowed: false, 
                    remaining: 0, 
                    resetAt: ipRateLimit.resetAt,
                    reason: 'ip_rate_limit_exceeded',
                    ipLimit: {
                        current: ipRequests,
                        max: planLimits.ipRequestsPerHour,
                        resetAt: ipRateLimit.resetAt
                    }
                };
            }
            ipRateLimit.requests = ipRequests + 1;
        } else {
            const resetAt = new Date(now + oneHour).toISOString();
            ipRateLimit = {
                requests: 1,
                resetAt: resetAt
            };
        }
        await env.OTP_AUTH_KV.put(ipRateLimitKey, JSON.stringify(ipRateLimit), { expirationTtl: 3600 });
        
        // Check email-based rate limit (with dynamic adjustment)
        const rateLimitKey = customerId 
            ? `cust_${customerId}_ratelimit_otp_${emailHash}`
            : `ratelimit_otp_${emailHash}`;
        
        const rateLimitData = await env.OTP_AUTH_KV.get(rateLimitKey);
        let rateLimit = null;
        
        if (rateLimitData) {
            try {
                rateLimit = typeof rateLimitData === 'string' ? JSON.parse(rateLimitData) : rateLimitData;
            } catch (e) {
                rateLimit = null;
            }
        }
        
        // Check if rate limit exists and is still valid
        const emailRequests = rateLimit ? (rateLimit.otpRequests || 0) : 0;
        if (rateLimit && rateLimit.resetAt && now <= new Date(rateLimit.resetAt).getTime()) {
            // Rate limit exists and is valid
            if (emailRequests >= adjustedRateLimit) {
                return { 
                    allowed: false, 
                    remaining: 0, 
                    resetAt: rateLimit.resetAt,
                    reason: 'email_rate_limit_exceeded',
                    emailLimit: {
                        current: emailRequests,
                        max: adjustedRateLimit,
                        resetAt: rateLimit.resetAt
                    },
                    ipLimit: {
                        current: ipRateLimit ? (ipRateLimit.requests || 0) : 0,
                        max: planLimits.ipRequestsPerHour,
                        resetAt: ipRateLimit?.resetAt || new Date(now + oneHour).toISOString()
                    },
                    failedAttempts: rateLimit.failedAttempts || 0
                };
            }
            
            // Increment counter (this request counts)
            rateLimit.otpRequests = emailRequests + 1;
            await env.OTP_AUTH_KV.put(rateLimitKey, JSON.stringify(rateLimit), { expirationTtl: 3600 });
            
            return { 
                allowed: true, 
                remaining: adjustedRateLimit - rateLimit.otpRequests, 
                resetAt: rateLimit.resetAt 
            };
        }
        
        // No rate limit or expired - create new one (this request counts as 1)
        const resetAt = new Date(now + oneHour).toISOString();
        const newRateLimit = {
            otpRequests: 1,
            failedAttempts: 0,
            resetAt: resetAt
        };
        await env.OTP_AUTH_KV.put(rateLimitKey, JSON.stringify(newRateLimit), { expirationTtl: 3600 });
        
        return { 
            allowed: true, 
            remaining: adjustedRateLimit - 1, 
            resetAt: resetAt 
        };
    } catch (error) {
        console.error('Rate limit check error:', error);
        // Fail closed for security - deny request if rate limiting fails
        // This prevents bypassing rate limits if KV is down
        return { 
            allowed: false, 
            remaining: 0, 
            resetAt: new Date(Date.now() + 3600000).toISOString(),
            reason: 'rate_limit_error'
        };
    }
}

/**
 * Record successful OTP request for statistics
 * @param {string} emailHash - Hashed email
 * @param {string} ipAddress - Client IP address
 * @param {string} customerId - Customer ID
 * @param {*} env - Worker environment
 * @returns {Promise<void>}
 */
export async function recordOTPRequest(emailHash, ipAddress, customerId, env) {
    try {
        const ipHash = await hashIP(ipAddress || 'unknown');
        await updateUsageStats(emailHash, ipHash, customerId, true, env);
    } catch (error) {
        console.error('Failed to record OTP request:', error);
        // Don't throw - statistics shouldn't break the request
    }
}

/**
 * Record failed OTP attempt for statistics
 * @param {string} emailHash - Hashed email
 * @param {string} ipAddress - Client IP address
 * @param {string} customerId - Customer ID
 * @param {*} env - Worker environment
 * @returns {Promise<void>}
 */
export async function recordOTPFailure(emailHash, ipAddress, customerId, env) {
    try {
        const ipHash = await hashIP(ipAddress || 'unknown');
        await updateUsageStats(emailHash, ipHash, customerId, false, env);
    } catch (error) {
        console.error('Failed to record OTP failure:', error);
        // Don't throw - statistics shouldn't break the request
    }
}

