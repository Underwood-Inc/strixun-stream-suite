/**
 * KV Key Utilities for Streamkit API
 * 
 * Provides functions for building and parsing customer-isolated KV keys
 * following the pattern: cust_{customerId}_streamkit_{type}_{id}
 */

/**
 * Build a customer-isolated KV key for Streamkit configs
 * 
 * Pattern: cust_{customerId}_streamkit_{type}_{id}
 * 
 * @param customerId - Customer ID from JWT
 * @param configType - Config type (text-cyclers, swaps, layouts, notes, etc.)
 * @param configId - Unique config ID
 * @returns KV key string
 */
export function buildKVKey(customerId: string, configType: string, configId: string): string {
  return `cust_${customerId}_streamkit_${configType}_${configId}`;
}

/**
 * Parse a Streamkit KV key back into components
 * 
 * @param key - KV key string
 * @returns Parsed components or null if invalid format
 */
export function parseKVKey(key: string): {
  customerId: string;
  configType: string;
  configId: string;
} | null {
  const match = key.match(/^cust_([^_]+)_streamkit_([^_]+)_(.+)$/);
  if (!match) return null;
  
  return {
    customerId: match[1],
    configType: match[2],
    configId: match[3],
  };
}
