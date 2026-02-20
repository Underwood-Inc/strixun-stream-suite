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
  
  // Production: use same-origin proxy at /api so requests go to auth.idling.app/api/access/*
  return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ACCESS_SERVICE_URL) 
    || '/api';
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

/**
 * Customer with access data (enriched from multiple services)
 */
export interface CustomerWithAccess {
  customerId: string;
  displayName: string | null;
  createdAt: string | null;
  lastLogin: string | null;
  hasUploadPermission: boolean;
  permissionSource: 'super-admin' | 'access-service' | 'kv' | 'none' | 'error';
  isSuperAdmin: boolean;
  modCount: number;
  tier?: 'free' | 'basic' | 'premium' | 'enterprise';
  status?: string;
  roles?: string[];
  permissions?: string[];
}

export interface CustomerListResponse {
  customers: CustomerWithAccess[];
  total: number;
  page: number;
  pageSize: number;
}

// OTP Auth API URL for enriched customer data (calls own backend)
const getOtpAuthApiUrl = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }
  
  // Development: use same origin (Vite proxy handles /admin)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return window.location.origin; // Vite proxy handles /admin -> otp-auth-service
  }
  
  // Production: use env var or fallback to same origin
  return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OTP_AUTH_URL) 
    || window.location.origin; // Same origin for production
};

// Create OTP Auth API client for enriched customer data
const createOtpAuthClient = () => {
  return createAPIClient({
    baseURL: getOtpAuthApiUrl(),
    defaultHeaders: {
      'Content-Type': 'application/json',
    },
    credentials: 'include' as RequestCredentials,
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
  private otpAuthApi = createOtpAuthClient();

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

  /**
   * List all customers with their access data (super-admin only)
   * Calls otp-auth-service which aggregates data from customer-api + access-service
   */
  async listCustomersWithAccess(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
  }): Promise<CustomerListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.pageSize) queryParams.set('pageSize', params.pageSize.toString());
    if (params?.search) queryParams.set('search', params.search);
    
    const query = queryParams.toString();
    const response = await this.otpAuthApi.get<CustomerListResponse>(`/admin/customers${query ? `?${query}` : ''}`);
    if (response.status !== 200 || !response.data) {
      const error = response.data as { detail?: string; message?: string } | undefined;
      throw new Error(error?.detail || error?.message || 'Failed to list customers');
    }
    return response.data;
  }

  /**
   * Update customer roles
   * Calls Access Service DIRECTLY: PUT /access/:customerId/roles
   */
  async updateCustomerRoles(customerId: string, roles: string[], reason?: string): Promise<void> {
    const response = await this.api.put<{ success: boolean }>(`/access/${customerId}/roles`, {
      roles,
      reason,
    });
    if (response.status !== 200) {
      const error = response.data as { detail?: string; message?: string } | undefined;
      throw new Error(error?.detail || error?.message || 'Failed to update customer roles');
    }
  }

  /**
   * Update customer permissions
   * Calls Access Service DIRECTLY: PUT /access/:customerId/permissions
   */
  async updateCustomerPermissions(customerId: string, permissions: string[], reason?: string): Promise<void> {
    const response = await this.api.put<{ success: boolean }>(`/access/${customerId}/permissions`, {
      permissions,
      reason,
    });
    if (response.status !== 200) {
      const error = response.data as { detail?: string; message?: string } | undefined;
      throw new Error(error?.detail || error?.message || 'Failed to update customer permissions');
    }
  }
}

// Export singleton instance
export const accessApiClient = new AccessApiClient();
