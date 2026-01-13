/**
 * Hook to check if customer has upload permission
 * 
 * IMPORTANT: This is a UI convenience check. The backend enforces actual permissions on all operations.
 * 
 * Permission Model:
 * - Super admins: Always have permission (implicit)
 * - Other customers: Must have explicit approval stored in KV as `upload_approval_{customerId}`
 * 
 * This hook calls the backend endpoint GET /mods/permissions/me to check the customer's permission status.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth';
import * as api from '../services/mods';

/**
 * Hook to check upload permission
 * Returns permission status and loading state
 * 
 * Calls the backend endpoint to get the customer's actual permission status,
 * which checks both super admin status and explicit approval.
 */
export function useUploadPermission() {
    const { customer, isAuthenticated } = useAuthStore();
    
    // CRITICAL: With HttpOnly cookies, we can't check for token
    // Just check if authenticated - cookie is sent automatically
    const canMakeRequest = isAuthenticated && !!customer?.customerId;
    
    const { data, isLoading, error } = useQuery({
        queryKey: ['uploadPermission', customer?.customerId],
        queryFn: async () => {
            // With HttpOnly cookies, API client sends cookie automatically
            const result = await api.checkUploadPermission();
            return result;
        },
        enabled: canMakeRequest,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        retry: (failureCount, error) => {
            // Don't retry on 401 errors (authentication failures)
            if (error && typeof error === 'object' && 'status' in error && error.status === 401) {
                return false;
            }
            // Retry other errors once
            return failureCount < 1;
        },
        retryDelay: 1000,
    });
    
    // Log errors for debugging
    if (error) {
        console.error('[useUploadPermission] Error checking permission:', error);
    }
    
    return {
        hasPermission: data?.hasPermission ?? false,
        isLoading,
        isAuthenticated,
        error,
    };
}

