/**
 * Customer data types for admin customer management
 */

export interface CustomerListItem {
    customerId: string;
    displayName: string | null;
    customerIdExternal: string | null;
    createdAt: string | null;
    lastLogin: string | null;
    hasUploadPermission: boolean;
    permissionSource?: 'super-admin' | 'env-var' | 'kv' | 'access-service' | 'none' | 'error'; // Source of upload permission
    isSuperAdmin?: boolean; // True if customer is super admin
    modCount?: number; // Optional - may not be returned by all endpoints
    // Extended fields from enriched endpoint
    tier?: 'free' | 'basic' | 'premium' | 'enterprise'; // Subscription tier
    status?: string; // Account status (active, suspended, etc.)
    roles?: string[]; // Roles from access-service
    permissions?: string[]; // Permissions from access-service
}

export interface CustomerDetail extends CustomerListItem {
    emailHash?: string; // For admin reference only, not the actual email
    approvedAt?: string | null;
}

export interface CustomerListResponse {
    customers: CustomerListItem[];
    total: number;
    page: number;
    pageSize: number;
}

export interface UpdateCustomerRequest {
    hasUploadPermission?: boolean;
    [key: string]: any;
}
