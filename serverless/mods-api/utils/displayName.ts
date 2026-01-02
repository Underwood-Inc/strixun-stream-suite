/**
 * Utility to fetch user display names from auth API
 */

import { getAuthApiUrl } from '@strixun/api-framework';

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
 * Fetch display name using /auth/me endpoint (requires JWT token)
 * This is more reliable when we have authentication, as it uses the token to get current user info
 * Falls back to fetchDisplayNameByUserId if token is not provided
 */
export async function fetchDisplayNameByToken(
    token: string,
    env: Env,
    timeoutMs: number = 10000
): Promise<string | null> {
    if (!token) {
        console.warn('[DisplayName] No token provided for fetchDisplayNameByToken');
        return null;
    }
    
    const authApiUrl = getAuthApiUrl(env);
    const url = `${authApiUrl}/auth/me`;
    
    console.log('[DisplayName] Fetching displayName via /auth/me:', { url, timeoutMs });
    
    // Retry logic: try once, retry once on timeout
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            // Create AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            
            try {
                // Call /auth/me endpoint with JWT token
                // NOTE: Do NOT use cache option - not supported in Cloudflare Workers
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    signal: controller.signal,
                });
                
                clearTimeout(timeoutId);
                
                console.log('[DisplayName] /auth/me response status:', { status: response.status, ok: response.ok, attempt: attempt + 1 });
                
                if (response.ok) {
                    const responseData = await response.json();
                    
                    // Check if response is encrypted (has X-Encrypted header or encrypted field)
                    const isEncrypted = response.headers.get('X-Encrypted') === 'true' || 
                                       (typeof responseData === 'object' && responseData && 'encrypted' in responseData);
                    
                    let userData: { displayName?: string | null; [key: string]: any };
                    if (isEncrypted) {
                        // Decrypt the response using JWT token
                        const { decryptWithJWT } = await import('@strixun/api-framework');
                        userData = await decryptWithJWT(responseData, token) as { displayName?: string | null; [key: string]: any };
                    } else {
                        userData = responseData;
                    }
                    
                    const displayName = userData?.displayName || null;
                    console.log('[DisplayName] Found displayName via /auth/me:', { displayName, hasDisplayName: !!displayName, attempt: attempt + 1 });
                    return displayName;
                } else if (response.status === 522 || response.status === 504) {
                    // Gateway timeout - retry if this is first attempt
                    if (attempt === 0) {
                        console.warn('[DisplayName] /auth/me gateway timeout, will retry:', { status: response.status, attempt: attempt + 1 });
                        continue; // Retry
                    } else {
                        console.error('[DisplayName] /auth/me gateway timeout after retry:', { status: response.status, url });
                        return null;
                    }
                } else {
                    console.error('[DisplayName] /auth/me unexpected response status:', { status: response.status, url, attempt: attempt + 1 });
                    return null;
                }
            } catch (fetchError) {
                clearTimeout(timeoutId);
                
                // Check if it's an abort (timeout)
                if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                    if (attempt === 0) {
                        console.warn('[DisplayName] /auth/me request timeout, will retry:', { timeoutMs, attempt: attempt + 1 });
                        continue; // Retry
                    } else {
                        console.error('[DisplayName] /auth/me request timeout after retry:', { timeoutMs, url });
                        return null;
                    }
                }
                throw fetchError; // Re-throw other errors
            }
        } catch (error) {
            // Network errors or other issues
            if (attempt === 0) {
                console.warn('[DisplayName] /auth/me fetch error, will retry:', { error: error instanceof Error ? error.message : String(error), attempt: attempt + 1 });
                // Wait a bit before retry
                await new Promise(resolve => setTimeout(resolve, 500));
                continue; // Retry
            } else {
                console.error('[DisplayName] Failed to fetch displayName via /auth/me after retry:', { error: error instanceof Error ? error.message : String(error) });
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

