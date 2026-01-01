/**
 * Zustand adapter for auth store
 * Use this in React projects
 */

import { create, type StateCreator } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, AuthState, AuthStoreMethods, AuthStoreConfig } from '../core/types.js';
import { 
    restoreSessionFromBackend, 
    validateTokenWithBackend, 
    fetchUserInfo,
    decodeJWTPayload 
} from '../core/api.js';

interface ZustandAuthState extends AuthState, AuthStoreMethods {}

/**
 * Create Zustand auth store
 */
export function createAuthStore(config?: AuthStoreConfig) {
    const storageKey = config?.storageKey || 'auth-storage';
    const storage = config?.storage || (typeof window !== 'undefined' ? window.localStorage : null);
    
    const authStoreCreator: StateCreator<ZustandAuthState> = (set, get) => ({
        user: null,
        isAuthenticated: false,
        isSuperAdmin: false,
        setUser: (user: User | null) => {
            // Extract isSuperAdmin from JWT if not already set
            let isSuperAdmin = user?.isSuperAdmin || false;
            if (user?.token) {
                const payload = decodeJWTPayload(user.token);
                if (payload?.isSuperAdmin === true) {
                    isSuperAdmin = true;
                }
            }
            
            set({ 
                user, 
                isAuthenticated: !!user,
                isSuperAdmin,
            });
        },
        logout: async () => {
            // Try to call logout endpoint to invalidate token on server
            try {
                const currentUser = get().user;
                if (currentUser?.token) {
                    const apiUrl = config?.authApiUrl || 'https://auth.idling.app';
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
                set({ user: null, isAuthenticated: false, isSuperAdmin: false });
            }
        },
        fetchUserInfo: async () => {
            const currentUser = get().user;
            if (!currentUser || !currentUser.token) {
                return;
            }
            
            // CRITICAL: Don't clear user if fetchUserInfo fails - only update if it succeeds
            // This prevents undefined cache values from wiping the session
            // EXCEPTION: If token mismatch is detected, we should clear and restore
            try {
                const userInfo = await fetchUserInfo(currentUser.token, config);
                if (userInfo) {
                    const updatedUser: User = { 
                        ...currentUser, 
                        isSuperAdmin: userInfo.isSuperAdmin, 
                        displayName: userInfo.displayName || currentUser.displayName,
                        customerId: userInfo.customerId || currentUser.customerId,
                    };
                    set({ 
                        user: updatedUser, 
                        isSuperAdmin: userInfo.isSuperAdmin,
                    });
                } else {
                    // Check if the response was still encrypted (token mismatch)
                    // This is detected by fetchUserInfo returning null when decryption fails
                    // We can't distinguish between "no data" and "token mismatch" from the return value,
                    // but the error logs will indicate token mismatch
                    console.warn('[Auth] Failed to fetch user info, but keeping existing auth state');
                }
            } catch (error) {
                // Check if this is a token mismatch error
                const errorMessage = error instanceof Error ? error.message : String(error);
                const isTokenMismatch = errorMessage.includes('token does not match') || 
                                        errorMessage.includes('Token mismatch') ||
                                        errorMessage.includes('decryption failed');
                
                if (isTokenMismatch) {
                    console.warn('[Auth] Token mismatch detected in fetchUserInfo, clearing auth state and restoring session');
                    set({ user: null, isAuthenticated: false, isSuperAdmin: false });
                    // Try to restore session
                    if (config?.enableSessionRestore) {
                        await get().restoreSession();
                    }
                } else {
                    // Other errors - log but don't clear the user
                    console.warn('[Auth] Failed to fetch user info, but keeping existing auth state:', errorMessage);
                }
            }
        },
        restoreSession: async () => {
            const currentUser = get().user;
            
            // If we already have a user with a valid (non-expired) token, validate it first
            if (currentUser && currentUser.token && currentUser.expiresAt) {
                const isExpired = new Date(currentUser.expiresAt) <= new Date();
                
                if (!isExpired) {
                    // Token not expired - validate with backend to check if it's blacklisted or stale
                    const isValid = await validateTokenWithBackend(currentUser.token, config);
                    
                    if (!isValid) {
                        // Token is invalid (blacklisted or stale) - clear it and try to restore
                        console.log('[Auth] Token validation failed (token is stale or blacklisted), clearing and attempting restore');
                        set({ user: null, isAuthenticated: false, isSuperAdmin: false });
                        // Fall through to restore from backend
                    } else {
                        // Token is valid, just refresh admin status in background
                        fetchUserInfo(currentUser.token, config).then(userInfo => {
                            if (userInfo) {
                                const updatedUser: User = { 
                                    ...currentUser, 
                                    isSuperAdmin: userInfo.isSuperAdmin, 
                                    displayName: userInfo.displayName || currentUser.displayName,
                                    customerId: userInfo.customerId || currentUser.customerId,
                                };
                                set({ 
                                    user: updatedUser, 
                                    isSuperAdmin: userInfo.isSuperAdmin,
                                });
                            }
                        }).catch(err => {
                            // If fetchUserInfo fails with token mismatch, try to restore session
                            const errorMessage = err instanceof Error ? err.message : String(err);
                            const isTokenMismatch = errorMessage.includes('token does not match') || 
                                                    errorMessage.includes('Token mismatch') ||
                                                    errorMessage.includes('decryption failed');
                            
                            if (isTokenMismatch) {
                                console.warn('[Auth] Token mismatch detected during background refresh, will restore session on next call');
                                // Clear the stale token so next restoreSession call will restore from backend
                                set({ user: null, isAuthenticated: false, isSuperAdmin: false });
                            } else {
                                console.debug('[Auth] Background admin status refresh failed (non-critical):', err);
                            }
                        });
                        return true; // Already authenticated with valid token - don't clear!
                    }
                }
                // Token is expired - try to restore from backend, but don't clear user yet
                // Only clear if backend restore fails
            }
            
            // Try to restore from backend (IP-based session sharing)
            // This runs if we don't have a user, the user's token is expired, or token validation failed
            if (!config?.enableSessionRestore) {
                return false;
            }
            
            const restoredUser = await restoreSessionFromBackend(config);
            if (restoredUser) {
                set({ user: restoredUser, isAuthenticated: true, isSuperAdmin: false });
                // Fetch admin status after restoring session (don't clear if it fails)
                const userInfo = await fetchUserInfo(restoredUser.token, config);
                if (userInfo) {
                    const updatedUser: User = { 
                        ...restoredUser, 
                        isSuperAdmin: userInfo.isSuperAdmin, 
                        displayName: userInfo.displayName || restoredUser.displayName,
                        customerId: userInfo.customerId || restoredUser.customerId,
                    };
                    set({ 
                        user: updatedUser, 
                        isSuperAdmin: userInfo.isSuperAdmin,
                    });
                } else {
                    // If fetchUserInfo fails, keep the user but log the issue
                    console.warn('[Auth] Failed to fetch admin status after restore, but keeping user authenticated');
                }
                return true; // Successfully restored
            } else if (currentUser && currentUser.expiresAt && new Date(currentUser.expiresAt) <= new Date()) {
                // Backend restore failed AND token is expired - only now clear the user
                console.log('[Auth] Token expired and backend restore failed, clearing auth state');
                set({ user: null, isAuthenticated: false, isSuperAdmin: false });
                return false; // Failed to restore
            }
            // If backend restore failed but we have a valid user, keep them logged in
            return false; // No user to restore or restore failed
        },
    });

    return create<ZustandAuthState>()(
        persist(
            authStoreCreator,
            {
                name: storageKey,
                storage: storage ? createJSONStorage(() => storage) : undefined,
                partialize: (state: ZustandAuthState) => ({ user: state.user }),
                // After hydration, restore session if needed
                onRehydrateStorage: () => {
                    return async (state) => {
                        if (state) {
                            // CRITICAL: Set isAuthenticated and isSuperAdmin from restored user
                            if (state.user) {
                                // Validate token exists and is not empty
                                if (!state.user.token || state.user.token.trim().length === 0) {
                                    console.warn('[Auth] User found in storage but token is missing or empty, clearing auth state');
                                    state.user = null;
                                    state.isAuthenticated = false;
                                    state.isSuperAdmin = false;
                                    await state.restoreSession();
                                    return;
                                }
                                
                                // Check if token is expired locally first (fast check)
                                const isExpired = state.user.expiresAt && new Date(state.user.expiresAt) <= new Date();
                                
                                if (!isExpired) {
                                    // Token not expired locally - validate with backend to check if blacklisted or stale
                                    // This ensures we detect tokens that were blacklisted on other domains or are stale
                                    const isValid = await validateTokenWithBackend(state.user.token, config);
                                    
                                    if (!isValid) {
                                        // Token is blacklisted, invalid, or stale (token mismatch) - clear auth state
                                        console.log('[Auth] Token validation failed (blacklisted, invalid, or stale), clearing auth state');
                                        state.user = null;
                                        state.isAuthenticated = false;
                                        state.isSuperAdmin = false;
                                        // Try to restore session from backend (in case there's a valid session for this IP)
                                        if (config?.enableSessionRestore) {
                                            await state.restoreSession();
                                        }
                                        return;
                                    }
                                    
                                    // Token is valid - restore auth state
                                    // Extract isSuperAdmin from JWT if not already set
                                    const payload = decodeJWTPayload(state.user.token);
                                    const isSuperAdmin = payload?.isSuperAdmin === true || state.user.isSuperAdmin || false;
                                    
                                    state.isAuthenticated = true;
                                    state.isSuperAdmin = isSuperAdmin;
                                    
                                    // Just refresh admin status and customerId in background, don't clear user
                                    console.log('[Auth] User authenticated from localStorage, token valid until:', state.user.expiresAt);
                                    if (state.user.token) {
                                        // Don't await - let it run in background, don't block hydration
                                        state.fetchUserInfo().catch(err => {
                                            // If fetchUserInfo fails with token mismatch, clear and restore
                                            const errorMessage = err instanceof Error ? err.message : String(err);
                                            const isTokenMismatch = errorMessage.includes('token does not match') || 
                                                                    errorMessage.includes('Token mismatch') ||
                                                                    errorMessage.includes('decryption failed');
                                            
                                            if (isTokenMismatch) {
                                                console.warn('[Auth] Token mismatch detected during background fetch, clearing and restoring session');
                                                state.user = null;
                                                state.isAuthenticated = false;
                                                state.isSuperAdmin = false;
                                                if (config?.enableSessionRestore) {
                                                    state.restoreSession().catch(restoreErr => {
                                                        console.debug('[Auth] Session restore after token mismatch failed:', restoreErr);
                                                    });
                                                }
                                            } else {
                                                console.debug('[Auth] Background fetchUserInfo failed (non-critical):', err);
                                            }
                                        });
                                    }
                                } else {
                                    // Token expired, try to restore from backend before clearing
                                    console.log('[Auth] Token expired, attempting to restore from backend');
                                    if (config?.enableSessionRestore) {
                                        const restored = await state.restoreSession();
                                        if (!restored) {
                                            // Backend restore failed, clear auth
                                            state.user = null;
                                            state.isAuthenticated = false;
                                            state.isSuperAdmin = false;
                                        }
                                    } else {
                                        // Session restore disabled, clear auth
                                        state.user = null;
                                        state.isAuthenticated = false;
                                        state.isSuperAdmin = false;
                                    }
                                }
                            } else {
                                // No user in localStorage - try to restore from backend (IP-based session sharing)
                                console.log('[Auth] No user in storage, attempting to restore session from backend');
                                if (config?.enableSessionRestore) {
                                    await state.restoreSession();
                                }
                            }
                        }
                    };
                },
            }
        )
    );
}
