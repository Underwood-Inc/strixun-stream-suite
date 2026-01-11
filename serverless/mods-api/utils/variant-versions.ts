/**
 * Variant Version Key Utilities
 * 
 * Helper functions for generating KV keys for variant versions
 */

/**
 * Get the KV key for a variant's version list
 * 
 * @param customerId - Customer ID for scoping
 * @param variantId - Variant ID
 * @returns KV key for the version list
 */
export function getVariantVersionListKey(customerId: string, variantId: string): string {
    return `customer_${customerId}_variant_${variantId}_versions`;
}

/**
 * Get the KV key for a specific variant version
 * 
 * @param customerId - Customer ID for scoping
 * @param versionId - Version ID
 * @returns KV key for the version
 */
export function getVariantVersionKey(customerId: string, versionId: string): string {
    return `customer_${customerId}_version_${versionId}`;
}

/**
 * Get the KV key for a variant
 * 
 * @param customerId - Customer ID for scoping
 * @param variantId - Variant ID
 * @returns KV key for the variant
 */
export function getVariantKey(customerId: string, variantId: string): string {
    return `customer_${customerId}_variant_${variantId}`;
}

/**
 * Get the KV key for a mod's variant list
 * 
 * @param customerId - Customer ID for scoping
 * @param modId - Mod ID
 * @returns KV key for the mod's variant list
 */
export function getModVariantListKey(customerId: string, modId: string): string {
    return `customer_${customerId}_mod_${modId}_variants`;
}
