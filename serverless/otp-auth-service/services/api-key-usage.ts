/**
 * API Key Usage Tracking Service
 *
 * Records per-API-key request counts in daily KV buckets and provides
 * aggregation helpers for the dashboard quota/usage display.
 *
 * KV pattern:  apikey_usage:{keyId}:{YYYY-MM-DD}
 * TTL:         90 days (automatic KV expiration)
 */

interface Env {
    OTP_AUTH_KV: KVNamespace;
    [key: string]: any;
}

export interface DailyKeyUsage {
    keyId: string;
    customerId: string;
    date: string;
    requests: number;
    otpRequests: number;
    otpVerifications: number;
    otpFailures: number;
    lastRequest: string;
}

export interface AggregatedKeyUsage {
    keyId: string;
    customerId: string;
    period: { start: string; end: string };
    totalRequests: number;
    totalOtpRequests: number;
    totalOtpVerifications: number;
    totalOtpFailures: number;
    dailyBreakdown: DailyKeyUsage[];
}

export interface PlanQuota {
    plan: string;
    dailyLimit: number;
    monthlyLimit: number;
}

const USAGE_TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

function usageKey(keyId: string, date: string): string {
    return `apikey_usage:${keyId}:${date}`;
}

function todayStr(): string {
    return new Date().toISOString().split('T')[0];
}

/**
 * Increment a usage metric for an API key.
 * Fire-and-forget safe -- errors are swallowed so request flow is never blocked.
 */
export async function trackApiKeyRequest(
    keyId: string,
    customerId: string,
    metric: 'requests' | 'otpRequests' | 'otpVerifications' | 'otpFailures',
    env: Env,
): Promise<void> {
    try {
        const date = todayStr();
        const key = usageKey(keyId, date);

        const existing = await env.OTP_AUTH_KV.get<DailyKeyUsage>(key, { type: 'json' });
        const record: DailyKeyUsage = existing ?? {
            keyId,
            customerId,
            date,
            requests: 0,
            otpRequests: 0,
            otpVerifications: 0,
            otpFailures: 0,
            lastRequest: new Date().toISOString(),
        };

        record[metric] += 1;
        record.lastRequest = new Date().toISOString();

        await env.OTP_AUTH_KV.put(key, JSON.stringify(record), { expirationTtl: USAGE_TTL_SECONDS });
    } catch (err) {
        console.error('[ApiKeyUsage] tracking failed (non-fatal):', err);
    }
}

/**
 * Read usage for a single key across a date range.
 */
export async function getKeyUsage(
    keyId: string,
    customerId: string,
    startDate: string,
    endDate: string,
    env: Env,
): Promise<AggregatedKeyUsage> {
    const agg: AggregatedKeyUsage = {
        keyId,
        customerId,
        period: { start: startDate, end: endDate },
        totalRequests: 0,
        totalOtpRequests: 0,
        totalOtpVerifications: 0,
        totalOtpFailures: 0,
        dailyBreakdown: [],
    };

    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const record = await env.OTP_AUTH_KV.get<DailyKeyUsage>(usageKey(keyId, dateStr), { type: 'json' });
        if (record) {
            agg.totalRequests += record.requests;
            agg.totalOtpRequests += record.otpRequests;
            agg.totalOtpVerifications += record.otpVerifications;
            agg.totalOtpFailures += record.otpFailures;
            agg.dailyBreakdown.push(record);
        }
    }

    return agg;
}

/**
 * Get today's usage for a single key (fast path for quota checks).
 */
export async function getKeyUsageToday(keyId: string, env: Env): Promise<DailyKeyUsage | null> {
    return env.OTP_AUTH_KV.get<DailyKeyUsage>(usageKey(keyId, todayStr()), { type: 'json' });
}

/**
 * Get current-month usage for a key.
 */
export async function getKeyUsageThisMonth(
    keyId: string,
    customerId: string,
    env: Env,
): Promise<AggregatedKeyUsage> {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];
    return getKeyUsage(keyId, customerId, startDate, endDate, env);
}

/**
 * Derive plan quota limits from the plan name.
 * Mirrors the limits in rate-limit.ts / validation.js.
 */
export function getPlanQuota(plan: string): PlanQuota {
    const quotas: Record<string, PlanQuota> = {
        free:       { plan: 'free',       dailyLimit: 1_000,    monthlyLimit: 10_000 },
        starter:    { plan: 'starter',    dailyLimit: 5_000,    monthlyLimit: 50_000 },
        pro:        { plan: 'pro',        dailyLimit: 10_000,   monthlyLimit: 100_000 },
        enterprise: { plan: 'enterprise', dailyLimit: 100_000,  monthlyLimit: 1_000_000 },
    };
    return quotas[plan] ?? quotas.free;
}
