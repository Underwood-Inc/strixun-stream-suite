/**
 * Authorization Service SDK
 * 
 * Client for service-to-service communication with the Authorization Service.
 * Used by all services (Mods API, OTP Auth, Customer API, etc.) to check permissions,
 * roles, and quotas.
 * 
 * @module authz-client
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

export interface AuthzClientOptions {
  authzUrl?: string;
  serviceApiKey?: string;
  timeout?: number;
}

/**
 * Authorization Service Client
 * 
 * Provides methods for checking permissions, quotas, and managing customer authorization.
 */
export class AuthzClient {
  private readonly authzUrl: string;
  private readonly serviceApiKey: string;
  private readonly timeout: number;

  constructor(env: any, options: AuthzClientOptions = {}) {
    // Default to production URL, override with env var or option
    this.authzUrl = options.authzUrl 
      || env.AUTHORIZATION_SERVICE_URL 
      || 'https://strixun-authorization-service.strixuns-script-suite.workers.dev';
    
    this.serviceApiKey = options.serviceApiKey || env.SERVICE_API_KEY || '';
    this.timeout = options.timeout || 5000; // 5 second timeout
  }

  /**
   * Check if a customer has a specific permission
   * 
   * @example
   * const allowed = await authz.checkPermission('cust_123', 'upload:mod');
   * if (allowed) { /* allow upload *\/ }
   */
  async checkPermission(
    customerId: string, 
    permission: string, 
    resource?: string
  ): Promise<boolean> {
    try {
      const response = await this.fetch('/authz/check-permission', {
        method: 'POST',
        body: JSON.stringify({ customerId, permission, resource }),
      });

      if (!response.ok) {
        console.error('[AuthzClient] Permission check failed:', response.status);
        return false; // Fail closed - deny access on error
      }

      const data: CheckPermissionResponse = await response.json();
      return data.allowed;
    } catch (error) {
      console.error('[AuthzClient] Permission check error:', error);
      return false; // Fail closed
    }
  }

  /**
   * Check if a customer has quota remaining for an action
   * 
   * @example
   * const quota = await authz.checkQuota('cust_123', 'upload:mod', 'mod');
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
      const response = await this.fetch('/authz/check-quota', {
        method: 'POST',
        body: JSON.stringify({ customerId, action, resource }),
      });

      if (!response.ok) {
        console.error('[AuthzClient] Quota check failed:', response.status);
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
      console.error('[AuthzClient] Quota check error:', error);
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
   * await authz.incrementQuota('cust_123', 'upload:mod', 'mod');
   */
  async incrementQuota(
    customerId: string,
    action: string,
    resource: string
  ): Promise<void> {
    try {
      const response = await this.fetch(`/authz/${customerId}/quotas/increment`, {
        method: 'POST',
        body: JSON.stringify({ action, resource }),
      });

      if (!response.ok) {
        console.error('[AuthzClient] Quota increment failed:', response.status);
        // Don't throw - tracking shouldn't break the flow
      }
    } catch (error) {
      console.error('[AuthzClient] Quota increment error:', error);
      // Don't throw - tracking shouldn't break the flow
    }
  }

  /**
   * Get full authorization details for a customer
   * Returns roles, permissions, and quotas
   * 
   * @example
   * const authz = await authzClient.getCustomerAuthorization('cust_123');
   * console.log('Roles:', authz.roles);
   * console.log('Permissions:', authz.permissions);
   */
  async getCustomerAuthorization(customerId: string): Promise<CustomerAuthorization | null> {
    try {
      const response = await this.fetch(`/authz/${customerId}`);

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Customer not found in authz system
        }
        console.error('[AuthzClient] Get authorization failed:', response.status);
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('[AuthzClient] Get authorization error:', error);
      return null;
    }
  }

  /**
   * Ensure a customer exists in the Authorization Service with default roles
   * Called during login to auto-provision customers
   * 
   * @example
   * // On successful OTP login:
   * await authz.ensureCustomer('cust_123', ['customer']);
   */
  async ensureCustomer(customerId: string, defaultRoles: string[] = ['customer']): Promise<void> {
    try {
      // Check if customer already exists
      const existing = await this.getCustomerAuthorization(customerId);
      if (existing) {
        console.log('[AuthzClient] Customer already exists in authz:', customerId);
        return; // Already provisioned
      }

      // Create customer with default roles
      const response = await this.fetch(`/authz/${customerId}/roles`, {
        method: 'PUT',
        body: JSON.stringify({ roles: defaultRoles }),
      });

      if (!response.ok) {
        console.error('[AuthzClient] Ensure customer failed:', response.status);
      } else {
        console.log('[AuthzClient] Customer provisioned in authz:', customerId, 'roles:', defaultRoles);
      }
    } catch (error) {
      console.error('[AuthzClient] Ensure customer error:', error);
      // Don't throw - provisioning failure shouldn't break login
    }
  }

  /**
   * Check if a customer has a specific role
   * 
   * @example
   * const isAdmin = await authz.hasRole('cust_123', 'admin');
   */
  async hasRole(customerId: string, role: string): Promise<boolean> {
    try {
      const authz = await this.getCustomerAuthorization(customerId);
      return authz?.roles.includes(role) || false;
    } catch (error) {
      console.error('[AuthzClient] Has role error:', error);
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
    const authz = await this.getCustomerAuthorization(customerId);
    return authz?.roles.some(r => r === 'admin' || r === 'super-admin') || false;
  }

  /**
   * Internal fetch wrapper with headers and timeout
   */
  private async fetch(path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.authzUrl}${path}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Key': this.serviceApiKey,
          ...options.headers,
        },
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Create an Authorization Service client
 * 
 * @example
 * const authz = createAuthzClient(env);
 * const allowed = await authz.checkPermission('cust_123', 'upload:mod');
 */
export function createAuthzClient(env: any, options: AuthzClientOptions = {}): AuthzClient {
  return new AuthzClient(env, options);
}
