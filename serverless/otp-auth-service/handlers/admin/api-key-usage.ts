/**
 * API Key Usage Handler
 *
 * GET /admin/customers/{customerId}/api-keys/{keyId}/usage
 *   → per-key usage for a date range (defaults to current month)
 *
 * GET /admin/api-keys/usage-summary
 *   → today + this-month usage for ALL of the authenticated customer's keys
 */

import { getCorsHeadersRecord } from '../../utils/cors.js';
import { getKeyUsage, getKeyUsageToday, getKeyUsageThisMonth, getPlanQuota } from '../../services/api-key-usage.js';
import { getApiKeysForCustomer } from '../../services/api-key.js';
import { fetchCustomerByCustomerId } from '@strixun/api-framework';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    [key: string]: any;
}

/**
 * GET /admin/customers/{customerId}/api-keys/{keyId}/usage?startDate=...&endDate=...
 */
export async function handleGetKeyUsage(
    request: Request,
    env: Env,
    customerId: string,
    keyId: string,
): Promise<Response> {
    try {
        const url = new URL(request.url);
        const now = new Date();
        const startDate = url.searchParams.get('startDate')
            ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const endDate = url.searchParams.get('endDate')
            ?? now.toISOString().split('T')[0];

        const usage = await getKeyUsage(keyId, customerId, startDate, endDate, env);

        return new Response(JSON.stringify({ success: true, ...usage }), {
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const err = error as Error;
        return new Response(JSON.stringify({ error: 'Failed to get key usage', message: err.message }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * GET /admin/api-keys/usage-summary
 *
 * Returns today + month usage for every active key the customer owns,
 * plus plan quota info so the dashboard can render usage bars.
 */
export async function handleGetUsageSummary(
    request: Request,
    env: Env,
    customerId: string,
): Promise<Response> {
    try {
        const keys = await getApiKeysForCustomer(customerId, env);
        const activeKeys = keys.filter(k => k.status === 'active');

        const customer = await fetchCustomerByCustomerId(customerId, env);
        const plan = customer?.plan ?? 'free';
        const quota = getPlanQuota(plan);

        const keySummaries = await Promise.all(activeKeys.map(async (key) => {
            const today = await getKeyUsageToday(key.keyId, env);
            const month = await getKeyUsageThisMonth(key.keyId, customerId, env);

            return {
                keyId: key.keyId,
                name: key.name,
                today: {
                    requests: today?.requests ?? 0,
                    otpRequests: today?.otpRequests ?? 0,
                    otpVerifications: today?.otpVerifications ?? 0,
                    otpFailures: today?.otpFailures ?? 0,
                    lastRequest: today?.lastRequest ?? null,
                },
                month: {
                    requests: month.totalRequests,
                    otpRequests: month.totalOtpRequests,
                    otpVerifications: month.totalOtpVerifications,
                    otpFailures: month.totalOtpFailures,
                },
            };
        }));

        // Aggregate across all keys for total customer usage
        const customerTotal = {
            todayRequests: keySummaries.reduce((s, k) => s + k.today.requests, 0),
            monthRequests: keySummaries.reduce((s, k) => s + k.month.requests, 0),
        };

        const dailyPct = quota.dailyLimit > 0
            ? Math.round((customerTotal.todayRequests / quota.dailyLimit) * 100)
            : 0;
        const monthlyPct = quota.monthlyLimit > 0
            ? Math.round((customerTotal.monthRequests / quota.monthlyLimit) * 100)
            : 0;

        return new Response(JSON.stringify({
            success: true,
            plan,
            quota,
            customerTotal,
            dailyUsagePercent: dailyPct,
            monthlyUsagePercent: monthlyPct,
            suggestUpgrade: monthlyPct >= 80 || dailyPct >= 80,
            keys: keySummaries,
        }), {
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const err = error as Error;
        return new Response(JSON.stringify({ error: 'Failed to get usage summary', message: err.message }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}
