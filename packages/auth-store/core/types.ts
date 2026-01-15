/**
 * Core types for auth store
 * Framework-agnostic types that work across all implementations
 * 
 * SIMPLIFIED: HttpOnly cookie-based authentication
 * - No IP restoration
 * - No localStorage token storage
 * - Cookies handle everything
 */

export interface AuthenticatedCustomer {
    customerId: string; // PRIMARY IDENTITY - REQUIRED
    email: string;
    displayName?: string | null;
    token?: string; // Optional - only for backward compat, not used with cookies
    expiresAt?: string;
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
    customer: AuthenticatedCustomer | null;
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
     * Customer API base URL
     * Defaults to 'https://customer-api.idling.app' in production
     * Can be overridden via environment variable or config
     */
    customerApiUrl?: string;
}

export interface AuthStoreMethods {
    /**
     * Set customer authentication state
     */
    setCustomer: (customer: AuthenticatedCustomer | null) => void;
    
    /**
     * Clear authentication state (logout)
     * Calls /auth/logout to clear HttpOnly cookie
     */
    logout: () => Promise<void>;
    
    /**
     * Check authentication status by calling /auth/me
     * Returns true if authenticated, false otherwise
     */
    checkAuth: () => Promise<boolean>;
    
    /**
     * Fetch fresh customer info from backend
     * Updates customer state with latest displayName and isSuperAdmin
     */
    fetchCustomerInfo: () => Promise<void>;
}

export interface AuthStore extends AuthState, AuthStoreMethods {}
