/**
 * GDPR Handlers
 * Handles user data export, deletion, and audit logs
 */

import { getCorsHeaders, getCorsHeadersRecord } from '../../utils/cors.js';
import { getEntity, deleteEntity, entityKey } from '@strixun/kv-entities';
import { hashEmail } from '../../utils/crypto.js';
import { logSecurityEvent } from '../../services/security.js';

interface Env {
    OTP_AUTH_KV: KVNamespace;
    ENVIRONMENT?: string;
}

interface CustomerData {
    customerId: string;
    email: string;
    createdAt: string;
    lastLogin?: string;
    displayName?: string;
}

interface AuditEvent {
    eventType: string;
    timestamp: string;
    [key: string]: unknown;
}

interface DayAudit {
    events: AuditEvent[];
}

/**
 * Export customer data (GDPR)
 * GET /admin/customers/{customerId}/export
 */
export async function handleExportCustomerData(request: Request, env: Env, customerId: string, customerIdParam: string): Promise<Response> {
    try {
        // Get customer data using new entity pattern
        const targetCustomerId = customerIdParam.replace('cust_', '');
        const customer = await getEntity<CustomerData>(env.OTP_AUTH_KV, 'otp-auth', 'customer', targetCustomerId);
        
        if (!customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Get all related data
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
        const err = error as Error;
        return new Response(JSON.stringify({
            error: 'Failed to export customer data',
            message: err.message
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Delete customer data (GDPR)
 * DELETE /admin/customers/{customerId}
 */
export async function handleDeleteCustomerData(request: Request, env: Env, customerId: string, customerIdParam: string): Promise<Response> {
    try {
        // Get customer data first using new entity pattern
        const targetCustomerId = customerIdParam.replace('cust_', '');
        const customer = await getEntity<CustomerData>(env.OTP_AUTH_KV, 'otp-auth', 'customer', targetCustomerId);
        
        if (!customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const emailHash = await hashEmail(customer.email);
        
        // CRITICAL: Release display name when customer account is deleted
        if (customer.displayName) {
            const { releaseDisplayName } = await import('../../services/nameGenerator.js');
            await releaseDisplayName(customer.displayName, null, env); // Global scope
        }
        
        // Delete all customer-related data using new entity pattern
        // Note: We can't easily list all OTP keys, but they expire automatically
        // Delete customer record
        await deleteEntity(env.OTP_AUTH_KV, 'otp-auth', 'customer', targetCustomerId);
        
        // Delete session using entity pattern
        await deleteEntity(env.OTP_AUTH_KV, 'otp-auth', 'session', customerIdParam);
        
        // Delete latest OTP key reference (ephemeral, uses raw key)
        const latestOtpKey = `otp_latest_${emailHash}`;
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
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const err = error as Error;
        return new Response(JSON.stringify({
            error: 'Failed to delete customer data',
            message: err.message
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Get audit logs (paginated)
 * GET /admin/audit-logs?page=1&pageSize=50&startDate=...&endDate=...&eventType=...
 *
 * Iterates KV day-buckets in reverse chronological order so the newest
 * events are fetched first.  Returns only the requested page slice.
 */
export async function handleGetAuditLogs(request: Request, env: Env, customerId: string): Promise<Response> {
    try {
        const url = new URL(request.url);
        const startDate = url.searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const endDate = url.searchParams.get('endDate') || new Date().toISOString().split('T')[0];
        const eventType = url.searchParams.get('eventType');
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
        const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '50', 10)));

        const events: AuditEvent[] = [];

        // Build date list in reverse (newest first) so sorting is cheaper
        const start = new Date(startDate);
        const end = new Date(endDate);
        const dates: string[] = [];
        for (let d = new Date(end); d >= start; d.setDate(d.getDate() - 1)) {
            dates.push(d.toISOString().split('T')[0]);
        }

        // Fetch day-buckets and collect matching events
        for (const dateStr of dates) {
            const auditKey = `audit_${customerId}_${dateStr}`;
            const dayAudit = await env.OTP_AUTH_KV.get<DayAudit>(auditKey, { type: 'json' });

            if (dayAudit?.events) {
                const filtered = eventType
                    ? dayAudit.events.filter(e => e.eventType === eventType)
                    : dayAudit.events;
                events.push(...filtered);
            }
        }

        // Stable sort newest-first
        events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        const total = events.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const safePage = Math.min(page, totalPages);
        const offset = (safePage - 1) * pageSize;
        const pageEvents = events.slice(offset, offset + pageSize);

        return new Response(JSON.stringify({
            success: true,
            period: { start: startDate, end: endDate },
            total,
            page: safePage,
            pageSize,
            totalPages,
            events: pageEvents,
        }), {
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        const err = error as Error;
        return new Response(JSON.stringify({
            error: 'Failed to get audit logs',
            message: err.message
        }), {
            status: 500,
            headers: { ...getCorsHeadersRecord(env, request), 'Content-Type': 'application/json' },
        });
    }
}
