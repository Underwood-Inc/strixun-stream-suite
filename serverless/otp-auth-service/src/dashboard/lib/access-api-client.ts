/**
 * Access Service API Client
 * Direct calls to Access Service - NO PROXY through OTP Auth Service!
 */

import { createAPIClient } from '@strixun/api-framework/client';
import type { RoleDefinition, PermissionDefinition } from './types.js';

// Access Service URL - direct connection
// In dev mode, Vite proxy handles /access → localhost:8795
// In production, use env var or fallback to production URL
const getAccessServiceUrl = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }
  
  // Check for env var (for builds)
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ACCESS_SERVICE_URL) {
    return import.meta.env.VITE_ACCESS_SERVICE_URL;
  }
  
  // Development: use Vite proxy
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return window.location.origin; // Vite proxy handles /access
  }
  
  // Production: use env var or fallback (should be set via env var)
  return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ACCESS_SERVICE_URL) 
    || 'https://access-api.idling.app';
};

const ACCESS_SERVICE_URL = getAccessServiceUrl();

// Create Access Service API client with HttpOnly cookie auth
const createAccessClient = () => {
  return createAPIClient({
    baseURL: ACCESS_SERVICE_URL,
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
