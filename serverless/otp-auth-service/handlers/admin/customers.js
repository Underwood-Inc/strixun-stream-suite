/**
 * Customer Management Handlers
 * Handles customer profile and status management
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { getCustomer, storeCustomer, getCustomerByEmail } from '../../services/customer.js';
import { ensureCustomerAccount } from '../auth/customer-creation.js';
import { hashEmail } from '../../utils/crypto.js';

/**
 * Get current customer info
 * GET /admin/customers/me
 */
export async function handleAdminGetMe(request, env, customerId) {
    try {
        // If customerId is provided but customer doesn't exist, try to ensure it exists
        let customer = customerId ? await getCustomer(customerId, env) : null;
        
        // If customer not found, try to get email from JWT token and ensure customer account exists
        if (!customer && customerId) {
            // Try to get email from JWT token in Authorization header
            const authHeader = request.headers.get('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                try {
                    const { verifyJWT, getJWTSecret } = await import('../../utils/crypto.js');
                    const jwtSecret = getJWTSecret(env);
                    const payload = await verifyJWT(token, jwtSecret);
                    
                    if (payload && payload.email) {
                        const emailLower = payload.email.toLowerCase().trim();
                        // Ensure customer account exists (backwards compatibility)
                        const resolvedCustomerId = await ensureCustomerAccount(emailLower, customerId, env);
                        if (resolvedCustomerId) {
                            customer = await getCustomer(resolvedCustomerId, env);
                        }
                    }
                } catch (jwtError) {
                    // JWT verification failed, continue with error handling below
                    console.warn('[Admin GetMe] Failed to verify JWT for customer lookup:', jwtError);
                }
            }
        }
        
        // If still no customer found, return error
        if (!customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Return customer directly (not wrapped) to match API client expectations
        return new Response(JSON.stringify({
            customerId: customer.customerId,
            name: customer.name,
            email: customer.email,
            companyName: customer.companyName,
            plan: customer.plan,
            status: customer.status,
            createdAt: customer.createdAt,
            features: customer.features
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to get customer info',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

/**
 * Update customer info
 * PUT /admin/customers/me
 */
export async function handleUpdateMe(request, env, customerId) {
    try {
        const customer = await getCustomer(customerId, env);
        if (!customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        const body = await request.json();
        const { name, companyName } = body;
        
        // Update allowed fields only
        if (name !== undefined) {
            customer.name = name;
        }
        if (companyName !== undefined) {
            customer.companyName = companyName;
        }
        
        customer.updatedAt = new Date().toISOString();
        await storeCustomer(customerId, customer, env);
        
        return new Response(JSON.stringify({
            success: true,
            customer: {
                customerId: customer.customerId,
                name: customer.name,
                email: customer.email,
                companyName: customer.companyName,
                plan: customer.plan,
                status: customer.status
            },
            message: 'Customer info updated successfully'
        }), {
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({
            error: 'Failed to update customer info',
            message: error.message
        }), {
            status: 500,
            headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
        });
    }
}

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

