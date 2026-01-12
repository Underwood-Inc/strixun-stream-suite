/**
 * Admin Handlers
 * Handles admin-only operations like listing all customers
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../utils/errors.js';
import { getCustomer, type CustomerData } from '../services/customer.js';

interface Env {
    CUSTOMER_KV: KVNamespace;
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

interface AuthResult {
    customerId: string | null;
    jwtToken: string;
}

export interface ValidationIssue {
    field: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
}

export interface CustomerWithValidation extends Partial<CustomerData> {
    customerId: string;
    validationIssues?: ValidationIssue[];
}

/**
 * Validate customer data and return any issues
 */
function validateCustomerData(customer: Partial<CustomerData>): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    // CRITICAL: customerId is mandatory
    if (!customer.customerId) {
        issues.push({
            field: 'customerId',
            severity: 'error',
            message: 'Customer ID is missing'
        });
    }
    
    // CRITICAL: displayName is mandatory
    if (!customer.displayName || customer.displayName.trim() === '') {
        issues.push({
            field: 'displayName',
            severity: 'error',
            message: 'Display name is missing or empty'
        });
    }
    
    // Email should be present (warning if missing)
    if (!customer.email) {
        issues.push({
            field: 'email',
            severity: 'warning',
            message: 'Email is missing (may be stripped from API responses)'
        });
    }
    
    // Status validation
    const validStatuses = ['active', 'suspended', 'cancelled'];
    if (!customer.status) {
        issues.push({
            field: 'status',
            severity: 'error',
            message: 'Status is missing'
        });
    } else if (!validStatuses.includes(customer.status)) {
        issues.push({
            field: 'status',
            severity: 'warning',
            message: `Invalid status: ${customer.status}. Expected: ${validStatuses.join(', ')}`
        });
    }
    
    // CreatedAt validation
    if (!customer.createdAt) {
        issues.push({
            field: 'createdAt',
            severity: 'warning',
            message: 'Created timestamp is missing'
        });
    } else {
        const createdDate = new Date(customer.createdAt);
        if (isNaN(createdDate.getTime())) {
            issues.push({
                field: 'createdAt',
                severity: 'error',
                message: 'Created timestamp is invalid'
            });
        }
    }
    
    // LastLogin validation
    if (customer.lastLogin) {
        const lastLoginDate = new Date(customer.lastLogin);
        if (isNaN(lastLoginDate.getTime())) {
            issues.push({
                field: 'lastLogin',
                severity: 'warning',
                message: 'Last login timestamp is invalid'
            });
        }
    }
    
    // CompanyName validation (should be present)
    if (!customer.companyName) {
        issues.push({
            field: 'companyName',
            severity: 'info',
            message: 'Company name is missing'
        });
    }
    
    return issues;
}

/**
 * Get customer details by ID (admin only)
 * GET /admin/customers/:customerId
 */
export async function handleGetCustomerDetails(
    request: Request,
    env: Env,
    auth: AuthResult,
    customerId: string
): Promise<Response> {
    const corsHeaders = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
    });

    try {
        const customer = await getCustomer(env.CUSTOMER_KV, customerId);
        
        if (!customer) {
            const rfcError = createError(
                request,
                404,
                'Customer Not Found',
                `Customer with ID ${customerId} does not exist`
            );
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }
        
        // Validate customer data
        const validationIssues = validateCustomerData(customer);
        
        const customerWithValidation: CustomerWithValidation = {
            ...customer,
            validationIssues: validationIssues.length > 0 ? validationIssues : undefined
        };
        
        console.log(`[Admin] Retrieved customer details:`, {
            customerId,
            hasIssues: validationIssues.length > 0
        });
        
        return new Response(JSON.stringify({
            customer: customerWithValidation
        }), {
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('[Admin] Failed to get customer details:', error);
        const rfcError = createError(
            request,
            500,
            'Internal Server Error',
            env.ENVIRONMENT === 'development' ? error.message : 'Failed to get customer details'
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
 * Update customer (admin only)
 * PUT /admin/customers/:customerId
 */
export async function handleUpdateCustomer(
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
        const existingCustomer = await getCustomer(env.CUSTOMER_KV, customerId);
        
        if (!existingCustomer) {
            const rfcError = createError(
                request,
                404,
                'Customer Not Found',
                `Customer with ID ${customerId} does not exist`
            );
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }
        
        // Parse request body
        const updates = await request.json().catch(() => ({})) as Partial<CustomerData>;
        
        // Merge updates with existing customer
        const updatedCustomer: CustomerData = {
            ...existingCustomer,
            ...updates,
            customerId, // Ensure customerId cannot be changed
            updatedAt: new Date().toISOString()
        };
        
        // Save updated customer
        const key = `customer_${customerId}`;
        await env.CUSTOMER_KV.put(key, JSON.stringify(updatedCustomer));
        
        // Also update by email hash if email exists
        if (updatedCustomer.email) {
            const { hashEmail } = await import('../utils/crypto.js');
            const emailHash = await hashEmail(updatedCustomer.email);
            const emailKey = `customer_${emailHash}`;
            await env.CUSTOMER_KV.put(emailKey, JSON.stringify(updatedCustomer));
        }
        
        console.log(`[Admin] Updated customer:`, {
            customerId,
            updatedFields: Object.keys(updates)
        });
        
        // Validate updated customer data
        const validationIssues = validateCustomerData(updatedCustomer);
        
        const customerWithValidation: CustomerWithValidation = {
            ...updatedCustomer,
            validationIssues: validationIssues.length > 0 ? validationIssues : undefined
        };
        
        return new Response(JSON.stringify({
            customer: customerWithValidation
        }), {
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('[Admin] Failed to update customer:', error);
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
 * List ALL customers from CUSTOMER_KV (admin only)
 * GET /admin/customers
 * 
 * Returns all customers including those with incomplete or faulty data
 * Each customer includes validation issues for the frontend to display
 */
export async function handleListAllCustomers(
    request: Request,
    env: Env,
    auth: AuthResult
): Promise<Response> {
    const corsHeaders = createCORSHeaders(request, {
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
    });

    try {
        const customers: CustomerWithValidation[] = [];
        const seenCustomerIds = new Set<string>();
        
        // List all customers from CUSTOMER_KV
        // Pattern: customer_{customerId} or customer_{emailHash}
        let cursor: string | undefined;
        let totalKeysScanned = 0;
        
        do {
            const listResult = await env.CUSTOMER_KV.list({ cursor, limit: 1000 });
            totalKeysScanned += listResult.keys.length;
            
            for (const key of listResult.keys) {
                // Look for customer keys
                if (key.name.startsWith('customer_')) {
                    try {
                        const customerData = await env.CUSTOMER_KV.get(key.name, { type: 'json' }) as Partial<CustomerData> | null;
                        
                        if (!customerData) {
                            // Key exists but no data - add as invalid customer
                            const extractedId = key.name.replace('customer_', '').split('_')[0];
                            if (extractedId && !seenCustomerIds.has(extractedId)) {
                                customers.push({
                                    customerId: extractedId,
                                    validationIssues: [{
                                        field: 'data',
                                        severity: 'error',
                                        message: `Customer key exists but data is null or corrupt: ${key.name}`
                                    }]
                                });
                                seenCustomerIds.add(extractedId);
                            }
                            continue;
                        }
                        
                        // Extract customerId
                        const customerId = customerData.customerId || key.name.replace('customer_', '').split('_')[0];
                        
                        // Skip duplicates (same customer can have multiple KV keys)
                        if (seenCustomerIds.has(customerId)) {
                            continue;
                        }
                        seenCustomerIds.add(customerId);
                        
                        // Validate customer data
                        const validationIssues = validateCustomerData({
                            ...customerData,
                            customerId // Ensure customerId is present
                        });
                        
                        // Add customer with validation issues
                        const customerWithValidation: CustomerWithValidation = {
                            ...customerData,
                            customerId,
                            validationIssues: validationIssues.length > 0 ? validationIssues : undefined
                        };
                        
                        customers.push(customerWithValidation);
                    } catch (error) {
                        console.error(`[Admin] Failed to parse customer key ${key.name}:`, error);
                        
                        // Add customer with parse error
                        const extractedId = key.name.replace('customer_', '').split('_')[0];
                        if (extractedId && !seenCustomerIds.has(extractedId)) {
                            customers.push({
                                customerId: extractedId,
                                validationIssues: [{
                                    field: 'data',
                                    severity: 'error',
                                    message: `Failed to parse customer data: ${error instanceof Error ? error.message : String(error)}`
                                }]
                            });
                            seenCustomerIds.add(extractedId);
                        }
                    }
                }
            }
            
            cursor = listResult.list_complete ? undefined : listResult.cursor;
        } while (cursor);
        
        console.log(`[Admin] Listed all customers:`, {
            totalKeysScanned,
            totalCustomers: customers.length,
            customersWithIssues: customers.filter(c => c.validationIssues && c.validationIssues.length > 0).length
        });
        
        // Return response - router will add integrity headers via wrapWithEncryption
        return new Response(JSON.stringify({
            customers,
            total: customers.length
        }), {
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('[Admin] Failed to list all customers:', error);
        const rfcError = createError(
            request,
            500,
            'Internal Server Error',
            env.ENVIRONMENT === 'development' ? error.message : 'Failed to list customers'
        );
        // Return error response - router will add integrity headers via wrapWithEncryption
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}
