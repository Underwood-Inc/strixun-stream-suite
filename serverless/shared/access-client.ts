/**
 * Access Service SDK
 * 
 * Client for service-to-service communication with the Access Service.
 * Used by all services (Mods API, OTP Auth, Customer API, etc.) to check permissions,
 * roles, and quotas.
 * 
 * @module access-client
 */

export interface CustomerAuthorization {
  customerId: string;
  roles: string[];
  permissions: string[];
  quotas: Record<string, QuotaInfo>;
  createdAt: string;
  updatedAt: string;
}

export interface QuotaInfo {
  limit: number;
  period: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
  current: number;
  resetAt: string;
}

export interface CheckPermissionRequest {
  customerId: string;
  permission: string;
  resource?: string;
}

export interface CheckPermissionResponse {
  allowed: boolean;
  reason?: string;
}

export interface CheckQuotaRequest {
  customerId: string;
  action: string;
  resource: string;
}

export interface CheckQuotaResponse {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: string;
  reason?: string;
}

export interface IncrementQuotaRequest {
  action: string;
  resource: string;
}

export interface EnsureCustomerRequest {
  customerId: string;
  roles?: string[];
}

export interface AccessClientOptions {
  accessUrl?: string;
  serviceApiKey?: string;
  jwtToken?: string;
  timeout?: number;
}

/**
 * Access Service Client
 * 
 * Provides methods for checking permissions, quotas, and managing customer access control.
 */
export class AccessClient {
  private readonly accessUrl: string;
  private readonly serviceApiKey: string;
  private readonly jwtToken: string;
  private readonly timeout: number;

  constructor(env: any, options: AccessClientOptions = {}) {
    // Default to production URL, override with env var or option
    this.accessUrl = options.accessUrl 
      || env.ACCESS_SERVICE_URL 
      || 'https://access-api.idling.app';
    
    this.serviceApiKey = options.serviceApiKey || env.SERVICE_API_KEY || '';
    this.jwtToken = options.jwtToken || '';
    this.timeout = options.timeout || 5000; // 5 second timeout
  }

  /**
   * Check if a customer has a specific permission
   * 
   * @example
   * const allowed = await access.checkPermission('cust_123', 'upload:mod');
   * if (allowed) { /* allow upload *\/ }
   */
  async checkPermission(
    customerId: string, 
    permission: string, 
    resource?: string
  ): Promise<boolean> {
    try {
      const response = await this.fetch('/access/check-permission', {
        method: 'POST',
        body: JSON.stringify({ customerId, permission, resource }),
      });

      if (!response.ok) {
        console.error('[AccessClient] Permission check failed:', response.status);
        return false; // Fail closed - deny access on error
      }

      const data: CheckPermissionResponse = await response.json();
      return data.allowed;
    } catch (error) {
      console.error('[AccessClient] Permission check error:', error);
      return false; // Fail closed
    }
  }

  /**
   * Check if a customer has quota remaining for an action
   * 
   * @example
   * const quota = await access.checkQuota('cust_123', 'upload:mod', 'mod');
   * if (!quota.allowed) {
   *   throw new Error(`Quota exceeded. Resets at ${quota.resetAt}`);
   * }
   */
  async checkQuota(
    customerId: string,
    action: string,
    resource: string
  ): Promise<CheckQuotaResponse> {
    try {
      const response = await this.fetch('/access/check-quota', {
        method: 'POST',
        body: JSON.stringify({ customerId, action, resource }),
      });

      if (!response.ok) {
        console.error('[AccessClient] Quota check failed:', response.status);
        // On error, deny (quota exceeded)
        return {
          allowed: false,
          remaining: 0,
          limit: 0,
          resetAt: new Date().toISOString(),
          reason: 'service_error',
        };
      }

      return await response.json();
    } catch (error) {
      console.error('[AccessClient] Quota check error:', error);
      return {
        allowed: false,
        remaining: 0,
        limit: 0,
        resetAt: new Date().toISOString(),
        reason: 'service_error',
      };
    }
  }

  /**
   * Increment a customer's quota usage
   * Should be called after a successful action (e.g., after uploading a mod)
   * 
   * @example
   * await access.incrementQuota('cust_123', 'upload:mod', 'mod');
   */
  async incrementQuota(
    customerId: string,
    action: string,
    resource: string
  ): Promise<void> {
    try {
      const response = await this.fetch(`/access/${customerId}/quotas/increment`, {
        method: 'POST',
        body: JSON.stringify({ action, resource }),
      });

      if (!response.ok) {
        console.error('[AccessClient] Quota increment failed:', response.status);
        // Don't throw - tracking shouldn't break the flow
      }
    } catch (error) {
      console.error('[AccessClient] Quota increment error:', error);
      // Don't throw - tracking shouldn't break the flow
    }
  }

  /**
   * Get full authorization details for a customer
   * Returns roles, permissions, and quotas
   * 
   * @example
   * const access = await accessClient.getCustomerAuthorization('cust_123');
   * console.log('Roles:', access.roles);
   * console.log('Permissions:', access.permissions);
   */
  async getCustomerAuthorization(customerId: string): Promise<CustomerAuthorization | null> {
    try {
      const response = await this.fetch(`/access/${customerId}`);

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Customer not found in access system
        }
        console.error('[AccessClient] Get authorization failed:', response.status);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('[AccessClient] Get authorization error:', error);
      return null;
    }
  }

  /**
   * Ensure a customer exists in the Access Service with default roles
   * Called during login to auto-provision customers
   * 
   * @example
   * // On successful OTP login:
   * await access.ensureCustomer('cust_123', ['customer']);
   */
  async ensureCustomer(customerId: string, defaultRoles: string[] = ['customer']): Promise<void> {
    try {
      // Check if customer already exists
      const existing = await this.getCustomerAuthorization(customerId);
      if (existing) {
        console.log('[AccessClient] Customer already exists in access service:', customerId);
        return; // Already provisioned
      }

      // Create customer with default roles
      const response = await this.fetch(`/access/${customerId}/roles`, {
        method: 'PUT',
        body: JSON.stringify({ roles: defaultRoles }),
      });

      if (!response.ok) {
        console.error('[AccessClient] Ensure customer failed:', response.status);
      } else {
        console.log('[AccessClient] Customer provisioned in access service:', customerId, 'roles:', defaultRoles);
      }
    } catch (error) {
      console.error('[AccessClient] Ensure customer error:', error);
      // Don't throw - provisioning failure shouldn't break login
    }
  }

  /**
   * Check if a customer has a specific role
   * 
   * @example
   * const isAdmin = await access.hasRole('cust_123', 'admin');
   */
  async hasRole(customerId: string, role: string): Promise<boolean> {
    try {
      const access = await this.getCustomerAuthorization(customerId);
      return access?.roles.includes(role) || false;
    } catch (error) {
      console.error('[AccessClient] Has role error:', error);
      return false;
    }
  }

  /**
   * Check if a customer is a super admin
   * Convenience method for common check
   */
  async isSuperAdmin(customerId: string): Promise<boolean> {
    return this.hasRole(customerId, 'super-admin');
  }

  /**
   * Check if a customer is an admin (includes super-admins)
   */
  async isAdmin(customerId: string): Promise<boolean> {
    const access = await this.getCustomerAuthorization(customerId);
    return access?.roles.some(r => r === 'admin' || r === 'super-admin') || false;
  }

  /**
   * Internal fetch wrapper with headers and timeout
   */
  private async fetch(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.accessUrl}${path}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      // Build headers - JWT token ONLY (security requirement)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers as Record<string, string>,
      };
      
      if (this.jwtToken) {
        headers['Authorization'] = `Bearer ${this.jwtToken}`;
        console.log('[AccessClient] Using JWT token authentication', {
          hasToken: true,
          tokenLength: this.jwtToken?.length,
          url
        });
      } else {
        console.error('[AccessClient] NO JWT TOKEN - Authentication will fail!', {
          url,
          hasJwtToken: !!this.jwtToken
        });
      }
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers,
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Create an Access Service client
 * 
 * @example
 * const access = createAccessClient(env);
 * const allowed = await access.checkPermission('cust_123', 'upload:mod');
 */
export function createAccessClient(env: any, options: AccessClientOptions = {}): AccessClient {
  return new AccessClient(env, options);
}

// Backwards compatibility alias
export const createAuthzClient = createAccessClient;
export type AuthzClient = AccessClient;
export type AuthzClientOptions = AccessClientOptions;
