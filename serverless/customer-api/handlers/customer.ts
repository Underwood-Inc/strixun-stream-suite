/**
 * Customer Handlers
 * Handles customer CRUD operations
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../utils/errors.js';
import {
    getCustomer,
    getCustomerByEmail,
    storeCustomer,
    generateCustomerId,
    type CustomerData,
} from '../services/customer.js';

interface Env {
    CUSTOMER_KV: KVNamespace;
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

interface AuthResult {
    userId: string;
    email?: string;
    customerId: string | null;
    jwtToken: string;
}

/**
 * Handle update customer by ID (for service calls)
 * PUT /customer/:id
 */
export async function handleUpdateCustomerById(
    request: Request,
    env: Env,
    auth: AuthResult,
    customerId: string
): Promise<Response> {
    const corsHeaders = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
    });

    try {
        // Get existing customer
        const customer = await getCustomer(customerId, env);
        if (!customer) {
            const rfcError = createError(request, 404, 'Not Found', 'Customer not found');
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Parse update data
        const body = await request.json() as Partial<CustomerData>;
        
        // Update allowed fields
        if (body.name !== undefined) customer.name = body.name;
        if (body.companyName !== undefined) customer.companyName = body.companyName;
        if (body.tier !== undefined) customer.tier = body.tier;
        if (body.status !== undefined) customer.status = body.status;
        if (body.subscriptions !== undefined) customer.subscriptions = body.subscriptions;
        if (body.flairs !== undefined) customer.flairs = body.flairs;
        if (body.config !== undefined) customer.config = { ...customer.config, ...body.config };
        if (body.features !== undefined) customer.features = { ...customer.features, ...body.features };

        customer.updatedAt = new Date().toISOString();

        // Store updated customer
        await storeCustomer(customerId, customer, env);

        // Build response with id and customerId (API architecture compliance)
        const responseData = {
            id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            customerId: customer.customerId,
            ...customer,
        };

        return new Response(JSON.stringify(responseData), {
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Update customer by ID error:', error);
        const rfcError = createError(
            request,
            500,
            'Internal Server Error',
            env.ENVIRONMENT === 'development' ? error.message : 'Failed to update customer'
        );
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}

/**
 * Get customer
 * GET /customer/me or GET /customer/:id
 */
export async function handleGetCustomer(
    request: Request,
    env: Env,
    auth: AuthResult,
    customerId?: string
): Promise<Response> {
    const corsHeaders = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
    });

    try {
        // Determine which customer to get
        const targetCustomerId = customerId || auth.customerId;

        if (!targetCustomerId) {
            const rfcError = createError(request, 404, 'Not Found', 'Customer not found');
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Get customer
        const customer = await getCustomer(targetCustomerId, env);

        if (!customer) {
            const rfcError = createError(request, 404, 'Not Found', 'Customer not found');
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Verify access (users can only access their own customer account)
        if (!customerId && customer.customerId !== auth.customerId) {
            const rfcError = createError(request, 403, 'Forbidden', 'Access denied');
            return new Response(JSON.stringify(rfcError), {
                status: 403,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Build response with id and customerId (API architecture compliance)
        const responseData = {
            id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            customerId: customer.customerId,
            ...customer,
        };

        return new Response(JSON.stringify(responseData), {
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Get customer error:', error);
        const rfcError = createError(
            request,
            500,
            'Internal Server Error',
            env.ENVIRONMENT === 'development' ? error.message : 'Failed to get customer'
        );
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}

/**
 * Create customer
 * POST /customer
 */
export async function handleCreateCustomer(
    request: Request,
    env: Env,
    auth: AuthResult
): Promise<Response> {
    const corsHeaders = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
    });

    try {
        const body = await request.json() as Partial<CustomerData>;
        const { email, name, companyName } = body;

        if (!email) {
            const rfcError = createError(request, 400, 'Bad Request', 'Email is required');
            return new Response(JSON.stringify(rfcError), {
                status: 400,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Check if customer already exists
        const existingCustomer = await getCustomerByEmail(email, env);
        if (existingCustomer) {
            const rfcError = createError(request, 409, 'Conflict', 'Customer with this email already exists');
            return new Response(JSON.stringify(rfcError), {
                status: 409,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Generate customer ID
        const customerId = generateCustomerId();

        // Create customer data
        const customerData: CustomerData = {
            customerId,
            email: email.toLowerCase().trim(),
            name: name || email.split('@')[0],
            companyName: companyName || email.split('@')[1]?.split('.')[0] || 'My App',
            tier: 'free',
            plan: 'free', // Legacy
            status: 'active',
            subscriptions: [{
                planId: 'free',
                status: 'active',
                startDate: new Date().toISOString(),
                endDate: null,
                planName: 'Free',
                billingCycle: 'monthly',
            }],
            flairs: [],
            createdAt: new Date().toISOString(),
        };

        // Store customer
        await storeCustomer(customerId, customerData, env);

        // Build response with id and customerId (API architecture compliance)
        const responseData = {
            id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            customerId: customerData.customerId,
            ...customerData,
        };

        return new Response(JSON.stringify(responseData), {
            status: 201,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Create customer error:', error);
        const rfcError = createError(
            request,
            500,
            'Internal Server Error',
            env.ENVIRONMENT === 'development' ? error.message : 'Failed to create customer'
        );
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}

/**
 * Get customer by email
 * GET /customer/by-email/:email
 */
export async function handleGetCustomerByEmail(
    request: Request,
    env: Env,
    auth: AuthResult,
    email: string
): Promise<Response> {
    const corsHeaders = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
    });

    try {
        // Get customer by email
        const customer = await getCustomerByEmail(email, env);

        if (!customer) {
            const rfcError = createError(request, 404, 'Not Found', 'Customer not found');
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Build response with id and customerId (API architecture compliance)
        const responseData = {
            id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            customerId: customer.customerId,
            ...customer,
        };

        return new Response(JSON.stringify(responseData), {
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Get customer by email error:', error);
        const rfcError = createError(
            request,
            500,
            'Internal Server Error',
            env.ENVIRONMENT === 'development' ? error.message : 'Failed to get customer by email'
        );
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}

/**
 * Update customer
 * PUT /customer/me
 */
export async function handleUpdateCustomer(
    request: Request,
    env: Env,
    auth: AuthResult
): Promise<Response> {
    const corsHeaders = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
    });

    try {
        if (!auth.customerId) {
            const rfcError = createError(request, 404, 'Not Found', 'Customer not found');
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Get existing customer
        const customer = await getCustomer(auth.customerId, env);
        if (!customer) {
            const rfcError = createError(request, 404, 'Not Found', 'Customer not found');
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Parse update data
        const body = await request.json() as Partial<CustomerData>;
        
        // Update allowed fields
        if (body.name !== undefined) customer.name = body.name;
        if (body.companyName !== undefined) customer.companyName = body.companyName;
        if (body.tier !== undefined) customer.tier = body.tier;
        if (body.status !== undefined) customer.status = body.status;
        if (body.subscriptions !== undefined) customer.subscriptions = body.subscriptions;
        if (body.flairs !== undefined) customer.flairs = body.flairs;
        if (body.config !== undefined) customer.config = { ...customer.config, ...body.config };
        if (body.features !== undefined) customer.features = { ...customer.features, ...body.features };

        customer.updatedAt = new Date().toISOString();

        // Store updated customer
        await storeCustomer(auth.customerId, customer, env);

        // Build response with id and customerId (API architecture compliance)
        const responseData = {
            id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            customerId: customer.customerId,
            ...customer,
        };

        return new Response(JSON.stringify(responseData), {
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Update customer error:', error);
        const rfcError = createError(
            request,
            500,
            'Internal Server Error',
            env.ENVIRONMENT === 'development' ? error.message : 'Failed to update customer'
        );
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}

