/**
 * API Client - TypeScript
 * Composable, type-safe API client for OTP Auth Service
 */
// API base URL - uses current origin (works with Vite proxy in dev, or same origin in production)
const API_BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';
export class ApiClient {
    constructor() {
        this.token = null;
        if (typeof window !== 'undefined') {
            this.token = localStorage.getItem('auth_token');
        }
    }
    setToken(token) {
        this.token = token;
        if (typeof window !== 'undefined') {
            if (token) {
                localStorage.setItem('auth_token', token);
            }
            else {
                localStorage.removeItem('auth_token');
            }
        }
    }
    getToken() {
        return this.token;
    }
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }
    async request(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const config = {
            method: options.method,
            headers: {
                ...this.getHeaders(),
                ...(options.headers || {}),
            },
        };
        // Handle body - convert unknown to BodyInit
        if (options.body !== undefined && options.body !== null) {
            const body = options.body;
            if (typeof body === 'string' ||
                body instanceof FormData ||
                body instanceof Blob ||
                body instanceof ArrayBuffer ||
                ArrayBuffer.isView(body)) {
                config.body = body;
            }
            else if (typeof body === 'object') {
                config.body = JSON.stringify(body);
            }
            else {
                config.body = String(body);
            }
        }
        try {
            const response = await fetch(url, config);
            // Handle 401 - token expired
            if (response.status === 401) {
                this.setToken(null);
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('auth:logout'));
                }
                throw new Error('Authentication expired. Please login again.');
            }
            return response;
        }
        catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }
    async decryptResponse(response) {
        const isEncrypted = response.headers.get('X-Encrypted') === 'true';
        const data = await response.json();
        if (isEncrypted && this.token) {
            // Decrypt the response using JWT token
            const { decryptWithJWT } = await import('./jwt-decrypt.js');
            return await decryptWithJWT(data, this.token);
        }
        return data;
    }
    async get(endpoint) {
        const response = await this.request(endpoint, { method: 'GET' });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.detail || error.error || 'Request failed');
        }
        return await this.decryptResponse(response);
    }
    async post(endpoint, body) {
        const response = await this.request(endpoint, {
            method: 'POST',
            body: body,
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.detail || error.error || 'Request failed');
        }
        return await this.decryptResponse(response);
    }
    // PUT method kept for API completeness and future use
    // Note: updateCustomer uses fetch directly because it calls external customer-api
    // @ts-expect-error - Intentionally kept for API completeness (standard HTTP method)
    async put(endpoint, body) {
        const response = await this.request(endpoint, {
            method: 'PUT',
            body: body,
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.detail || error.error || 'Request failed');
        }
        return await this.decryptResponse(response);
    }
    async delete(endpoint) {
        const response = await this.request(endpoint, { method: 'DELETE' });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Request failed' }));
            throw new Error(error.detail || error.error || 'Request failed');
        }
        return await this.decryptResponse(response);
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
        }
        catch (error) {
            console.warn('Logout API call failed:', error);
        }
        this.setToken(null);
    }
    // Customer endpoints (now using customer-api)
    async getCustomer() {
        // Use customer-api endpoint instead of OTP auth service
        const customerApiUrl = import.meta.env.VITE_CUSTOMER_API_URL || 'https://customer.idling.app';
        const response = await fetch(`${customerApiUrl}/customer/me`, {
            method: 'GET',
            headers: this.getHeaders(),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Failed to get customer' }));
            throw new Error(error.detail || 'Failed to get customer');
        }
        return await this.decryptResponse(response);
    }
    async updateCustomer(data) {
        // Use customer-api endpoint instead of OTP auth service
        const customerApiUrl = import.meta.env.VITE_CUSTOMER_API_URL || 'https://customer.idling.app';
        const response = await fetch(`${customerApiUrl}/customer/me`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Failed to update customer' }));
            throw new Error(error.detail || 'Failed to update customer');
        }
        return await this.decryptResponse(response);
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
    async revealApiKey(customerId, keyId) {
        return await this.post(`/admin/customers/${customerId}/api-keys/${keyId}/reveal`, {});
    }
    async getAuditLogs(_customerId, params = {}) {
        const queryParams = new URLSearchParams();
        if (params.startDate)
            queryParams.set('startDate', params.startDate);
        if (params.endDate)
            queryParams.set('endDate', params.endDate);
        if (params.eventType)
            queryParams.set('eventType', params.eventType);
        const query = queryParams.toString();
        return await this.get(`/admin/audit-logs${query ? `?${query}` : ''}`);
    }
    async getAnalytics() {
        return await this.get('/admin/analytics');
    }
    async getRealtimeAnalytics() {
        return await this.get('/admin/analytics/realtime');
    }
    async getErrorAnalytics() {
        return await this.get('/admin/analytics/errors');
    }
}
// Export singleton instance
export const apiClient = new ApiClient();
//# sourceMappingURL=api-client.js.map