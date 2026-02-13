/**
 * API Client - TypeScript
 * Composable, type-safe API client for OTP Auth Service
 * Uses the shared API framework for HTTPS enforcement, retry, encryption, etc.
 */

import { createAPIClient } from '@strixun/api-framework/client';
import type {
  Customer,
  ApiKey,
  ApiKeyResponse,
  ApiKeyVerifyResponse,
  AuditLogsResponse,
  Analytics,
  RealtimeAnalytics,
  ErrorAnalytics
} from './types.js';

// API base URL - uses current origin (works with Vite proxy in dev, or same origin in production)
const API_BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

// Create API client instance with HttpOnly cookie authentication
// CRITICAL: NO tokenGetter - HttpOnly cookies are sent automatically!
const createClient = () => {
  return createAPIClient({
    baseURL: API_BASE_URL,
    defaultHeaders: {
      'Content-Type': 'application/json',
    },
    // CRITICAL: HttpOnly cookie sent automatically - NO tokenGetter needed
    credentials: 'include' as RequestCredentials,
    auth: {
      onTokenExpired: () => {
        if (typeof window !== 'undefined') {
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
    // Client is created with token getter, so it will always read from HttpOnly cookie
  }

  /**
   * Set token is now a no-op - HttpOnly cookie is set by the server
   */
  setToken(_token: string | null): void {
    // HttpOnly cookie is set by the server, nothing to do client-side
    // Just recreate the client to ensure fresh config
    this.api = createClient();
  }

  /**
   * Get token - DEPRECATED: HttpOnly cookies cannot be read by JavaScript
   * @returns null (token is in HttpOnly cookie)
   */
  getToken(): string | null {
    console.warn('[API Client] getToken() is deprecated. Token is in HttpOnly cookie and cannot be read by JavaScript.');
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

  async logout(): Promise<void> {
    try {
      await this.api.post('/auth/logout', {});
    } catch (error) {
      console.warn('Logout API call failed:', error);
    }
    this.setToken(null);
  }

  /**
   * Check if user is authenticated via HttpOnly cookie SSO
   * Uses /auth/me (proxied to otp-auth-service) - the same fast, reliable
   * endpoint that all other apps use for SSO checks.
   * Returns basic auth info (customerId, isSuperAdmin) or null if not authenticated.
   */
  async checkAuth(): Promise<{ customerId: string; isSuperAdmin?: boolean } | null> {
    try {
      const response = await this.api.get<{ customerId: string; isSuperAdmin?: boolean }>('/auth/me');
      if (response.status === 200 && response.data?.customerId) {
        return response.data;
      }
      return null;
    } catch {
      return null;
    }
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

  /**
   * Test an API key to verify it's valid and see what services are available
   * @param apiKey - The API key to test
   * @returns API key verification result with services and rate limits
   */
  async testApiKey(apiKey: string): Promise<ApiKeyVerifyResponse> {
    // Use fetch directly since we need to set a custom header
    const response = await fetch(`${API_BASE_URL}/api-key/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OTP-API-Key': apiKey
      }
    });
    
    const data = await response.json();
    return data as ApiKeyVerifyResponse;
  }

  /**
   * Get the HTML+JS test snippet for end-to-end testing
   * @param apiKey - The API key to include in the snippet
   * @returns HTML+JS code snippet
   */
  async getTestSnippet(apiKey: string): Promise<{ success: boolean; snippet: string; instructions: string[] }> {
    const response = await fetch(`${API_BASE_URL}/api-key/test-snippet?apiKey=${encodeURIComponent(apiKey)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    return data;
  }

  /**
   * Get customer configuration including allowed origins
   * @returns Customer configuration object
   */
  async getConfig(): Promise<{ allowedOrigins?: string[]; rateLimits?: any; emailConfig?: any }> {
    const response = await this.api.get<{ config: any }>('/admin/config');
    if (response.status !== 200 || !response.data) {
      const error = response.data as { detail?: string } | undefined;
      throw new Error(error?.detail || 'Failed to get configuration');
    }
    return response.data.config || {};
  }

  /**
   * Update customer configuration
   * @param config - Configuration to update (partial updates allowed)
   * @returns Updated configuration
   */
  async updateConfig(config: { allowedOrigins?: string[]; rateLimits?: any }): Promise<{ config: any }> {
    const response = await this.api.put<{ config: any }>('/admin/config', config);
    if (response.status !== 200 || !response.data) {
      const error = response.data as { detail?: string } | undefined;
      throw new Error(error?.detail || 'Failed to update configuration');
    }
    return response.data;
  }

  /**
   * Update allowed origins for a specific API key
   * Each key can have its own set of allowed origins for CORS
   */
  async updateKeyOrigins(customerId: string, keyId: string, allowedOrigins: string[]): Promise<{ success: boolean; allowedOrigins: string[]; message: string }> {
    const response = await this.client.put<{ success: boolean; allowedOrigins: string[]; message: string }>(
      `/admin/customers/${customerId}/api-keys/${keyId}/origins`,
      { allowedOrigins }
    );
    if (response.status !== 200 || !response.data) {
      const error = response.data as { error?: string; message?: string } | undefined;
      throw new Error(error?.message || error?.error || 'Failed to update allowed origins');
    }
    return response.data;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

