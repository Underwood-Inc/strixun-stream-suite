/**
 * Type declarations for @strixun/customer-lookup
 * 
 * This file allows TypeScript to resolve types for dynamic imports
 * without creating a dependency cycle. The actual module is imported
 * dynamically at runtime in route-protection.ts
 */

declare module '@strixun/customer-lookup' {
    export interface CustomerData {
        customerId: string;
        name?: string;
        email?: string;
        companyName?: string;
        plan?: string;
        tier?: string;
        status?: string;
        createdAt?: string;
        updatedAt?: string;
        subscriptions?: any[];
        flairs?: any[];
        displayName?: string;
        config?: any;
        features?: any;
        [key: string]: any;
    }

    export interface CustomerLookupEnv {
        CUSTOMER_API_URL?: string;
        SUPER_ADMIN_API_KEY?: string;
        NETWORK_INTEGRITY_KEYPHRASE?: string;
        ENVIRONMENT?: string;
        [key: string]: any;
    }

    export function fetchCustomerByCustomerId(
        customerId: string,
        env: CustomerLookupEnv
    ): Promise<CustomerData | null>;
}
