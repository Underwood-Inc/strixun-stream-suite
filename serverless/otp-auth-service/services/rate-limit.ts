/**
 * Rate limiting service
 * OTP request rate limiting with customer-specific configurations
 * Includes IP-based rate limiting, dynamic throttling, and free tier hard caps
 */

import type { CustomerData } from './customer.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    [key: string]: any;
}

interface PlanLimits {
    otpRequestsPerHour: number;
    otpRequestsPerDay: number;
    otpRequestsPerMonth: number;
    ipRequestsPerHour: number;
    ipRequestsPerDay: number;
    maxUsers: number;
}

interface EmailStats {
    totalRequests: number;
    requestsLast24h: number;
    failedAttempts: number;
    lastSuccessfulLogin: string | null;
    requestTimestamps: number[];
}

interface IPStats {
    requestsLast24h: number;
    failedAttempts: number;
    requestTimestamps: number[];
}

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: string;
    reason?: string;
    emailLimit?: {
        current: number;
        max: number;
        resetAt: string;
    };
    ipLimit?: {
        current: number;
        max: number;
        resetAt: string;
    };
    failedAttempts?: number;
}

type GetCustomerFn = (customerId: string) => Promise<CustomerData | null>;

/**
 * Get plan limits for customer
 * @param plan - Plan name ('free', 'pro', 'enterprise')
 * @returns Plan limits
 */
function getPlanLimits(plan: string = 'free'): PlanLimits {
    const plans: Record<string, PlanLimits> = {
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
 * @param emailStats - Email usage statistics
 * @param ipStats - IP usage statistics
 * @returns Adjustment factor (-2 to +2)
 */
function calculateDynamicAdjustment(emailStats: EmailStats, ipStats: IPStats): number {
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
 * @param emailHash - Hashed email
 * @param ipHash - Hashed IP address
 * @param customerId - Customer ID
 * @param env - Worker environment
 * @returns Usage statistics
 */
async function getUsageStats(emailHash: string, ipHash: string, customerId: string | null, env: Env): Promise<{emailStats: EmailStats, ipStats: IPStats}> {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    
    // Get email stats
    const emailStatsKey = customerId 
        ? `cust_${customerId}_stats_email_${emailHash}`
        : `stats_email_${emailHash}`;
    const emailStatsData = await env.OTP_AUTH_KV.get(emailStatsKey, { type: 'json' }) as EmailStats | null || {
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
    const ipStatsData = await env.OTP_AUTH_KV.get(ipStatsKey, { type: 'json' }) as IPStats | null || {
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
 * @param emailHash - Hashed email
 * @param ipHash - Hashed IP address
 * @param customerId - Customer ID
 * @param success - Whether request was successful
 * @param env - Worker environment
 */
async function updateUsageStats(emailHash: string, ipHash: string, customerId: string | null, success: boolean, env: Env): Promise<void> {
    const now = Date.now();
    
    // Update email stats
    const emailStatsKey = customerId 
        ? `cust_${customerId}_stats_email_${emailHash}`
        : `stats_email_${emailHash}`;
    const emailStats = await env.OTP_AUTH_KV.get(emailStatsKey, { type: 'json' }) as EmailStats | null || {
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
    const ipStats = await env.OTP_AUTH_KV.get(ipStatsKey, { type: 'json' }) as IPStats | null || {
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
 * @param ip - IP address
 * @returns Hashed IP
 */
export async function hashIP(ip: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(ip);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

/**
 * Check rate limit for OTP requests with IP-based and dynamic throttling
 * @param emailHash - Hashed email
 * @param customerId - Customer ID (for multi-tenant isolation)
 * @param ipAddress - Client IP address
 * @param getCustomerCachedFn - Function to get cached customer
 * @param env - Worker environment
 * @param email - Optional email address for super admin check
 * @returns Rate limit check result
 */
export async function checkOTPRateLimit(
    emailHash: string,
    customerId: string | null,
    ipAddress: string,
    getCustomerCachedFn: GetCustomerFn,
    env: Env,
    email?: string
): Promise<RateLimitResult> {
    try {
        // Super admins are ALWAYS exempt from rate limits
        if (email) {
            const { isSuperAdminEmail } = await import('../utils/super-admin.js');
            // DIAGNOSTIC: Log what we're checking
            const superAdminEmails = env.SUPER_ADMIN_EMAILS ? env.SUPER_ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase()) : [];
            console.log('[RATE_LIMIT_DEBUG] Checking super admin:', {
                email: email.trim().toLowerCase(),
                superAdminEmails: superAdminEmails,
                hasEnvVar: !!env.SUPER_ADMIN_EMAILS,
                envValue: env.SUPER_ADMIN_EMAILS
            });
            const isSuperAdmin = await isSuperAdminEmail(email, env);
            console.log('[RATE_LIMIT_DEBUG] Super admin check result:', isSuperAdmin);
            if (isSuperAdmin) {
                // Return unlimited access for super admins
                const now = Date.now();
                const oneHour = 60 * 60 * 1000;
                const resetAt = new Date(now + oneHour).toISOString();
                return {
                    allowed: true,
                    remaining: 999999, // Effectively unlimited
                    resetAt: resetAt
                };
            }
        }
        // Get customer configuration and plan
        let customer: CustomerData | null = null;
        let plan = 'free';
        let rateLimitPerHour = 3; // Default
        
        if (customerId) {
            customer = await getCustomerCachedFn(customerId);
            if (customer) {
                plan = customer.plan || 'free';
                if (customer.config && customer.config.rateLimits) {
                    rateLimitPerHour = (customer.config.rateLimits as { otpRequestsPerHour?: number }).otpRequestsPerHour || 3;
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
        let ipRateLimit: { requests: number; resetAt: string } | null = null;
        
        if (ipRateLimitData) {
            try {
                ipRateLimit = typeof ipRateLimitData === 'string' ? JSON.parse(ipRateLimitData) : ipRateLimitData as { requests: number; resetAt: string };
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
        let rateLimit: { otpRequests: number; failedAttempts?: number; resetAt: string } | null = null;
        
        if (rateLimitData) {
            try {
                rateLimit = typeof rateLimitData === 'string' ? JSON.parse(rateLimitData) : rateLimitData as { otpRequests: number; failedAttempts?: number; resetAt: string };
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
 * @param emailHash - Hashed email
 * @param ipAddress - Client IP address
 * @param customerId - Customer ID
 * @param env - Worker environment
 */
export async function recordOTPRequest(emailHash: string, ipAddress: string, customerId: string | null, env: Env): Promise<void> {
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
 * @param emailHash - Hashed email
 * @param ipAddress - Client IP address
 * @param customerId - Customer ID
 * @param env - Worker environment
 */
export async function recordOTPFailure(emailHash: string, ipAddress: string, customerId: string | null, env: Env): Promise<void> {
    try {
        const ipHash = await hashIP(ipAddress || 'unknown');
        await updateUsageStats(emailHash, ipHash, customerId, false, env);
    } catch (error) {
        console.error('Failed to record OTP failure:', error);
        // Don't throw - statistics shouldn't break the request
    }
}

/**
 * Record IP-only request for statistics (for endpoints without email)
 * Updates IP usage statistics for dynamic rate limiting
 * @param ipAddress - Client IP address
 * @param customerId - Customer ID
 * @param env - Worker environment
 * @param success - Whether request was successful
 */
export async function recordIPRequest(ipAddress: string, customerId: string | null, env: Env, success: boolean = true): Promise<void> {
    try {
        const ipHash = await hashIP(ipAddress || 'unknown');
        // Use empty email hash for IP-only endpoints
        const emptyEmailHash = '0000000000000000';
        await updateUsageStats(emptyEmailHash, ipHash, customerId, success, env);
    } catch (error) {
        console.error('Failed to record IP request:', error);
        // Don't throw - statistics shouldn't break the request
    }
}

/**
 * Generic IP-based rate limiting for any endpoint
 * Uses the FULL rate limiting logic from OTP requests including usage statistics and dynamic adjustment
 * 
 * @param ipAddress - Client IP address
 * @param customerId - Customer ID (for multi-tenant isolation)
 * @param getCustomerCachedFn - Function to get cached customer
 * @param env - Worker environment
 * @param endpointName - Name of endpoint for rate limit key (e.g., 'session-lookup')
 * @param requestsPerHour - Optional custom limit (defaults to plan's ipRequestsPerHour)
 * @param email - Optional email address for super admin check
 * @returns Rate limit check result
 */
export async function checkIPRateLimit(
    ipAddress: string,
    customerId: string | null,
    getCustomerCachedFn: GetCustomerFn,
    env: Env,
    endpointName: string = 'generic',
    requestsPerHour?: number,
    email?: string
): Promise<RateLimitResult> {
    try {
        // Super admins are ALWAYS exempt from rate limits
        if (email) {
            const { isSuperAdminEmail } = await import('../utils/super-admin.js');
            const isSuperAdmin = await isSuperAdminEmail(email, env);
            if (isSuperAdmin) {
                const now = Date.now();
                const oneHour = 60 * 60 * 1000;
                const resetAt = new Date(now + oneHour).toISOString();
                return {
                    allowed: true,
                    remaining: 999999, // Effectively unlimited
                    resetAt: resetAt
                };
            }
        }
        
        // Get customer configuration and plan
        let customer: CustomerData | null = null;
        let plan = 'free';
        
        if (customerId) {
            customer = await getCustomerCachedFn(customerId);
            if (customer) {
                plan = customer.plan || 'free';
            }
        }
        
        const planLimits = getPlanLimits(plan);
        const baseLimit = requestsPerHour || planLimits.ipRequestsPerHour;
        
        // Hash IP address
        const ipHash = await hashIP(ipAddress || 'unknown');
        
        // Get usage statistics for dynamic adjustment (FULL SERVICE - same as OTP rate limiting)
        // Use empty email hash since we're doing IP-only rate limiting
        const emptyEmailHash = '0000000000000000'; // Placeholder for IP-only endpoints
        const { emailStats, ipStats } = await getUsageStats(emptyEmailHash, ipHash, customerId, env);
        
        // Calculate dynamic adjustment based on IP usage patterns (FULL SERVICE)
        // For IP-only endpoints, we use IP stats for adjustment
        let adjustment = 0;
        
        // IP-based penalties (from calculateDynamicAdjustment logic)
        if (ipStats.requestsLast24h > 20) {
            adjustment -= 1;
        }
        
        if (ipStats.failedAttempts > 10) {
            adjustment -= 1;
        }
        
        // New IP bonus (< 3 requests in last 24h) - adapted from email logic
        if (ipStats.requestsLast24h < 3) {
            adjustment += 2;
        }
        
        // Frequent IP penalty (> 10 requests in last 24h) - adapted from email logic
        if (ipStats.requestsLast24h > 10) {
            adjustment -= 1;
        }
        
        // Clamp adjustment between -2 and +2 (same as OTP rate limiting)
        adjustment = Math.max(-2, Math.min(2, adjustment));
        const adjustedRateLimit = Math.max(1, baseLimit + adjustment);
        
        // Check IP-based rate limit (hard cap) - FULL SERVICE with endpoint-specific key
        const ipRateLimitKey = customerId 
            ? `cust_${customerId}_ratelimit_ip_${endpointName}_${ipHash}`
            : `ratelimit_ip_${endpointName}_${ipHash}`;
        
        const ipRateLimitData = await env.OTP_AUTH_KV.get(ipRateLimitKey);
        let ipRateLimit: { requests: number; resetAt: string } | null = null;
        
        if (ipRateLimitData) {
            try {
                ipRateLimit = typeof ipRateLimitData === 'string' ? JSON.parse(ipRateLimitData) : ipRateLimitData as { requests: number; resetAt: string };
            } catch (e) {
                ipRateLimit = null;
            }
        }
        
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        
        // Check IP rate limit
        const ipRequests = ipRateLimit ? (ipRateLimit.requests || 0) : 0;
        if (ipRateLimit && ipRateLimit.resetAt && now <= new Date(ipRateLimit.resetAt).getTime()) {
            if (ipRequests >= adjustedRateLimit) {
                return { 
                    allowed: false, 
                    remaining: 0, 
                    resetAt: ipRateLimit.resetAt,
                    reason: 'ip_rate_limit_exceeded',
                    ipLimit: {
                        current: ipRequests,
                        max: adjustedRateLimit,
                        resetAt: ipRateLimit.resetAt
                    },
                    failedAttempts: ipStats.failedAttempts || 0
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
        
        return { 
            allowed: true, 
            remaining: adjustedRateLimit - ipRateLimit.requests, 
            resetAt: ipRateLimit.resetAt 
        };
    } catch (error) {
        console.error('IP rate limit check error:', error);
        // Fail closed for security - deny request if rate limiting fails
        // This prevents bypassing rate limits if KV is down (same as OTP rate limiting)
        return { 
            allowed: false, 
            remaining: 0, 
            resetAt: new Date(Date.now() + 3600000).toISOString(),
            reason: 'rate_limit_error'
        };
    }
}

