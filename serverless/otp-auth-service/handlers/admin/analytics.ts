/**
 * Analytics Handlers
 * Handles analytics and metrics endpoints
 */

import { getCorsHeaders, getCorsHeadersRecord } from '../../utils/cors.js';
import { getUsage } from '../../services/analytics.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    [key: string]: any;
}

interface AnalyticsResponse {
    success: boolean;
    period: {
        start: string;
        end: string;
    };
    metrics: {
        otpRequests: number;
        otpVerifications: number;
        successRate: number;
        emailsSent: number;
        uniqueUsers: number;
        newUsers: number;
    };
    dailyBreakdown?: any;
}

interface RealtimeAnalyticsResponse {
    success: boolean;
    currentHour: {
        otpRequests: number;
        otpVerifications: number;
        activeUsers: number;
    };
    last24Hours: {
        otpRequests: number;
        otpVerifications: number;
    };
    responseTimeMetrics: Record<string, {
        avg: number;
        p50: number;
        p95: number;
        p99: number;
    }>;
    errorRate: number;
    lastUpdated: string;
}

interface ErrorAnalyticsResponse {
    success: boolean;
    period: {
        start: string;
        end: string;
    };
    total: number;
    byCategory: Record<string, number>;
    byEndpoint: Record<string, number>;
    recentErrors: Array<{
        category: string;
        message: string;
        endpoint: string;
        timestamp: string;
    }>;
}

interface EmailAnalyticsResponse {
    success: boolean;
    period: {
        start: string;
        end: string;
    };
    summary: {
        totalOpens: number;
        uniqueCountries: number;
        averageOpensPerDay: string;
    };
    countryStats: Record<string, number>;
    dailyBreakdown: Array<{
        date: string;
        opens: number;
        countries: Record<string, number>;
    }>;
    recentOpens: Array<{
        openedAt: number;
        country: string | null;
        city: string | null;
        timezone: string | null;
        userAgent: string | null;
    }>;
}

/**
 * Get analytics
 * GET /admin/analytics
 */
export async function handleGetAnalytics(request: Request, env: Env, customerId: string | null): Promise<Response> {
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
        const response: AnalyticsResponse = {
            success: true,
            period: {
                start: startDate,
                end: endDate
            },
            metrics,
            dailyBreakdown: granularity === 'day' ? usage.dailyBreakdown : undefined
        };
        
        return new Response(JSON.stringify(response), {
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({
            error: 'Failed to get analytics',
            message: error?.message || 'Unknown error'
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Get real-time analytics
 * GET /admin/analytics/realtime
 */
export async function handleGetRealtimeAnalytics(request: Request, env: Env, customerId: string | null): Promise<Response> {
    try {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        
        // Get today's usage
        const todayUsage = (await env.OTP_AUTH_KV.get(`usage_${customerId}_${today}`, { type: 'json' })) as any || {};
        
        // Get last 24 hours (approximate - would need hourly tracking for exact)
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const yesterdayUsage = (await env.OTP_AUTH_KV.get(`usage_${customerId}_${yesterdayStr}`, { type: 'json' })) as any || {};
        
        // Calculate last 24 hours (today + partial yesterday)
        const last24Hours = {
            otpRequests: (todayUsage.otpRequests || 0) + (yesterdayUsage.otpRequests || 0),
            otpVerifications: (todayUsage.otpVerifications || 0) + (yesterdayUsage.otpVerifications || 0)
        };
        
        // Get response time metrics for today
        const responseTimeMetrics: Record<string, { avg: number; p50: number; p95: number; p99: number }> = {};
        const endpoints = ['request-otp', 'verify-otp', 'me', 'logout', 'refresh'];
        for (const endpoint of endpoints) {
            const metricsKey = `metrics_${customerId}_${today}_${endpoint}`;
            const metrics = (await env.OTP_AUTH_KV.get(metricsKey, { type: 'json' })) as any;
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
        const errorData = (await env.OTP_AUTH_KV.get(errorKey, { type: 'json' })) as any || { total: 0 };
        const totalRequests = todayUsage.otpRequests || 0;
        const errorRate = totalRequests > 0 ? ((errorData.total / totalRequests) * 100).toFixed(2) : 0;
        
        const response: RealtimeAnalyticsResponse = {
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
        };
        
        return new Response(JSON.stringify(response), {
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({
            error: 'Failed to get real-time analytics',
            message: error?.message || 'Unknown error'
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Get error analytics
 * GET /admin/analytics/errors
 */
export async function handleGetErrorAnalytics(request: Request, env: Env, customerId: string | null): Promise<Response> {
    try {
        const url = new URL(request.url);
        const startDate = url.searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = url.searchParams.get('endDate') || new Date().toISOString().split('T')[0];
        const category = url.searchParams.get('category');
        
        const errors: Array<{ category: string; message: string; endpoint: string; timestamp: string }> = [];
        const byCategory: Record<string, number> = {};
        const byEndpoint: Record<string, number> = {};
        let total = 0;
        
        // Iterate through date range
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const errorKey = `errors_${customerId}_${dateStr}`;
            const dayErrors = (await env.OTP_AUTH_KV.get(errorKey, { type: 'json' })) as any;
            
            if (dayErrors) {
                // Filter by category if specified
                const filteredErrors = category 
                    ? dayErrors.errors.filter((e: any) => e.category === category)
                    : dayErrors.errors;
                
                errors.push(...filteredErrors);
                
                // Aggregate by category
                for (const [cat, count] of Object.entries(dayErrors.byCategory || {})) {
                    if (!category || cat === category) {
                        byCategory[cat] = (byCategory[cat] || 0) + (count as number);
                    }
                }
                
                // Aggregate by endpoint
                for (const [ep, count] of Object.entries(dayErrors.byEndpoint || {})) {
                    byEndpoint[ep] = (byEndpoint[ep] || 0) + (count as number);
                }
                
                total += category ? filteredErrors.length : dayErrors.total;
            }
        }
        
        const response: ErrorAnalyticsResponse = {
            success: true,
            period: { start: startDate, end: endDate },
            total,
            byCategory,
            byEndpoint,
            recentErrors: errors.slice(-100) // Last 100 errors
        };
        
        return new Response(JSON.stringify(response), {
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({
            error: 'Failed to get error analytics',
            message: error?.message || 'Unknown error'
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Get email tracking analytics
 * GET /admin/analytics/email
 */
export async function handleGetEmailAnalytics(request: Request, env: Env, customerId: string | null): Promise<Response> {
    try {
        const url = new URL(request.url);
        const startDate = url.searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = url.searchParams.get('endDate') || new Date().toISOString().split('T')[0];
        
        const emailAnalytics: Array<{ date: string; opens: number; countries: Record<string, number> }> = [];
        const countryStats: Record<string, number> = {};
        let totalOpens = 0;
        
        // Iterate through date range
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const analyticsKey = `email_analytics_${customerId || 'default'}_${dateStr}`;
            const dayData = (await env.OTP_AUTH_KV.get(analyticsKey, { type: 'json' })) as any;
            
            if (dayData) {
                emailAnalytics.push({
                    date: dateStr,
                    opens: dayData.opens || 0,
                    countries: dayData.countries || {}
                });
                
                totalOpens += dayData.opens || 0;
                
                // Aggregate country stats
                for (const [country, count] of Object.entries(dayData.countries || {})) {
                    countryStats[country] = (countryStats[country] || 0) + (count as number);
                }
            } else {
                emailAnalytics.push({
                    date: dateStr,
                    opens: 0,
                    countries: {}
                });
            }
        }
        
        // Get recent individual tracking records (last 100)
        const recentOpens: Array<{
            openedAt: number;
            country: string | null;
            city: string | null;
            timezone: string | null;
            userAgent: string | null;
        }> = [];
        const listResult = await env.OTP_AUTH_KV.list({ prefix: `email_tracking_` });
        
        // Filter by customer if provided and get most recent
        const allRecords: Array<{
            openedAt: number;
            country: string | null;
            city: string | null;
            timezone: string | null;
            userAgent: string | null;
            customerId: string | null;
            key: string;
        }> = [];
        
        for (const key of listResult.keys) {
            try {
                const record = (await env.OTP_AUTH_KV.get(key.name, { type: 'json' })) as any;
                if (record) {
                    // Filter by customer if customerId is provided
                    if (!customerId || record.customerId === customerId) {
                        allRecords.push({
                            openedAt: record.openedAt || 0,
                            country: record.country || null,
                            city: record.city || null,
                            timezone: record.timezone || null,
                            userAgent: record.userAgent || null,
                            customerId: record.customerId || null,
                            key: key.name
                        });
                    }
                }
            } catch (e) {
                // Skip invalid records
                continue;
            }
        }
        
        // Sort by openedAt (most recent first) and take top 100
        allRecords.sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0));
        recentOpens.push(...allRecords.slice(0, 100).map(record => ({
            openedAt: record.openedAt,
            country: record.country,
            city: record.city,
            timezone: record.timezone,
            userAgent: record.userAgent ? record.userAgent.substring(0, 100) : null // Truncate for privacy
        })));
        
        const response: EmailAnalyticsResponse = {
            success: true,
            period: {
                start: startDate,
                end: endDate
            },
            summary: {
                totalOpens,
                uniqueCountries: Object.keys(countryStats).length,
                averageOpensPerDay: emailAnalytics.length > 0 ? (totalOpens / emailAnalytics.length).toFixed(2) : '0'
            },
            countryStats,
            dailyBreakdown: emailAnalytics,
            recentOpens
        };
        
        return new Response(JSON.stringify(response), {
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({
            error: 'Failed to get email analytics',
            message: error?.message || 'Unknown error'
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}

