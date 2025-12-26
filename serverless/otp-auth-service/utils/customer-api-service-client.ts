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
        console.error('[Customer API Service Client] SERVICE_API_KEY is missing in environment');
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
    
    try {
        const response = await fetch(url, options);
        
        // Log request details for debugging (only in development)
        if (env?.ENVIRONMENT === 'development' || env?.ENVIRONMENT === 'dev') {
            console.log(`[Customer API Service Client] ${method} ${url} - ${response.status} ${response.statusText}`);
        }
        
        // Handle Cloudflare 530 errors (Origin is unreachable)
        if (response.status === 530) {
            console.error('[Customer API Service Client] Cloudflare 530 error - Customer API worker is unreachable:', {
                method,
                url,
                baseUrl,
                hasServiceKey: !!env?.SERVICE_API_KEY,
                status: response.status,
                statusText: response.statusText,
            });
            throw new Error(`Customer API service is unreachable (530). The customer-api worker may not be deployed or is experiencing issues. URL: ${baseUrl}`);
        }
        
        return response;
    } catch (networkError) {
        // If it's already our formatted 530 error, re-throw it
        if (networkError instanceof Error && networkError.message.includes('530')) {
            throw networkError;
        }
        
        console.error('[Customer API Service Client] Network error making request:', {
            method,
            url,
            error: networkError instanceof Error ? networkError.message : String(networkError),
            hasServiceKey: !!env?.SERVICE_API_KEY,
            baseUrl,
        });
        throw networkError;
    }
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
            let errorDetail = 'Failed to get customer by email';
            let errorBody: any = null;
            
            try {
                errorBody = await response.json();
                errorDetail = errorBody.detail || errorBody.error || errorBody.message || errorDetail;
            } catch (parseError) {
                // If JSON parsing fails, try to get text
                try {
                    const text = await response.text();
                    errorDetail = text || errorDetail;
                } catch (textError) {
                    // Ignore text parsing errors
                }
            }
            
            console.error(`[Customer API Service Client] Failed to get customer by email: ${response.status} ${response.statusText}`, {
                email: encodedEmail,
                status: response.status,
                statusText: response.statusText,
                errorBody,
                url: response.url,
            });
            
            throw new Error(errorDetail || `Failed to get customer by email: ${response.status} ${response.statusText}`);
        }
        
        // Service responses are not encrypted (no JWT)
        const data = await response.json();
        
        // Extract customer data (remove id field added by API architecture)
        const { id, ...customerData } = data;
        return customerData as CustomerData;
    } catch (error) {
        // Re-throw if it's already our formatted error
        if (error instanceof Error && error.message.includes('Failed to get customer by email')) {
            throw error;
        }
        
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
        const response = await makeServiceRequest('POST', '/customer', customerData, env);
        
        if (!response.ok) {
            let errorDetail = 'Failed to create customer';
            let errorBody: any = null;
            
            try {
                errorBody = await response.json();
                errorDetail = errorBody.detail || errorBody.error || errorBody.message || errorDetail;
            } catch (parseError) {
                // If JSON parsing fails, try to get text
                try {
                    const text = await response.text();
                    errorDetail = text || errorDetail;
                } catch (textError) {
                    // Ignore text parsing errors
                }
            }
            
            console.error(`[Customer API Service Client] Failed to create customer: ${response.status} ${response.statusText}`, {
                email: customerData.email,
                customerId: customerData.customerId,
                status: response.status,
                statusText: response.statusText,
                errorBody,
                url: response.url,
            });
            
            throw new Error(errorDetail || `Failed to create customer: ${response.status} ${response.statusText}`);
        }
        
        // Service responses are not encrypted (no JWT)
        const data = await response.json();
        
        // Extract customer data (remove id field added by API architecture)
        const { id, ...customer } = data;
        return customer as CustomerData;
    } catch (error) {
        // Re-throw if it's already our formatted error
        if (error instanceof Error && error.message.includes('Failed to create customer')) {
            throw error;
        }
        
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

