/**
 * API Client Module
 * Composable, maintainable API client for OTP Auth Service
 */

const API_BASE_URL = window.location.origin;

/**
 * API Client class
 * Handles all API requests with authentication
 */
export class ApiClient {
    constructor() {
        this.token = localStorage.getItem('auth_token');
    }

    /**
     * Set authentication token
     * @param {string} token - JWT token
     */
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('auth_token', token);
        } else {
            localStorage.removeItem('auth_token');
        }
    }

    /**
     * Get authentication headers
     * @returns {object} Headers object
     */
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
        };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        return headers;
    }

    /**
     * Make API request
     * @param {string} endpoint - API endpoint
     * @param {object} options - Fetch options
     * @returns {Promise<Response>} Fetch response
     */
    async request(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const config = {
            ...options,
            headers: {
                ...this.getHeaders(),
                ...(options.headers || {}),
            },
        };

        if (options.body && typeof options.body === 'object') {
            config.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url, config);
            
            // Handle 401 - token expired
            if (response.status === 401) {
                this.setToken(null);
                window.dispatchEvent(new CustomEvent('auth:logout'));
                throw new Error('Authentication expired. Please login again.');
            }

            return response;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    /**
     * GET request
     * @param {string} endpoint - API endpoint
     * @returns {Promise<object>} JSON response
     */
    async get(endpoint) {
        const response = await this.request(endpoint, { method: 'GET' });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.detail || error.error || 'Request failed');
        }
        return await response.json();
    }

    /**
     * POST request
     * @param {string} endpoint - API endpoint
     * @param {object} body - Request body
     * @returns {Promise<object>} JSON response
     */
    async post(endpoint, body) {
        const response = await this.request(endpoint, {
            method: 'POST',
            body,
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.detail || error.error || 'Request failed');
        }
        return await response.json();
    }

    /**
     * PUT request
     * @param {string} endpoint - API endpoint
     * @param {object} body - Request body
     * @returns {Promise<object>} JSON response
     */
    async put(endpoint, body) {
        const response = await this.request(endpoint, {
            method: 'PUT',
            body,
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.detail || error.error || 'Request failed');
        }
        return await response.json();
    }

    /**
     * DELETE request
     * @param {string} endpoint - API endpoint
     * @returns {Promise<object>} JSON response
     */
    async delete(endpoint) {
        const response = await this.request(endpoint, { method: 'DELETE' });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.detail || error.error || 'Request failed');
        }
        return await response.json();
    }

    // Authentication endpoints
    async requestOTP(email) {
        return await this.post('/auth/request-otp', { email });
    }

    async verifyOTP(email, otp) {
        return await this.post('/auth/verify-otp', { email, otp });
    }

    async getMe() {
        return await this.get('/auth/me');
    }

    async logout() {
        try {
            await this.post('/auth/logout', {});
        } catch (error) {
            // Continue with logout even if API call fails
            console.warn('Logout API call failed:', error);
        }
        this.setToken(null);
    }

    // Customer endpoints (now using customer-api)
    async getCustomer() {
        // Customer API uses different base URL
        // CRITICAL: Always use localhost if running on localhost (even if env vars aren't set)
        const isLocalhost = typeof window !== 'undefined' && 
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        
        // ALWAYS use localhost in local dev - never fall back to production URL
        // Force localhost if we're running on localhost, regardless of env vars
        const customerApiUrl = isLocalhost 
            ? 'http://localhost:8790'
            : (import.meta?.env?.VITE_CUSTOMER_API_URL || 'https://customer-api.idling.app');
        
        const url = `${customerApiUrl}/customer/me`;
        const response = await fetch(url, {
            method: 'GET',
            headers: this.getHeaders(),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.detail || error.error || 'Failed to get customer');
        }
        return await response.json();
    }

    async updateCustomer(data) {
        // Customer API uses different base URL
        // CRITICAL: Always use localhost if running on localhost (even if env vars aren't set)
        const isLocalhost = typeof window !== 'undefined' && 
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        
        // ALWAYS use localhost in local dev - never fall back to production URL
        // Force localhost if we're running on localhost, regardless of env vars
        const customerApiUrl = isLocalhost 
            ? 'http://localhost:8790'
            : (import.meta?.env?.VITE_CUSTOMER_API_URL || 'https://customer-api.idling.app');
        
        const url = `${customerApiUrl}/customer/me`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.detail || error.error || 'Failed to update customer');
        }
        return await response.json();
    }

    async getApiKeys(customerId) {
        return await this.get(`/admin/customers/${customerId}/api-keys`);
    }

    async createApiKey(customerId, name) {
        return await this.post(`/admin/customers/${customerId}/api-keys`, { name });
    }

    async revokeApiKey(customerId, keyId) {
        return await this.delete(`/admin/customers/${customerId}/api-keys/${keyId}`);
    }

    async rotateApiKey(customerId, keyId) {
        return await this.post(`/admin/customers/${customerId}/api-keys/${keyId}/rotate`, {});
    }

    async getAuditLogs(customerId, params = {}) {
        const queryParams = new URLSearchParams();
        if (params.startDate) queryParams.set('startDate', params.startDate);
        if (params.endDate) queryParams.set('endDate', params.endDate);
        if (params.eventType) queryParams.set('eventType', params.eventType);
        
        const query = queryParams.toString();
        return await this.get(`/admin/audit-logs${query ? `?${query}` : ''}`);
    }

    async getAnalytics(customerId) {
        return await this.get('/admin/analytics');
    }

    async getRealtimeAnalytics(customerId) {
        return await this.get('/admin/analytics/realtime');
    }

    async getErrorAnalytics(customerId) {
        return await this.get('/admin/analytics/errors');
    }
}

// Export singleton instance
export const apiClient = new ApiClient();

