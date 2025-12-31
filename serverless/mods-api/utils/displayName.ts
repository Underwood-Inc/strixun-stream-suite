/**
 * Utility to fetch user display names from auth API
 */

/**
 * Get the auth API URL with auto-detection for local dev
 * Priority:
 * 1. AUTH_API_URL env var (if explicitly set)
 * 2. localhost:8787 if ENVIRONMENT is 'test' or 'development'
 * 3. Production default (https://auth.idling.app)
 */
function getAuthApiUrl(env: Env): string {
    if (env.AUTH_API_URL) {
        return env.AUTH_API_URL;
    }
    if (env.ENVIRONMENT === 'test' || env.ENVIRONMENT === 'development') {
        // Local dev - use localhost (otp-auth-service runs on port 8787)
        return 'http://localhost:8787';
    }
    // Production default
    return 'https://auth.idling.app';
}

/**
 * Fetch display name for a user by userId
 * Uses the public /auth/user/:userId endpoint in the auth API
 * Includes timeout handling and retry logic for reliability
 */
export async function fetchDisplayNameByUserId(userId: string, env: Env, timeoutMs: number = 5000): Promise<string | null> {
    if (!userId) {
        console.warn('[DisplayName] Empty userId provided');
        return null;
    }
    
    const authApiUrl = getAuthApiUrl(env);
    const url = `${authApiUrl}/auth/user/${userId}`;
    
    console.log('[DisplayName] Fetching displayName for userId:', { userId, url, timeoutMs });
    
    // Retry logic: try once, retry once on timeout
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            // Create AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            
            try {
                // Call the public user lookup endpoint
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    signal: controller.signal,
                });
                
                clearTimeout(timeoutId);
                
                console.log('[DisplayName] Response status:', { userId, status: response.status, ok: response.ok, attempt: attempt + 1 });
                
                if (response.ok) {
                    const userData = await response.json() as { displayName?: string | null; userId?: string; [key: string]: any };
                    const displayName = userData.displayName || null;
                    console.log('[DisplayName] Found displayName:', { userId, displayName, hasDisplayName: !!displayName, attempt: attempt + 1 });
                    return displayName;
                } else if (response.status === 404) {
                    // User not found - return null (not an error)
                    console.warn('[DisplayName] User not found (404):', { userId, url, attempt: attempt + 1 });
                    return null;
                } else if (response.status === 522 || response.status === 504) {
                    // Gateway timeout - retry if this is first attempt
                    if (attempt === 0) {
                        console.warn('[DisplayName] Gateway timeout, will retry:', { userId, status: response.status, attempt: attempt + 1 });
                        continue; // Retry
                    } else {
                        console.error('[DisplayName] Gateway timeout after retry:', { userId, status: response.status, url });
                        return null;
                    }
                } else {
                    console.error('[DisplayName] Unexpected response status:', { userId, status: response.status, url, attempt: attempt + 1 });
                    return null;
                }
            } catch (fetchError) {
                clearTimeout(timeoutId);
                
                // Check if it's an abort (timeout)
                if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                    if (attempt === 0) {
                        console.warn('[DisplayName] Request timeout, will retry:', { userId, timeoutMs, attempt: attempt + 1 });
                        continue; // Retry
                    } else {
                        console.error('[DisplayName] Request timeout after retry:', { userId, timeoutMs, url });
                        return null;
                    }
                }
                throw fetchError; // Re-throw other errors
            }
        } catch (error) {
            // Network errors or other issues
            if (attempt === 0) {
                console.warn('[DisplayName] Fetch error, will retry:', { userId, error: error instanceof Error ? error.message : String(error), attempt: attempt + 1 });
                // Wait a bit before retry
                await new Promise(resolve => setTimeout(resolve, 500));
                continue; // Retry
            } else {
                console.error('[DisplayName] Failed to fetch displayName for userId after retry:', { userId, error: error instanceof Error ? error.message : String(error) });
                return null;
            }
        }
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

