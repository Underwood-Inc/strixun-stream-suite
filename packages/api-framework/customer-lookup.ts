/**
 * Customer Lookup Utility
 * 
 * Consolidated customer API client using the API framework as source of truth
 * Supports both JWT authentication (for customer requests) and service-client (for service-to-service)
 * Customer is the primary data source for all customizable customer info
 * 
 * This module is part of api-framework to avoid dependency cycles.
 */

import { createServiceClient, type ServiceClient } from '@strixun/service-client';
import { createAPIClient } from './src/client.js';
import { getCustomerApiUrl as getCustomerApiUrlFromUtils } from './src/utils/service-url.js';

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
    SUPER_ADMIN_EMAILS?: string;
    [key: string]: any;
}


/**
 * Create service client for customer API (service-to-service)
 * Uses the service-client library which provides integrity verification
 * 
 * NOTE: Integrity verification is disabled in test/development environments
 * because local workers may not have integrity headers configured
 */
function createCustomerApiServiceClient(env: CustomerLookupEnv): ServiceClient {
    const customerApiUrl = getCustomerApiUrlFromUtils(env);
    
    // Disable integrity verification in test/development environments
    // Local workers may not have integrity headers configured
    const isTestOrDev = env.ENVIRONMENT === 'test' || 
                       env.ENVIRONMENT === 'development' || 
                       env.ENVIRONMENT === 'dev' ||
                       customerApiUrl.includes('localhost') ||
                       customerApiUrl.includes('127.0.0.1');
    
    // Get keyphrase - required even if integrity is disabled
    const keyphrase = env.NETWORK_INTEGRITY_KEYPHRASE || 'test-integrity-keyphrase-for-local-development';
    
    return createServiceClient(customerApiUrl, env, {
        retry: {
            maxAttempts: 3,
            backoff: 'exponential',
            retryableErrors: [408, 429, 500, 502, 503, 504, 522, 530],
        },
        timeout: 3000, // Reduced timeout for faster failure if customer-api is not running
        integrity: {
            enabled: !isTestOrDev, // Disable integrity verification in test/dev
            keyphrase, // Always required by ServiceClient
            verifyResponse: !isTestOrDev, // Disable response verification in test/dev
            verifyRequest: !isTestOrDev, // Disable request verification in test/dev
            throwOnFailure: !isTestOrDev, // Don't throw on failure in test/dev
        },
    });
}

/**
 * Create API client for customer API (JWT-authenticated customer requests)
 * Uses the API framework's createAPIClient
 */
function createCustomerApiJWTClient(jwtToken: string, env: CustomerLookupEnv) {
    return createAPIClient({
        baseURL: getCustomerApiUrlFromUtils(env),
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
    env: CustomerLookupEnv
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
    env: CustomerLookupEnv
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
    env: CustomerLookupEnv
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

/**
 * Check if a customerId belongs to a super admin
 * Looks up customer by customerId, gets email from customer record, checks against SUPER_ADMIN_EMAILS
 * 
 * @param customerId - Customer ID to check
 * @param env - Environment with SUPER_ADMIN_EMAILS and customer lookup config
 * @returns true if customer email is in SUPER_ADMIN_EMAILS
 */
/**
 * Get customer roles from Access Service
 * @param customerId - Customer ID
 * @param env - Environment with ACCESS_SERVICE_URL and SERVICE_API_KEY
 * @returns Array of role names
 */
export async function getCustomerRoles(
    customerId: string | null,
    env: CustomerLookupEnv & { ACCESS_SERVICE_URL?: string; SERVICE_API_KEY?: string }
): Promise<string[]> {
    if (!customerId) return [];
    
    try {
        // Call Access Service directly to get customer roles
        const accessServiceUrl = env.ACCESS_SERVICE_URL || 'http://localhost:8791';
        const url = `${accessServiceUrl}/access/${customerId}`;
        
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        
        // Use service API key for service-to-service calls
        if (env.SERVICE_API_KEY) {
            headers['X-Service-Key'] = env.SERVICE_API_KEY;
        }
        
        const response = await fetch(url, {
            method: 'GET',
            headers,
        });
        
        if (!response.ok) {
            // If 404, customer has no roles
            if (response.status === 404) {
                return [];
            }
            console.error('[CustomerLookup] Access Service error:', response.status, response.statusText);
            return [];
        }
        
        const data = await response.json() as { roles?: string[] };
        return data.roles || [];
    } catch (error) {
        console.error('[CustomerLookup] Error getting customer roles:', error);
        return [];
    }
}

export async function isSuperAdminByCustomerId(
    customerId: string | null,
    env: CustomerLookupEnv & { ACCESS_SERVICE_URL?: string; SERVICE_API_KEY?: string }
): Promise<boolean> {
    if (!customerId) return false;
    
    try {
        // Call Access Service directly to check for super-admin role
        const accessServiceUrl = env.ACCESS_SERVICE_URL || 'http://localhost:8791';
        const url = `${accessServiceUrl}/access/${customerId}`;
        
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        
        // Use service API key for service-to-service calls
        if (env.SERVICE_API_KEY) {
            headers['X-Service-Key'] = env.SERVICE_API_KEY;
        }
        
        const response = await fetch(url, {
            method: 'GET',
            headers,
        });
        
        if (!response.ok) {
            // If 404, customer has no roles (not super-admin)
            if (response.status === 404) {
                return false;
            }
            console.error('[CustomerLookup] Access Service error:', response.status, response.statusText);
            return false;
        }
        
        const data = await response.json() as { roles?: string[] };
        return data.roles?.includes('super-admin') || false;
    } catch (error) {
        console.error('[CustomerLookup] Error checking super admin by customerId:', error);
        return false;
    }
}
