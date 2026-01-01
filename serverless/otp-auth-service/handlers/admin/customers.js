/**
 * Customer Management Handlers
 * Handles customer profile and status management
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { getCustomer, storeCustomer } from '../../services/customer.js';

/**
 * Update customer status
 * PUT /admin/customers/{customerId}/status
 */
export async function handleUpdateCustomerStatus(request, env, customerId, newStatus) {
    try {
        const customer = await getCustomer(customerId, env);
        if (!customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Validate status
        const validStatuses = ['active', 'suspended', 'cancelled', 'pending_verification'];
        if (!validStatuses.includes(newStatus)) {
            return new Response(JSON.stringify({ 
                error: 'Invalid status',
                validStatuses 
            }), {
                status: 400,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Update status
        const oldStatus = customer.status;
        customer.status = newStatus;
        customer.statusChangedAt = new Date().toISOString();
        customer.updatedAt = new Date().toISOString();
        
        await storeCustomer(customerId, customer, env);
        
        // Log status change
        console.log(`Customer ${customerId} status changed from ${oldStatus} to ${newStatus}`);
        
        return new Response(JSON.stringify({
            success: true,
            customerId,
            oldStatus,
            newStatus,
            statusChangedAt: customer.statusChangedAt,
            message: `Customer status updated to ${newStatus}`
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to update customer status',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Suspend customer
 * POST /admin/customers/{customerId}/suspend
 */
export async function handleSuspendCustomer(request, env, customerId) {
    return handleUpdateCustomerStatus(request, env, customerId, 'suspended');
}

/**
 * Activate customer
 * POST /admin/customers/{customerId}/activate
 */
export async function handleActivateCustomer(request, env, customerId) {
    return handleUpdateCustomerStatus(request, env, customerId, 'active');
}

