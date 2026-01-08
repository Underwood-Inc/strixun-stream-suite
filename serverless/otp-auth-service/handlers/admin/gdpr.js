/**
 * GDPR Handlers
 * Handles user data export, deletion, and audit logs
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { getCustomerKey } from '../../services/customer.js';
import { hashEmail } from '../../utils/crypto.js';
import { logSecurityEvent } from '../../services/security.js';

/**
 * Export customer data (GDPR)
 * GET /admin/customers/{customerId}/export
 */
export async function handleExportCustomerData(request, env, customerId, customerIdParam) {
    try {
        // Get customer data
        const customerKey = getCustomerKey(customerId, `customer_${customerIdParam.replace('cust_', '')}`);
        const customer = await env.OTP_AUTH_KV.get(customerKey, { type: 'json' });
        
        if (!customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Get all related data
        const emailHash = await hashEmail(customer.email);
        const exportData = {
            customerId: customer.customerId,
            email: customer.email,
            createdAt: customer.createdAt,
            lastLogin: customer.lastLogin,
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
                'Content-Disposition': `attachment; filename="customer-data-${customerIdParam}.json"`
            },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to export customer data',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Delete customer data (GDPR)
 * DELETE /admin/customers/{customerId}
 */
export async function handleDeleteCustomerData(request, env, customerId, customerIdParam) {
    try {
        // Get customer data first
        const customerKey = getCustomerKey(customerId, `customer_${customerIdParam.replace('cust_', '')}`);
        const customer = await env.OTP_AUTH_KV.get(customerKey, { type: 'json' });
        
        if (!customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const emailHash = await hashEmail(customer.email);
        
        // CRITICAL: Release display name when customer account is deleted
        if (customer.displayName) {
            const { releaseDisplayName } = await import('../../services/nameGenerator.js');
            await releaseDisplayName(customer.displayName, null, env); // Global scope
        }
        
        // Delete all customer-related data
        // Note: We can't easily list all OTP keys, but they expire automatically
        // Delete customer record
        await env.OTP_AUTH_KV.delete(customerKey);
        
        // Delete session
        const sessionKey = getCustomerKey(customerId, `session_${customerIdParam}`);
        await env.OTP_AUTH_KV.delete(sessionKey);
        
        // Delete latest OTP key reference
        const latestOtpKey = getCustomerKey(customerId, `otp_latest_${emailHash}`);
        await env.OTP_AUTH_KV.delete(latestOtpKey);
        
        // Log deletion for audit
        await logSecurityEvent(customerId, 'customer_data_deleted', {
            customerId: customerIdParam,
            email: customer.email,
            deletedAt: new Date().toISOString()
        }, env);
        
        return new Response(JSON.stringify({
            success: true,
            message: 'Customer data deleted successfully'
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to delete customer data',
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

