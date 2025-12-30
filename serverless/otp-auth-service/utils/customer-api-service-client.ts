/**
 * Customer API Service Client
 * 
 * Service-to-service client for making internal requests to customer-api
 * Used during OTP verification when no user JWT exists yet
 * Uses SERVICE_API_KEY for authentication instead of JWT
 * Uses the shared service-to-service client library
 */

import { createServiceClient } from '@strixun/service-client';

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
    NETWORK_INTEGRITY_KEYPHRASE?: string; // REQUIRED for network integrity verification
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
 * Create service client for service-to-service calls with SERVICE_API_KEY
 * 
 * CRITICAL: Validates required environment variables before creating client
 * Throws clear error messages if SERVICE_API_KEY or NETWORK_INTEGRITY_KEYPHRASE are missing
 */
function createServiceApiClient(env: Env) {
    // Validate required environment variables
    if (!env.SERVICE_API_KEY) {
        throw new Error(
            'SERVICE_API_KEY is required for service-to-service calls to customer-api. ' +
            'Set it via: wrangler secret put SERVICE_API_KEY'
        );
    }
    
    if (!env.NETWORK_INTEGRITY_KEYPHRASE) {
        throw new Error(
            'NETWORK_INTEGRITY_KEYPHRASE is required for service-to-service calls to customer-api. ' +
            'Set it via: wrangler secret put NETWORK_INTEGRITY_KEYPHRASE'
        );
    }
    
    // Debug logging to verify env vars are present
    console.log('[Customer API Service Client] Creating service client', {
        hasServiceApiKey: !!env.SERVICE_API_KEY,
        serviceApiKeyLength: env.SERVICE_API_KEY?.length || 0,
        hasNetworkIntegrityKeyphrase: !!env.NETWORK_INTEGRITY_KEYPHRASE,
        networkIntegrityKeyphraseLength: env.NETWORK_INTEGRITY_KEYPHRASE?.length || 0,
        customerApiUrl: getCustomerApiUrl(env),
        hasSuperAdminKey: !!env.SUPER_ADMIN_API_KEY, // Log if this exists (should not be used for service-to-service)
    });
    
    // CRITICAL: For service-to-service calls, we MUST use SERVICE_API_KEY, not SUPER_ADMIN_API_KEY
    // Create a filtered env object that only includes SERVICE_API_KEY (excludes SUPER_ADMIN_API_KEY)
    // This ensures we use X-Service-Key header instead of Authorization: Bearer header
    const serviceEnv = {
        SERVICE_API_KEY: env.SERVICE_API_KEY,
        NETWORK_INTEGRITY_KEYPHRASE: env.NETWORK_INTEGRITY_KEYPHRASE,
    };
    
    return createServiceClient(getCustomerApiUrl(env), serviceEnv, {
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
        const client = createServiceApiClient(env);
        const encodedEmail = encodeURIComponent(email.toLowerCase().trim());
        const response = await client.get<any>(`/customer/by-email/${encodedEmail}`);
        
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
        const client = createServiceApiClient(env);
        const response = await client.post<any>('/customer', customerData);
        
        // POST requests return 201 Created, not 200 OK
        if (response.status !== 201 && response.status !== 200 || !response.data) {
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
        const client = createServiceApiClient(env);
        const response = await client.get<any>(`/customer/${customerId}`);
        
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
        const client = createServiceApiClient(env);
        // For service calls, we need to specify customerId in the path
        const response = await client.put<any>(`/customer/${customerId}`, updates);
        
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

