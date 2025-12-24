/**
 * Cache utilities for customer data
 * In-memory cache with TTL for performance optimization
 */

// In-memory cache for customer data (5-minute TTL)
const customerCache = new Map();
const cacheTTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get customer from cache or KV
 * @param {string} customerId - Customer ID
 * @param {Function} getCustomerFn - Function to fetch customer from KV
 * @returns {Promise<object|null>} Customer data
 */
export async function getCustomerCached(customerId, getCustomerFn) {
    if (!customerId) return null;
    
    const cacheKey = `customer_${customerId}`;
    const cached = customerCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < cacheTTL) {
        return cached.data;
    }
    
    const customer = await getCustomerFn(customerId);
    if (customer) {
        customerCache.set(cacheKey, {
            data: customer,
            timestamp: Date.now()
        });
    }
    
    return customer;
}

/**
 * Invalidate customer cache
 * @param {string} customerId - Customer ID
 */
export function invalidateCustomerCache(customerId) {
    if (customerId) {
        customerCache.delete(`customer_${customerId}`);
    }
}

