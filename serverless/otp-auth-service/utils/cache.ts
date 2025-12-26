/**
 * Cache utilities for customer data
 * In-memory cache with TTL for performance optimization
 */

import type { CustomerData } from '../services/customer.js';

interface CacheEntry {
    data: CustomerData;
    timestamp: number;
}

// In-memory cache for customer data (5-minute TTL)
const customerCache = new Map<string, CacheEntry>();
const cacheTTL = 5 * 60 * 1000; // 5 minutes

/**
 * Function type for fetching customer data
 */
export type GetCustomerFn = (customerId: string) => Promise<CustomerData | null>;

/**
 * Get customer from cache or KV
 * @param customerId - Customer ID
 * @param getCustomerFn - Function to fetch customer from KV
 * @returns Customer data or null
 */
export async function getCustomerCached(
    customerId: string | null,
    getCustomerFn: GetCustomerFn
): Promise<CustomerData | null> {
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
 * @param customerId - Customer ID
 */
export function invalidateCustomerCache(customerId: string | null): void {
    if (customerId) {
        customerCache.delete(`customer_${customerId}`);
    }
}

