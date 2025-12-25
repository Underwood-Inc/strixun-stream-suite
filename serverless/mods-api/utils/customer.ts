/**
 * Customer isolation utilities
 * Handles multi-tenant data isolation using customer IDs
 */

/**
 * Get customer-scoped key for KV storage
 * @param customerId - Customer ID (null for default tenant)
 * @param key - Base key
 * @returns Scoped key
 */
export function getCustomerKey(customerId: string | null, key: string): string {
    if (customerId) {
        return `customer_${customerId}_${key}`;
    }
    return key;
}

/**
 * Get customer-scoped R2 key for file storage
 * @param customerId - Customer ID (null for default tenant)
 * @param key - Base key
 * @returns Scoped key
 */
export function getCustomerR2Key(customerId: string | null, key: string): string {
    if (customerId) {
        return `customer_${customerId}/${key}`;
    }
    return key;
}

