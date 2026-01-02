/**
 * Core types for auth store
 * Framework-agnostic types that work across all implementations
 */

export interface User {
    userId: string;
    email: string;
    displayName?: string | null;
    customerId?: string | null; // Customer ID for data scoping (REQUIRED for mod operations)
    token: string;
    expiresAt: string;
    isSuperAdmin?: boolean;
    // Optional extensions for specific projects
    twitchAccount?: {
        twitchUserId: string;
        twitchUsername: string;
        displayName?: string;
        attachedAt: string;
    };
    [key: string]: unknown; // Allow additional properties
}

export interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isSuperAdmin: boolean;
}

export interface AuthStoreConfig {
    /**
     * Auth API base URL
     * Defaults to 'https://auth.idling.app' in production
     * Can be overridden via environment variable or config
     */
    authApiUrl?: string;
    
    /**
     * Storage key for persisting auth state
     * Defaults to 'auth-storage'
     */
    storageKey?: string;
    
    /**
     * Storage implementation (localStorage, sessionStorage, or custom)
     * Defaults to localStorage
     */
    storage?: Storage;
    
    /**
     * Enable session restoration from backend
     * Defaults to true
     */
    enableSessionRestore?: boolean;
    
    /**
     * Enable token validation with backend
     * Defaults to true
     */
    enableTokenValidation?: boolean;
    
    /**
     * Timeout for session restoration (ms)
     * Defaults to 10000 (10 seconds)
     */
    sessionRestoreTimeout?: number;
    
    /**
     * Timeout for token validation (ms)
     * Defaults to 5000 (5 seconds)
     */
    tokenValidationTimeout?: number;
}

export interface AuthStoreMethods {
    /**
     * Set user authentication state
     */
    setUser: (user: User | null) => void;
    
    /**
     * Clear authentication state (logout)
     */
    logout: () => void;
    
    /**
     * Restore session from backend (IP-based session sharing)
     * Returns true if session was restored, false otherwise
     */
    restoreSession: () => Promise<boolean>;
    
    /**
     * Fetch fresh user info from /auth/me endpoint
     * Updates user state with latest displayName, customerId, and isSuperAdmin
     */
    fetchUserInfo: () => Promise<void>;
}

export interface AuthStore extends AuthState, AuthStoreMethods {}
