/**
 * Analytics service
 * Usage tracking, metrics, and analytics endpoints
 */

import type { CustomerData } from './customer.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    [key: string]: any;
}

interface MetricsData {
    endpoint: string;
    date: string;
    responseTimes: number[];
    count: number;
    sum: number;
    avgResponseTime?: number;
    p50ResponseTime?: number;
    p95ResponseTime?: number;
    p99ResponseTime?: number;
}

interface ErrorData {
    customerId: string;
    date: string;
    errors: Array<{
        category: string;
        message: string;
        endpoint: string;
        timestamp: string;
    }>;
    byCategory: Record<string, number>;
    byEndpoint: Record<string, number>;
    total: number;
}

interface UsageData {
    customerId: string;
    date: string;
    otpRequests: number;
    otpVerifications: number;
    successfulLogins: number;
    failedAttempts: number;
    emailsSent: number;
    apiCalls: number;
    storageUsed: number;
    lastUpdated: string;
}

interface AggregatedUsage {
    customerId: string;
    period: { start: string; end: string };
    otpRequests: number;
    otpVerifications: number;
    successfulLogins: number;
    failedAttempts: number;
    emailsSent: number;
    apiCalls: number;
    storageUsed: number;
    dailyBreakdown: Array<{
        date: string;
        otpRequests: number;
        otpVerifications: number;
        successfulLogins: number;
        failedAttempts: number;
        emailsSent: number;
    }>;
    successRate?: string;
}

interface PlanLimits {
    otpRequestsPerDay: number;
    otpRequestsPerMonth: number;
    maxUsers: number;
}

interface QuotaResult {
    allowed: boolean;
    reason?: string;
    quota?: PlanLimits;
    usage?: {
        daily: number;
        monthly: number | null;
        remainingDaily?: number;
        remainingMonthly?: number;
    };
}

type GetCustomerFn = (customerId: string) => Promise<CustomerData | null>;
type GetPlanLimitsFn = (plan: string) => PlanLimits;

/**
 * Track response time
 * @param customerId - Customer ID
 * @param endpoint - Endpoint name
 * @param responseTime - Response time in ms
 * @param env - Worker environment
 */
export async function trackResponseTime(customerId: string | null, endpoint: string, responseTime: number, env: Env): Promise<void> {
    if (!customerId) return;
    
    try {
        const today = new Date().toISOString().split('T')[0];
        const metricsKey = `metrics_${customerId}_${today}_${endpoint}`;
        
        const existing = await env.OTP_AUTH_KV.get(metricsKey, { type: 'json' }) as MetricsData | null || {
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
 * @param customerId - Customer ID
 * @param category - Error category
 * @param message - Error message
 * @param endpoint - Endpoint where error occurred
 * @param env - Worker environment
 */
export async function trackError(customerId: string | null, category: string, message: string, endpoint: string, env: Env): Promise<void> {
    if (!customerId) return;
    
    try {
        const today = new Date().toISOString().split('T')[0];
        const errorKey = `errors_${customerId}_${today}`;
        
        const existing = await env.OTP_AUTH_KV.get(errorKey, { type: 'json' }) as ErrorData | null || {
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
 * @param customerId - Customer ID
 * @param metric - Metric name (otpRequests, otpVerifications, etc.)
 * @param increment - Amount to increment (default 1)
 * @param env - Worker environment
 */
export async function trackUsage(customerId: string | null, metric: string, increment: number = 1, env: Env): Promise<void> {
    if (!customerId) return; // Skip tracking for non-authenticated requests
    
    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const usageKey = `usage_${customerId}_${today}`;
        
        // Get existing usage
        const existingUsage = await env.OTP_AUTH_KV.get(usageKey, { type: 'json' }) as UsageData | null || {
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
        if ((existingUsage as any)[metric] !== undefined) {
            (existingUsage as any)[metric] = ((existingUsage as any)[metric] || 0) + increment;
        } else {
            (existingUsage as any)[metric] = increment;
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
 * @param customerId - Customer ID
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param env - Worker environment
 * @returns Aggregated usage data
 */
export async function getUsage(customerId: string, startDate: string, endDate: string, env: Env): Promise<AggregatedUsage> {
    const usage: AggregatedUsage = {
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
        const dayUsage = await env.OTP_AUTH_KV.get(usageKey, { type: 'json' }) as UsageData | null;
        
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
        : '0';
    
    return usage;
}

/**
 * Get current month usage
 * @param customerId - Customer ID
 * @param env - Worker environment
 * @returns Monthly usage
 */
export async function getMonthlyUsage(customerId: string, env: Env): Promise<AggregatedUsage> {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];
    
    return getUsage(customerId, startDate, endDate, env);
}

/**
 * Check quota for customer
 * @param customerId - Customer ID
 * @param getCustomerCachedFn - Function to get cached customer
 * @param getPlanLimitsFn - Function to get plan limits
 * @param env - Worker environment
 * @param email - Optional email address for super admin check
 * @returns Quota check result
 */
export async function checkQuota(
    customerId: string | null,
    getCustomerCachedFn: GetCustomerFn,
    getPlanLimitsFn: GetPlanLimitsFn,
    env: Env,
    email?: string
): Promise<QuotaResult> {
    // Super admins are ALWAYS exempt from quota limits
    if (email) {
        const { isSuperAdminEmail } = await import('../utils/super-admin.js');
        const isSuperAdmin = await isSuperAdminEmail(email, env);
        if (isSuperAdmin) {
            // Return unlimited quota for super admins
            return {
                allowed: true,
                quota: {
                    otpRequestsPerDay: 999999,
                    otpRequestsPerMonth: 999999,
                    maxUsers: 999999,
                    otpRequestsPerHour: 999999,
                    ipRequestsPerHour: 999999,
                    ipRequestsPerDay: 999999
                },
                usage: {
                    daily: 0,
                    monthly: 0,
                    remainingDaily: 999999,
                    remainingMonthly: 999999
                }
            };
        }
    }
    
    if (!customerId) {
        return { allowed: true }; // No quota check for non-authenticated (backward compat)
    }
    
    try {
        const customer = await getCustomerCachedFn(customerId);
        if (!customer) {
            return { allowed: false, reason: 'customer_not_found' };
        }
        
        const planLimits = getPlanLimitsFn(customer.plan || 'free');
        const customerLimits = (customer.config?.rateLimits as PlanLimits | undefined) || {};
        
        // Use customer limits if set, otherwise plan limits
        const quota: PlanLimits = {
            otpRequestsPerDay: customerLimits.otpRequestsPerDay ?? planLimits.otpRequestsPerDay,
            otpRequestsPerMonth: customerLimits.otpRequestsPerMonth ?? planLimits.otpRequestsPerMonth,
            maxUsers: customerLimits.maxUsers ?? planLimits.maxUsers
        };
        
        // Check daily quota
        const today = new Date().toISOString().split('T')[0];
        const todayUsage = await env.OTP_AUTH_KV.get(`usage_${customerId}_${today}`, { type: 'json' }) as UsageData | null;
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

