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
                    ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
                },
            });
        }

        // Parse update data
        const body = await request.json() as Partial<CustomerData>;
        
        // Update allowed fields
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
        // NEVER return email - email is only for OTP auth, never exposed in API responses
        const { email, ...customerWithoutEmail } = customer;
        const responseData = {
            id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...customerWithoutEmail,
        };

        return new Response(JSON.stringify(responseData), {
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
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
                ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
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
        // Determine which customer to get - ONLY use customerId (no email fallback)
        const targetCustomerId = customerId || auth.customerId;

        if (!targetCustomerId) {
            const rfcError = createError(request, 404, 'Not Found', 'Customer not found. Customer ID is required.');
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
                },
            });
        }

        // Get customer by customerId only
        const customer = await getCustomer(targetCustomerId, env);

        if (!customer) {
            const rfcError = createError(request, 404, 'Not Found', 'Customer not found');
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
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
                    ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
                },
            });
        }

        // CRITICAL: displayName is REQUIRED, not optional
        // If missing, generate it using the existing name generator and update the customer
        if (!customer.displayName || customer.displayName.trim() === '') {
            console.warn(`[Customer API] Customer ${customer.customerId} is missing displayName. Generating and updating...`);
            
            try {
                // Import the existing name generator from otp-auth-service package
                // Pass CUSTOMER_KV as OTP_AUTH_KV so it can check uniqueness
                const { generateUniqueDisplayName, reserveDisplayName } = await import('@strixun/otp-auth-service/services/nameGenerator');
                const nameGeneratorEnv = {
                    OTP_AUTH_KV: env.CUSTOMER_KV, // Use CUSTOMER_KV for uniqueness checks
                } as { OTP_AUTH_KV: KVNamespace; [key: string]: any };
                
                const customerDisplayName = await generateUniqueDisplayName({
                    maxAttempts: 10,
                    pattern: 'random'
                }, nameGeneratorEnv);
                
                // Handle empty string (generation failed after 50 retries)
                if (!customerDisplayName || customerDisplayName.trim() === '') {
                    console.error(`[Customer API] Failed to generate unique displayName after 50 retries for customer ${customer.customerId}`);
                    // Don't throw - return customer without displayName rather than failing the request
                    // It will be fixed on next authentication via ensureCustomerAccount
                    console.warn(`[Customer API] Customer ${customer.customerId} will have null displayName - will be fixed on next authentication`);
                } else {
                    // Reserve the display name (global scope)
                    await reserveDisplayName(customerDisplayName, customer.customerId, null, nameGeneratorEnv);
                    
                    // Update the customer record with the generated displayName
                    customer.displayName = customerDisplayName;
                }
                customer.updatedAt = new Date().toISOString();
                await storeCustomer(customer.customerId, customer, env);
                
                console.log(`[Customer API] Generated and set displayName "${customerDisplayName}" for customer ${customer.customerId}`);
            } catch (error) {
                console.error(`[Customer API] Failed to generate displayName for customer ${customer.customerId}:`, error);
                // Don't throw - return customer without displayName rather than failing the request
                // It will be fixed on next authentication via ensureCustomerAccount
            }
        }

        // Build response with id and customerId (API architecture compliance)
        // NEVER return email - email is only for OTP auth, never exposed in API responses
        // (Exception: mods-hub profile page will have special handling for own profile)
        const { email, ...customerWithoutEmail } = customer;
        const responseData = {
            id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...customerWithoutEmail,
        };

        return new Response(JSON.stringify(responseData), {
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
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
                ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
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
        const { email, companyName, displayName, customerId: providedCustomerId, subscriptions, flairs, config, features } = body;

        if (!email) {
            const rfcError = createError(request, 400, 'Bad Request', 'Email is required');
            return new Response(JSON.stringify(rfcError), {
                status: 400,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
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
                    ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
                },
            });
        }

        // Use provided customerId or generate new one
        const customerId = providedCustomerId || generateCustomerId();

        // CRITICAL: displayName is REQUIRED - generate if not provided
        let finalDisplayName = displayName;
        if (!finalDisplayName || finalDisplayName.trim() === '') {
            const { generateUniqueDisplayName, reserveDisplayName } = await import('@strixun/otp-auth-service/services/nameGenerator');
            const nameGeneratorEnv = {
                OTP_AUTH_KV: env.CUSTOMER_KV,
            } as { OTP_AUTH_KV: KVNamespace; [key: string]: any };
            
            finalDisplayName = await generateUniqueDisplayName({
                maxAttempts: 10,
                pattern: 'random'
            }, nameGeneratorEnv);
            
            // Handle empty string (generation failed after 50 retries)
            if (!finalDisplayName || finalDisplayName.trim() === '') {
                console.error(`[Customer API] Failed to generate unique displayName after 50 retries for new customer`);
                throw new Error('Unable to generate unique display name. Please try again or contact support.');
            }
            
            await reserveDisplayName(finalDisplayName, customerId, null, nameGeneratorEnv); // Global scope
        }

        // Create customer data - use provided fields or defaults
        const customerData: CustomerData = {
            customerId,
            email: email.toLowerCase().trim(),
            companyName: companyName || email.split('@')[1]?.split('.')[0] || 'My App',
            displayName: finalDisplayName, // REQUIRED: Use provided or generated displayName
            tier: body.tier || 'free',
            plan: body.plan || 'free', // Legacy
            status: body.status || 'active',
            subscriptions: subscriptions || [{
                planId: 'free',
                status: 'active',
                startDate: new Date().toISOString(),
                endDate: null,
                planName: 'Free',
                billingCycle: 'monthly',
            }],
            flairs: flairs || [],
            config: config,
            features: features,
            createdAt: body.createdAt || new Date().toISOString(),
        };

        // Store customer
        await storeCustomer(customerId, customerData, env);

        // Build response with id and customerId (API architecture compliance)
        // NEVER return email - email is only for OTP auth, never exposed in API responses
        const { email: _, ...customerDataWithoutEmail } = customerData;
        const responseData = {
            id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...customerDataWithoutEmail,
        };

        return new Response(JSON.stringify(responseData), {
            status: 201,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
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
                ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
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
                    ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
                },
            });
        }

        // Build response with id and customerId (API architecture compliance)
        // NEVER return email - email is only for OTP auth and service-to-service lookups
        // This endpoint is service-to-service only, but we still don't return email for consistency
        const { email: _, ...customerWithoutEmail } = customer;
        const responseData = {
            id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...customerWithoutEmail,
        };

        return new Response(JSON.stringify(responseData), {
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
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
                ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
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
                    ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
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
                    ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
                },
            });
        }

        // Parse update data
        const body = await request.json() as Partial<CustomerData>;
        
        // Update allowed fields
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
        // NEVER return email - email is only for OTP auth, never exposed in API responses
        const { email, ...customerWithoutEmail } = customer;
        const responseData = {
            id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...customerWithoutEmail,
        };

        return new Response(JSON.stringify(responseData), {
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
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
                ...Object.fromEntries(Array.from((corsHeaders as any).entries())),
            },
        });
    }
}

