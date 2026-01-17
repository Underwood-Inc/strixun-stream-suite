/**
 * Customer isolation utilities
 * Handles multi-tenant data isolation using customer IDs
 * 
 * MIGRATION NOTE: This file now re-exports from kv-keys.ts for backward compatibility.
 * New code should import directly from kv-keys.ts using the KVKeys object.
 * 
 * @deprecated Use KVKeys from '../../utils/kv-keys.js' for new code
 */

// Re-export for backward compatibility
export { getCustomerKey, normalizeModId } from './kv-keys.js';

/**
 * Get customer-scoped R2 key for file storage
 * @param customerId - Customer ID (null for default tenant)
 * @param key - Base key
 * @returns Scoped key
 * @deprecated Use KVKeys.r2File() from '../../utils/kv-keys.js' instead
 */
export function getCustomerR2Key(customerId: string | null, key: string): string {
    if (customerId) {
        return `customer_${customerId}/${key}`;
    }
    return key;
}

