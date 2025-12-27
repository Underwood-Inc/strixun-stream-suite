/**
 * Customer API Service Client
 * 
 * Service-to-service client for making internal requests to customer-api
 * Used during OTP verification when no user JWT exists yet
 * Uses SERVICE_API_KEY for authentication instead of JWT
 * Uses the shared API framework for HTTPS enforcement, retry, etc.
 */

import { createAPIClient } from '@strixun/api-framework/client';

interface CustomerData {
    customerId: string;
    name?: string;
    email?: string;
    companyName?: string;
    plan?: string;
    tier?: string;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
    subscriptions?: any[];
    flairs?: any[];
    displayName?: string;
    config?: any;
    features?: any;
    [key: string]: any;
}

interface Env {
    CUSTOMER_API_URL?: string;
    SERVICE_API_KEY?: string; // Service-to-service API key
    [key: string]: any;
}

/**
 * Get the customer API base URL
 * Priority:
 * 1. CUSTOMER_API_URL environment variable (if set)
 * 2. Custom domain (customer-api.idling.app) - if configured
 * 3. Workers.dev subdomain (always works) - fallback
 */
function getCustomerApiUrl(env: Env): string {
    if (env.CUSTOMER_API_URL) {
        return env.CUSTOMER_API_URL;
    }
    // Default to workers.dev subdomain (always works, no DNS setup needed)
    // Custom domain can be configured later via CUSTOMER_API_URL env var
    return 'https://strixun-customer-api.strixuns-script-suite.workers.dev';
}

/**
 * Create API client for service-to-service calls with SERVICE_API_KEY
 */
function createServiceApiClient(env: Env) {
    if (!env.SERVICE_API_KEY) {
        console.error('[Customer API Service Client] SERVICE_API_KEY is missing in environment');
        throw new Error('SERVICE_API_KEY is required for service-to-service requests');
    }
    
    return createAPIClient({
        baseURL: getCustomerApiUrl(env),
        defaultHeaders: {
            'Content-Type': 'application/json',
            'X-Service-Key': env.SERVICE_API_KEY,
        },
        timeout: 30000,
        retry: {
            maxAttempts: 3,
            backoff: 'exponential',
            retryableErrors: [408, 429, 500, 502, 503, 504, 530],
        },
    });
}

/**
 * Get customer by email (service-to-service)
 */
export async function getCustomerByEmailService(email: string, env: Env): Promise<CustomerData | null> {
    try {
        const api = createServiceApiClient(env);
        const encodedEmail = encodeURIComponent(email.toLowerCase().trim());
        const response = await api.get<any>(`/customer/by-email/${encodedEmail}`);
        
        if (response.status === 404) {
            return null;
        }
        
        if (response.status !== 200 || !response.data) {
            const error = response.data as { detail?: string; error?: string; message?: string } | undefined;
            const errorDetail = error?.detail || error?.error || error?.message || 'Failed to get customer by email';
            
            console.error(`[Customer API Service Client] Failed to get customer by email: ${response.status}`, {
                email: encodedEmail,
                status: response.status,
                error,
            });
            
            throw new Error(errorDetail);
        }
        
        // Service responses are not encrypted (no JWT)
        // Extract customer data (remove id field added by API architecture)
        const { id, ...customerData } = response.data;
        return customerData as CustomerData;
    } catch (error) {
        // Log and re-throw network/other errors
        console.error('[Customer API Service Client] Error getting customer by email:', {
            email,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
    }
}

/**
 * Create customer (service-to-service)
 */
export async function createCustomerService(customerData: Partial<CustomerData>, env: Env): Promise<CustomerData> {
    try {
        const api = createServiceApiClient(env);
        const response = await api.post<any>('/customer', customerData);
        
        if (response.status !== 200 || !response.data) {
            const error = response.data as { detail?: string; error?: string; message?: string } | undefined;
            const errorDetail = error?.detail || error?.error || error?.message || 'Failed to create customer';
            
            console.error(`[Customer API Service Client] Failed to create customer: ${response.status}`, {
                email: customerData.email,
                customerId: customerData.customerId,
                status: response.status,
                error,
            });
            
            throw new Error(errorDetail);
        }
        
        // Service responses are not encrypted (no JWT)
        // Extract customer data (remove id field added by API architecture)
        const { id, ...customer } = response.data;
        return customer as CustomerData;
    } catch (error) {
        // Log and re-throw network/other errors
        console.error('[Customer API Service Client] Error creating customer:', {
            email: customerData.email,
            customerId: customerData.customerId,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        throw error;
    }
}

/**
 * Get customer by ID (service-to-service)
 */
export async function getCustomerService(customerId: string, env: Env): Promise<CustomerData | null> {
    try {
        const api = createServiceApiClient(env);
        const response = await api.get<any>(`/customer/${customerId}`);
        
        if (response.status === 404) {
            return null;
        }
        
        if (response.status !== 200 || !response.data) {
            const error = response.data as { detail?: string } | undefined;
            throw new Error(error?.detail || 'Failed to get customer');
        }
        
        // Service responses are not encrypted (no JWT)
        // Extract customer data (remove id field added by API architecture)
        const { id, ...customerData } = response.data;
        return customerData as CustomerData;
    } catch (error) {
        console.error('[Customer API Service Client] Error getting customer:', error);
        throw error;
    }
}

/**
 * Update customer (service-to-service)
 */
export async function updateCustomerService(customerId: string, updates: Partial<CustomerData>, env: Env): Promise<CustomerData> {
    try {
        const api = createServiceApiClient(env);
        // For service calls, we need to specify customerId in the path
        const response = await api.put<any>(`/customer/${customerId}`, updates);
        
        if (response.status === 404) {
            throw new Error('Customer not found');
        }
        
        if (response.status !== 200 || !response.data) {
            const error = response.data as { detail?: string } | undefined;
            throw new Error(error?.detail || 'Failed to update customer');
        }
        
        // Service responses are not encrypted (no JWT)
        // Extract customer data (remove id field added by API architecture)
        const { id, ...customer } = response.data;
        return customer as CustomerData;
    } catch (error) {
        console.error('[Customer API Service Client] Error updating customer:', error);
        throw error;
    }
}

