/**
 * Utility to fetch user display names from auth API
 */

/**
 * Fetch display name for a user by userId
 * Uses the public /auth/user/:userId endpoint in the auth API
 */
export async function fetchDisplayNameByUserId(userId: string, env: Env): Promise<string | null> {
    if (!userId) {
        console.warn('[DisplayName] Empty userId provided');
        return null;
    }
    
    try {
        const authApiUrl = env.AUTH_API_URL || 'https://auth.idling.app';
        const url = `${authApiUrl}/auth/user/${userId}`;
        
        console.log('[DisplayName] Fetching displayName for userId:', { userId, url });
        
        // Call the public user lookup endpoint
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        
        console.log('[DisplayName] Response status:', { userId, status: response.status, ok: response.ok });
        
        if (response.ok) {
            const userData = await response.json() as { displayName?: string | null; userId?: string; [key: string]: any };
            const displayName = userData.displayName || null;
            console.log('[DisplayName] Found displayName:', { userId, displayName, hasDisplayName: !!displayName });
            return displayName;
        } else if (response.status === 404) {
            // User not found - return null (not an error)
            console.warn('[DisplayName] User not found (404):', { userId, url });
            return null;
        } else {
            console.error('[DisplayName] Unexpected response status:', { userId, status: response.status, url });
            return null;
        }
    } catch (error) {
        console.error('[DisplayName] Failed to fetch displayName for userId:', { userId, error: error instanceof Error ? error.message : String(error) });
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

