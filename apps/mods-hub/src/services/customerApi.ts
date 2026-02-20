/**
 * Customer API Service
 * Handles all customer management operations
 * 
 * Uses mods-api for enriched customer data aggregated from:
 * - customer-api: Base customer data (displayName, createdAt, lastLogin, tier)
 * - access-service: Permissions (hasUploadPermission, isSuperAdmin, roles)
 * - mods-api: Mod counts
 */

import { createAPIClient } from '@strixun/api-framework/client';
import type { 
    CustomerDetail,
    CustomerListResponse,
    UpdateCustomerRequest 
} from '../types/customer';
import { sharedClientConfig } from './authConfig';

/**
 * Mods API base URL - provides enriched customer data
 * In dev mode, uses Vite proxy to avoid CORS issues
 * In production, uses environment variables or defaults to production URL
 */
export const MODS_API_BASE_URL = import.meta.env.DEV
  ? '/mods-api'  // Vite proxy in development
  : (import.meta.env.VITE_MODS_API_URL || '/api/mods');

/**
 * API client for customer management
 * Routes through mods-api which aggregates data from multiple services
 */
const modsApi = createAPIClient({
    ...sharedClientConfig,
    baseURL: MODS_API_BASE_URL,
});

/**
 * List customers (admin only)
 * Returns enriched data from mods-api including:
 * - hasUploadPermission, permissionSource, isSuperAdmin (from access-service)
 * - modCount (from MODS_KV)
 * - lastLogin (synced from otp-auth to customer-api)
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
        const response = await modsApi.get<CustomerListResponse>(`/admin/customers${queryString}`);
        
        return response.data;
    } catch (error) {
        console.error('[CustomerAPI] Failed to list customers:', error);
        throw new Error(`Failed to list customers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Get customer details (admin only)
 * Returns enriched data from mods-api
 */
export async function getCustomerDetails(customerId: string): Promise<CustomerDetail> {
    try {
        const response = await modsApi.get<{ customer: CustomerDetail }>(`/admin/customers/${customerId}`);
        return response.data.customer;
    } catch (error) {
        console.error(`[CustomerAPI] Failed to get customer details for ${customerId}:`, error);
        throw new Error(`Failed to get customer details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Update customer (admin only)
 * Proxies through mods-api which forwards to customer-api and returns enriched response
 */
export async function updateCustomer(customerId: string, updates: UpdateCustomerRequest): Promise<CustomerDetail> {
    try {
        const response = await modsApi.put<{ customer: CustomerDetail }>(`/admin/customers/${customerId}`, updates);
        return response.data.customer;
    } catch (error) {
        console.error(`[CustomerAPI] Failed to update customer ${customerId}:`, error);
        throw new Error(`Failed to update customer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
