/**
 * Service-to-Service Client Library
 * 
 * Reusable, agnostic library for making authenticated service-to-service API calls
 * Supports multiple authentication methods:
 * - SUPER_ADMIN_API_KEY: For admin/system-wide operations
 * - SERVICE_API_KEY: For general service-to-service calls
 * 
 * Features:
 * - Automatic authentication header injection
 * - Cache prevention (no-store for all service calls)
 * - Error handling and retry logic
 * - Type-safe request/response handling
 * - Configurable timeouts and retries
 * - Network traffic integrity verification (HMAC-SHA256 signatures)
 * - Automatic tamper detection on all requests/responses
 */

export interface ServiceClientConfig {
    /**
     * Base URL of the target service
     */
    baseURL: string;
    
    /**
     * Authentication method and key
     */
    auth: {
        /**
         * Use SUPER_ADMIN_API_KEY for admin/system-wide operations
         * This authenticates as a super-admin with system-wide access
         */
        superAdminKey?: string;
        
        /**
         * Use SERVICE_API_KEY for general service-to-service calls
         * This authenticates as a service (not a user)
         */
        serviceKey?: string;
        
        /**
         * Custom header name for service key (default: 'X-Service-Key')
         */
        serviceKeyHeader?: string;
    };
    
    /**
     * Request timeout in milliseconds (default: 30000)
     */
    timeout?: number;
    
    /**
     * Retry configuration
     */
    retry?: {
        maxAttempts?: number;
        backoff?: 'exponential' | 'linear' | 'fixed';
        retryableErrors?: number[];
    };
    
    /**
     * Additional default headers
     */
    defaultHeaders?: Record<string, string>;
    
    /**
     * Network integrity configuration
     * Integrity checks are ALWAYS enabled - this is a security feature baked into the library
     */
    integrity?: {
        /**
         * Secret keyphrase for HMAC signing (from NETWORK_INTEGRITY_KEYPHRASE env var)
         * If not provided, will use NETWORK_INTEGRITY_KEYPHRASE from environment
         * Falls back to dev keyphrase if not set (development only)
         */
        keyphrase?: string;
        
        /**
         * Throw error on integrity failure (default: true)
         */
        throwOnFailure?: boolean;
    };
}

export interface ServiceRequestOptions {
    /**
     * Request method
     */
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    
    /**
     * Request body (will be JSON stringified)
     */
    body?: any;
    
    /**
     * Query parameters
     */
    params?: Record<string, string | number | boolean | null | undefined>;
    
    /**
     * Additional headers for this request
     */
    headers?: Record<string, string>;
    
    /**
     * Override timeout for this request
     */
    timeout?: number;
}

export interface ServiceResponse<T = any> {
    status: number;
    statusText: string;
    data: T;
    headers: Headers;
}

export class ServiceClient {
    private config: Required<ServiceClientConfig>;
    private integrityKeyphrase: string;
    
    constructor(config: ServiceClientConfig) {
        // Validate auth config
        if (!config.auth.superAdminKey && !config.auth.serviceKey) {
            throw new Error('ServiceClient: Either superAdminKey or serviceKey must be provided');
        }
        
        if (config.auth.superAdminKey && config.auth.serviceKey) {
            throw new Error('ServiceClient: Cannot use both superAdminKey and serviceKey. Use one or the other.');
        }
        
        // Get integrity keyphrase - always required (baked-in security feature)
        // Priority: config > env var > dev fallback
        this.integrityKeyphrase = config.integrity?.keyphrase || 
            (typeof process !== 'undefined' ? process.env?.NETWORK_INTEGRITY_KEYPHRASE : undefined) ||
            'strixun:network-integrity:dev-fallback';
        
        if (this.integrityKeyphrase === 'strixun:network-integrity:dev-fallback') {
            console.warn('[ServiceClient] Using dev fallback for NETWORK_INTEGRITY_KEYPHRASE - set NETWORK_INTEGRITY_KEYPHRASE in production!');
        }
        
        // Set defaults
        this.config = {
            baseURL: config.baseURL,
            auth: {
                superAdminKey: config.auth.superAdminKey,
                serviceKey: config.auth.serviceKey,
                serviceKeyHeader: config.auth.serviceKeyHeader || 'X-Service-Key',
            },
            timeout: config.timeout || 30000,
            retry: {
                maxAttempts: config.retry?.maxAttempts || 3,
                backoff: config.retry?.backoff || 'exponential',
                retryableErrors: config.retry?.retryableErrors || [408, 429, 500, 502, 503, 504, 530],
            },
            defaultHeaders: {
                'Content-Type': 'application/json',
                ...config.defaultHeaders,
            },
            integrity: {
                keyphrase: this.integrityKeyphrase,
                throwOnFailure: config.integrity?.throwOnFailure !== false,
            },
        };
    }
    
    /**
     * Get authentication header value
     */
    private getAuthHeader(): string {
        if (this.config.auth.superAdminKey) {
            return `Bearer ${this.config.auth.superAdminKey}`;
        }
        if (this.config.auth.serviceKey) {
            return this.config.auth.serviceKey;
        }
        throw new Error('ServiceClient: No authentication key configured');
    }
    
    /**
     * Get authentication header name
     */
    private getAuthHeaderName(): string {
        if (this.config.auth.superAdminKey) {
            return 'Authorization';
        }
        if (this.config.auth.serviceKey) {
            return this.config.auth.serviceKeyHeader;
        }
        throw new Error('ServiceClient: No authentication key configured');
    }
    
    /**
     * Build URL with query parameters
     */
    private buildURL(path: string, params?: Record<string, string | number | boolean | null | undefined>): string {
        const url = new URL(path, this.config.baseURL);
        
        if (params) {
            for (const [key, value] of Object.entries(params)) {
                if (value !== null && value !== undefined) {
                    url.searchParams.append(key, String(value));
                }
            }
        }
        
        return url.toString();
    }
    
    /**
     * Calculate retry delay
     */
    private getRetryDelay(attempt: number): number {
        const { backoff } = this.config.retry;
        
        switch (backoff) {
            case 'exponential':
                return Math.min(1000 * Math.pow(2, attempt), 10000);
            case 'linear':
                return 1000 * (attempt + 1);
            case 'fixed':
                return 1000;
            default:
                return 1000;
        }
    }
    
    /**
     * Make a service-to-service request with retry logic
     */
    async request<T = any>(
        path: string,
        options: ServiceRequestOptions = {}
    ): Promise<ServiceResponse<T>> {
        const method = options.method || 'GET';
        const timeout = options.timeout || this.config.timeout;
        const maxAttempts = this.config.retry.maxAttempts;
        
        let lastError: Error | null = null;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const url = this.buildURL(path, options.params);
                const headers = new Headers(this.config.defaultHeaders);
                
                // Add authentication header
                headers.set(this.getAuthHeaderName(), this.getAuthHeader());
                
                // Add custom headers
                if (options.headers) {
                    for (const [key, value] of Object.entries(options.headers)) {
                        headers.set(key, value);
                    }
                }
                
                // Prepare body for integrity calculation
                let requestBody: string | ArrayBuffer | null = null;
                if (options.body !== undefined) {
                    if (typeof options.body === 'string') {
                        requestBody = options.body;
                    } else {
                        requestBody = JSON.stringify(options.body);
                    }
                }
                
                // Add network integrity headers (baked-in security feature)
                const urlObj = new URL(path, this.config.baseURL);
                const pathWithQuery = urlObj.pathname + urlObj.search;
                await this.addRequestIntegrityHeaders(method, pathWithQuery, requestBody, headers);
                
                // Build request
                const requestInit: RequestInit = {
                    method,
                    headers,
                    // CRITICAL: Prevent caching of service-to-service API calls
                    // Even server-side calls should not be cached to ensure fresh data
                    cache: 'no-store',
                };
                
                // Add body if present
                if (requestBody !== null) {
                    requestInit.body = requestBody;
                }
                
                // Make request with timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);
                
                try {
                    const response = await fetch(url, {
                        ...requestInit,
                        signal: controller.signal,
                    });
                    
                    clearTimeout(timeoutId);
                    
                    // Get response body text for integrity verification
                    const responseText = await response.text();
                    
                    // Verify response integrity (baked-in security feature)
                    const verification = await this.verifyResponseIntegrity(
                        response.status,
                        responseText,
                        response.headers
                    );
                    
                    if (!verification.verified) {
                        if (this.config.integrity.throwOnFailure) {
                            throw new Error(`[NetworkIntegrity] ${verification.error || 'Response integrity verification failed'}`);
                        } else {
                            console.warn(`[NetworkIntegrity] ${verification.error || 'Response integrity verification failed'}`);
                        }
                    }
                    
                    // Parse response
                    let data: T;
                    const contentType = response.headers.get('content-type');
                    
                    if (contentType?.includes('application/json')) {
                        try {
                            data = JSON.parse(responseText) as T;
                        } catch (parseError) {
                            throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}. Response: ${responseText.substring(0, 500)}`);
                        }
                    } else {
                        data = responseText as unknown as T;
                    }
                    
                    // Check if we should retry
                    if (!response.ok && this.config.retry.retryableErrors.includes(response.status)) {
                        if (attempt < maxAttempts - 1) {
                            const delay = this.getRetryDelay(attempt);
                            await new Promise(resolve => setTimeout(resolve, delay));
                            lastError = new Error(`Request failed with status ${response.status}: ${JSON.stringify(data).substring(0, 200)}`);
                            continue;
                        }
                    }
                    
                    return {
                        status: response.status,
                        statusText: response.statusText,
                        data,
                        headers: response.headers,
                    };
                } catch (fetchError) {
                    clearTimeout(timeoutId);
                    
                    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                        throw new Error(`Request timeout after ${timeout}ms`);
                    }
                    
                    throw fetchError;
                }
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                
                // Retry on network errors
                if (attempt < maxAttempts - 1) {
                    const delay = this.getRetryDelay(attempt);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                
                throw lastError;
            }
        }
        
        throw lastError || new Error('Request failed after all retry attempts');
    }
    
    /**
     * GET request
     */
    async get<T = any>(path: string, options?: Omit<ServiceRequestOptions, 'method' | 'body'>): Promise<ServiceResponse<T>> {
        return this.request<T>(path, { ...options, method: 'GET' });
    }
    
    /**
     * POST request
     */
    async post<T = any>(path: string, body?: any, options?: Omit<ServiceRequestOptions, 'method' | 'body'>): Promise<ServiceResponse<T>> {
        return this.request<T>(path, { ...options, method: 'POST', body });
    }
    
    /**
     * PUT request
     */
    async put<T = any>(path: string, body?: any, options?: Omit<ServiceRequestOptions, 'method' | 'body'>): Promise<ServiceResponse<T>> {
        return this.request<T>(path, { ...options, method: 'PUT', body });
    }
    
    /**
     * PATCH request
     */
    async patch<T = any>(path: string, body?: any, options?: Omit<ServiceRequestOptions, 'method' | 'body'>): Promise<ServiceResponse<T>> {
        return this.request<T>(path, { ...options, method: 'PATCH', body });
    }
    
    /**
     * DELETE request
     */
    async delete<T = any>(path: string, options?: Omit<ServiceRequestOptions, 'method' | 'body'>): Promise<ServiceResponse<T>> {
        return this.request<T>(path, { ...options, method: 'DELETE' });
    }
    
    /**
     * Add request integrity headers (baked-in security feature)
     */
    private async addRequestIntegrityHeaders(
        method: string,
        path: string,
        body: string | ArrayBuffer | null,
        headers: Headers
    ): Promise<void> {
        const { addRequestIntegrityHeaders } = await import('./integrity.js');
        await addRequestIntegrityHeaders(method, path, body, headers, this.integrityKeyphrase);
    }
    
    /**
     * Verify response integrity (baked-in security feature)
     */
    private async verifyResponseIntegrity(
        status: number,
        body: string | ArrayBuffer,
        responseHeaders: Headers
    ): Promise<{ verified: boolean; error?: string }> {
        const { verifyResponseIntegrityFromHeaders } = await import('./integrity.js');
        return verifyResponseIntegrityFromHeaders(status, body, responseHeaders, this.integrityKeyphrase);
    }
}

/**
 * Create a service client from environment variables
 * Automatically detects which auth method to use based on available env vars
 * Network integrity checks are automatically enabled (baked-in security feature)
 */
export function createServiceClient(
    baseURL: string,
    env: {
        SUPER_ADMIN_API_KEY?: string;
        SERVICE_API_KEY?: string;
        NETWORK_INTEGRITY_KEYPHRASE?: string;
        [key: string]: any;
    },
    config?: Partial<ServiceClientConfig>
): ServiceClient {
    const auth: ServiceClientConfig['auth'] = {};
    
    if (env.SUPER_ADMIN_API_KEY) {
        auth.superAdminKey = env.SUPER_ADMIN_API_KEY;
    } else if (env.SERVICE_API_KEY) {
        auth.serviceKey = env.SERVICE_API_KEY;
    } else {
        throw new Error('ServiceClient: Either SUPER_ADMIN_API_KEY or SERVICE_API_KEY must be set in environment');
    }
    
    return new ServiceClient({
        baseURL,
        auth,
        integrity: {
            keyphrase: env.NETWORK_INTEGRITY_KEYPHRASE,
            ...config?.integrity,
        },
        ...config,
    });
}

