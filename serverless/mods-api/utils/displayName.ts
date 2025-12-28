/**
 * Utility to fetch user display names from auth API
 */

/**
 * Fetch display name for a user by userId
 * Note: This requires the auth API to support user lookup by userId
 * For now, we'll try to fetch from /auth/user/:userId if available
 * Otherwise, we'll return null and the frontend can handle it
 */
export async function fetchDisplayNameByUserId(userId: string, env: Env): Promise<string | null> {
    try {
        const authApiUrl = env.AUTH_API_URL || 'https://auth.idling.app';
        
        // Try to fetch user info by userId
        // The auth API might have a public endpoint for this
        const response = await fetch(`${authApiUrl}/auth/user/${userId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        
        if (response.ok) {
            const userData = await response.json() as { displayName?: string | null; [key: string]: any };
            return userData.displayName || null;
        }
    } catch (error) {
        console.warn('[DisplayName] Failed to fetch displayName for userId:', userId, error);
    }
    return null;
}

/**
 * Fetch display names for multiple users
 * Returns a map of userId -> displayName
 */
export async function fetchDisplayNamesByUserIds(userIds: string[], env: Env): Promise<Map<string, string | null>> {
    const displayNames = new Map<string, string | null>();
    
    // Fetch all display names in parallel
    const promises = userIds.map(async (userId) => {
        const displayName = await fetchDisplayNameByUserId(userId, env);
        return { userId, displayName };
    });
    
    const results = await Promise.all(promises);
    results.forEach(({ userId, displayName }) => {
        displayNames.set(userId, displayName);
    });
    
    return displayNames;
}

interface Env {
    AUTH_API_URL?: string;
    [key: string]: any;
}

