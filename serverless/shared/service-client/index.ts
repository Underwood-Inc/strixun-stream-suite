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
 */

import type { IntegrityConfig } from './integrity.js';

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
     * Network integrity configuration (REQUIRED for security)
     */
    integrity: IntegrityConfig;
    
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

interface InternalServiceClientConfig {
    baseURL: string;
    auth: {
        superAdminKey?: string;
        serviceKey?: string;
        serviceKeyHeader: string;
    };
    integrity: {
        enabled: boolean;
        keyphrase: string;
        verifyResponse: boolean;
        verifyRequest: boolean;
        throwOnFailure: boolean;
    };
    timeout: number;
    retry: {
        maxAttempts: number;
        backoff: 'exponential' | 'linear' | 'fixed';
        retryableErrors: number[];
    };
    defaultHeaders: Record<string, string>;
}

export class ServiceClient {
    private config: InternalServiceClientConfig;
    private integrityKeyphrase: string;
    
    constructor(config: ServiceClientConfig) {
        // Validate auth config
        if (!config.auth.superAdminKey && !config.auth.serviceKey) {
            throw new Error('ServiceClient: Either superAdminKey or serviceKey must be provided');
        }
        
        if (config.auth.superAdminKey && config.auth.serviceKey) {
            throw new Error('ServiceClient: Cannot use both superAdminKey and serviceKey. Use one or the other.');
        }
        
        // Validate integrity config
        if (!config.integrity) {
            throw new Error('ServiceClient: integrity configuration is REQUIRED for security');
        }
        
        if (!config.integrity.keyphrase) {
            throw new Error('ServiceClient: integrity.keyphrase is REQUIRED for security');
        }
        
        // Store integrity keyphrase
        this.integrityKeyphrase = config.integrity.keyphrase;
        
        // Set defaults with integrity enforced
        this.config = {
            baseURL: config.baseURL,
            auth: {
                superAdminKey: config.auth.superAdminKey,
                serviceKey: config.auth.serviceKey,
                serviceKeyHeader: config.auth.serviceKeyHeader || 'X-Service-Key',
            },
            integrity: {
                enabled: config.integrity.enabled !== false, // Default to true
                keyphrase: config.integrity.keyphrase,
                verifyResponse: config.integrity.verifyResponse !== false, // Default to true
                verifyRequest: config.integrity.verifyRequest !== false, // Default to true
                throwOnFailure: config.integrity.throwOnFailure !== false, // Default to true - ENFORCE SECURITY
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
                const authHeaderName = this.getAuthHeaderName();
                const authHeaderValue = this.getAuthHeader();
                console.log('[ServiceClient] Setting auth header', {
                    authHeaderName,
                    authHeaderValueLength: authHeaderValue.length,
                    authHeaderValuePreview: authHeaderValue.substring(0, 8) + '...',
                    hasSuperAdminKey: !!this.config.auth.superAdminKey,
                    hasServiceKey: !!this.config.auth.serviceKey,
                    serviceKeyHeader: this.config.auth.serviceKeyHeader,
                });
                headers.set(authHeaderName, authHeaderValue);
                
                // Verify header was set correctly
                const verifyHeader = headers.get(authHeaderName);
                if (!verifyHeader) {
                    console.error('[ServiceClient] CRITICAL: Auth header was not set!', {
                        authHeaderName,
                        allHeaders: Array.from(headers.entries()).map(([k]) => k),
                    });
                } else {
                    console.log('[ServiceClient] Auth header verified', {
                        authHeaderName,
                        headerValueLength: verifyHeader.length,
                        headerValuePreview: verifyHeader.substring(0, 8) + '...',
                    });
                }
                
                // Add custom headers
                if (options.headers) {
                    for (const [key, value] of Object.entries(options.headers)) {
                        headers.set(key, value);
                    }
                }
                
                // Add body if present (needed before integrity headers)
                let requestBody: string | null = null;
                if (options.body !== undefined) {
                    if (typeof options.body === 'string') {
                        requestBody = options.body;
                    } else {
                        requestBody = JSON.stringify(options.body);
                    }
                }
                
                // CRITICAL: Add request integrity headers for service-to-service calls
                // This is required for network integrity verification
                if (this.config.integrity.enabled && this.config.integrity.verifyRequest) {
                    const urlObj = new URL(url);
                    await this.addRequestIntegrityHeaders(method, urlObj.pathname + urlObj.search, requestBody, headers);
                }
                
                // Build request
                const requestInit: RequestInit = {
                    method,
                    headers,
                    // CRITICAL: Prevent caching of service-to-service API calls
                    // Even server-side calls should not be cached to ensure fresh data
                    cache: 'no-store',
                };
                
                // Add body to request
                if (requestBody !== null) {
                    requestInit.body = requestBody;
                }
                
                // Debug logging for authentication issues
                const authHeaderName = this.getAuthHeaderName();
                const authHeaderValue = headers.get(authHeaderName);
                console.log('[ServiceClient] Making request', {
                    method,
                    url,
                    hasAuthHeader: !!authHeaderValue,
                    authHeaderName: authHeaderName,
                    authHeaderValueLength: authHeaderValue?.length || 0,
                    authHeaderValuePreview: authHeaderValue ? `${authHeaderValue.substring(0, 8)}...` : 'missing',
                    hasIntegrityHeader: headers.has('X-Strixun-Request-Integrity'),
                    allHeaders: Array.from(headers.entries()).map(([k]) => k),
                });
                
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
                    
                    console.log('[ServiceClient] Response received', {
                      status: response.status,
                      statusText: response.statusText,
                      bodyLength: responseText.length,
                      hasIntegrityHeader: response.headers.has('X-Strixun-Response-Integrity'),
                      integrityHeader: response.headers.get('X-Strixun-Response-Integrity')?.substring(0, 50) || 'missing',
                      allHeaders: Array.from(response.headers.entries()).map(([k]) => k),
                      integrityEnabled: this.config.integrity.enabled,
                      verifyResponse: this.config.integrity.verifyResponse
                    });
                    
                    // Verify response integrity (baked-in security feature)
                    // CRITICAL: All service-to-service responses MUST include integrity header
                    if (this.config.integrity.enabled && this.config.integrity.verifyResponse) {
                        console.log('[ServiceClient] Verifying response integrity');
                        const verification = await this.verifyResponseIntegrity(
                            response.status,
                            responseText,
                            response.headers
                        );
                        
                        console.log('[ServiceClient] Integrity verification result', {
                          verified: verification.verified,
                          error: verification.error
                        });
                        
                        if (!verification.verified) {
                            if (this.config.integrity.throwOnFailure) {
                                console.error('[ServiceClient] Integrity verification FAILED - throwing error');
                                throw new Error(`[NetworkIntegrity] ${verification.error || 'Response integrity verification failed'}`);
                            } else {
                                console.warn(`[NetworkIntegrity] ${verification.error || 'Response integrity verification failed'}`);
                            }
                        } else {
                            console.log('[ServiceClient] Integrity verification PASSED');
                        }
                    } else {
                        console.log('[ServiceClient] Integrity verification skipped', {
                          enabled: this.config.integrity.enabled,
                          verifyResponse: this.config.integrity.verifyResponse
                        });
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
     * Verify response integrity
     * @private
     */
    private async verifyResponseIntegrity(
        status: number,
        body: string,
        headers: Headers
    ): Promise<{ verified: boolean; error?: string }> {
        const { verifyResponseIntegrityFromHeaders } = await import('./integrity.js');
        return await verifyResponseIntegrityFromHeaders(status, body, headers, this.integrityKeyphrase);
    }
    
    /**
     * Add request integrity headers
     * @private
     */
    private async addRequestIntegrityHeaders(
        method: string,
        path: string,
        body: string | null,
        headers: Headers
    ): Promise<void> {
        const { addRequestIntegrityHeaders } = await import('./integrity.js');
        await addRequestIntegrityHeaders(method, path, body, headers, this.integrityKeyphrase);
    }
}

/**
 * Create a service client from environment variables
 * Automatically detects which auth method to use based on available env vars
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
    
    // Get integrity keyphrase from env or config
    const integrityKeyphrase = config?.integrity?.keyphrase || env.NETWORK_INTEGRITY_KEYPHRASE;
    if (!integrityKeyphrase) {
        throw new Error('ServiceClient: NETWORK_INTEGRITY_KEYPHRASE must be set in environment or provided in config');
    }
    
    return new ServiceClient({
        baseURL,
        auth,
        integrity: {
            enabled: true,
            keyphrase: integrityKeyphrase,
            verifyResponse: true,
            verifyRequest: true,
            throwOnFailure: true, // ENFORCE SECURITY - always throw on failure
            ...config?.integrity,
        },
        ...config,
    });
}

