/**
 * Customer isolation utilities
 */

/**
 * Get customer key with prefix for isolation
 */
export function getCustomerKey(customerId: string | null, key: string): string {
    return customerId ? `cust_${customerId}_${key}` : key;
}

