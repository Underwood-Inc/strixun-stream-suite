/**
 * Auth store using Zustand
 * Manages authentication state
 */

import { create, type StateCreator } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
    userId: string;
    email: string;
    token: string;
    expiresAt: string;
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    setUser: (user: User | null) => void;
    logout: () => void;
    restoreSession: () => Promise<void>;
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
        
        const response = await authClient.post<{ restored: boolean; access_token?: string; token?: string; userId?: string; sub?: string; email?: string; expiresAt?: string }>('/auth/restore-session', {});

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
                token,
                expiresAt,
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

const authStoreCreator: StateCreator<AuthState> = (set, get) => ({
    user: null,
    isAuthenticated: false,
    setUser: (user: User | null) => {
        // Store token in sessionStorage when setting user
        if (user && typeof window !== 'undefined' && window.sessionStorage) {
            sessionStorage.setItem('auth_token', user.token);
        } else if (!user && typeof window !== 'undefined') {
            sessionStorage.removeItem('auth_token');
        }
        set({ user, isAuthenticated: !!user });
    },
    logout: () => {
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem('auth_token');
        }
        set({ user: null, isAuthenticated: false });
    },
    restoreSession: async () => {
        const currentUser = get().user;
        
        // If we already have a user, check if token is still valid
        if (currentUser) {
            const token = sessionStorage.getItem('auth_token');
            // If token matches and not expired, we're good
            if (token === currentUser.token && currentUser.expiresAt && new Date(currentUser.expiresAt) > new Date()) {
                return; // Already authenticated with valid token
            }
            // Token mismatch or expired - clear and restore
            set({ user: null, isAuthenticated: false });
        }
        
        // Try to restore from backend (IP-based session sharing)
        const restoredUser = await restoreSessionFromBackend();
        if (restoredUser) {
            set({ user: restoredUser, isAuthenticated: true });
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
                                // Update user token to match sessionStorage
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
                }
            },
        }
    )
);

