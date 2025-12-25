/**
 * Customer API Client
 * 
 * Client utility for making requests to the customer-api worker
 * Replaces direct KV access with HTTP API calls for decoupled architecture
 */

import { decryptWithJWT } from './jwt-encryption.js';

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
    CUSTOMER_API_URL?: string; // Optional override (defaults to https://customer.idling.app)
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
    return 'https://customer.idling.app';
}

/**
 * Make authenticated request to customer-api
 */
async function makeCustomerApiRequest(
    method: string,
    path: string,
    jwtToken: string,
    body?: any,
    env?: Env
): Promise<Response> {
    const baseUrl = getCustomerApiUrl(env || {});
    const url = `${baseUrl}${path}`;
    
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`,
    };
    
    const options: RequestInit = {
        method,
        headers,
    };
    
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(body);
    }
    
    return fetch(url, options);
}

/**
 * Decrypt response from customer-api (if encrypted)
 */
async function decryptResponse(response: Response, jwtToken: string): Promise<any> {
    const isEncrypted = response.headers.get('X-Encrypted') === 'true';
    
    if (!isEncrypted) {
        return await response.json();
    }
    
    // Response is encrypted, decrypt it
    const encryptedData = await response.json();
    return await decryptWithJWT(encryptedData, jwtToken);
}

/**
 * Get customer by ID
 */
export async function getCustomer(customerId: string, jwtToken: string, env?: Env): Promise<CustomerData | null> {
    try {
        const response = await makeCustomerApiRequest('GET', `/customer/${customerId}`, jwtToken, undefined, env);
        
        if (response.status === 404) {
            return null;
        }
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Failed to get customer' }));
            throw new Error(error.detail || `Failed to get customer: ${response.statusText}`);
        }
        
        const data = await decryptResponse(response, jwtToken);
        
        // Extract customer data (remove id field added by API architecture)
        const { id, ...customerData } = data;
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
        const encodedEmail = encodeURIComponent(email.toLowerCase().trim());
        const response = await makeCustomerApiRequest('GET', `/customer/by-email/${encodedEmail}`, jwtToken, undefined, env);
        
        if (response.status === 404) {
            return null;
        }
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Failed to get customer by email' }));
            throw new Error(error.detail || `Failed to get customer by email: ${response.statusText}`);
        }
        
        const data = await decryptResponse(response, jwtToken);
        
        // Extract customer data (remove id field added by API architecture)
        const { id, ...customerData } = data;
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
        const response = await makeCustomerApiRequest('POST', '/customer', jwtToken, customerData, env);
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Failed to create customer' }));
            throw new Error(error.detail || `Failed to create customer: ${response.statusText}`);
        }
        
        const data = await decryptResponse(response, jwtToken);
        
        // Extract customer data (remove id field added by API architecture)
        const { id, ...customer } = data;
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
        const response = await makeCustomerApiRequest('PUT', '/customer/me', jwtToken, updates, env);
        
        if (response.status === 404) {
            throw new Error('Customer not found');
        }
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Failed to update customer' }));
            throw new Error(error.detail || `Failed to update customer: ${response.statusText}`);
        }
        
        const data = await decryptResponse(response, jwtToken);
        
        // Extract customer data (remove id field added by API architecture)
        const { id, ...customer } = data;
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
        const response = await makeCustomerApiRequest('GET', '/customer/me', jwtToken, undefined, env);
        
        if (response.status === 404) {
            return null;
        }
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Failed to get current customer' }));
            throw new Error(error.detail || `Failed to get current customer: ${response.statusText}`);
        }
        
        const data = await decryptResponse(response, jwtToken);
        
        // Extract customer data (remove id field added by API architecture)
        const { id, ...customerData } = data;
        return customerData as CustomerData;
    } catch (error) {
        console.error('[Customer API Client] Error getting current customer:', error);
        throw error;
    }
}

