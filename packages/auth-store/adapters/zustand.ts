/**
 * Zustand adapter for auth store
 * Use this in React projects
 */

import { create, type StateCreator } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthenticatedCustomer, AuthState, AuthStoreMethods, AuthStoreConfig } from '../core/types.js';
import { 
    restoreSessionFromBackend, 
    validateTokenWithBackend, 
    fetchCustomerInfo,
    decodeJWTPayload 
} from '../core/api.js';

interface ZustandAuthState extends AuthState, AuthStoreMethods {
    _isRestoring?: boolean; // Guard to prevent concurrent restore calls
    _lastRestoreAttempt?: number; // Timestamp of last restore attempt to debounce
    _lastLogoutTime?: number; // Timestamp of last logout to prevent immediate restoration
}

/**
 * Create Zustand auth store
 */
export function createAuthStore(config?: AuthStoreConfig) {
    const storageKey = config?.storageKey || 'auth-storage';
    const storage = config?.storage || (typeof window !== 'undefined' ? window.localStorage : null);
    
    const authStoreCreator: StateCreator<ZustandAuthState> = (set, get) => ({
        customer: null,
        isAuthenticated: false,
        isSuperAdmin: false,
        _isRestoring: false, // Guard to prevent concurrent restore calls
        _lastRestoreAttempt: 0, // Timestamp of last restore attempt to debounce
        _lastLogoutTime: 0, // Timestamp of last logout to prevent immediate restoration
        setCustomer: (customer: AuthenticatedCustomer | null) => {
            // CRITICAL: Trim token when storing to ensure consistency with backend
            if (!customer) {
                set({ 
                    customer: null, 
                    isAuthenticated: false,
                    isSuperAdmin: false,
                });
                return;
            }
            
            let customerToStore: AuthenticatedCustomer = customer;
            // Clear logout timestamp when setting a new customer (login)
            const state = get() as any;
            if (state._lastLogoutTime) {
                state._lastLogoutTime = 0;
            }
            
            if (customer.token) {
                const trimmedToken = customer.token.trim();
                if (trimmedToken !== customer.token) {
                    customerToStore = { ...customer, token: trimmedToken };
                }
                // Extract isSuperAdmin from JWT if not already set
                let isSuperAdmin = customer.isSuperAdmin || false;
                const payload = decodeJWTPayload(trimmedToken);
                if (payload?.isSuperAdmin === true) {
                    isSuperAdmin = true;
                }
                
                set({ 
                    customer: customerToStore, 
                    isAuthenticated: true, // Explicitly set isAuthenticated when customer is set
                    isSuperAdmin,
                    _lastLogoutTime: 0, // Clear logout timestamp on successful login
                });
            } else {
                set({ 
                    customer: customerToStore, 
                    isAuthenticated: true, // Explicitly set isAuthenticated when customer is set
                    isSuperAdmin: false,
                    _lastLogoutTime: 0, // Clear logout timestamp on successful login
                });
            }
        },
        logout: async () => {
            // Try to call logout endpoint to invalidate token on server
            try {
                const currentCustomer = get().customer;
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
                    
                    // CRITICAL: Store token before creating client (we'll clear it after)
                    const tokenToUse = currentCustomer.token.trim();
                    
                    const { createAPIClient } = await import('@strixun/api-framework/client');
                    const authClient = createAPIClient({
                        baseURL: apiUrl,
                        timeout: 5000,
                        auth: {
                            tokenGetter: () => {
                                // Return the token for this logout request
                                // CRITICAL: Trim token to ensure it matches the token used for encryption on backend
                                return tokenToUse;
                            },
                        },
                    });
                    await authClient.post('/auth/logout', {});
                }
            } catch (error) {
                // Continue with logout even if API call fails
                console.warn('[Auth] Logout API call failed, continuing with local logout:', error);
            } finally {
                // Always clear local auth state and record logout time
                set({ 
                    customer: null, 
                    isAuthenticated: false, 
                    isSuperAdmin: false,
                    _lastLogoutTime: Date.now(), // Record logout time to prevent immediate restoration
                });
            }
        },
        fetchCustomerInfo: async () => {
            const currentCustomer = get().customer;
            if (!currentCustomer || !currentCustomer.token) {
                return;
            }
            
            // CRITICAL: Trim token before using it to ensure it matches the token used for encryption on backend
            const trimmedToken = currentCustomer.token.trim();
            if (trimmedToken !== currentCustomer.token) {
                // Token had whitespace - update it
                const updatedCustomer = { ...currentCustomer, token: trimmedToken };
                set({ 
                    customer: updatedCustomer,
                    isAuthenticated: true, // Ensure isAuthenticated is set when customer is updated
                });
            }
            
            // CRITICAL: Don't clear customer if fetchCustomerInfo fails - only update if it succeeds
            // This prevents undefined cache values from wiping the session
            // EXCEPTION: If token mismatch is detected, we should clear and restore
            try {
                const customerInfo = await fetchCustomerInfo(trimmedToken, config);
                if (customerInfo) {
                    const updatedCustomer: AuthenticatedCustomer = { 
                        ...currentCustomer, 
                        isSuperAdmin: customerInfo.isSuperAdmin, 
                        displayName: customerInfo.displayName || currentCustomer.displayName,
                        customerId: currentCustomer.customerId, // customerId is already in customer, don't override
                    };
                    set({ 
                        customer: updatedCustomer, 
                        isSuperAdmin: customerInfo.isSuperAdmin,
                    });
                } else {
                    // Check if the response was still encrypted (token mismatch)
                    // This is detected by fetchCustomerInfo returning null when decryption fails
                    // We can't distinguish between "no data" and "token mismatch" from the return value,
                    // but the error logs will indicate token mismatch
                    console.warn('[Auth] Failed to fetch customer info, but keeping existing auth state');
                }
            } catch (error) {
                // Check if this is a token mismatch error
                const errorMessage = error instanceof Error ? error.message : String(error);
                const isTokenMismatch = errorMessage.includes('token does not match') || 
                                        errorMessage.includes('Token mismatch') ||
                                        errorMessage.includes('decryption failed');
                
                if (isTokenMismatch) {
                    console.warn('[Auth] Token mismatch detected in fetchCustomerInfo, extracting customerId from JWT before restoring session');
                    
                    // CRITICAL: Extract customerId from JWT BEFORE clearing customer
                    // This ensures the customer can still access features that require customerId
                    // even if the token is stale and restore fails
                    const jwtPayload = decodeJWTPayload(currentCustomer.token);
                    const jwtCustomerId = jwtPayload?.customerId as string | null | undefined;
                    
                    // Try to restore session first (this will get a fresh token)
                    if (config?.enableSessionRestore) {
                        try {
                            const restored = await get().restoreSession();
                            if (restored) {
                                // Restore succeeded - customer should now have fresh token and customerId
                                console.log('[Auth] Session restored successfully after token mismatch');
                                return; // Exit early - restoreSession already updated the customer
                            }
                        } catch (restoreError) {
                            console.warn('[Auth] Session restore failed after token mismatch:', restoreError);
                        }
                    }
                    
                    // If restore failed or is disabled, keep customer logged in with customerId from JWT
                    // This allows the customer to continue using the app even with a stale token
                    if (jwtCustomerId) {
                        const customerWithCustomerId: AuthenticatedCustomer = {
                            ...currentCustomer,
                            customerId: jwtCustomerId || currentCustomer.customerId,
                        };
                        set({ 
                            customer: customerWithCustomerId, 
                            isAuthenticated: true, // Ensure isAuthenticated is set when customer is updated
                        });
                        console.log('[Auth] Kept customer logged in with customerId from JWT:', jwtCustomerId);
                    } else {
                        // No customerId in JWT and restore failed - clear customer
                        console.warn('[Auth] No customerId in JWT and restore failed - clearing customer');
                        set({ customer: null, isAuthenticated: false, isSuperAdmin: false });
                    }
                } else {
                    // Other errors - log but don't clear the customer
                    console.warn('[Auth] Failed to fetch customer info, but keeping existing auth state:', errorMessage);
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
                const currentCustomer = get().customer;
                
                // If we already have a customer with a valid (non-expired) token, validate it first
                if (currentCustomer && currentCustomer.token && currentCustomer.expiresAt) {
                const isExpired = new Date(currentCustomer.expiresAt) <= new Date();
                
                if (!isExpired) {
                    // Token not expired - validate with backend to check if it's blacklisted or stale
                    const isValid = await validateTokenWithBackend(currentCustomer.token, config);
                    
                    if (!isValid) {
                        // Token is invalid (blacklisted or stale) - clear it and try to restore
                        console.log('[Auth] Token validation failed (token is stale or blacklisted), clearing and attempting restore');
                        set({ customer: null, isAuthenticated: false, isSuperAdmin: false });
                        // Fall through to restore from backend
                    } else {
                        // Token is valid, just refresh admin status in background
                        // CRITICAL: Use the token from currentCustomer directly to avoid any timing issues
                        fetchCustomerInfo(currentCustomer.token, config).then(customerInfo => {
                            if (customerInfo) {
                                // Get current customer again to ensure we have the latest state
                                const latestCustomer = get().customer;
                                if (latestCustomer && latestCustomer.token === currentCustomer.token) {
                                    const updatedCustomer: AuthenticatedCustomer = { 
                                        ...latestCustomer, 
                                        isSuperAdmin: customerInfo.isSuperAdmin, 
                                        displayName: customerInfo.displayName || latestCustomer.displayName,
                                        customerId: latestCustomer.customerId, // Don't override customerId
                                    };
                                    set({ 
                                        customer: updatedCustomer, 
                                        isAuthenticated: true, // Ensure isAuthenticated is set when customer is updated
                                        isSuperAdmin: customerInfo.isSuperAdmin,
                                    });
                                }
                            }
                        }).catch(err => {
                            // If fetchCustomerInfo fails with token mismatch, clear and restore session
                            const errorMessage = err instanceof Error ? err.message : String(err);
                            const isTokenMismatch = (err as any)?.isTokenMismatch === true ||
                                                    errorMessage.includes('token does not match') || 
                                                    errorMessage.includes('Token mismatch') ||
                                                    errorMessage.includes('decryption failed');
                            
                            if (isTokenMismatch) {
                                // Token mismatch - don't spam restore, just log it
                                // The token is stale but clearing it will cause infinite loops
                                // Instead, just log and let the customer continue - if the token is truly broken,
                                // API calls will fail and they can log in again
                                console.warn('[Auth] Token mismatch detected during background refresh - token may be stale');
                                console.warn('[Auth] Keeping customer logged in - if API calls fail, customer should log in again');
                                // DON'T clear or restore here - that causes infinite loops
                            } else {
                                console.debug('[Auth] Background admin status refresh failed (non-critical):', err);
                            }
                        });
                        return true; // Already authenticated with valid token - don't clear!
                    }
                }
                // Token is expired - try to restore from backend, but don't clear customer yet
                // Only clear if backend restore fails
            }
            
            // Try to restore from backend (IP-based session sharing)
            // This runs if we don't have a customer, the customer's token is expired, or token validation failed
            if (!config?.enableSessionRestore) {
                return false;
            }
            
            const restoredCustomer = await restoreSessionFromBackend(config);
            if (restoredCustomer) {
                // CRITICAL: Extract customerId from JWT immediately so customer can access upload
                const jwtPayload = decodeJWTPayload(restoredCustomer.token);
                const jwtCustomerId = jwtPayload?.customerId as string | null | undefined;
                const customerWithCustomerId: AuthenticatedCustomer = {
                    ...restoredCustomer,
                    customerId: restoredCustomer.customerId || jwtCustomerId || '',
                };
                
                set({ customer: customerWithCustomerId, isAuthenticated: true, isSuperAdmin: false });
                // Fetch admin status after restoring session
                try {
                    const customerInfo = await fetchCustomerInfo(customerWithCustomerId.token, config);
                    if (customerInfo) {
                        const updatedCustomer: AuthenticatedCustomer = { 
                            ...customerWithCustomerId, 
                            isSuperAdmin: customerInfo.isSuperAdmin, 
                            displayName: customerInfo.displayName || customerWithCustomerId.displayName,
                            customerId: customerWithCustomerId.customerId, // Don't override customerId
                        };
                        set({ 
                            customer: updatedCustomer, 
                            isAuthenticated: true, // Ensure isAuthenticated is set when customer is updated
                            isSuperAdmin: customerInfo.isSuperAdmin,
                        });
                        return true; // Successfully restored
                    } else {
                        // fetchCustomerInfo returned null - we already have customerId from JWT, keep customer logged in
                        console.warn('[Auth] fetchCustomerInfo returned null after restore - keeping customer logged in with customerId from JWT');
                        return true; // Keep customer logged in - customerId already extracted from JWT
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
                        // and keep the customer logged in - they can still use the app
                        console.warn('[Auth] Token mismatch detected after restore - keeping restored customer logged in');
                        const jwtPayload = decodeJWTPayload(restoredCustomer.token);
                        const jwtCustomerId = jwtPayload?.customerId as string | null | undefined;
                        if (jwtCustomerId && !restoredCustomer.customerId) {
                            const customerWithCustomerId: AuthenticatedCustomer = {
                                ...restoredCustomer,
                                customerId: jwtCustomerId,
                            };
                            set({ 
                                customer: customerWithCustomerId, 
                                isAuthenticated: true, // Ensure isAuthenticated is set when customer is updated
                            });
                        }
                        // Keep the customer - don't clear them or we'll get into infinite restore loops
                        return true; // Consider restore successful even if fetchCustomerInfo failed
                    } else {
                        // Other error - log but keep the restored customer
                        console.warn('[Auth] Failed to fetch admin status after restore (non-critical):', errorMessage);
                        // Keep the customer authenticated even if we couldn't fetch admin status
                        return true; // Consider restore successful even if admin status fetch failed
                    }
                }
            } else if (currentCustomer && currentCustomer.expiresAt && new Date(currentCustomer.expiresAt) <= new Date()) {
                // Backend restore failed AND token is expired - only now clear the customer
                console.log('[Auth] Token expired and backend restore failed, clearing auth state');
                set({ customer: null, isAuthenticated: false, isSuperAdmin: false });
                return false; // Failed to restore
            }
            // If backend restore failed but we have a valid customer, keep them logged in
            return false; // No customer to restore or restore failed
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
                partialize: (state: ZustandAuthState) => ({ 
                    customer: state.customer,
                    _lastLogoutTime: state._lastLogoutTime, // Persist logout time to prevent restoration after page reload
                }),
                // After hydration, restore session if needed
                onRehydrateStorage: () => {
                    return async (state) => {
                        if (state) {
                            // CRITICAL: Trim token when hydrating from storage to ensure consistency
                            if (state.customer?.token) {
                                const trimmedToken = state.customer.token.trim();
                                if (trimmedToken !== state.customer.token) {
                                    state.customer = { ...state.customer, token: trimmedToken };
                                    console.log('[Auth] Trimmed token during hydration');
                                }
                            }
                            
                            // Extract customerId from JWT immediately if available
                            if (state.customer?.token && !state.customer.customerId) {
                                const jwtPayload = decodeJWTPayload(state.customer.token);
                                const jwtCustomerId = jwtPayload?.customerId as string | null | undefined;
                                if (jwtCustomerId) {
                                    state.customer = { ...state.customer, customerId: jwtCustomerId };
                                    console.log('[Auth] Extracted customerId from JWT during hydration:', jwtCustomerId);
                                }
                            }
                            
                            // CRITICAL: Set isAuthenticated and isSuperAdmin from restored customer
                            if (state.customer) {
                                // Validate token exists and is not empty
                                if (!state.customer.token || state.customer.token.trim().length === 0) {
                                    console.warn('[Auth] Customer found in storage but token is missing or empty, clearing auth state');
                                    state.customer = null;
                                    state.isAuthenticated = false;
                                    state.isSuperAdmin = false;
                                    await state.restoreSession();
                                    return;
                                }
                                
                                // Check if token is expired locally first (fast check)
                                const isExpired = state.customer.expiresAt && new Date(state.customer.expiresAt) <= new Date();
                                
                                if (!isExpired) {
                                    // Token not expired locally - validate with backend to check if blacklisted or stale
                                    // This ensures we detect tokens that were blacklisted on other domains or are stale
                                    const isValid = await validateTokenWithBackend(state.customer.token, config);
                                    
                                    if (!isValid) {
                                        // Token is blacklisted, invalid, or stale (token mismatch) - clear auth state
                                        console.log('[Auth] Token validation failed (blacklisted, invalid, or stale), clearing auth state');
                                        state.customer = null;
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
                                    const payload = decodeJWTPayload(state.customer.token);
                                    const isSuperAdmin = payload?.isSuperAdmin === true || state.customer.isSuperAdmin || false;
                                    
                                    state.isAuthenticated = true;
                                    state.isSuperAdmin = isSuperAdmin;
                                    
                                    // Just refresh admin status and customerId in background, don't clear customer
                                    console.log('[Auth] Customer authenticated from localStorage, token valid until:', state.customer.expiresAt);
                                    if (state.customer.token) {
                                        // CRITICAL: Use the token from state.customer directly, not from the store's fetchCustomerInfo
                                        // This ensures we use the exact token that was validated, avoiding timing issues
                                        // Don't await - let it run in background, don't block hydration
                                        fetchCustomerInfo(state.customer.token, config).catch(err => {
                                            // If fetchCustomerInfo fails with token mismatch, clear and restore
                                            const errorMessage = err instanceof Error ? err.message : String(err);
                                            const isTokenMismatch = (err as any)?.isTokenMismatch === true ||
                                                                    errorMessage.includes('token does not match') || 
                                                                    errorMessage.includes('Token mismatch') ||
                                                                    errorMessage.includes('decryption failed');
                                            
                                            if (isTokenMismatch) {
                                                // Token mismatch - don't spam restore, just extract customerId from JWT if needed
                                                console.warn('[Auth] Token mismatch detected during background fetch - token may be stale');
                                                if (state.customer) {
                                                    const jwtPayload = decodeJWTPayload(state.customer.token);
                                                    const jwtCustomerId = jwtPayload?.customerId as string | null | undefined;
                                                    if (jwtCustomerId && !state.customer.customerId) {
                                                        state.customer = { 
                                                            ...state.customer, 
                                                            customerId: jwtCustomerId,
                                                        };
                                                        console.log('[Auth] Extracted customerId from JWT after token mismatch:', jwtCustomerId);
                                                    }
                                                }
                                                // DON'T clear or restore - that causes infinite loops
                                            } else {
                                                console.debug('[Auth] Background fetchCustomerInfo failed (non-critical):', err);
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
                                            state.customer = null;
                                            state.isAuthenticated = false;
                                            state.isSuperAdmin = false;
                                        }
                                    } else {
                                        // Session restore disabled, clear auth
                                        state.customer = null;
                                        state.isAuthenticated = false;
                                        state.isSuperAdmin = false;
                                    }
                                }
                            } else {
                                // No customer in localStorage - try to restore from backend (IP-based session sharing)
                                // BUT: Don't restore here if Layout component will also call restoreSession
                                // The Layout component's restoreSession call will handle this
                                console.log('[Auth] No customer in storage - Layout component will attempt restore on mount');
                                // Don't call restoreSession here to avoid duplicate calls
                            }
                        }
                    };
                },
            }
        )
    );
}
