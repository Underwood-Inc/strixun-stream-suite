/**
 * Customer Management Handlers
 * Handles customer profile and status management
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { getCustomer, storeCustomer, getCustomerByEmail, getCustomerKey } from '../../services/customer.js';
import { ensureCustomerAccount } from '../auth/customer-creation.js';
import { hashEmail, verifyJWT, getJWTSecret } from '../../utils/crypto.js';
import { buildResponseWithEncryption } from '../../utils/response-builder.js';
import { getCustomerService, getCustomerByEmailService } from '../../utils/customer-api-service-client.js';

/**
 * Get current customer info
 * GET /admin/customers/me
 */
export async function handleAdminGetMe(request, env, customerId) {
    try {
        // Get JWT token from Authorization header
        const authHeader = request.headers.get('Authorization');
        const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
        
        // Try to get email from JWT token to ensure customer account exists
        let email = null;
        let resolvedCustomerId = customerId;
        
        if (token) {
            try {
                const { verifyJWT, getJWTSecret } = await import('../../utils/crypto.js');
                const jwtSecret = getJWTSecret(env);
                const payload = await verifyJWT(token, jwtSecret);
                
                if (payload && payload.email) {
                    email = payload.email.toLowerCase().trim();
                    // BUSINESS RULE: Customer account MUST ALWAYS be created - ensureCustomerAccount throws if it fails
                    try {
                        resolvedCustomerId = await ensureCustomerAccount(email, customerId, env);
                    } catch (error) {
                        console.error(`[Admin GetMe] Failed to ensure customer account for ${email}:`, error);
                        // Continue - will try to get customer anyway
                    }
                }
            } catch (jwtError) {
                console.warn('[Admin GetMe] Failed to verify JWT for customer lookup:', jwtError);
            }
        }
        
        // Get customer from Customer API (not local KV store)
        let customer = null;
        if (resolvedCustomerId) {
            try {
                customer = await getCustomerService(resolvedCustomerId, env);
            } catch (error) {
                console.warn(`[Admin GetMe] Failed to get customer by ID ${resolvedCustomerId}:`, error);
            }
        }
        
        // If still not found and we have email, try by email
        if (!customer && email) {
            try {
                customer = await getCustomerByEmailService(email, env);
                if (customer) {
                    resolvedCustomerId = customer.customerId;
                }
            } catch (error) {
                console.warn(`[Admin GetMe] Failed to get customer by email ${email}:`, error);
            }
        }
        
        // If still no customer found, return error
        if (!customer) {
            return new Response(JSON.stringify({ error: 'Customer not found' }), {
                status: 404,
                headers: { ...getCorsHeaders(env, request), 'Content-Type': 'application/json' },
            });
        }
        
        // Extract userId from JWT token for root config (always include id and customerId per API architecture)
        // Reuse token from earlier extraction (line 21)
        let userId = null;
        if (token) {
            try {
                const { verifyJWT, getJWTSecret } = await import('../../utils/crypto.js');
                const jwtSecret = getJWTSecret(env);
                const payload = await verifyJWT(token, jwtSecret);
                if (payload) {
                    userId = payload.userId || payload.sub || null;
                }
            } catch (jwtError) {
                // JWT verification failed, continue without userId
            }
        }
        
        // Generate request ID if userId not available
        const requestId = userId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Get owner's JWT token for encryption (if available)
        // For customer data, we need to get the customer's user token
        // For now, we'll use the requester's token as a fallback
        // In Phase 2, we'll properly retrieve the owner's token
        let ownerToken = token;
        let ownerUserId = userId;
        
        // Try to get customer's user ID from email
        if (customer.email) {
            const { hashEmail } = await import('../../utils/crypto.js');
            const emailHash = await hashEmail(customer.email);
            const userKey = getCustomerKey(customerId, `user_${emailHash}`);
            const user = await env.OTP_AUTH_KV.get(userKey, { type: 'json' });
            if (user && user.userId) {
                ownerUserId = user.userId;
                // Note: In Phase 2, we'll retrieve the owner's actual JWT token
                // For now, we'll use a placeholder - this will need proper implementation
            }
        }
        
        // Build response with proper encryption
        const responseData = await buildResponseWithEncryption(
            {
                id: requestId,
                customerId: customer.customerId,
                email: customer.email,
                userId: customer.email, // Use email as userId
                companyName: customer.companyName,
                plan: customer.plan || customer.tier,
                status: customer.status,
                createdAt: customer.createdAt,
                displayName: customer.displayName,
                features: customer.features
            },
            ownerUserId || customer.email, // Owner user ID
            ownerToken, // Owner's JWT token
            resolvedCustomerId || customerId,
            env
        );
        
        // Return customer with root config (id and customerId always included per API architecture)
        return new Response(JSON.stringify(responseData), {
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
        const { companyName } = body;
        
        // Update allowed fields only
        if (companyName !== undefined) {
            customer.companyName = companyName;
        }
        
        customer.updatedAt = new Date().toISOString();
        await storeCustomer(customerId, customer, env);
        
        return new Response(JSON.stringify({
            success: true,
            customer: {
                customerId: customer.customerId,
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

