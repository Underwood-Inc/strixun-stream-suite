/**
 * API Client - TypeScript
 * Composable, type-safe API client for OTP Auth Service
 * Uses the shared API framework for HTTPS enforcement, retry, encryption, etc.
 */

import { createAPIClient } from '@strixun/api-framework/client';
import { getCookie, deleteCookie } from '@strixun/auth-store/core/utils';
import type {
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

// Create API client instance with auth token getter reading from HttpOnly cookie
const createClient = () => {
  return createAPIClient({
    baseURL: API_BASE_URL,
    defaultHeaders: {
      'Content-Type': 'application/json',
    },
    auth: {
      tokenGetter: () => getCookie('auth_token'), // Read from HttpOnly cookie
      onTokenExpired: () => {
        if (typeof window !== 'undefined') {
          deleteCookie('auth_token', window.location.hostname, '/');
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
    // CRITICAL: Include credentials to send HttpOnly cookies
    credentials: 'include',
  });
};

export class ApiClient {
  private api = createClient();

  constructor() {
    // Client is created with token getter, so it will always read from HttpOnly cookie
  }

  /**
   * Set token is now a no-op - HttpOnly cookie is set by the server
   * We just recreate the client to pick up the cookie
   */
  setToken(_token: string | null): void {
    // HttpOnly cookie is set by the server, we just recreate the client
    this.api = createClient();
  }

  getToken(): string | null {
    return getCookie('auth_token');
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

  async logout(): Promise<void> {
    try {
      await this.api.post('/auth/logout', {});
    } catch (error) {
      console.warn('Logout API call failed:', error);
    }
    this.setToken(null);
  }

  // Customer endpoints (using customer-api via Vite proxy)
  async getCustomer(): Promise<Customer> {
    const response = await this.api.get<Customer>('/customer/me');
    if (response.status !== 200 || !response.data) {
      const error = response.data as { detail?: string } | undefined;
      throw new Error(error?.detail || 'Failed to get customer');
    }
    return response.data;
  }

  async updateCustomer(data: Partial<Customer>): Promise<Customer> {
    const response = await this.api.put<Customer>('/customer/me', data);
    if (response.status !== 200 || !response.data) {
      const error = response.data as { detail?: string } | undefined;
      throw new Error(error?.detail || 'Failed to update customer');
    }
    return response.data;
  }

  async getUserRoles(_customerId: string): Promise<string[]> {
    // Get current user's roles (customerId param kept for interface compatibility but unused)
    const response = await this.api.get<{ roles: string[] }>('/admin/roles');
    if (response.status !== 200 || !response.data) {
      throw new Error(`Failed to get user roles: ${response.status}`);
    }
    return response.data.roles;
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

