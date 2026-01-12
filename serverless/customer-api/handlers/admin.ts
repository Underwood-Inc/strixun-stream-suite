/**
 * Admin Handlers
 * Handles admin-only operations like listing all customers
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { wrapResponseWithIntegrity } from '@strixun/service-client/integrity-response';
import { createError } from '../utils/errors.js';
import { getCustomer, type CustomerData } from '../services/customer.js';

interface Env {
    CUSTOMER_KV: KVNamespace;
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    NETWORK_INTEGRITY_KEYPHRASE?: string;
    [key: string]: any;
}

interface AuthResult {
    userId: string;
    customerId: string | null;
    jwtToken?: string;
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
        
        // Create base response
        const baseResponse = new Response(JSON.stringify({
            customers,
            total: customers.length
        }), {
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
        
        // Wrap with integrity headers for service-to-service calls
        return await wrapResponseWithIntegrity(baseResponse, request, auth, env);
    } catch (error: any) {
        console.error('[Admin] Failed to list all customers:', error);
        const rfcError = createError(
            request,
            500,
            'Internal Server Error',
            env.ENVIRONMENT === 'development' ? error.message : 'Failed to list customers'
        );
        // Create base error response
        const baseErrorResponse = new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
        
        // Wrap with integrity headers for service-to-service calls
        return await wrapResponseWithIntegrity(baseErrorResponse, request, auth, env);
    }
}
