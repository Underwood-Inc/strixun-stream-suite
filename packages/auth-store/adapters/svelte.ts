/**
 * Svelte adapter for auth store
 * Use this in Svelte projects
 */

import { writable, derived, get, type Writable, type Readable } from 'svelte/store';
import type { User, AuthStoreConfig } from '../core/types.js';
import { 
    restoreSessionFromBackend, 
    validateTokenWithBackend, 
    fetchUserInfo,
    decodeJWTPayload 
} from '../core/api.js';

/**
 * Create Svelte auth stores
 */
export function createAuthStore(config?: AuthStoreConfig) {
    const storageKey = config?.storageKey || 'auth_user';
    const storage = config?.storage || (typeof window !== 'undefined' ? window.localStorage : null);
    
    // Core stores
    const user: Writable<User | null> = writable(null);
    const isAuthenticated: Writable<boolean> = writable(false);
    const isSuperAdmin: Writable<boolean> = writable(false);
    const csrfToken: Writable<string | null> = writable(null);
    
    // Derived stores
    const isTokenExpired: Readable<boolean> = derived(
        user,
        ($user) => {
            if (!$user) return true;
            return new Date($user.expiresAt) < new Date();
        }
    );
    
    /**
     * Save authentication state to storage
     */
    function saveAuthState(userData: User | null): void {
        if (userData) {
            // Store user data in storage
            if (storage) {
                storage.setItem(storageKey, JSON.stringify(userData));
            }
            
            // Extract CSRF token and isSuperAdmin from JWT payload
            const payload = decodeJWTPayload(userData.token);
            const csrf = payload?.csrf as string | undefined;
            const isSuperAdminValue = payload?.isSuperAdmin === true || userData.isSuperAdmin || false;
            
            // Update userData with isSuperAdmin from JWT if not already set
            const updatedUserData = { ...userData, isSuperAdmin: isSuperAdminValue };
            
            isAuthenticated.set(true);
            user.set(updatedUserData);
            csrfToken.set(csrf || null);
            isSuperAdmin.set(isSuperAdminValue);
        } else {
            // Clear storage
            if (storage) {
                storage.removeItem(storageKey);
                storage.removeItem('auth_token'); // Clean up any old token storage
            }
            isAuthenticated.set(false);
            user.set(null);
            csrfToken.set(null);
            isSuperAdmin.set(false);
        }
    }
    
    /**
     * Set user authentication state
     */
    function setUser(userData: User | null): void {
        saveAuthState(userData);
    }
    
    /**
     * Clear authentication state (logout)
     */
    async function logout(): Promise<void> {
        try {
            // Try to call logout endpoint to invalidate token on server
            const currentUser = get(user);
            if (currentUser?.token) {
                // CRITICAL: NO FALLBACKS ON LOCAL - Always use localhost in development
                let apiUrl = config?.authApiUrl;
                if (!apiUrl && typeof window !== 'undefined') {
                    const isLocalhost = window.location.hostname === 'localhost' || 
                                        window.location.hostname === '127.0.0.1' ||
                                        import.meta.env?.DEV ||
                                        import.meta.env?.MODE === 'development';
                    
                    if (isLocalhost) {
                        // NEVER fall back to production when on localhost
                        apiUrl = 'http://localhost:8787';
                    } else {
                        apiUrl = 'https://auth.idling.app';
                    }
                } else if (!apiUrl) {
                    apiUrl = 'https://auth.idling.app';
                }
                const { createAPIClient } = await import('@strixun/api-framework/client');
                const authClient = createAPIClient({
                    baseURL: apiUrl,
                    timeout: 5000,
                });
                await authClient.post('/auth/logout', {});
            }
        } catch (error) {
            // Continue with logout even if API call fails
            console.warn('[Auth] Logout API call failed, continuing with local logout:', error);
        } finally {
            // Always clear local auth state
            saveAuthState(null);
        }
    }
    
    /**
     * Fetch fresh user info from /auth/me endpoint
     */
    async function fetchUserInfoFromAPI(): Promise<void> {
        const currentUser = get(user);
        if (!currentUser || !currentUser.token) {
            return;
        }
        
        // CRITICAL: Don't clear user if fetchUserInfo fails - only update if it succeeds
        const userInfo = await fetchUserInfo(currentUser.token, config);
        if (userInfo) {
            const updatedUser: User = { 
                ...currentUser, 
                isSuperAdmin: userInfo.isSuperAdmin, 
                displayName: userInfo.displayName || currentUser.displayName,
                customerId: userInfo.customerId || currentUser.customerId,
            };
            saveAuthState(updatedUser);
        } else {
            // If fetchUserInfo fails, log but don't clear the user - they're still authenticated
            console.warn('[Auth] Failed to fetch user info, but keeping existing auth state');
        }
    }
    
    /**
     * Restore session from backend (IP-based session sharing)
     */
    async function restoreSession(): Promise<boolean> {
        const currentUser = get(user);
        
        // If we already have a user with a valid (non-expired) token, don't clear them
        // Just refresh admin status in background
        if (currentUser && currentUser.token && currentUser.expiresAt) {
            const isExpired = new Date(currentUser.expiresAt) <= new Date();
            
            if (!isExpired) {
                // Token is valid, just refresh admin status in background
                fetchUserInfoFromAPI().catch(err => {
                    console.debug('[Auth] Background admin status refresh failed (non-critical):', err);
                });
                return true; // Already authenticated with valid token - don't clear!
            }
            // Token is expired - try to restore from backend, but don't clear user yet
            // Only clear if backend restore fails
        }
        
        // Try to restore from backend (IP-based session sharing)
        if (!config?.enableSessionRestore) {
            return false;
        }
        
        const restoredUser = await restoreSessionFromBackend(config);
        if (restoredUser) {
            saveAuthState(restoredUser);
            // Fetch admin status after restoring session (don't clear if it fails)
            const userInfo = await fetchUserInfo(restoredUser.token, config);
            if (userInfo) {
                const updatedUser: User = { 
                    ...restoredUser, 
                    isSuperAdmin: userInfo.isSuperAdmin, 
                    displayName: userInfo.displayName || restoredUser.displayName,
                    customerId: userInfo.customerId || restoredUser.customerId,
                };
                saveAuthState(updatedUser);
            } else {
                // If fetchUserInfo fails, keep the user but log the issue
                console.warn('[Auth] Failed to fetch admin status after restore, but keeping user authenticated');
            }
            return true; // Successfully restored
        } else if (currentUser && currentUser.expiresAt && new Date(currentUser.expiresAt) <= new Date()) {
            // Backend restore failed AND token is expired - only now clear the user
            console.log('[Auth] Token expired and backend restore failed, clearing auth state');
            saveAuthState(null);
            return false; // Failed to restore
        }
        // If backend restore failed but we have a valid user, keep them logged in
        return false; // No user to restore or restore failed
    }
    
    /**
     * Load authentication state from storage
     * CRITICAL: Validates tokens with backend to detect blacklisted tokens from logout on other domains
     */
    async function loadAuthState(): Promise<void> {
        try {
            let userData: User | null = null;
            
            // Try to load from storage
            if (storage) {
                const stored = storage.getItem(storageKey);
                if (stored) {
                    try {
                        userData = JSON.parse(stored) as User;
                    } catch (e) {
                        console.warn('[Auth] Failed to parse stored user data');
                    }
                }
            }
            
            // Token is stored in userData
            if (userData && userData.token && 'expiresAt' in userData && typeof userData.expiresAt === 'string') {
                // Check if token is expired locally first (fast check)
                if (new Date(userData.expiresAt) > new Date()) {
                    // Token not expired locally - validate with backend to check if blacklisted
                    const isValid = await validateTokenWithBackend(userData.token, config);
                    
                    if (!isValid) {
                        // Token is blacklisted or invalid - clear auth state
                        console.log('[Auth] Token is blacklisted or invalid, clearing auth state');
                        saveAuthState(null);
                        // Try to restore session from backend (in case there's a valid session for this IP)
                        if (config?.enableSessionRestore) {
                            await restoreSession();
                        }
                        return;
                    }

                    // Token is valid - restore auth state
                    // Extract CSRF token and isSuperAdmin from JWT payload before saving
                    const payload = decodeJWTPayload(userData.token);
                    const csrf = payload?.csrf as string | undefined;
                    const isSuperAdminValue = payload?.isSuperAdmin === true || userData.isSuperAdmin || false;
                    if (csrf) {
                        csrfToken.set(csrf);
                    }
                    // Update userData with isSuperAdmin from JWT if not already set
                    const updatedUserData = { ...userData, isSuperAdmin: isSuperAdminValue };
                    saveAuthState(updatedUserData);
                    console.log('[Auth] ✓ User authenticated from storage, token valid until:', userData.expiresAt);
                    return;
                } else {
                    // Token expired, try to restore from backend before clearing
                    console.log('[Auth] Token expired, attempting to restore from backend');
                    if (config?.enableSessionRestore) {
                        const restored = await restoreSession();
                        if (!restored) {
                            // Backend restore failed, clear auth
                            saveAuthState(null);
                        }
                    } else {
                        saveAuthState(null);
                    }
                    return;
                }
            }

            // No userData found - try to restore session from backend
            // This enables cross-application session sharing for the same device/IP
            if (!userData && config?.enableSessionRestore) {
                await restoreSession();
            }
        } catch (error) {
            console.error('[Auth] Failed to load auth state:', error);
            // Don't clear auth on error - might be a temporary network issue
            // Only clear if we truly have no userData
            if (storage) {
                const stored = storage.getItem(storageKey);
                if (!stored) {
                    saveAuthState(null);
                }
            }
        }
    }
    
    /**
     * Get current auth token
     */
    function getAuthToken(): string | null {
        const currentUser = get(user);
        return currentUser?.token || null;
    }
    
    /**
     * Get current CSRF token from JWT payload
     */
    function getCsrfToken(): string | null {
        return get(csrfToken);
    }
    
    // Initialize: Load auth state on creation
    if (typeof window !== 'undefined') {
        loadAuthState().catch(err => {
            console.error('[Auth] Failed to initialize auth state:', err);
        });
    }
    
    return {
        // Stores
        user,
        isAuthenticated,
        isSuperAdmin,
        csrfToken,
        isTokenExpired,
        
        // Methods
        setUser,
        logout,
        restoreSession,
        fetchUserInfo: fetchUserInfoFromAPI,
        loadAuthState,
        getAuthToken,
        getCsrfToken,
    };
}
