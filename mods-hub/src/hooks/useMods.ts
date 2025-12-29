/**
 * TanStack Query hooks for mods
 * Handles server state management
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api';
import { useUIStore } from '../stores/ui';
import { useAuthStore } from '../stores/auth';
import type { ModStatus, ModUpdateRequest, ModUploadRequest, VersionUploadRequest } from '../types/mod';

/**
 * Query keys
 */
export const modKeys = {
    all: ['mods'] as const,
    lists: () => [...modKeys.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...modKeys.lists(), filters] as const,
    adminList: (filters: Record<string, any>) => [...modKeys.all, 'admin', 'list', filters] as const,
    details: () => [...modKeys.all, 'detail'] as const,
    detail: (id: string) => [...modKeys.details(), id] as const,
    review: (slug: string) => [...modKeys.details(), slug, 'review'] as const,
};

/**
 * List mods query
 * Always fetches fresh data - no caching
 * CRITICAL: Only returns mods with status 'approved' - filters out denied/pending/etc
 */
export function useModsList(filters: {
    page?: number;
    pageSize?: number;
    category?: string;
    search?: string;
    authorId?: string;
    featured?: boolean;
    visibility?: string;
}) {
    return useQuery({
        queryKey: modKeys.list(filters),
        queryFn: async () => {
            console.log('[useModsList] Query function called with filters:', filters);
            try {
                const result = await api.listMods(filters);
                console.log('[useModsList] Query result:', result);
                
                // Validate response structure
                if (!result || typeof result !== 'object') {
                    console.error('[useModsList] Invalid response format:', typeof result, result);
                    throw new Error('Invalid API response format');
                }
                
                if (!Array.isArray(result.mods)) {
                    console.error('[useModsList] Response missing mods array:', result);
                    throw new Error('API response missing mods array');
                }
                
                // CRITICAL: Frontend safety filter - only return approved mods for public browsing
                // BUT: If filtering by authorId (user viewing their own mods), show ALL statuses
                // This is a defense-in-depth measure in case backend filtering fails
                // The browse page should NEVER show denied/pending/archived mods
                // But users should see their own pending mods in their dashboard
                const shouldFilterByStatus = !filters.authorId; // Only filter if NOT viewing own mods
                const filteredMods = shouldFilterByStatus 
                    ? result.mods.filter(mod => mod.status === 'approved')
                    : result.mods; // Show all mods when viewing own mods
                
                return {
                    ...result,
                    mods: filteredMods,
                    total: filteredMods.length, // Update total to reflect filtered count
                };
            } catch (error) {
                console.error('[useModsList] Query error:', error);
                throw error;
            }
        },
        retry: 1,
        retryDelay: 1000,
        // Always fetch fresh data - disable all caching
        staleTime: 0, // Data is immediately stale, will refetch
        gcTime: 0, // Don't keep data in cache (formerly cacheTime)
        refetchOnMount: 'always', // Always refetch when component mounts
        refetchOnWindowFocus: true, // Refetch when window regains focus
    });
}

/**
 * Get mod detail query
 */
export function useModDetail(modId: string) {
    return useQuery({
        queryKey: modKeys.detail(modId),
        queryFn: () => api.getModDetail(modId),
        enabled: !!modId,
    });
}

/**
 * Upload mod mutation
 */
export function useUploadMod() {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);
    
    return useMutation({
        mutationFn: ({ file, metadata, thumbnail }: {
            file: File;
            metadata: ModUploadRequest;
            thumbnail?: File;
        }) => api.uploadMod(file, metadata, thumbnail),
        onSuccess: () => {
            // Invalidate all list queries and force refetch
            queryClient.invalidateQueries({ queryKey: modKeys.lists() });
            queryClient.invalidateQueries({ queryKey: modKeys.adminList({}) });
            // Force refetch all active queries
            queryClient.refetchQueries({ queryKey: modKeys.lists() });
            addNotification({
                message: 'Mod uploaded successfully!',
                type: 'success',
            });
        },
        onError: (error: Error) => {
            // Extract file size error messages from API responses
            let errorMessage = error.message || 'Failed to upload mod';
            
            // Check if error contains file size information
            if (errorMessage.includes('File Must Be Encrypted')) {
                errorMessage = 'File encryption error. Please try uploading again.';
            } else if (errorMessage.includes('413') || errorMessage.includes('Payload Too Large')) {
                errorMessage = 'File size exceeds maximum allowed size. Please use a smaller file.';
            }
            
            addNotification({
                message: errorMessage,
                type: 'error',
            });
        },
    });
}

/**
 * Update mod mutation
 */
export function useUpdateMod() {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);
    
    return useMutation({
        mutationFn: ({ slug, updates, thumbnail }: {
            slug: string;
            updates: ModUpdateRequest;
            thumbnail?: File;
        }) => api.updateMod(slug, updates, thumbnail),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: modKeys.detail(variables.slug) });
            queryClient.invalidateQueries({ queryKey: modKeys.lists() });
            addNotification({
                message: 'Mod updated successfully!',
                type: 'success',
            });
        },
        onError: (error: Error) => {
            addNotification({
                message: error.message || 'Failed to update mod',
                type: 'error',
            });
        },
    });
}

/**
 * Delete mod mutation
 */
export function useDeleteMod() {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);
    
    return useMutation({
        mutationFn: (slug: string) => api.deleteMod(slug),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: modKeys.lists() });
            addNotification({
                message: 'Mod deleted successfully!',
                type: 'success',
            });
        },
        onError: (error: Error) => {
            addNotification({
                message: error.message || 'Failed to delete mod',
                type: 'error',
            });
        },
    });
}

/**
 * Upload version mutation
 */
export function useUploadVersion() {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);
    
    return useMutation({
        mutationFn: ({ modId, file, metadata }: {
            modId: string;
            file: File;
            metadata: VersionUploadRequest;
        }) => api.uploadVersion(modId, file, metadata),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: modKeys.detail(variables.modId) });
            addNotification({
                message: 'Version uploaded successfully!',
                type: 'success',
            });
        },
        onError: (error: Error) => {
            addNotification({
                message: error.message || 'Failed to upload version',
                type: 'error',
            });
        },
    });
}

/**
 * Admin list mods query (all statuses)
 */
export function useAdminModsList(filters: {
    page?: number;
    pageSize?: number;
    status?: string;
    category?: string;
    search?: string;
}) {
    return useQuery({
        queryKey: modKeys.adminList(filters),
        queryFn: () => api.listAllMods(filters),
    });
}

/**
 * Get mod review query (admin/uploader only)
 */
export function useModReview(slug: string) {
    return useQuery({
        queryKey: modKeys.review(slug),
        queryFn: () => api.getModReview(slug),
        enabled: !!slug,
    });
}

/**
 * Update mod status mutation (admin only)
 */
export function useUpdateModStatus() {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);
    
    return useMutation({
        mutationFn: ({ modId, status, reason }: { modId: string; status: ModStatus; reason?: string }) => 
            api.updateModStatus(modId, status, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: modKeys.adminList({}) });
            queryClient.invalidateQueries({ queryKey: modKeys.lists() });
            addNotification({
                message: 'Mod status updated successfully!',
                type: 'success',
            });
        },
        onError: (error: Error) => {
            addNotification({
                message: error.message || 'Failed to update mod status',
                type: 'error',
            });
        },
    });
}

/**
 * Add review comment mutation
 */
export function useAddReviewComment() {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);
    
    return useMutation({
        mutationFn: ({ modId, content }: { modId: string; content: string }) => 
            api.addReviewComment(modId, content),
        onSuccess: () => {
            // Invalidate all review queries to refresh the review page
            queryClient.invalidateQueries({ queryKey: modKeys.details() });
            addNotification({
                message: 'Comment added successfully!',
                type: 'success',
            });
        },
        onError: (error: Error) => {
            addNotification({
                message: error.message || 'Failed to add comment',
                type: 'error',
            });
        },
    });
}

/**
 * Admin delete mod mutation (admin only, bypasses author check)
 */
export function useAdminDeleteMod() {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);
    
    return useMutation({
        mutationFn: (modId: string) => api.adminDeleteMod(modId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: modKeys.adminList({}) });
            queryClient.invalidateQueries({ queryKey: modKeys.lists() });
            addNotification({
                message: 'Mod deleted successfully!',
                type: 'success',
            });
        },
        onError: (error: Error) => {
            addNotification({
                message: error.message || 'Failed to delete mod',
                type: 'error',
            });
        },
    });
}

/**
 * Get mod ratings query
 */
export function useModRatings(modId: string) {
    return useQuery({
        queryKey: [...modKeys.details(), modId, 'ratings'],
        queryFn: () => api.getModRatings(modId),
        enabled: !!modId,
    });
}

/**
 * List drafts query (authenticated users only)
 * Filters mods by authorId (current user) and status='draft'
 */
export function useDrafts(params?: {
    page?: number;
    pageSize?: number;
}) {
    const { user } = useAuthStore();
    
    return useQuery({
        queryKey: [...modKeys.all, 'drafts', user?.userId || '', params || {}],
        queryFn: async () => {
            if (!user?.userId) {
                return { mods: [], total: 0, page: 1, pageSize: 20 };
            }
            // Use listMods with authorId filter - this returns all statuses for the author
            const result = await api.listMods({
                ...params,
                authorId: user.userId,
            });
            // Filter to only show drafts
            return {
                ...result,
                mods: result.mods.filter(mod => mod.status === 'draft'),
                total: result.mods.filter(mod => mod.status === 'draft').length,
            };
        },
        enabled: !!user?.userId,
        staleTime: 0,
        gcTime: 0,
        refetchOnMount: 'always',
        refetchOnWindowFocus: true,
    });
}

/**
 * Submit mod rating mutation
 */
export function useSubmitModRating() {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);
    
    return useMutation({
        mutationFn: ({ modId, rating, comment }: { modId: string; rating: number; comment?: string }) =>
            api.submitModRating(modId, rating, comment),
        onSuccess: (_data, variables) => {
            // Invalidate ratings query to refresh ratings
            queryClient.invalidateQueries({ queryKey: [...modKeys.details(), variables.modId, 'ratings'] });
            queryClient.invalidateQueries({ queryKey: modKeys.detail(variables.modId) });
            addNotification({
                message: 'Rating submitted successfully!',
                type: 'success',
            });
        },
        onError: (error: Error) => {
            addNotification({
                message: error.message || 'Failed to submit rating',
                type: 'error',
            });
        },
    });
}

/**
 * Get admin settings query
 */
export function useAdminSettings() {
    return useQuery({
        queryKey: ['admin', 'settings'],
        queryFn: () => api.getAdminSettings(),
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });
}

/**
 * Update admin settings mutation
 */
export function useUpdateAdminSettings() {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);
    
    return useMutation({
        mutationFn: (settings: { allowedFileExtensions: string[] }) => api.updateAdminSettings(settings),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
            addNotification({
                message: 'Settings updated successfully!',
                type: 'success',
            });
        },
        onError: (error: Error) => {
            addNotification({
                message: error.message || 'Failed to update settings',
                type: 'error',
            });
        },
    });
}

