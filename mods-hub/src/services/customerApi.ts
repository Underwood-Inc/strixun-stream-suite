/**
 * Customer API Service
 * Handles all customer management operations
 * Calls customer-api directly (NO proxying through mods-api)
 */

import { createAPIClient } from '@strixun/api-framework/client';
import type { 
    CustomerListItem,
    CustomerDetail,
    CustomerListResponse,
    UpdateCustomerRequest 
} from '../types/customer';
import { sharedClientConfig } from './authConfig';

/**
 * Customer API base URL
 * In dev mode, uses Vite proxy to avoid CORS issues
 * In production, uses environment variables or defaults to production URL
 */
export const CUSTOMER_API_BASE_URL = import.meta.env.DEV
  ? '/customer-api'  // Vite proxy in development
  : (import.meta.env.VITE_CUSTOMER_API_URL || 'https://customer-api.idling.app');

/**
 * Singleton customer API client instance
 */
const customerApi = createAPIClient({
    ...sharedClientConfig,
    baseURL: CUSTOMER_API_BASE_URL,
});

/**
 * List customers (admin only)
 * Calls customer-api directly
 */
export async function listCustomers(filters: {
    page?: number;
    pageSize?: number;
    search?: string;
}): Promise<CustomerListResponse> {
    try {
        const params = new URLSearchParams();
        if (filters.page) params.append('page', filters.page.toString());
        if (filters.pageSize) params.append('pageSize', filters.pageSize.toString());
        if (filters.search) params.append('search', filters.search);
        
        const queryString = params.toString() ? `?${params.toString()}` : '';
        const response = await customerApi.get<{
            customers: CustomerListItem[];
            total: number;
        }>(`/admin/customers${queryString}`);
        
        // Customer API returns just { customers, total }, add pagination data
        return {
            customers: response.data.customers,
            total: response.data.total,
            page: filters.page || 1,
            pageSize: filters.pageSize || 20,
        };
    } catch (error) {
        console.error('[CustomerAPI] Failed to list customers:', error);
        throw new Error(`Failed to list customers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Get customer details (admin only)
 * Calls customer-api directly
 */
export async function getCustomerDetails(customerId: string): Promise<CustomerDetail> {
    try {
        const response = await customerApi.get<{ customer: CustomerDetail }>(`/admin/customers/${customerId}`);
        return response.data.customer;
    } catch (error) {
        console.error(`[CustomerAPI] Failed to get customer details for ${customerId}:`, error);
        throw new Error(`Failed to get customer details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Update customer (admin only)
 * Calls customer-api directly
 */
export async function updateCustomer(customerId: string, updates: UpdateCustomerRequest): Promise<CustomerDetail> {
    try {
        const response = await customerApi.put<{ customer: CustomerDetail }>(`/admin/customers/${customerId}`, updates);
        return response.data.customer;
    } catch (error) {
        console.error(`[CustomerAPI] Failed to update customer ${customerId}:`, error);
        throw new Error(`Failed to update customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
