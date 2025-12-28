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

/**
 * Normalize modId by stripping 'mod_' prefix if present
 * This ensures consistent key generation regardless of whether modId includes the prefix
 * @param modId - Mod ID (may or may not include 'mod_' prefix)
 * @returns Normalized mod ID without 'mod_' prefix
 */
export function normalizeModId(modId: string): string {
    return modId.startsWith('mod_') ? modId.substring(4) : modId;
}

