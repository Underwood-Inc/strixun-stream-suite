/**
 * Customer API Service Client
 * 
 * Service-to-service client for making internal requests to customer-api
 * Used during OTP verification when no user JWT exists yet
 * Uses SERVICE_API_KEY for authentication instead of JWT
 */

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
 */
function getCustomerApiUrl(env: Env): string {
    if (env.CUSTOMER_API_URL) {
        return env.CUSTOMER_API_URL;
    }
    return 'https://customer.idling.app';
}

/**
 * Make service-to-service request to customer-api
 */
async function makeServiceRequest(
    method: string,
    path: string,
    body?: any,
    env?: Env
): Promise<Response> {
    const baseUrl = getCustomerApiUrl(env || {});
    const url = `${baseUrl}${path}`;
    
    if (!env?.SERVICE_API_KEY) {
        throw new Error('SERVICE_API_KEY is required for service-to-service requests');
    }
    
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'X-Service-Key': env.SERVICE_API_KEY,
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
 * Get customer by email (service-to-service)
 */
export async function getCustomerByEmailService(email: string, env: Env): Promise<CustomerData | null> {
    try {
        const encodedEmail = encodeURIComponent(email.toLowerCase().trim());
        const response = await makeServiceRequest('GET', `/customer/by-email/${encodedEmail}`, undefined, env);
        
        if (response.status === 404) {
            return null;
        }
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Failed to get customer by email' }));
            throw new Error(error.detail || `Failed to get customer by email: ${response.statusText}`);
        }
        
        // Service responses are not encrypted (no JWT)
        const data = await response.json();
        
        // Extract customer data (remove id field added by API architecture)
        const { id, ...customerData } = data;
        return customerData as CustomerData;
    } catch (error) {
        console.error('[Customer API Service Client] Error getting customer by email:', error);
        throw error;
    }
}

/**
 * Create customer (service-to-service)
 */
export async function createCustomerService(customerData: Partial<CustomerData>, env: Env): Promise<CustomerData> {
    try {
        const response = await makeServiceRequest('POST', '/customer', customerData, env);
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Failed to create customer' }));
            throw new Error(error.detail || `Failed to create customer: ${response.statusText}`);
        }
        
        // Service responses are not encrypted (no JWT)
        const data = await response.json();
        
        // Extract customer data (remove id field added by API architecture)
        const { id, ...customer } = data;
        return customer as CustomerData;
    } catch (error) {
        console.error('[Customer API Service Client] Error creating customer:', error);
        throw error;
    }
}

/**
 * Get customer by ID (service-to-service)
 */
export async function getCustomerService(customerId: string, env: Env): Promise<CustomerData | null> {
    try {
        const response = await makeServiceRequest('GET', `/customer/${customerId}`, undefined, env);
        
        if (response.status === 404) {
            return null;
        }
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Failed to get customer' }));
            throw new Error(error.detail || `Failed to get customer: ${response.statusText}`);
        }
        
        // Service responses are not encrypted (no JWT)
        const data = await response.json();
        
        // Extract customer data (remove id field added by API architecture)
        const { id, ...customerData } = data;
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
        // For service calls, we need to specify customerId in the path
        const response = await makeServiceRequest('PUT', `/customer/${customerId}`, updates, env);
        
        if (response.status === 404) {
            throw new Error('Customer not found');
        }
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Failed to update customer' }));
            throw new Error(error.detail || `Failed to update customer: ${response.statusText}`);
        }
        
        // Service responses are not encrypted (no JWT)
        const data = await response.json();
        
        // Extract customer data (remove id field added by API architecture)
        const { id, ...customer } = data;
        return customer as CustomerData;
    } catch (error) {
        console.error('[Customer API Service Client] Error updating customer:', error);
        throw error;
    }
}

