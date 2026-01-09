/**
 * Svelte adapter for auth store
 * Use this in Svelte projects
 * 
 * CRITICAL: We ONLY have Customer entities - NO "customer" entity exists
 */

import { writable, derived, get, type Writable, type Readable } from 'svelte/store';
import type { AuthenticatedCustomer, AuthStoreConfig } from '../core/types.js';
import { 
    restoreSessionFromBackend, 
    validateTokenWithBackend, 
    fetchCustomerInfo,
    decodeJWTPayload 
} from '../core/api.js';

/**
 * Create Svelte auth stores
 */
export function createAuthStore(config?: AuthStoreConfig) {
    const storageKey = config?.storageKey || 'auth_customer';
    const storage = config?.storage || (typeof window !== 'undefined' ? window.localStorage : null);
    
    // Core stores
    const customer: Writable<AuthenticatedCustomer | null> = writable(null);
    const isAuthenticated: Writable<boolean> = writable(false);
    const isSuperAdmin: Writable<boolean> = writable(false);
    const csrfToken: Writable<string | null> = writable(null);
    
    // Derived stores
    const isTokenExpired: Readable<boolean> = derived(
        customer,
        ($customer) => {
            if (!$customer) return true;
            return new Date($customer.expiresAt) < new Date();
        }
    );
    
    /**
     * Save authentication state to storage
     */
    function saveAuthState(customerData: AuthenticatedCustomer | null): void {
        if (customerData) {
            // Store customer data in storage
            if (storage) {
                storage.setItem(storageKey, JSON.stringify(customerData));
                // Clean up old storage keys
                storage.removeItem('auth_user');
            }
            
            // Extract CSRF token and isSuperAdmin from JWT payload
            const payload = decodeJWTPayload(customerData.token);
            const csrf = payload?.csrf as string | undefined;
            const isSuperAdminValue = payload?.isSuperAdmin === true || customerData.isSuperAdmin || false;
            
            // Update customerData with isSuperAdmin from JWT if not already set
            const updatedCustomerData = { ...customerData, isSuperAdmin: isSuperAdminValue };
            
            isAuthenticated.set(true);
            customer.set(updatedCustomerData);
            csrfToken.set(csrf || null);
            isSuperAdmin.set(isSuperAdminValue);
        } else {
            // Clear storage
            if (storage) {
                storage.removeItem(storageKey);
                storage.removeItem('auth_user'); // Clean up old storage
                storage.removeItem('auth_token'); // Clean up any old token storage
            }
            isAuthenticated.set(false);
            customer.set(null);
            csrfToken.set(null);
            isSuperAdmin.set(false);
        }
    }
    
    /**
     * Set customer authentication state
     */
    function setCustomer(customerData: AuthenticatedCustomer | null): void {
        saveAuthState(customerData);
    }
    
    /**
     * Clear authentication state (logout)
     */
    async function logout(): Promise<void> {
        try {
            // Try to call logout endpoint to invalidate token on server
            const currentCustomer = get(customer);
            if (currentCustomer?.token) {
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
     * Fetch fresh customer info from /auth/me endpoint
     */
    async function fetchCustomerInfoFromAPI(): Promise<void> {
        const currentCustomer = get(customer);
        if (!currentCustomer || !currentCustomer.token) {
            return;
        }
        
        // CRITICAL: Don't clear customer if fetchCustomerInfo fails - only update if it succeeds
        const customerInfo = await fetchCustomerInfo(currentCustomer.token, config);
        if (customerInfo) {
            const updatedCustomer: AuthenticatedCustomer = { 
                ...currentCustomer, 
                isSuperAdmin: customerInfo.isSuperAdmin, 
                displayName: customerInfo.displayName || currentCustomer.displayName,
                customerId: currentCustomer.customerId, // Don't override
            };
            saveAuthState(updatedCustomer);
        } else {
            // If fetchCustomerInfo fails, log but don't clear the customer - they're still authenticated
            console.warn('[Auth] Failed to fetch customer info, but keeping existing auth state');
        }
    }
    
    /**
     * Restore session from backend (IP-based session sharing)
     */
    async function restoreSession(): Promise<boolean> {
        const currentCustomer = get(customer);
        
        // If we already have a customer with a valid (non-expired) token, don't clear them
        // Just refresh admin status in background
        if (currentCustomer && currentCustomer.token && currentCustomer.expiresAt) {
            const isExpired = new Date(currentCustomer.expiresAt) <= new Date();
            
            if (!isExpired) {
                // Token is valid, just refresh admin status in background
                fetchCustomerInfoFromAPI().catch(err => {
                    console.debug('[Auth] Background admin status refresh failed (non-critical):', err);
                });
                return true; // Already authenticated with valid token - don't clear!
            }
            // Token is expired - try to restore from backend, but don't clear customer yet
            // Only clear if backend restore fails
        }
        
        // Try to restore from backend (IP-based session sharing)
        if (!config?.enableSessionRestore) {
            return false;
        }
        
        const restoredCustomer = await restoreSessionFromBackend(config);
        if (restoredCustomer) {
            saveAuthState(restoredCustomer);
            // Fetch admin status after restoring session (don't clear if it fails)
            const customerInfo = await fetchCustomerInfo(restoredCustomer.token, config);
            if (customerInfo) {
                const updatedCustomer: AuthenticatedCustomer = { 
                    ...restoredCustomer, 
                    isSuperAdmin: customerInfo.isSuperAdmin, 
                    displayName: customerInfo.displayName || restoredCustomer.displayName,
                    customerId: restoredCustomer.customerId, // Don't override
                };
                saveAuthState(updatedCustomer);
            } else {
                // If fetchCustomerInfo fails, keep the customer but log the issue
                console.warn('[Auth] Failed to fetch admin status after restore, but keeping customer authenticated');
            }
            return true; // Successfully restored
        } else if (currentCustomer && currentCustomer.expiresAt && new Date(currentCustomer.expiresAt) <= new Date()) {
            // Backend restore failed AND token is expired - only now clear the customer
            console.log('[Auth] Token expired and backend restore failed, clearing auth state');
            saveAuthState(null);
            return false; // Failed to restore
        }
        // If backend restore failed but we have a valid customer, keep them logged in
        return false; // No customer to restore or restore failed
    }
    
    /**
     * Load authentication state from storage
     * CRITICAL: Validates tokens with backend to detect blacklisted tokens from logout on other domains
     */
    async function loadAuthState(): Promise<void> {
        try {
            let customerData: AuthenticatedCustomer | null = null;
            
            // Try to load from storage (try new key first, fallback to old key for migration)
            if (storage) {
                let stored = storage.getItem(storageKey);
                if (!stored) {
                    // Try old key for migration
                    stored = storage.getItem('auth_user');
                    if (stored) {
                        // Migrate from old key
                        try {
                            const oldData = JSON.parse(stored) as any;
                            customerData = {
                                customerId: oldData.customerId || oldData.customerId || oldData.sub || '',
                                email: oldData.email,
                                displayName: oldData.displayName,
                                token: oldData.token,
                                expiresAt: oldData.expiresAt,
                                isSuperAdmin: oldData.isSuperAdmin,
                            };
                            // Save under new key and remove old key
                            storage.setItem(storageKey, JSON.stringify(customerData));
                        storage.removeItem('auth_user');
                    } catch (e) {
                        console.warn('[Auth] Failed to migrate old storage data');
                    }
                    }
                } else {
                    try {
                        customerData = JSON.parse(stored) as AuthenticatedCustomer;
                    } catch (e) {
                        console.warn('[Auth] Failed to parse stored customer data');
                    }
                }
            }
            
            // Token is stored in customerData
            if (customerData && customerData.token && 'expiresAt' in customerData && typeof customerData.expiresAt === 'string') {
                // Check if token is expired locally first (fast check)
                if (new Date(customerData.expiresAt) > new Date()) {
                    // Token not expired locally - validate with backend to check if blacklisted
                    const isValid = await validateTokenWithBackend(customerData.token, config);
                    
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
                    const payload = decodeJWTPayload(customerData.token);
                    const csrf = payload?.csrf as string | undefined;
                    const isSuperAdminValue = payload?.isSuperAdmin === true || customerData.isSuperAdmin || false;
                    if (csrf) {
                        csrfToken.set(csrf);
                    }
                    // Update customerData with isSuperAdmin from JWT if not already set
                    const updatedCustomerData = { ...customerData, isSuperAdmin: isSuperAdminValue };
                    saveAuthState(updatedCustomerData);
                    console.log('[Auth] ✓ Customer authenticated from storage, token valid until:', customerData.expiresAt);
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

            // No customerData found - try to restore session from backend
            // This enables cross-application session sharing for the same device/IP
            if (!customerData && config?.enableSessionRestore) {
                await restoreSession();
            }
        } catch (error) {
            console.error('[Auth] Failed to load auth state:', error);
            // Don't clear auth on error - might be a temporary network issue
            // Only clear if we truly have no customerData
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
        const currentCustomer = get(customer);
        return currentCustomer?.token || null;
    }
    
    /**
     * Get current CSRF token from JWT payload
     */
    function getCsrfTokenValue(): string | null {
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
        customer,
        isAuthenticated,
        isSuperAdmin,
        csrfToken,
        isTokenExpired,
        
        // Methods
        setCustomer,
        logout,
        restoreSession,
        fetchCustomerInfo: fetchCustomerInfoFromAPI,
        loadAuthState,
        getAuthToken,
        getCsrfToken: getCsrfTokenValue,
    };
}
