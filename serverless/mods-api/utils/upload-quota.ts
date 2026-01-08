/**
 * Upload quota tracking and enforcement
 * Prevents abuse by limiting uploads per customer per day
 */

interface UploadQuotaConfig {
    /** Maximum uploads per day per customer (default: 10) */
    maxUploadsPerDay: number;
    /** Maximum uploads per month per customer (default: 100) */
    maxUploadsPerMonth: number;
}

interface UploadUsage {
    customerId: string;
    date: string; // YYYY-MM-DD
    uploadCount: number;
    lastUpdated: string;
}

interface QuotaCheckResult {
    allowed: boolean;
    reason?: string;
    quota: UploadQuotaConfig;
    usage: {
        daily: number;
        monthly: number;
    };
}

/**
 * Get upload quota configuration from environment or defaults
 */
function getUploadQuotaConfig(env: Env): UploadQuotaConfig {
    const maxPerDay = env.MAX_UPLOADS_PER_DAY 
        ? parseInt(env.MAX_UPLOADS_PER_DAY, 10) 
        : 10; // Default: 10 uploads per day
    
    const maxPerMonth = env.MAX_UPLOADS_PER_MONTH 
        ? parseInt(env.MAX_UPLOADS_PER_MONTH, 10) 
        : 100; // Default: 100 uploads per month
    
    return {
        maxUploadsPerDay: maxPerDay,
        maxUploadsPerMonth: maxPerMonth,
    };
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
}

/**
 * Get current month in YYYY-MM format
 */
function getCurrentMonth(): string {
    return new Date().toISOString().substring(0, 7);
}

/**
 * Get daily upload usage for a customer
 */
async function getDailyUploadUsage(customerId: string, env: Env): Promise<UploadUsage> {
    const today = getTodayDate();
    const usageKey = `upload_usage_${customerId}_${today}`;
    
    const existing = await env.MODS_KV.get(usageKey, { type: 'json' }) as UploadUsage | null;
    
    if (existing) {
        return existing;
    }
    
    return {
        customerId,
        date: today,
        uploadCount: 0,
        lastUpdated: new Date().toISOString(),
    };
}

/**
 * Get monthly upload usage for a customer
 */
async function getMonthlyUploadUsage(customerId: string, env: Env): Promise<number> {
    const month = getCurrentMonth();
    const monthKey = `upload_usage_${customerId}_month_${month}`;
    
    const existing = await env.MODS_KV.get(monthKey, { type: 'json' }) as { count: number } | null;
    
    return existing?.count || 0;
}

/**
 * Increment upload count for a customer
 */
async function incrementUploadCount(customerId: string, env: Env): Promise<void> {
    const today = getTodayDate();
    const month = getCurrentMonth();
    
    // Increment daily count
    const dailyUsage = await getDailyUploadUsage(customerId, env);
    dailyUsage.uploadCount += 1;
    dailyUsage.lastUpdated = new Date().toISOString();
    
    const dailyKey = `upload_usage_${customerId}_${today}`;
    // Store with 2-day TTL (to handle timezone edge cases)
    await env.MODS_KV.put(dailyKey, JSON.stringify(dailyUsage), { expirationTtl: 172800 });
    
    // Increment monthly count
    const monthKey = `upload_usage_${customerId}_month_${month}`;
    const monthlyData = await env.MODS_KV.get(monthKey, { type: 'json' }) as { count: number } | null;
    const newMonthlyCount = (monthlyData?.count || 0) + 1;
    
    // Store with 32-day TTL (to handle month-end edge cases)
    await env.MODS_KV.put(monthKey, JSON.stringify({ count: newMonthlyCount }), { expirationTtl: 2764800 });
}

/**
 * Check if customer has exceeded upload quota
 * Returns result with quota information
 */
export async function checkUploadQuota(
    customerId: string,
    env: Env
): Promise<QuotaCheckResult> {
    const quota = getUploadQuotaConfig(env);
    
    // Get current usage
    const dailyUsage = await getDailyUploadUsage(customerId, env);
    const monthlyUsage = await getMonthlyUploadUsage(customerId, env);
    
    // Check daily quota
    if (dailyUsage.uploadCount >= quota.maxUploadsPerDay) {
        return {
            allowed: false,
            reason: 'daily_quota_exceeded',
            quota,
            usage: {
                daily: dailyUsage.uploadCount,
                monthly: monthlyUsage,
            },
        };
    }
    
    // Check monthly quota
    if (monthlyUsage >= quota.maxUploadsPerMonth) {
        return {
            allowed: false,
            reason: 'monthly_quota_exceeded',
            quota,
            usage: {
                daily: dailyUsage.uploadCount,
                monthly: monthlyUsage,
            },
        };
    }
    
    return {
        allowed: true,
        quota,
        usage: {
            daily: dailyUsage.uploadCount,
            monthly: monthlyUsage,
        },
    };
}

/**
 * Track an upload (increment counters)
 * Should be called after a successful upload
 */
export async function trackUpload(customerId: string, env: Env): Promise<void> {
    try {
        await incrementUploadCount(customerId, env);
    } catch (error) {
        console.error('Error tracking upload:', error);
        // Don't throw - tracking shouldn't break the upload
    }
}

interface Env {
    MODS_KV: KVNamespace;
    MAX_UPLOADS_PER_DAY?: string;
    MAX_UPLOADS_PER_MONTH?: string;
    [key: string]: any;
}

