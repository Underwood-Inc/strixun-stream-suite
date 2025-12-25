/**
 * Customer utility for game API
 * Simplified version for customer isolation in game data
 */

/**
 * Get customer key with prefix for isolation
 * @param {string} customerId - Customer ID (optional for backward compatibility)
 * @param {string} key - Base key
 * @returns {string} Prefixed key
 */
export function getCustomerKey(customerId, key) {
    return customerId ? `cust_${customerId}_${key}` : key;
}

