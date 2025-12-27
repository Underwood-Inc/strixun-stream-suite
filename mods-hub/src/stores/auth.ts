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
        const response = await fetch(`${AUTH_API_URL}/auth/restore-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            // Not an error - just no session found
            if (response.status === 200) {
                const data = await response.json();
                if (!data.restored) {
                    return null;
                }
            } else {
                console.warn('[Auth] Session restoration failed:', response.status);
                return null;
            }
        }

        const data = await response.json();
        if (data.restored && data.access_token) {
            // Session restored! Return user data
            const user: User = {
                userId: data.userId || data.sub,
                email: data.email,
                token: data.access_token || data.token,
                expiresAt: data.expiresAt,
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
        // Also store token in sessionStorage when setting user
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
        // Only restore if no user is currently set
        if (!currentUser) {
            const restoredUser = await restoreSessionFromBackend();
            if (restoredUser) {
                set({ user: restoredUser, isAuthenticated: true });
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
        }
    )
);

