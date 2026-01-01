/**
 * Customer Lookup Utility
 * 
 * Consolidated customer API client using the API framework as source of truth
 * Supports both JWT authentication (for user requests) and service-client (for service-to-service)
 * Customer is the primary data source for all customizable user info
 */

import { createServiceClient, type ServiceClient } from '@strixun/service-client';
import { createAPIClient } from '@strixun/api-framework/client';

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
    SUPER_ADMIN_API_KEY?: string;
    NETWORK_INTEGRITY_KEYPHRASE?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

/**
 * Get the customer API base URL
 * Uses standardized port 8790 for local development
 * 
 * Priority:
 * 1. CUSTOMER_API_URL env var (if explicitly set)
 * 2. localhost:8790 if ENVIRONMENT is 'test' or 'development'
 * 3. Production default (workers.dev subdomain)
 */
function getCustomerApiUrl(env: CustomerLookupEnv): string {
    if (env.CUSTOMER_API_URL) {
        return env.CUSTOMER_API_URL;
    }
    // Auto-detect local dev: if ENVIRONMENT is 'test' or 'development', use localhost
    if (env.ENVIRONMENT === 'test' || env.ENVIRONMENT === 'development') {
        return 'http://localhost:8790'; // Local dev (customer-api runs on port 8790)
    }
    // Production default
    return 'https://strixun-customer-api.strixuns-script-suite.workers.dev';
}

/**
 * Create service client for customer API (service-to-service)
 * Uses the service-client library which provides integrity verification
 */
function createCustomerApiServiceClient(env: CustomerLookupEnv): ServiceClient {
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
 * Create API client for customer API (JWT-authenticated user requests)
 * Uses the API framework's createAPIClient
 */
function createCustomerApiJWTClient(jwtToken: string, env?: CustomerLookupEnv) {
    return createAPIClient({
        baseURL: getCustomerApiUrl(env || {}),
        defaultHeaders: {
            'Content-Type': 'application/json',
        },
        auth: {
            tokenGetter: () => jwtToken,
        },
        timeout: 30000,
        retry: {
            maxAttempts: 3,
            backoff: 'exponential',
            retryableErrors: [408, 429, 500, 502, 503, 504],
        },
    });
}

/**
 * Fetch customer by customerId from customer API (service-to-service)
 * Returns customer data including displayName
 * 
 * @param customerId - Customer ID to lookup
 * @param env - Environment variables (must include NETWORK_INTEGRITY_KEYPHRASE; SUPER_ADMIN_API_KEY is optional for internal calls)
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
        const client = createCustomerApiServiceClient(env);
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
 * Get customer by ID (JWT-authenticated user request)
 * 
 * @param customerId - Customer ID to lookup
 * @param jwtToken - JWT token for authentication
 * @param env - Environment variables
 * @returns Customer data or null if not found
 */
export async function getCustomer(
    customerId: string,
    jwtToken: string,
    env?: CustomerLookupEnv
): Promise<CustomerData | null> {
    try {
        const api = createCustomerApiJWTClient(jwtToken, env);
        const response = await api.get<any>(`/customer/${customerId}`);
        
        if (response.status === 404) {
            return null;
        }
        
        if (response.status !== 200 || !response.data) {
            const error = response.data as { detail?: string } | undefined;
            throw new Error(error?.detail || 'Failed to get customer');
        }
        
        // Extract customer data (remove id field added by API architecture)
        const { id, ...customerData } = response.data;
        return customerData as CustomerData;
    } catch (error) {
        console.error('[CustomerLookup] Error getting customer:', error);
        throw error;
    }
}

/**
 * Get customer by email (JWT-authenticated user request)
 */
export async function getCustomerByEmail(
    email: string,
    jwtToken: string,
    env?: CustomerLookupEnv
): Promise<CustomerData | null> {
    try {
        const api = createCustomerApiJWTClient(jwtToken, env);
        const encodedEmail = encodeURIComponent(email.toLowerCase().trim());
        const response = await api.get<any>(`/customer/by-email/${encodedEmail}`);
        
        if (response.status === 404) {
            return null;
        }
        
        if (response.status !== 200 || !response.data) {
            const error = response.data as { detail?: string } | undefined;
            throw new Error(error?.detail || 'Failed to get customer by email');
        }
        
        // Extract customer data (remove id field added by API architecture)
        const { id, ...customerData } = response.data;
        return customerData as CustomerData;
    } catch (error) {
        console.error('[CustomerLookup] Error getting customer by email:', error);
        throw error;
    }
}

/**
 * Get current customer (me) - JWT-authenticated user request
 */
export async function getCurrentCustomer(
    jwtToken: string,
    env?: CustomerLookupEnv
): Promise<CustomerData | null> {
    try {
        const api = createCustomerApiJWTClient(jwtToken, env);
        const response = await api.get<any>('/customer/me');
        
        if (response.status === 404) {
            return null;
        }
        
        if (response.status !== 200 || !response.data) {
            const error = response.data as { detail?: string } | undefined;
            throw new Error(error?.detail || 'Failed to get current customer');
        }
        
        // Extract customer data (remove id field added by API architecture)
        const { id, ...customerData } = response.data;
        return customerData as CustomerData;
    } catch (error) {
        console.error('[CustomerLookup] Error getting current customer:', error);
        throw error;
    }
}

/**
 * Create customer (service-to-service)
 */
export async function createCustomer(
    customerData: Partial<CustomerData>,
    env: CustomerLookupEnv
): Promise<CustomerData> {
    try {
        const client = createCustomerApiServiceClient(env);
        const response = await client.post<any>('/customer', customerData);
        
        if (response.status !== 201 && response.status !== 200 || !response.data) {
            const error = response.data as { detail?: string } | undefined;
            throw new Error(error?.detail || 'Failed to create customer');
        }
        
        // Extract customer data (remove id field added by API architecture)
        const { id, ...customer } = response.data;
        return customer as CustomerData;
    } catch (error) {
        console.error('[CustomerLookup] Error creating customer:', error);
        throw error;
    }
}

/**
 * Update customer (service-to-service)
 */
export async function updateCustomer(
    customerId: string,
    updates: Partial<CustomerData>,
    env: CustomerLookupEnv
): Promise<CustomerData> {
    try {
        const client = createCustomerApiServiceClient(env);
        const response = await client.put<any>(`/customer/${customerId}`, updates);
        
        if (response.status === 404) {
            throw new Error('Customer not found');
        }
        
        if (response.status !== 200 || !response.data) {
            const error = response.data as { detail?: string } | undefined;
            throw new Error(error?.detail || 'Failed to update customer');
        }
        
        // Extract customer data (remove id field added by API architecture)
        const { id, ...customer } = response.data;
        return customer as CustomerData;
    } catch (error) {
        console.error('[CustomerLookup] Error updating customer:', error);
        throw error;
    }
}

/**
 * Get customer by email (service-to-service)
 */
export async function getCustomerByEmailService(
    email: string,
    env: CustomerLookupEnv
): Promise<CustomerData | null> {
    try {
        const client = createCustomerApiServiceClient(env);
        const encodedEmail = encodeURIComponent(email.toLowerCase().trim());
        const response = await client.get<any>(`/customer/by-email/${encodedEmail}`);
        
        if (response.status === 404) {
            return null;
        }
        
        if (response.status !== 200 || !response.data) {
            const error = response.data as { detail?: string } | undefined;
            throw new Error(error?.detail || 'Failed to get customer by email');
        }
        
        // Extract customer data (remove id field added by API architecture)
        const { id, ...customerData } = response.data;
        return customerData as CustomerData;
    } catch (error) {
        console.error('[CustomerLookup] Error getting customer by email:', error);
        throw error;
    }
}

/**
 * Get customer service (service-to-service) - alias for fetchCustomerByCustomerId
 */
export async function getCustomerService(
    customerId: string,
    env: CustomerLookupEnv
): Promise<CustomerData | null> {
    return fetchCustomerByCustomerId(customerId, env);
}

/**
 * Fetch display name for a customer by customerId
 * This is the primary method for getting display names - customer is the source of truth
 * 
 * @param customerId - Customer ID to lookup
 * @param env - Environment variables (must include NETWORK_INTEGRITY_KEYPHRASE; SUPER_ADMIN_API_KEY is optional for internal calls)
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
