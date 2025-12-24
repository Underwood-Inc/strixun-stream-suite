/**
 * Analytics service
 * Usage tracking, metrics, and analytics endpoints
 */

import { getCustomer } from './customer.js';

/**
 * Track response time
 * @param {string} customerId - Customer ID
 * @param {string} endpoint - Endpoint name
 * @param {number} responseTime - Response time in ms
 * @param {*} env - Worker environment
 * @returns {Promise<void>}
 */
export async function trackResponseTime(customerId, endpoint, responseTime, env) {
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
export async function trackError(customerId, category, message, endpoint, env) {
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
export async function trackUsage(customerId, metric, increment = 1, env) {
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
export async function getUsage(customerId, startDate, endDate, env) {
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
export async function getMonthlyUsage(customerId, env) {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];
    
    return getUsage(customerId, startDate, endDate, env);
}

/**
 * Check quota for customer
 * @param {string} customerId - Customer ID
 * @param {Function} getCustomerCachedFn - Function to get cached customer
 * @param {Function} getPlanLimitsFn - Function to get plan limits
 * @param {*} env - Worker environment
 * @returns {Promise<{allowed: boolean, reason?: string, quota?: object, usage?: object}>}
 */
export async function checkQuota(customerId, getCustomerCachedFn, getPlanLimitsFn, env) {
    if (!customerId) {
        return { allowed: true }; // No quota check for non-authenticated (backward compat)
    }
    
    try {
        const customer = await getCustomerCachedFn(customerId);
        if (!customer) {
            return { allowed: false, reason: 'customer_not_found' };
        }
        
        const planLimits = getPlanLimitsFn(customer.plan);
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

