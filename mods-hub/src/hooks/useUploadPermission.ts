/**
 * Hook to check if user has upload permission
 * 
 * IMPORTANT: This is a UI convenience check. The backend enforces actual permissions on all operations.
 * 
 * Permission Model:
 * - Super admins: Always have permission (implicit)
 * - Other users: Must have explicit approval stored in KV as `upload_approval_{userId}`
 * 
 * This hook calls the backend endpoint GET /mods/permissions/me to check the user's permission status.
 */

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth';
import * as api from '../services/api';

/**
 * Hook to check upload permission
 * Returns permission status and loading state
 * 
 * Calls the backend endpoint to get the user's actual permission status,
 * which checks both super admin status and explicit approval.
 */
export function useUploadPermission() {
    const { user, isAuthenticated } = useAuthStore();
    
    // Ensure we have a valid token before making the request
    const hasValidToken = isAuthenticated && !!user?.token && user.token.trim().length > 0;
    
    const { data, isLoading, error } = useQuery({
        queryKey: ['uploadPermission', user?.userId, user?.token ? 'has-token' : 'no-token'],
        queryFn: async () => {
            // Double-check token before making request
            if (!user?.token) {
                throw new Error('No authentication token available');
            }
            const result = await api.checkUploadPermission();
            return result;
        },
        enabled: hasValidToken && !!user?.userId,
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

