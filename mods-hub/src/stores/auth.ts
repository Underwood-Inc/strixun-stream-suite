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
    restoreSession: () => Promise<void>;
    fetchUserInfo: () => Promise<void>;
}

const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL || 'https://auth.idling.app';

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
            timeout: 5000, // 5 second timeout for session restoration
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
            
            // Store token in sessionStorage
            if (typeof window !== 'undefined' && window.sessionStorage) {
                sessionStorage.setItem('auth_token', user.token);
            }
            
            console.log('[Auth] ✅ Session restored from backend for user:', user.email);
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
 * Fetch user info from /auth/me to get admin status
 * CRITICAL: Disable caching for this endpoint - we always need fresh user data
 * Also handles undefined cached values gracefully
 * 
 * NOTE: /auth/me returns encrypted responses that need to be decrypted with the JWT token
 */
async function fetchUserInfo(token: string): Promise<{ isSuperAdmin: boolean; displayName?: string | null } | null> {
    try {
        const { createAPIClient } = await import('@strixun/api-framework/client');
        const authClient = createAPIClient({
            baseURL: AUTH_API_URL,
            timeout: 5000,
            auth: {
                tokenGetter: () => token,
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
        // Store token in sessionStorage when setting user
        if (user && typeof window !== 'undefined' && window.sessionStorage) {
            sessionStorage.setItem('auth_token', user.token);
        } else if (!user && typeof window !== 'undefined') {
            sessionStorage.removeItem('auth_token');
        }
        set({ 
            user, 
            isAuthenticated: !!user,
            isSuperAdmin: user?.isSuperAdmin || false,
        });
    },
    logout: () => {
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem('auth_token');
        }
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
        
        // If we already have a user, check if token is still valid
        if (currentUser) {
            const token = sessionStorage.getItem('auth_token');
            // If token matches and not expired, we're good - just refresh admin status
            if (token === currentUser.token && currentUser.expiresAt && new Date(currentUser.expiresAt) > new Date()) {
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
                return; // Already authenticated with valid token
            }
            // Token mismatch or expired - clear and restore
            set({ user: null, isAuthenticated: false });
        }
        
        // Try to restore from backend (IP-based session sharing)
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
        }
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
            onRehydrateStorage: () => (state) => {
                if (state) {
                    // After Zustand hydrates, check if we need to restore session
                    const token = typeof window !== 'undefined' ? sessionStorage.getItem('auth_token') : null;
                    if (state.user) {
                        // If we have a user but token doesn't match, restore
                        if (token !== state.user.token) {
                            if (token) {
                                // Update user token to match sessionStorage (preserve displayName)
                                state.setUser({ ...state.user, token });
                            } else {
                                // No token in sessionStorage, try to restore
                                state.restoreSession();
                            }
                        } else if (state.user.expiresAt && new Date(state.user.expiresAt) <= new Date()) {
                            // Token expired, restore session
                            state.restoreSession();
                        }
                    } else if (token) {
                        // We have a token but no user - restore session
                        state.restoreSession();
                    } else {
                        // No user and no token - try to restore from backend
                        state.restoreSession();
                    }
                    
                    // If we have a user, fetch admin status (but don't clear user if it fails)
                    if (state.user && state.user.token) {
                        // Don't await - let it run in background, don't block hydration
                        state.fetchUserInfo().catch(err => {
                            console.debug('[Auth] Background fetchUserInfo failed (non-critical):', err);
                        });
                    }
                }
            },
        }
    )
);

