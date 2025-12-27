/**
 * Customer API Client
 * 
 * Client utility for making requests to the customer-api worker
 * Replaces direct KV access with HTTP API calls for decoupled architecture
 * Uses the shared API framework for HTTPS enforcement, retry, encryption, etc.
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
    CUSTOMER_API_URL?: string; // Optional override (defaults to https://customer-api.idling.app)
    JWT_SECRET?: string;
    [key: string]: any;
}

/**
 * Get the customer API base URL
 */
function getCustomerApiUrl(env: Env): string {
    // Allow override via environment variable (useful for local dev)
    if (env.CUSTOMER_API_URL) {
        return env.CUSTOMER_API_URL;
    }
    // Default to production URL
    return 'https://customer-api.idling.app';
}

/**
 * Create API client for customer-api with JWT token
 */
function createCustomerApiClient(jwtToken: string, env?: Env) {
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
 * Get customer by ID
 */
export async function getCustomer(customerId: string, jwtToken: string, env?: Env): Promise<CustomerData | null> {
    try {
        const api = createCustomerApiClient(jwtToken, env);
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
        console.error('[Customer API Client] Error getting customer:', error);
        throw error;
    }
}

/**
 * Get customer by email
 */
export async function getCustomerByEmail(email: string, jwtToken: string, env?: Env): Promise<CustomerData | null> {
    try {
        const api = createCustomerApiClient(jwtToken, env);
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
        console.error('[Customer API Client] Error getting customer by email:', error);
        throw error;
    }
}

/**
 * Create customer
 */
export async function createCustomer(customerData: Partial<CustomerData>, jwtToken: string, env?: Env): Promise<CustomerData> {
    try {
        const api = createCustomerApiClient(jwtToken, env);
        const response = await api.post<any>('/customer', customerData);
        
        if (response.status !== 200 || !response.data) {
            const error = response.data as { detail?: string } | undefined;
            throw new Error(error?.detail || 'Failed to create customer');
        }
        
        // Extract customer data (remove id field added by API architecture)
        const { id, ...customer } = response.data;
        return customer as CustomerData;
    } catch (error) {
        console.error('[Customer API Client] Error creating customer:', error);
        throw error;
    }
}

/**
 * Update customer
 */
export async function updateCustomer(customerId: string, updates: Partial<CustomerData>, jwtToken: string, env?: Env): Promise<CustomerData> {
    try {
        const api = createCustomerApiClient(jwtToken, env);
        const response = await api.put<any>('/customer/me', updates);
        
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
        console.error('[Customer API Client] Error updating customer:', error);
        throw error;
    }
}

/**
 * Get current customer (me)
 */
export async function getCurrentCustomer(jwtToken: string, env?: Env): Promise<CustomerData | null> {
    try {
        const api = createCustomerApiClient(jwtToken, env);
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
        console.error('[Customer API Client] Error getting current customer:', error);
        throw error;
    }
}

