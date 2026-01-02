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
        _isRestoring: false, // Guard to prevent concurrent restore calls
        _lastRestoreAttempt: 0, // Timestamp of last restore attempt to debounce
        setUser: (user: User | null) => {
            // CRITICAL: Trim token when storing to ensure consistency with backend
            if (!user) {
                set({ 
                    user: null, 
                    isAuthenticated: false,
                    isSuperAdmin: false,
                });
                return;
            }
            
            let userToStore: User = user;
            if (user.token) {
                const trimmedToken = user.token.trim();
                if (trimmedToken !== user.token) {
                    userToStore = { ...user, token: trimmedToken };
                }
                // Extract isSuperAdmin and customerId from JWT if not already set
                let isSuperAdmin = user.isSuperAdmin || false;
                let customerId = user.customerId || null;
                const payload = decodeJWTPayload(trimmedToken);
                if (payload?.isSuperAdmin === true) {
                    isSuperAdmin = true;
                }
                if (payload?.customerId && !customerId) {
                    customerId = payload.customerId as string | null;
                }
                
                // Update user with extracted customerId if needed
                if (customerId && customerId !== userToStore.customerId) {
                    userToStore = { ...userToStore, customerId };
                }
                
                set({ 
                    user: userToStore, 
                    isAuthenticated: true,
                    isSuperAdmin,
                });
            } else {
                set({ 
                    user: userToStore, 
                    isAuthenticated: true,
                    isSuperAdmin: false,
                });
            }
        },
        logout: async () => {
            // Try to call logout endpoint to invalidate token on server
            try {
                const currentUser = get().user;
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
                set({ user: null, isAuthenticated: false, isSuperAdmin: false });
            }
        },
        fetchUserInfo: async () => {
            const currentUser = get().user;
            if (!currentUser || !currentUser.token) {
                return;
            }
            
            // CRITICAL: Trim token before using it to ensure it matches the token used for encryption on backend
            const trimmedToken = currentUser.token.trim();
            if (trimmedToken !== currentUser.token) {
                // Token had whitespace - update it
                const updatedUser = { ...currentUser, token: trimmedToken };
                set({ user: updatedUser });
            }
            
            // CRITICAL: Don't clear user if fetchUserInfo fails - only update if it succeeds
            // This prevents undefined cache values from wiping the session
            // EXCEPTION: If token mismatch is detected, we should clear and restore
            try {
                const userInfo = await fetchUserInfo(trimmedToken, config);
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
                    console.warn('[Auth] Token mismatch detected in fetchUserInfo, extracting customerId from JWT before restoring session');
                    
                    // CRITICAL: Extract customerId from JWT BEFORE clearing user
                    // This ensures the user can still access features that require customerId
                    // even if the token is stale and restore fails
                    const jwtPayload = decodeJWTPayload(currentUser.token);
                    const jwtCustomerId = jwtPayload?.customerId as string | null | undefined;
                    
                    // Try to restore session first (this will get a fresh token)
                    if (config?.enableSessionRestore) {
                        try {
                            const restored = await get().restoreSession();
                            if (restored) {
                                // Restore succeeded - user should now have fresh token and customerId
                                console.log('[Auth] Session restored successfully after token mismatch');
                                return; // Exit early - restoreSession already updated the user
                            }
                        } catch (restoreError) {
                            console.warn('[Auth] Session restore failed after token mismatch:', restoreError);
                        }
                    }
                    
                    // If restore failed or is disabled, keep user logged in with customerId from JWT
                    // This allows the user to continue using the app even with a stale token
                    if (jwtCustomerId) {
                        const userWithCustomerId: User = {
                            ...currentUser,
                            customerId: jwtCustomerId || currentUser.customerId,
                        };
                        set({ user: userWithCustomerId });
                        console.log('[Auth] Kept user logged in with customerId from JWT:', jwtCustomerId);
                    } else {
                        // No customerId in JWT and restore failed - clear user
                        console.warn('[Auth] No customerId in JWT and restore failed - clearing user');
                        set({ user: null, isAuthenticated: false, isSuperAdmin: false });
                    }
                } else {
                    // Other errors - log but don't clear the user
                    console.warn('[Auth] Failed to fetch user info, but keeping existing auth state:', errorMessage);
                }
            }
        },
        restoreSession: async () => {
            // Prevent infinite loops - if we're already restoring, don't restore again
            const state = get() as any;
            if (state._isRestoring) {
                console.debug('[Auth] Restore already in progress, skipping duplicate call');
                return false;
            }
            
            // Mark as restoring to prevent concurrent calls
            state._isRestoring = true;
            
            try {
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
                        // CRITICAL: Use the token from currentUser directly to avoid any timing issues
                        fetchUserInfo(currentUser.token, config).then(userInfo => {
                            if (userInfo) {
                                // Get current user again to ensure we have the latest state
                                const latestUser = get().user;
                                if (latestUser && latestUser.token === currentUser.token) {
                                    const updatedUser: User = { 
                                        ...latestUser, 
                                        isSuperAdmin: userInfo.isSuperAdmin, 
                                        displayName: userInfo.displayName || latestUser.displayName,
                                        customerId: userInfo.customerId || latestUser.customerId,
                                    };
                                    set({ 
                                        user: updatedUser, 
                                        isSuperAdmin: userInfo.isSuperAdmin,
                                    });
                                }
                            }
                        }).catch(err => {
                            // If fetchUserInfo fails with token mismatch, clear and restore session
                            const errorMessage = err instanceof Error ? err.message : String(err);
                            const isTokenMismatch = (err as any)?.isTokenMismatch === true ||
                                                    errorMessage.includes('token does not match') || 
                                                    errorMessage.includes('Token mismatch') ||
                                                    errorMessage.includes('decryption failed');
                            
                            if (isTokenMismatch) {
                                // Token mismatch - don't spam restore, just log it
                                // The token is stale but clearing it will cause infinite loops
                                // Instead, just log and let the user continue - if the token is truly broken,
                                // API calls will fail and they can log in again
                                console.warn('[Auth] Token mismatch detected during background refresh - token may be stale');
                                console.warn('[Auth] Keeping user logged in - if API calls fail, user should log in again');
                                // DON'T clear or restore here - that causes infinite loops
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
                // CRITICAL: Extract customerId from JWT immediately so user can access upload
                const jwtPayload = decodeJWTPayload(restoredUser.token);
                const jwtCustomerId = jwtPayload?.customerId as string | null | undefined;
                const userWithCustomerId: User = {
                    ...restoredUser,
                    customerId: restoredUser.customerId || jwtCustomerId || null,
                };
                
                set({ user: userWithCustomerId, isAuthenticated: true, isSuperAdmin: false });
                // Fetch admin status after restoring session
                try {
                    const userInfo = await fetchUserInfo(userWithCustomerId.token, config);
                    if (userInfo) {
                        const updatedUser: User = { 
                            ...userWithCustomerId, 
                            isSuperAdmin: userInfo.isSuperAdmin, 
                            displayName: userInfo.displayName || userWithCustomerId.displayName,
                            customerId: userInfo.customerId || userWithCustomerId.customerId || jwtCustomerId || null,
                        };
                        set({ 
                            user: updatedUser, 
                            isSuperAdmin: userInfo.isSuperAdmin,
                        });
                        return true; // Successfully restored
                    } else {
                        // fetchUserInfo returned null - we already have customerId from JWT, keep user logged in
                        console.warn('[Auth] fetchUserInfo returned null after restore - keeping user logged in with customerId from JWT');
                        return true; // Keep user logged in - customerId already extracted from JWT
                    }
                } catch (error) {
                    // Check if this is a token mismatch error
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    const isTokenMismatch = (error as any)?.isTokenMismatch === true ||
                                            errorMessage.includes('token does not match') || 
                                            errorMessage.includes('Token mismatch') ||
                                            errorMessage.includes('decryption failed');
                    
                    if (isTokenMismatch) {
                        // Token mismatch after restore - this can happen if restore created a new token
                        // but the backend session still has the old token. Extract customerId from JWT
                        // and keep the user logged in - they can still use the app
                        console.warn('[Auth] Token mismatch detected after restore - keeping restored user logged in');
                        const jwtPayload = decodeJWTPayload(restoredUser.token);
                        const jwtCustomerId = jwtPayload?.customerId as string | null | undefined;
                        if (jwtCustomerId && !restoredUser.customerId) {
                            const userWithCustomerId: User = {
                                ...restoredUser,
                                customerId: jwtCustomerId,
                            };
                            set({ user: userWithCustomerId });
                        }
                        // Keep the user - don't clear them or we'll get into infinite restore loops
                        return true; // Consider restore successful even if fetchUserInfo failed
                    } else {
                        // Other error - log but keep the restored user
                        console.warn('[Auth] Failed to fetch admin status after restore (non-critical):', errorMessage);
                        // Keep the user authenticated even if we couldn't fetch admin status
                        return true; // Consider restore successful even if admin status fetch failed
                    }
                }
            } else if (currentUser && currentUser.expiresAt && new Date(currentUser.expiresAt) <= new Date()) {
                // Backend restore failed AND token is expired - only now clear the user
                console.log('[Auth] Token expired and backend restore failed, clearing auth state');
                set({ user: null, isAuthenticated: false, isSuperAdmin: false });
                return false; // Failed to restore
            }
            // If backend restore failed but we have a valid user, keep them logged in
            return false; // No user to restore or restore failed
            } finally {
                // Always clear the restoring flag
                const state = get() as any;
                state._isRestoring = false;
                // Don't reset _lastRestoreAttempt - let debounce work
            }
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
                            // CRITICAL: Trim token when hydrating from storage to ensure consistency
                            if (state.user?.token) {
                                const trimmedToken = state.user.token.trim();
                                if (trimmedToken !== state.user.token) {
                                    state.user = { ...state.user, token: trimmedToken };
                                    console.log('[Auth] Trimmed token during hydration');
                                }
                            }
                            
                            // Extract customerId from JWT immediately if available
                            if (state.user?.token && !state.user.customerId) {
                                const jwtPayload = decodeJWTPayload(state.user.token);
                                const jwtCustomerId = jwtPayload?.customerId as string | null | undefined;
                                if (jwtCustomerId) {
                                    state.user = { ...state.user, customerId: jwtCustomerId };
                                    console.log('[Auth] Extracted customerId from JWT during hydration:', jwtCustomerId);
                                }
                            }
                            
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
                                        // CRITICAL: Use the token from state.user directly, not from the store's fetchUserInfo
                                        // This ensures we use the exact token that was validated, avoiding timing issues
                                        // Don't await - let it run in background, don't block hydration
                                        fetchUserInfo(state.user.token, config).catch(err => {
                                            // If fetchUserInfo fails with token mismatch, clear and restore
                                            const errorMessage = err instanceof Error ? err.message : String(err);
                                            const isTokenMismatch = (err as any)?.isTokenMismatch === true ||
                                                                    errorMessage.includes('token does not match') || 
                                                                    errorMessage.includes('Token mismatch') ||
                                                                    errorMessage.includes('decryption failed');
                                            
                                            if (isTokenMismatch) {
                                                // Token mismatch - don't spam restore, just extract customerId from JWT if needed
                                                console.warn('[Auth] Token mismatch detected during background fetch - token may be stale');
                                                if (state.user) {
                                                    const jwtPayload = decodeJWTPayload(state.user.token);
                                                    const jwtCustomerId = jwtPayload?.customerId as string | null | undefined;
                                                    if (jwtCustomerId && !state.user.customerId) {
                                                        state.user = { 
                                                            ...state.user, 
                                                            customerId: jwtCustomerId,
                                                            userId: state.user.userId, // Ensure userId is explicitly set
                                                        };
                                                        console.log('[Auth] Extracted customerId from JWT after token mismatch:', jwtCustomerId);
                                                    }
                                                }
                                                // DON'T clear or restore - that causes infinite loops
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
                                // BUT: Don't restore here if Layout component will also call restoreSession
                                // The Layout component's restoreSession call will handle this
                                console.log('[Auth] No user in storage - Layout component will attempt restore on mount');
                                // Don't call restoreSession here to avoid duplicate calls
                            }
                        }
                    };
                },
            }
        )
    );
}
