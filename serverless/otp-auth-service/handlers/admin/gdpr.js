/**
 * GDPR Handlers
 * Handles user data export, deletion, and audit logs
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { getCustomerKey } from '../../services/customer.js';
import { hashEmail } from '../../utils/crypto.js';
import { logSecurityEvent } from '../../services/security.js';

/**
 * Export user data (GDPR)
 * GET /admin/users/{userId}/export
 */
export async function handleExportUserData(request, env, customerId, userId) {
    try {
        // Get user data
        const userKey = getCustomerKey(customerId, `user_${userId.replace('user_', '')}`);
        const user = await env.OTP_AUTH_KV.get(userKey, { type: 'json' });
        
        if (!user) {
            return new Response(JSON.stringify({ error: 'User not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Get all related data
        const emailHash = await hashEmail(user.email);
        const exportData = {
            userId: user.userId,
            email: user.email,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
            // Note: OTP codes are not stored after use, so no OTP history
            // Sessions are stored but don't contain sensitive data
        };
        
        return new Response(JSON.stringify({
            success: true,
            data: exportData,
            exportedAt: new Date().toISOString()
        }), {
            headers: { 
                ...getCorsHeaders(env, request), 
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="user-data-${userId}.json"`
            },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to export user data',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Delete user data (GDPR)
 * DELETE /admin/users/{userId}
 */
export async function handleDeleteUserData(request, env, customerId, userId) {
    try {
        // Get user data first
        const userKey = getCustomerKey(customerId, `user_${userId.replace('user_', '')}`);
        const user = await env.OTP_AUTH_KV.get(userKey, { type: 'json' });
        
        if (!user) {
            return new Response(JSON.stringify({ error: 'User not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const emailHash = await hashEmail(user.email);
        
        // CRITICAL: Release display name when user account is deleted
        if (user.displayName) {
            const { releaseDisplayName } = await import('../../services/nameGenerator.js');
            await releaseDisplayName(user.displayName, null, env); // Global scope
        }
        
        // Delete all user-related data
        // Note: We can't easily list all OTP keys, but they expire automatically
        // Delete user record
        await env.OTP_AUTH_KV.delete(userKey);
        
        // Delete session
        const sessionKey = getCustomerKey(customerId, `session_${userId}`);
        await env.OTP_AUTH_KV.delete(sessionKey);
        
        // Delete latest OTP key reference
        const latestOtpKey = getCustomerKey(customerId, `otp_latest_${emailHash}`);
        await env.OTP_AUTH_KV.delete(latestOtpKey);
        
        // Log deletion for audit
        await logSecurityEvent(customerId, 'user_data_deleted', {
            userId,
            email: user.email,
            deletedAt: new Date().toISOString()
        }, env);
        
        return new Response(JSON.stringify({
            success: true,
            message: 'User data deleted successfully'
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to delete user data',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Get audit logs
 * GET /admin/audit-logs
 */
export async function handleGetAuditLogs(request, env, customerId) {
    try {
        const url = new URL(request.url);
        const startDate = url.searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = url.searchParams.get('endDate') || new Date().toISOString().split('T')[0];
        const eventType = url.searchParams.get('eventType');
        
        const events = [];
        
        // Iterate through date range
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const auditKey = `audit_${customerId}_${dateStr}`;
            const dayAudit = await env.OTP_AUTH_KV.get(auditKey, { type: 'json' });
            
            if (dayAudit && dayAudit.events) {
                const filteredEvents = eventType 
                    ? dayAudit.events.filter(e => e.eventType === eventType)
                    : dayAudit.events;
                
                events.push(...filteredEvents);
            }
        }
        
        // Sort by timestamp (newest first)
        events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        return new Response(JSON.stringify({
            success: true,
            period: { start: startDate, end: endDate },
            total: events.length,
            events: events.slice(0, 1000) // Limit to 1000 most recent
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to get audit logs',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

