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
    
    const { data, isLoading } = useQuery({
        queryKey: ['uploadPermission', user?.userId],
        queryFn: async () => {
            const result = await api.checkUploadPermission();
            return result;
        },
        enabled: isAuthenticated && !!user?.userId,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        retry: 1,
        retryDelay: 1000,
    });
    
    return {
        hasPermission: data?.hasPermission ?? false,
        isLoading,
        isAuthenticated,
    };
}

