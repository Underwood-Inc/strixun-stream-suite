/**
 * Auth store using Zustand
 * Manages authentication state
 */

import { create, type StateCreator } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
    userId: string;
    email: string;
    displayName?: string | null;
    token: string;
    expiresAt: string;
    isSuperAdmin?: boolean;
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isSuperAdmin: boolean;
    setUser: (user: User | null) => void;
    logout: () => void;
    restoreSession: () => Promise<boolean>;
    fetchUserInfo: () => Promise<void>;
}

// Use proxy in development (via Vite), direct URL in production
// E2E tests can override with VITE_AUTH_API_URL to use direct local worker URLs
const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL 
  ? import.meta.env.VITE_AUTH_API_URL  // Explicit URL override (for E2E tests)
  : (import.meta.env.DEV 
    ? '/auth-api'  // Vite proxy in development
    : 'https://auth.idling.app');  // Production default

/**
 * Restore session from backend based on IP address
 * This enables cross-application session sharing for the same device
 */
async function restoreSessionFromBackend(): Promise<User | null> {
    try {
        // Use the API framework client which already handles secureFetch internally
        // Import dynamically to avoid circular dependencies
        const { createAPIClient } = await import('@strixun/api-framework/client');
        const authClient = createAPIClient({
            baseURL: AUTH_API_URL,
            timeout: 10000, // Increased to 10 seconds for session restoration
        });
        
        const response = await authClient.post<{ restored: boolean; access_token?: string; token?: string; userId?: string; sub?: string; email?: string; displayName?: string | null; expiresAt?: string }>('/auth/restore-session', {});

        if (response.status !== 200 || !response.data) {
            // Not an error - just no session found
            if (response.status === 200 && response.data && !response.data.restored) {
                return null;
            } else {
                console.warn('[Auth] Session restoration failed:', response.status);
                return null;
            }
        }

        const data = response.data;
        if (data.restored && data.access_token) {
            // Session restored! Return user data
            const userId = data.userId || data.sub;
            const email = data.email;
            const token = data.access_token || data.token;
            const expiresAt = data.expiresAt;

            if (!userId || !email || !token || !expiresAt) {
                console.warn('[Auth] Session restoration incomplete - missing required fields');
                return null;
            }

            const user: User = {
                userId,
                email,
                displayName: data.displayName || null,
                token,
                expiresAt,
                isSuperAdmin: false, // Will be fetched separately
            };
            
            // Token is stored in user object, which is persisted to localStorage
            console.log('[Auth] ✓ Session restored from backend for user:', user.email);
            return user;
        }

        if (data.restored === false) {
            console.log('[Auth] No active session found for this IP address');
        } else {
            console.warn('[Auth] Unexpected response format from restore-session:', { restored: data.restored, hasToken: !!data.access_token });
        }

        return null;
    } catch (error) {
        // Log error for debugging (session restoration is optional but we want to know if it's failing)
        console.warn('[Auth] Session restoration error:', error instanceof Error ? error.message : String(error));
        if (error instanceof Error && error.stack) {
            console.debug('[Auth] Session restoration stack:', error.stack);
        }
        return null;
    }
}

/**
 * Validate token with backend to check if it's blacklisted or invalid
 * Returns true if token is valid, false if invalid/blacklisted
 * 
 * CRITICAL: This ensures we detect tokens that were blacklisted on other domains
 */
async function validateTokenWithBackend(token: string): Promise<boolean> {
    try {
        const { createAPIClient } = await import('@strixun/api-framework/client');
        const authClient = createAPIClient({
            baseURL: AUTH_API_URL,
            timeout: 5000, // 5 second timeout for validation
            auth: {
                tokenGetter: () => {
                    // CRITICAL: Return token so Authorization header is set
                    if (!token || typeof token !== 'string' || token.trim().length === 0) {
                        return null;
                    }
                    return token;
                },
            },
            cache: {
                enabled: false, // Never cache validation requests
            },
        });
        
        // Use /auth/me endpoint to validate token (returns 401 if invalid/blacklisted)
        const response = await authClient.get('/auth/me', undefined, {
            metadata: {
                token: token, // Pass token in metadata for decryption (if response is encrypted)
                cache: false, // Never cache validation requests
            },
        });
        
        // 200 = valid, 401 = invalid/blacklisted
        return response.status === 200;
    } catch (error) {
        // Network errors or other issues - assume valid to avoid blocking initialization
        console.warn('[Auth] Token validation failed (assuming valid):', error instanceof Error ? error.message : String(error));
        return true; // Assume valid to avoid blocking initialization
    }
}

/**
 * Fetch user info from /auth/me to get admin status
 * CRITICAL: Disable caching for this endpoint - we always need fresh user data
 * Also handles undefined cached values gracefully
 * 
 * NOTE: /auth/me returns encrypted responses that need to be decrypted with the JWT token
 */
async function fetchUserInfo(token: string): Promise<{ isSuperAdmin: boolean; displayName?: string | null } | null> {
    // CRITICAL: Validate token exists before making request
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
        console.error('[Auth] fetchUserInfo called with invalid token:', { hasToken: !!token, tokenType: typeof token, tokenLength: token?.length });
        return null;
    }
    
    try {
        const { createAPIClient } = await import('@strixun/api-framework/client');
        const authClient = createAPIClient({
            baseURL: AUTH_API_URL,
            timeout: 10000, // Increased to 10 seconds to handle slower responses
            auth: {
                tokenGetter: () => {
                    // Double-check token is still valid
                    if (!token || typeof token !== 'string' || token.trim().length === 0) {
                        console.warn('[Auth] tokenGetter returned invalid token');
                        return null;
                    }
                    return token;
                },
            },
            cache: {
                enabled: false, // CRITICAL: Never cache /auth/me - always fetch fresh to avoid undefined cache hits
            },
        });
        
        // CRITICAL: Pass token in metadata so the response handler can decrypt encrypted responses
        const response = await authClient.get<{ isSuperAdmin?: boolean; displayName?: string | null; [key: string]: any }>('/auth/me', undefined, {
            metadata: {
                cache: false, // Explicitly disable caching for this request
                token: token, // Pass token in metadata for decryption
            },
        });
        
        console.log('[Auth] /auth/me response:', { 
            status: response.status, 
            hasData: !!response.data,
            dataType: typeof response.data,
            dataKeys: response.data && typeof response.data === 'object' ? Object.keys(response.data) : null,
        });
        
        if (response.status === 200 && response.data) {
            // Validate that we got actual data, not undefined
            if (response.data === undefined || response.data === null) {
                console.error('[Auth] /auth/me returned undefined/null data - this indicates a decryption or caching issue');
                return null;
            }
            
            // Check if response is still encrypted (decryption failed)
            if (typeof response.data === 'object' && 'encrypted' in response.data && (response.data as any).encrypted === true) {
                console.error('[Auth] /auth/me response is still encrypted - decryption failed. Token may be invalid or missing from metadata.');
                return null;
            }
            
            return {
                isSuperAdmin: response.data.isSuperAdmin || false,
                displayName: response.data.displayName || null,
            };
        }
        
        console.warn('[Auth] /auth/me returned non-200 status:', response.status);
        return null;
    } catch (error) {
        console.error('[Auth] Failed to fetch user info:', error instanceof Error ? error.message : String(error));
        if (error instanceof Error && error.stack) {
            console.debug('[Auth] fetchUserInfo error stack:', error.stack);
        }
        return null;
    }
}

const authStoreCreator: StateCreator<AuthState> = (set, get) => ({
    user: null,
    isAuthenticated: false,
    isSuperAdmin: false,
    setUser: (user: User | null) => {
        // Token is stored in the user object in localStorage via Zustand persist
        // No need for separate sessionStorage - it gets cleared on reload anyway
        set({ 
            user, 
            isAuthenticated: !!user,
            isSuperAdmin: user?.isSuperAdmin || false,
        });
    },
    logout: () => {
        // Token is in user object, clearing user will clear it
        set({ user: null, isAuthenticated: false, isSuperAdmin: false });
    },
    fetchUserInfo: async () => {
        const currentUser = get().user;
        if (!currentUser || !currentUser.token) {
            return;
        }
        
        // CRITICAL: Don't clear user if fetchUserInfo fails - only update if it succeeds
        // This prevents undefined cache values from wiping the session
        const userInfo = await fetchUserInfo(currentUser.token);
        if (userInfo) {
            const updatedUser = { ...currentUser, isSuperAdmin: userInfo.isSuperAdmin, displayName: userInfo.displayName };
            set({ 
                user: updatedUser, 
                isSuperAdmin: userInfo.isSuperAdmin,
            });
        } else {
            // If fetchUserInfo fails, log but don't clear the user - they're still authenticated
            console.warn('[Auth] Failed to fetch user info, but keeping existing auth state');
        }
    },
    restoreSession: async () => {
        const currentUser = get().user;
        
        // If we already have a user with a valid (non-expired) token, don't clear them
        // Just refresh admin status in background
        if (currentUser && currentUser.token && currentUser.expiresAt) {
            const isExpired = new Date(currentUser.expiresAt) <= new Date();
            
            if (!isExpired) {
                // Token is valid, just refresh admin status in background
                fetchUserInfo(currentUser.token).then(userInfo => {
                    if (userInfo) {
                        const updatedUser = { ...currentUser, isSuperAdmin: userInfo.isSuperAdmin, displayName: userInfo.displayName };
                        set({ 
                            user: updatedUser, 
                            isSuperAdmin: userInfo.isSuperAdmin,
                        });
                    }
                }).catch(err => {
                    console.debug('[Auth] Background admin status refresh failed (non-critical):', err);
                });
                return true; // Already authenticated with valid token - don't clear!
            }
            // Token is expired - try to restore from backend, but don't clear user yet
            // Only clear if backend restore fails
        }
        
        // Try to restore from backend (IP-based session sharing)
        // This only runs if we don't have a user, or the user's token is expired
        const restoredUser = await restoreSessionFromBackend();
        if (restoredUser) {
            set({ user: restoredUser, isAuthenticated: true, isSuperAdmin: false });
            // Fetch admin status after restoring session (don't clear if it fails)
            const userInfo = await fetchUserInfo(restoredUser.token);
            if (userInfo) {
                const updatedUser = { ...restoredUser, isSuperAdmin: userInfo.isSuperAdmin, displayName: userInfo.displayName };
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

export const useAuthStore = create<AuthState>()(
    persist(
        authStoreCreator,
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state: AuthState) => ({ user: state.user }),
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
                            // Token not expired locally - validate with backend to check if blacklisted
                            // This ensures we detect tokens that were blacklisted on other domains
                            const isValid = await validateTokenWithBackend(state.user.token);
                            
                            if (!isValid) {
                                // Token is blacklisted or invalid - clear auth state
                                console.log('[Auth] Token is blacklisted or invalid, clearing auth state');
                                state.user = null;
                                state.isAuthenticated = false;
                                state.isSuperAdmin = false;
                                // Try to restore session from backend (in case there's a valid session for this IP)
                                await state.restoreSession();
                                return;
                            }
                            
                            // Token is valid - restore auth state
                            state.isAuthenticated = true;
                            state.isSuperAdmin = state.user.isSuperAdmin || false;
                            
                            // Just refresh admin status in background, don't clear user
                            console.log('[Auth] User authenticated from localStorage, token valid until:', state.user.expiresAt);
                            if (state.user.token) {
                                // Don't await - let it run in background, don't block hydration
                                state.fetchUserInfo().catch(err => {
                                    console.debug('[Auth] Background fetchUserInfo failed (non-critical):', err);
                                });
                            }
                        } else {
                            // Token expired, try to restore from backend before clearing
                            console.log('[Auth] Token expired, attempting to restore from backend');
                            const restored = await state.restoreSession();
                            if (!restored) {
                                // Backend restore failed, clear auth
                                state.user = null;
                                state.isAuthenticated = false;
                                state.isSuperAdmin = false;
                            }
                        }
                    } else {
                        // No user in localStorage - try to restore from backend (IP-based session sharing)
                        console.log('[Auth] No user in storage, attempting to restore session from backend');
                        await state.restoreSession();
                    }
                }
                };
            },
        }
    )
);

