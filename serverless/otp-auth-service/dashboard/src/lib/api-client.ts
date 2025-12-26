/**
 * API Client - TypeScript
 * Composable, type-safe API client for OTP Auth Service
 */

import type {
  Analytics,
  ApiKey,
  ApiKeyResponse,
  AuditLogsResponse,
  Customer,
  ErrorAnalytics,
  RealtimeAnalytics,
  User
} from './types.js';

// API base URL - uses current origin (works with Vite proxy in dev, or same origin in production)
const API_BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

export class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  setToken(token: string | null): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('auth_token', token);
      } else {
        localStorage.removeItem('auth_token');
      }
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    return headers;
  }

  private async request(
    endpoint: string,
    options: RequestInit & { body?: BodyInit | null | unknown } = {}
  ): Promise<Response> {
    const url = `${API_BASE_URL}${endpoint}`;
    const config: RequestInit = {
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
      } else if (typeof body === 'object') {
        config.body = JSON.stringify(body);
      } else {
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
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  private async decryptResponse<T>(response: Response): Promise<T> {
    const isEncrypted = response.headers.get('X-Encrypted') === 'true';
    const data = await response.json();
    
    if (isEncrypted && this.token) {
      // Decrypt the response using JWT token
      // Uses shared encryption suite from serverless/shared/encryption
      const { decryptWithJWT } = await import('@strixun/api-framework');
      return await decryptWithJWT(data as any, this.token) as T;
    }
    
    return data as T;
  }

  private async get<T>(endpoint: string): Promise<T> {
    const response = await this.request(endpoint, { method: 'GET' });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error((error as { detail?: string; error?: string }).detail || (error as { error?: string }).error || 'Request failed');
    }
    return await this.decryptResponse<T>(response);
  }

  private async post<T>(endpoint: string, body?: unknown): Promise<T> {
    const response = await this.request(endpoint, {
      method: 'POST',
      body: body as BodyInit | null | undefined,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error((error as { detail?: string; error?: string }).detail || (error as { error?: string }).error || 'Request failed');
    }
    return await this.decryptResponse<T>(response);
  }

  // PUT method kept for API completeness and future use
  // Note: updateCustomer uses fetch directly because it calls external customer-api
  // @ts-expect-error - Intentionally kept for API completeness (standard HTTP method)
  private async put<T>(endpoint: string, body?: unknown): Promise<T> {
    const response = await this.request(endpoint, {
      method: 'PUT',
      body: body as BodyInit | null | undefined,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error((error as { detail?: string; error?: string }).detail || (error as { error?: string }).error || 'Request failed');
    }
    return await this.decryptResponse<T>(response);
  }

  private async delete<T>(endpoint: string): Promise<T> {
    const response = await this.request(endpoint, { method: 'DELETE' });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error((error as { detail?: string; error?: string }).detail || (error as { error?: string }).error || 'Request failed');
    }
    return await this.decryptResponse<T>(response);
  }

  // Authentication endpoints
  async requestOTP(email: string): Promise<{ success: boolean; message: string }> {
    return await this.post('/auth/request-otp', { email });
  }

  async verifyOTP(email: string, otp: string): Promise<{ access_token?: string; token?: string; [key: string]: unknown }> {
    return await this.post('/auth/verify-otp', { email, otp });
  }

  async getMe(): Promise<User> {
    return await this.get<User>('/auth/me');
  }

  async logout(): Promise<void> {
    try {
      await this.post('/auth/logout', {});
    } catch (error) {
      console.warn('Logout API call failed:', error);
    }
    this.setToken(null);
  }

  // Customer endpoints (now using customer-api)
  async getCustomer(): Promise<Customer> {
    // Use customer-api endpoint instead of OTP auth service
    const customerApiUrl = import.meta.env.VITE_CUSTOMER_API_URL || 'https://customer.idling.app';
    const response = await fetch(`${customerApiUrl}/customer/me`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to get customer' }));
      throw new Error((error as { detail?: string }).detail || 'Failed to get customer');
    }
    
    return await this.decryptResponse<Customer>(response);
  }

  async updateCustomer(data: Partial<Customer>): Promise<Customer> {
    // Use customer-api endpoint instead of OTP auth service
    const customerApiUrl = import.meta.env.VITE_CUSTOMER_API_URL || 'https://customer.idling.app';
    const response = await fetch(`${customerApiUrl}/customer/me`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to update customer' }));
      throw new Error((error as { detail?: string }).detail || 'Failed to update customer');
    }
    
    return await this.decryptResponse<Customer>(response);
  }

  async getApiKeys(customerId: string): Promise<{ apiKeys: ApiKey[] }> {
    return await this.get<{ apiKeys: ApiKey[] }>(`/admin/customers/${customerId}/api-keys`);
  }

  async createApiKey(customerId: string, name: string): Promise<ApiKeyResponse> {
    return await this.post<ApiKeyResponse>(`/admin/customers/${customerId}/api-keys`, { name });
  }

  async revokeApiKey(customerId: string, keyId: string): Promise<{ success: boolean }> {
    return await this.delete<{ success: boolean }>(`/admin/customers/${customerId}/api-keys/${keyId}`);
  }

  async rotateApiKey(customerId: string, keyId: string): Promise<ApiKeyResponse> {
    return await this.post<ApiKeyResponse>(`/admin/customers/${customerId}/api-keys/${keyId}/rotate`, {});
  }

  async revealApiKey(customerId: string, keyId: string): Promise<ApiKeyResponse> {
    return await this.post<ApiKeyResponse>(`/admin/customers/${customerId}/api-keys/${keyId}/reveal`, {});
  }

  async getAuditLogs(
    _customerId: string | null,
    params: { startDate?: string; endDate?: string; eventType?: string } = {}
  ): Promise<AuditLogsResponse> {
    const queryParams = new URLSearchParams();
    if (params.startDate) queryParams.set('startDate', params.startDate);
    if (params.endDate) queryParams.set('endDate', params.endDate);
    if (params.eventType) queryParams.set('eventType', params.eventType);
    
    const query = queryParams.toString();
    return await this.get<AuditLogsResponse>(`/admin/audit-logs${query ? `?${query}` : ''}`);
  }

  async getAnalytics(): Promise<Analytics> {
    return await this.get<Analytics>('/admin/analytics');
  }

  async getRealtimeAnalytics(): Promise<RealtimeAnalytics> {
    return await this.get<RealtimeAnalytics>('/admin/analytics/realtime');
  }

  async getErrorAnalytics(): Promise<ErrorAnalytics> {
    return await this.get<ErrorAnalytics>('/admin/analytics/errors');
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

