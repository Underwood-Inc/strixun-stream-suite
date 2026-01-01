/**
 * Customer Lookup Utility
 * 
 * Shared utility for fetching customer data by customerId across all projects
 * Uses the service-client library for proper service-to-service communication
 * Customer is the primary data source for all customizable user info
 */

import { createServiceClient, type ServiceClient } from '@strixun/service-client';

/**
 * Customer data structure
 */
export interface CustomerData {
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
    displayName?: string; // Primary source for display name
    config?: any;
    features?: any;
    [key: string]: any;
}

/**
 * Environment interface for customer lookup
 */
export interface CustomerLookupEnv {
    CUSTOMER_API_URL?: string;
    SERVICE_API_KEY?: string;
    SUPER_ADMIN_API_KEY?: string;
    NETWORK_INTEGRITY_KEYPHRASE?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

/**
 * Get the customer API base URL
 */
function getCustomerApiUrl(env: CustomerLookupEnv): string {
    if (env.CUSTOMER_API_URL) {
        return env.CUSTOMER_API_URL;
    }
    // Default to workers.dev subdomain
    if (env.ENVIRONMENT === 'test' || env.ENVIRONMENT === 'development') {
        return 'http://localhost:8788'; // Local dev
    }
    return 'https://strixun-customer-api.strixuns-script-suite.workers.dev';
}

/**
 * Create service client for customer API
 */
function createCustomerApiClient(env: CustomerLookupEnv): ServiceClient {
    const customerApiUrl = getCustomerApiUrl(env);
    
    return createServiceClient(customerApiUrl, env, {
        retry: {
            maxAttempts: 3,
            backoff: 'exponential',
            retryableErrors: [408, 429, 500, 502, 503, 504, 522, 530],
        },
        timeout: 10000,
    });
}

/**
 * Fetch customer by customerId from customer API
 * Returns customer data including displayName
 * 
 * @param customerId - Customer ID to lookup
 * @param env - Environment variables (must include SERVICE_API_KEY or SUPER_ADMIN_API_KEY and NETWORK_INTEGRITY_KEYPHRASE)
 * @returns Customer data or null if not found
 */
export async function fetchCustomerByCustomerId(
    customerId: string,
    env: CustomerLookupEnv
): Promise<CustomerData | null> {
    if (!customerId) {
        console.warn('[CustomerLookup] Empty customerId provided');
        return null;
    }
    
    try {
        const client = createCustomerApiClient(env);
        const response = await client.get<any>(`/customer/${customerId}`);
        
        if (response.status === 404) {
            console.warn('[CustomerLookup] Customer not found (404):', { customerId });
            return null;
        }
        
        if (response.status !== 200 || !response.data) {
            const error = response.data as { detail?: string } | undefined;
            console.error('[CustomerLookup] Failed to get customer:', {
                customerId,
                status: response.status,
                error: error?.detail || 'Unknown error',
            });
            return null;
        }
        
        // Extract customer data (remove id field added by API architecture)
        const { id, ...customerData } = response.data;
        const customer = customerData as CustomerData;
        const displayName = customer.displayName || null;
        
        console.log('[CustomerLookup] Found customer:', {
            customerId,
            displayName,
            hasDisplayName: !!displayName,
        });
        
        return customer;
    } catch (error) {
        console.error('[CustomerLookup] Error fetching customer:', {
            customerId,
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

/**
 * Fetch display name for a customer by customerId
 * This is the primary method for getting display names - customer is the source of truth
 * 
 * @param customerId - Customer ID to lookup
 * @param env - Environment variables (must include SERVICE_API_KEY or SUPER_ADMIN_API_KEY and NETWORK_INTEGRITY_KEYPHRASE)
 * @returns Display name or null if not found
 */
export async function fetchDisplayNameByCustomerId(
    customerId: string,
    env: CustomerLookupEnv
): Promise<string | null> {
    if (!customerId) {
        console.warn('[CustomerLookup] Empty customerId provided for display name lookup');
        return null;
    }
    
    const customer = await fetchCustomerByCustomerId(customerId, env);
    return customer?.displayName || null;
}

/**
 * Fetch multiple customers by their customerIds
 * Returns a map of customerId -> CustomerData
 * 
 * @param customerIds - Array of customer IDs to lookup
 * @param env - Environment variables
 * @returns Map of customerId -> CustomerData
 */
export async function fetchCustomersByCustomerIds(
    customerIds: string[],
    env: CustomerLookupEnv
): Promise<Map<string, CustomerData | null>> {
    const customers = new Map<string, CustomerData | null>();
    
    // Fetch all customers in parallel
    const promises = customerIds.map(async (customerId) => {
        const customer = await fetchCustomerByCustomerId(customerId, env);
        return { customerId, customer };
    });
    
    const results = await Promise.all(promises);
    results.forEach(({ customerId, customer }) => {
        customers.set(customerId, customer);
    });
    
    return customers;
}

/**
 * Fetch display names for multiple customers
 * Returns a map of customerId -> displayName
 * 
 * @param customerIds - Array of customer IDs to lookup
 * @param env - Environment variables
 * @returns Map of customerId -> displayName
 */
export async function fetchDisplayNamesByCustomerIds(
    customerIds: string[],
    env: CustomerLookupEnv
): Promise<Map<string, string | null>> {
    const displayNames = new Map<string, string | null>();
    
    // Fetch all customers in parallel
    const customers = await fetchCustomersByCustomerIds(customerIds, env);
    
    customers.forEach((customer, customerId) => {
        displayNames.set(customerId, customer?.displayName || null);
    });
    
    return displayNames;
}
