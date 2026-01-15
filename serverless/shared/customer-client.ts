/**
 * Customer Service SDK
 * 
 * Client for service-to-service communication with the Customer API.
 * Used by all services (Mods API, OTP Auth, Access Service, etc.) to manage customer data.
 * 
 * @module customer-client
 */

import { createServiceClient, type ServiceClient } from '@strixun/service-client';

export interface CustomerData {
  customerId: string;
  email: string;
  displayName: string;
  companyName?: string;
  status: 'active' | 'suspended' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  preferences?: Record<string, any>;
}

export interface CustomerPreferences {
  theme?: 'light' | 'dark' | 'auto';
  notifications?: boolean;
  language?: string;
  [key: string]: any;
}

export interface CustomerClientOptions {
  customerUrl?: string;
  timeout?: number;
}

/**
 * Customer Service Client
 * 
 * Provides methods for managing customer data across services.
 * Uses ServiceClient for authenticated service-to-service calls with integrity verification.
 */
export class CustomerClient {
  private readonly client: ServiceClient;

  constructor(env: any, options: CustomerClientOptions = {}) {
    // Default to production URL, override with env var or option
    const customerUrl = options.customerUrl 
      || env.CUSTOMER_API_URL 
      || (env.ENVIRONMENT === 'development' ? 'http://localhost:8790' : 'https://customer-api.idling.app');
    
    // Create service client with proper authentication and integrity
    this.client = createServiceClient(customerUrl, env, {
      timeout: options.timeout || 10000, // 10 second timeout
    });
  }

  /**
   * Get customer by ID
   * 
   * @example
   * const customer = await customerClient.getCustomer('cust_123');
   * if (customer) console.log(customer.displayName);
   */
  async getCustomer(customerId: string): Promise<CustomerData | null> {
    try {
      const response = await this.client.get<{ customer: CustomerData }>(`/customer/${customerId}`);
      
      if (response.status === 404) {
        return null;
      }
      
      if (response.status < 200 || response.status >= 300) {
        console.error('[CustomerClient] Get customer failed:', response.status);
        return null;
      }
      
      return response.data.customer;
    } catch (error) {
      console.error('[CustomerClient] Get customer error:', error);
      return null;
    }
  }

  /**
   * Get customer by email
   * 
   * @example
   * const customer = await customerClient.getCustomerByEmail('user@example.com');
   */
  async getCustomerByEmail(email: string): Promise<CustomerData | null> {
    try {
      const encodedEmail = encodeURIComponent(email);
      const response = await this.client.get<{ customer: CustomerData }>(`/customer/by-email/${encodedEmail}`);
      
      if (response.status === 404) {
        return null;
      }
      
      if (response.status < 200 || response.status >= 300) {
        console.error('[CustomerClient] Get customer by email failed:', response.status);
        return null;
      }
      
      return response.data.customer;
    } catch (error) {
      console.error('[CustomerClient] Get customer by email error:', error);
      return null;
    }
  }

  /**
   * Create new customer
   * 
   * @example
   * const customer = await customerClient.createCustomer({
   *   customerId: 'cust_123',
   *   email: 'user@example.com',
   *   displayName: 'John Doe'
   * });
   */
  async createCustomer(customerData: {
    customerId: string;
    email: string;
    displayName: string;
    companyName?: string;
  }): Promise<CustomerData | null> {
    try {
      const response = await this.client.post<{ customer: CustomerData }>('/customer/', customerData);
      
      if (response.status < 200 || response.status >= 300) {
        console.error('[CustomerClient] Create customer failed:', response.status);
        return null;
      }
      
      return response.data.customer;
    } catch (error) {
      console.error('[CustomerClient] Create customer error:', error);
      return null;
    }
  }

  /**
   * Update customer
   * 
   * @example
   * const updated = await customerClient.updateCustomer('cust_123', {
   *   displayName: 'Jane Doe'
   * });
   */
  async updateCustomer(customerId: string, updates: Partial<CustomerData>): Promise<CustomerData | null> {
    try {
      const response = await this.client.put<{ customer: CustomerData }>(`/customer/${customerId}`, updates);
      
      if (response.status < 200 || response.status >= 300) {
        console.error('[CustomerClient] Update customer failed:', response.status);
        return null;
      }
      
      return response.data.customer;
    } catch (error) {
      console.error('[CustomerClient] Update customer error:', error);
      return null;
    }
  }

  /**
   * Get customer preferences
   * 
   * @example
   * const prefs = await customerClient.getPreferences('cust_123');
   */
  async getPreferences(customerId: string): Promise<CustomerPreferences | null> {
    try {
      const response = await this.client.get<{ preferences: CustomerPreferences }>(`/customer/${customerId}/preferences`);
      
      if (response.status === 404) {
        return null;
      }
      
      if (response.status < 200 || response.status >= 300) {
        console.error('[CustomerClient] Get preferences failed:', response.status);
        return null;
      }
      
      return response.data.preferences;
    } catch (error) {
      console.error('[CustomerClient] Get preferences error:', error);
      return null;
    }
  }

  /**
   * Update customer preferences
   * 
   * @example
   * await customerClient.updatePreferences('cust_123', { theme: 'dark' });
   */
  async updatePreferences(customerId: string, preferences: Partial<CustomerPreferences>): Promise<CustomerPreferences | null> {
    try {
      const response = await this.client.put<{ preferences: CustomerPreferences }>(`/customer/${customerId}/preferences`, preferences);
      
      if (response.status < 200 || response.status >= 300) {
        console.error('[CustomerClient] Update preferences failed:', response.status);
        return null;
      }
      
      return response.data.preferences;
    } catch (error) {
      console.error('[CustomerClient] Update preferences error:', error);
      return null;
    }
  }

  /**
   * Update customer display name
   * 
   * @example
   * await customerClient.updateDisplayName('cust_123', 'Jane Smith');
   */
  async updateDisplayName(customerId: string, displayName: string): Promise<CustomerData | null> {
    try {
      const response = await this.client.put<{ customer: CustomerData }>(`/customer/${customerId}/display-name`, { displayName });
      
      if (response.status < 200 || response.status >= 300) {
        console.error('[CustomerClient] Update display name failed:', response.status);
        return null;
      }
      
      return response.data.customer;
    } catch (error) {
      console.error('[CustomerClient] Update display name error:', error);
      return null;
    }
  }

  /**
   * List all customers (admin only - requires SUPER_ADMIN_API_KEY)
   * 
   * @example
   * const { customers, total } = await customerClient.listAllCustomers();
   */
  async listAllCustomers(): Promise<{ customers: CustomerData[]; total: number } | null> {
    try {
      const response = await this.client.get<{ customers: CustomerData[]; total: number }>('/admin/customers');
      
      if (response.status < 200 || response.status >= 300) {
        console.error('[CustomerClient] List all customers failed:', response.status);
        return null;
      }
      
      return response.data;
    } catch (error) {
      console.error('[CustomerClient] List all customers error:', error);
      return null;
    }
  }

  /**
   * Get customer details (admin only - requires SUPER_ADMIN_API_KEY)
   * 
   * @example
   * const customer = await customerClient.getCustomerDetails('cust_123');
   */
  async getCustomerDetails(customerId: string): Promise<CustomerData | null> {
    try {
      const response = await this.client.get<{ customer: CustomerData }>(`/admin/customers/${customerId}`);
      
      if (response.status === 404) {
        return null;
      }
      
      if (response.status < 200 || response.status >= 300) {
        console.error('[CustomerClient] Get customer details failed:', response.status);
        return null;
      }
      
      return response.data.customer;
    } catch (error) {
      console.error('[CustomerClient] Get customer details error:', error);
      return null;
    }
  }

  /**
   * Update customer (admin only - requires SUPER_ADMIN_API_KEY)
   * 
   * @example
   * const customer = await customerClient.adminUpdateCustomer('cust_123', {
   *   displayName: 'Updated Name'
   * });
   */
  async adminUpdateCustomer(customerId: string, updates: Partial<CustomerData>): Promise<CustomerData | null> {
    try {
      const response = await this.client.put<{ customer: CustomerData }>(`/admin/customers/${customerId}`, updates);
      
      if (response.status < 200 || response.status >= 300) {
        console.error('[CustomerClient] Admin update customer failed:', response.status);
        return null;
      }
      
      return response.data.customer;
    } catch (error) {
      console.error('[CustomerClient] Admin update customer error:', error);
      return null;
    }
  }
}

/**
 * Create a Customer Service client
 * 
 * @example
 * const customerClient = createCustomerClient(env);
 * const customer = await customerClient.getCustomer('cust_123');
 */
export function createCustomerClient(env: any, options: CustomerClientOptions = {}): CustomerClient {
  return new CustomerClient(env, options);
}
