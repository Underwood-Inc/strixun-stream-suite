/**
 * API Client - TypeScript
 * Composable, type-safe API client for OTP Auth Service
 * Uses the shared API framework for HTTPS enforcement, retry, encryption, etc.
 */

import { createAPIClient } from '@strixun/api-framework/client';
import type {
  User,
  Customer,
  ApiKey,
  ApiKeyResponse,
  AuditLogsResponse,
  Analytics,
  RealtimeAnalytics,
  ErrorAnalytics
} from './types.js';

// API base URL - uses current origin (works with Vite proxy in dev, or same origin in production)
const API_BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

// Create API client instance with auth token getter
const createClient = () => {
  return createAPIClient({
    baseURL: API_BASE_URL,
    defaultHeaders: {
      'Content-Type': 'application/json',
    },
    auth: {
      tokenGetter: () => {
        if (typeof window !== 'undefined') {
          return localStorage.getItem('auth_token');
        }
        return null;
      },
      onTokenExpired: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
          window.dispatchEvent(new CustomEvent('auth:logout'));
        }
      },
    },
    timeout: 30000,
    retry: {
      maxAttempts: 3,
      backoff: 'exponential',
      retryableErrors: [408, 429, 500, 502, 503, 504],
    },
  });
};

export class ApiClient {
  private api = createClient();

  constructor() {
    // Client is created with token getter, so it will always read from localStorage
  }

  setToken(token: string | null): void {
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('auth_token', token);
      } else {
        localStorage.removeItem('auth_token');
      }
    }
    // Recreate client to pick up new token
    this.api = createClient();
  }

  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }

  // Authentication endpoints
  async requestOTP(email: string): Promise<{ success: boolean; message: string }> {
    const response = await this.api.post<{ success: boolean; message: string }>('/auth/request-otp', { email });
    if (response.status !== 200 || !response.data) {
      const error = response.data as { detail?: string } | undefined;
      throw new Error(error?.detail || 'Failed to request OTP');
    }
    return response.data;
  }

  async verifyOTP(email: string, otp: string): Promise<{ access_token?: string; token?: string; [key: string]: unknown }> {
    const response = await this.api.post<{ access_token?: string; token?: string; [key: string]: unknown }>('/auth/verify-otp', { email, otp });
    if (response.status !== 200 || !response.data) {
      const error = response.data as { detail?: string } | undefined;
      throw new Error(error?.detail || 'Failed to verify OTP');
    }
    return response.data;
  }

  async getMe(): Promise<User> {
    const response = await this.api.get<User>('/auth/me');
    if (response.status !== 200 || !response.data) {
      const error = response.data as { detail?: string } | undefined;
      throw new Error(error?.detail || 'Failed to get user');
    }
    return response.data;
  }

  async logout(): Promise<void> {
    try {
      await this.api.post('/auth/logout', {});
    } catch (error) {
      console.warn('Logout API call failed:', error);
    }
    this.setToken(null);
  }

  // Customer endpoints (using customer-api - consolidated from /admin/customers/me)
  async getCustomer(): Promise<Customer> {
    // Use customer-api endpoint - customer-api handles all customer data
    // CRITICAL: NO FALLBACKS ON LOCAL - Always use localhost in development
    const isLocalhost = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' ||
      import.meta.env?.DEV ||
      import.meta.env?.MODE === 'development'
    );
    
    const customerApiUrl = import.meta.env.VITE_CUSTOMER_API_URL || 
      (isLocalhost ? 'http://localhost:8790' : 'https://customer-api.idling.app');
    const customerApi = createAPIClient({
      baseURL: customerApiUrl,
      defaultHeaders: {
        'Content-Type': 'application/json',
      },
      auth: {
        tokenGetter: () => {
          if (typeof window !== 'undefined') {
            return localStorage.getItem('auth_token');
          }
          return null;
        },
        onTokenExpired: () => {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
            window.dispatchEvent(new CustomEvent('auth:logout'));
          }
        },
      },
      timeout: 30000,
      retry: {
        maxAttempts: 3,
        backoff: 'exponential',
        retryableErrors: [408, 429, 500, 502, 503, 504],
      },
    });
    const response = await customerApi.get<Customer>('/customer/me');
    if (response.status !== 200 || !response.data) {
      const error = response.data as { detail?: string } | undefined;
      throw new Error(error?.detail || 'Failed to get customer');
    }
    return response.data;
  }

  async updateCustomer(data: Partial<Customer>): Promise<Customer> {
    // Use customer-api endpoint - customer-api handles all customer data
    // CRITICAL: NO FALLBACKS ON LOCAL - Always use localhost in development
    const isLocalhost = typeof window !== 'undefined' && (
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' ||
      import.meta.env?.DEV ||
      import.meta.env?.MODE === 'development'
    );
    
    const customerApiUrl = import.meta.env.VITE_CUSTOMER_API_URL || 
      (isLocalhost ? 'http://localhost:8790' : 'https://customer-api.idling.app');
    const customerApi = createAPIClient({
      baseURL: customerApiUrl,
      defaultHeaders: {
        'Content-Type': 'application/json',
      },
      auth: {
        tokenGetter: () => {
          if (typeof window !== 'undefined') {
            return localStorage.getItem('auth_token');
          }
          return null;
        },
        onTokenExpired: () => {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
            window.dispatchEvent(new CustomEvent('auth:logout'));
          }
        },
      },
      timeout: 30000,
      retry: {
        maxAttempts: 3,
        backoff: 'exponential',
        retryableErrors: [408, 429, 500, 502, 503, 504],
      },
    });
    const response = await customerApi.put<Customer>('/customer/me', data);
    if (response.status !== 200 || !response.data) {
      const error = response.data as { detail?: string } | undefined;
      throw new Error(error?.detail || 'Failed to update customer');
    }
    return response.data;
  }

  async getApiKeys(customerId: string): Promise<{ apiKeys: ApiKey[] }> {
    const response = await this.api.get<{ apiKeys: ApiKey[] }>(`/admin/customers/${customerId}/api-keys`);
    if (response.status !== 200 || !response.data) {
      const error = response.data as { detail?: string } | undefined;
      throw new Error(error?.detail || 'Failed to get API keys');
    }
    return response.data;
  }

  async createApiKey(customerId: string, name: string): Promise<ApiKeyResponse> {
    const response = await this.api.post<ApiKeyResponse>(`/admin/customers/${customerId}/api-keys`, { name });
    if (response.status !== 200 || !response.data) {
      const error = response.data as { detail?: string } | undefined;
      throw new Error(error?.detail || 'Failed to create API key');
    }
    return response.data;
  }

  async revokeApiKey(customerId: string, keyId: string): Promise<{ success: boolean }> {
    const response = await this.api.delete<{ success: boolean }>(`/admin/customers/${customerId}/api-keys/${keyId}`);
    if (response.status !== 200 || !response.data) {
      const error = response.data as { detail?: string } | undefined;
      throw new Error(error?.detail || 'Failed to revoke API key');
    }
    return response.data;
  }

  async rotateApiKey(customerId: string, keyId: string): Promise<ApiKeyResponse> {
    const response = await this.api.post<ApiKeyResponse>(`/admin/customers/${customerId}/api-keys/${keyId}/rotate`, {});
    if (response.status !== 200 || !response.data) {
      const error = response.data as { detail?: string } | undefined;
      throw new Error(error?.detail || 'Failed to rotate API key');
    }
    return response.data;
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
    const response = await this.api.get<AuditLogsResponse>(`/admin/audit-logs${query ? `?${query}` : ''}`);
    if (response.status !== 200 || !response.data) {
      const error = response.data as { detail?: string } | undefined;
      throw new Error(error?.detail || 'Failed to get audit logs');
    }
    return response.data;
  }

  async getAnalytics(): Promise<Analytics> {
    const response = await this.api.get<Analytics>('/admin/analytics');
    if (response.status !== 200 || !response.data) {
      const error = response.data as { detail?: string } | undefined;
      throw new Error(error?.detail || 'Failed to get analytics');
    }
    return response.data;
  }

  async getRealtimeAnalytics(): Promise<RealtimeAnalytics> {
    const response = await this.api.get<RealtimeAnalytics>('/admin/analytics/realtime');
    if (response.status !== 200 || !response.data) {
      const error = response.data as { detail?: string } | undefined;
      throw new Error(error?.detail || 'Failed to get realtime analytics');
    }
    return response.data;
  }

  async getErrorAnalytics(): Promise<ErrorAnalytics> {
    const response = await this.api.get<ErrorAnalytics>('/admin/analytics/errors');
    if (response.status !== 200 || !response.data) {
      const error = response.data as { detail?: string } | undefined;
      throw new Error(error?.detail || 'Failed to get error analytics');
    }
    return response.data;
  }

  async getEmailAnalytics(params?: { startDate?: string; endDate?: string }): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.set('startDate', params.startDate);
    if (params?.endDate) queryParams.set('endDate', params.endDate);
    
    const query = queryParams.toString();
    const response = await this.api.get<any>(`/admin/analytics/email${query ? `?${query}` : ''}`);
    if (response.status !== 200 || !response.data) {
      const error = response.data as { detail?: string } | undefined;
      throw new Error(error?.detail || 'Failed to get email analytics');
    }
    return response.data;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

