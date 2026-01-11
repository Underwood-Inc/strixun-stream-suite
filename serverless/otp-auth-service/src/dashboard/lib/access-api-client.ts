/**
 * Access Service API Client
 * Direct calls to Access Service - NO PROXY through OTP Auth Service!
 */

import { createAPIClient } from '@strixun/api-framework/client';
import type { RoleDefinition, PermissionDefinition } from './types.js';

// Access Service URL - direct connection
// In dev mode, Vite proxy handles /access → localhost:8791
// In production, we call access.idling.app directly
const ACCESS_SERVICE_URL = typeof window !== 'undefined' 
  ? (window.location.hostname === 'localhost' ? window.location.origin : 'https://access.idling.app')
  : '';

// Create Access Service API client with JWT auth
const createAccessClient = () => {
  return createAPIClient({
    baseURL: ACCESS_SERVICE_URL,
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

export class AccessApiClient {
  private api = createAccessClient();

  /**
   * Get all system roles (super-admin only)
   * Calls Access Service DIRECTLY: GET /access/roles
   */
  async getAllRoles(): Promise<{ roles: RoleDefinition[] }> {
    const response = await this.api.get<{ roles: RoleDefinition[] }>('/access/roles');
    if (response.status !== 200 || !response.data) {
      const error = response.data as { detail?: string; message?: string } | undefined;
      throw new Error(error?.detail || error?.message || 'Failed to get all roles');
    }
    return response.data;
  }

  /**
   * Get all system permissions (super-admin only)
   * Calls Access Service DIRECTLY: GET /access/permissions
   */
  async getAllPermissions(): Promise<{ permissions: PermissionDefinition[] }> {
    const response = await this.api.get<{ permissions: PermissionDefinition[] }>('/access/permissions');
    if (response.status !== 200 || !response.data) {
      const error = response.data as { detail?: string; message?: string } | undefined;
      throw new Error(error?.detail || error?.message || 'Failed to get all permissions');
    }
    return response.data;
  }

  /**
   * Get roles for a specific customer
   * Calls Access Service DIRECTLY: GET /access/:customerId/roles
   */
  async getCustomerRoles(customerId: string): Promise<{ roles: string[] }> {
    const response = await this.api.get<{ roles: string[] }>(`/access/${customerId}/roles`);
    if (response.status !== 200 || !response.data) {
      const error = response.data as { detail?: string; message?: string } | undefined;
      throw new Error(error?.detail || error?.message || 'Failed to get customer roles');
    }
    return response.data;
  }

  /**
   * Get permissions for a specific customer
   * Calls Access Service DIRECTLY: GET /access/:customerId/permissions
   */
  async getCustomerPermissions(customerId: string): Promise<{ permissions: string[] }> {
    const response = await this.api.get<{ permissions: string[] }>(`/access/${customerId}/permissions`);
    if (response.status !== 200 || !response.data) {
      const error = response.data as { detail?: string; message?: string } | undefined;
      throw new Error(error?.detail || error?.message || 'Failed to get customer permissions');
    }
    return response.data;
  }
}

// Export singleton instance
export const accessApiClient = new AccessApiClient();
