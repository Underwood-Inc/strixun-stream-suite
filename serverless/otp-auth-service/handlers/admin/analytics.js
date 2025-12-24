/**
 * Analytics Handlers
 * Handles analytics and metrics endpoints
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { getUsage } from '../../services/analytics.js';

/**
 * Get analytics
 * GET /admin/analytics
 */
export async function handleGetAnalytics(request, env, customerId) {
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
        const response = {
            success: true,
            period: {
                start: startDate,
                end: endDate
            },
            metrics,
            dailyBreakdown: granularity === 'day' ? usage.dailyBreakdown : undefined
        };
        
        return new Response(JSON.stringify(response), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to get analytics',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Get real-time analytics
 * GET /admin/analytics/realtime
 */
export async function handleGetRealtimeAnalytics(request, env, customerId) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        
        // Get today's usage
        const todayUsage = await env.OTP_AUTH_KV.get(`usage_${customerId}_${today}`, { type: 'json' }) || {};
        
        // Get last 24 hours (approximate - would need hourly tracking for exact)
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const yesterdayUsage = await env.OTP_AUTH_KV.get(`usage_${customerId}_${yesterdayStr}`, { type: 'json' }) || {};
        
        // Calculate last 24 hours (today + partial yesterday)
        const last24Hours = {
            otpRequests: (todayUsage.otpRequests || 0) + (yesterdayUsage.otpRequests || 0),
            otpVerifications: (todayUsage.otpVerifications || 0) + (yesterdayUsage.otpVerifications || 0)
        };
        
        // Get response time metrics for today
        const responseTimeMetrics = {};
        const endpoints = ['request-otp', 'verify-otp', 'me', 'logout', 'refresh'];
        for (const endpoint of endpoints) {
            const metricsKey = `metrics_${customerId}_${today}_${endpoint}`;
            const metrics = await env.OTP_AUTH_KV.get(metricsKey, { type: 'json' });
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
        const errorData = await env.OTP_AUTH_KV.get(errorKey, { type: 'json' }) || { total: 0 };
        const totalRequests = todayUsage.otpRequests || 0;
        const errorRate = totalRequests > 0 ? ((errorData.total / totalRequests) * 100).toFixed(2) : 0;
        
        return new Response(JSON.stringify({
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
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to get real-time analytics',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Get error analytics
 * GET /admin/analytics/errors
 */
export async function handleGetErrorAnalytics(request, env, customerId) {
    try {
        const url = new URL(request.url);
        const startDate = url.searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = url.searchParams.get('endDate') || new Date().toISOString().split('T')[0];
        const category = url.searchParams.get('category');
        
        const errors = [];
        const byCategory = {};
        const byEndpoint = {};
        let total = 0;
        
        // Iterate through date range
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const errorKey = `errors_${customerId}_${dateStr}`;
            const dayErrors = await env.OTP_AUTH_KV.get(errorKey, { type: 'json' });
            
            if (dayErrors) {
                // Filter by category if specified
                const filteredErrors = category 
                    ? dayErrors.errors.filter(e => e.category === category)
                    : dayErrors.errors;
                
                errors.push(...filteredErrors);
                
                // Aggregate by category
                for (const [cat, count] of Object.entries(dayErrors.byCategory || {})) {
                    if (!category || cat === category) {
                        byCategory[cat] = (byCategory[cat] || 0) + count;
                    }
                }
                
                // Aggregate by endpoint
                for (const [ep, count] of Object.entries(dayErrors.byEndpoint || {})) {
                    byEndpoint[ep] = (byEndpoint[ep] || 0) + count;
                }
                
                total += category ? filteredErrors.length : dayErrors.total;
            }
        }
        
        return new Response(JSON.stringify({
            success: true,
            period: { start: startDate, end: endDate },
            total,
            byCategory,
            byEndpoint,
            recentErrors: errors.slice(-100) // Last 100 errors
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to get error analytics',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

