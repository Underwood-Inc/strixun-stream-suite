/**
 * User Index Utility
 * 
 * Maintains a userId -> customerId index for O(1) user lookups
 * This eliminates the need to scan all customer scopes when looking up users by userId
 * 
 * Index Key Format: `user_index_${userId}` -> `customerId`
 */

interface Env {
    OTP_AUTH_KV: KVNamespace;
    [key: string]: any;
}

/**
 * Get the index key for a userId
 */
function getUserIndexKey(userId: string): string {
    return `user_index_${userId}`;
}

/**
 * Update the userId -> customerId index
 * Call this whenever a user is created or their customerId changes
 * 
 * @param userId - The user's unique ID
 * @param customerId - The customer ID (can be null)
 * @param env - Environment with OTP_AUTH_KV
 */
export async function updateUserIndex(
    userId: string,
    customerId: string | null,
    env: Env
): Promise<void> {
    if (!userId) {
        console.warn('[UserIndex] Cannot update index: userId is empty');
        return;
    }
    
    try {
        const indexKey = getUserIndexKey(userId);
        const expirationTtl = 31536000; // 1 year (matches user TTL)
        
        if (customerId) {
            // Store customerId in index
            await env.OTP_AUTH_KV.put(indexKey, customerId, { expirationTtl });
        } else {
            // Store 'null' as string for null customerId (KV doesn't support null values)
            await env.OTP_AUTH_KV.put(indexKey, 'null', { expirationTtl });
        }
    } catch (error) {
        // Log but don't throw - index update failure shouldn't break user operations
        console.error(`[UserIndex] Failed to update index for userId ${userId}:`, error);
    }
}

/**
 * Get customerId from index by userId
 * Returns null if not found or if customerId is null
 * 
 * @param userId - The user's unique ID
 * @param env - Environment with OTP_AUTH_KV
 * @returns The customerId, or null if not found
 */
export async function getCustomerIdFromIndex(
    userId: string,
    env: Env
): Promise<string | null> {
    if (!userId) {
        return null;
    }
    
    try {
        const indexKey = getUserIndexKey(userId);
        const customerId = await env.OTP_AUTH_KV.get(indexKey);
        
        if (customerId === null) {
            return null; // Index entry doesn't exist
        }
        
        if (customerId === 'null') {
            return null; // customerId is null (stored as string)
        }
        
        return customerId;
    } catch (error) {
        // Log but return null - index lookup failure should fall back to scanning
        console.error(`[UserIndex] Failed to get customerId from index for userId ${userId}:`, error);
        return null;
    }
}

/**
 * Delete the index entry for a userId
 * Call this when a user is deleted
 * 
 * @param userId - The user's unique ID
 * @param env - Environment with OTP_AUTH_KV
 */
export async function deleteUserIndex(
    userId: string,
    env: Env
): Promise<void> {
    if (!userId) {
        return;
    }
    
    try {
        const indexKey = getUserIndexKey(userId);
        await env.OTP_AUTH_KV.delete(indexKey);
    } catch (error) {
        // Log but don't throw - index deletion failure shouldn't break operations
        console.error(`[UserIndex] Failed to delete index for userId ${userId}:`, error);
    }
}

