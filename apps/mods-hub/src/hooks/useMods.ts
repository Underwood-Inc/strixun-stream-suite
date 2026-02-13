/**
 * TanStack Query hooks for mods
 * Handles server state management
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/mods';
import { useUIStore } from '../stores/ui';
import { useAuthStore } from '../stores/auth';
import { getUserFriendlyErrorMessage, shouldRedirectToLogin } from '../utils/error-messages';
import { useNavigate } from 'react-router-dom';
import type { 
    ModStatus, 
    ModUpdateRequest, 
    ModUploadRequest, 
    VersionUploadRequest,
    VariantVersionUploadRequest
} from '../types/mod';

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
    variantVersions: (modSlug: string, variantId: string) => [...modKeys.all, 'variant-versions', modSlug, variantId] as const,
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
                // BUT: If filtering by authorId (customer viewing their own mods), show ALL statuses
                // This is a defense-in-depth measure in case backend filtering fails
                // The browse page should NEVER show denied/pending/archived mods
                // But customers should see their own pending mods in their dashboard
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
 * Always fetches fresh data - no caching
 */
export function useModDetail(modId: string) {
    return useQuery({
        queryKey: modKeys.detail(modId),
        queryFn: () => api.getModDetail(modId),
        enabled: !!modId,
        // Always fetch fresh data - disable all caching
        staleTime: 0, // Data is immediately stale, will refetch
        gcTime: 0, // Don't keep data in cache (formerly cacheTime)
        refetchOnMount: 'always', // Always refetch when component mounts
        refetchOnWindowFocus: true, // Refetch when window regains focus
    });
}

/**
 * Upload mod mutation
 */
export function useUploadMod() {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);
    const customer = useAuthStore((state) => state.customer);
    
    return useMutation({
        mutationFn: ({ file, metadata, thumbnail }: {
            file: File;
            metadata: ModUploadRequest;
            thumbnail?: File;
        }) => api.uploadMod(file, {
            ...metadata,
            displayName: customer?.displayName || undefined,
        }, thumbnail),
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
    const customer = useAuthStore((state) => state.customer);
    
    return useMutation({
        mutationFn: ({ slug, updates, thumbnail, variantFiles }: {
            slug: string;
            updates: ModUpdateRequest;
            thumbnail?: File;
            variantFiles?: Record<string, File>;
        }) => api.updateMod(slug, {
            ...updates,
            displayName: customer?.displayName || undefined,
        }, thumbnail, variantFiles),
        onSuccess: (data, variables) => {
            // Check if slug changed in the update
            const newSlug = data?.slug;
            const oldSlug = variables.slug;
            
            if (newSlug && newSlug !== oldSlug) {
                // Slug changed - invalidate both old and new slug queries
                queryClient.invalidateQueries({ queryKey: modKeys.detail(oldSlug) });
                queryClient.invalidateQueries({ queryKey: modKeys.detail(newSlug) });
                console.log('[useUpdateMod] Slug changed:', { oldSlug, newSlug });
            } else {
                // Slug didn't change - invalidate current slug query
                queryClient.invalidateQueries({ queryKey: modKeys.detail(oldSlug) });
            }
            
            queryClient.invalidateQueries({ queryKey: modKeys.lists() });
            
            // Invalidate variant versions queries to refresh after variant file upload
            // Use partial matching to invalidate all variant version queries for this mod
            queryClient.invalidateQueries({ 
                predicate: (query) => 
                    query.queryKey[0] === 'mods' && 
                    query.queryKey[1] === 'variant-versions' && 
                    query.queryKey[2] === oldSlug
            });
            if (newSlug && newSlug !== oldSlug) {
                queryClient.invalidateQueries({ 
                    predicate: (query) => 
                        query.queryKey[0] === 'mods' && 
                        query.queryKey[1] === 'variant-versions' && 
                        query.queryKey[2] === newSlug
                });
            }
            
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
    const navigate = useNavigate();
    
    return useMutation({
        mutationFn: (slug: string) => api.deleteMod(slug),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: modKeys.lists() });
            queryClient.invalidateQueries({ queryKey: modKeys.details() });
            addNotification({
                message: 'Mod deleted successfully!',
                type: 'success',
            });
            // Navigate to browse page after successful deletion
            navigate('/');
        },
        onError: (error: Error) => {
            addNotification({
                message: getUserFriendlyErrorMessage(error),
                type: 'error',
            });
            
            if (shouldRedirectToLogin(error)) {
                setTimeout(() => {
                    navigate('/login');
                }, 1000);
            }
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
            slug?: string;
        }) => api.uploadVersion(modId, file, metadata),
        onSuccess: (data, variables) => {
            // Invalidate by both modId and slug (if provided)
            queryClient.invalidateQueries({ queryKey: modKeys.detail(variables.modId) });
            if (variables.slug) {
                queryClient.invalidateQueries({ queryKey: modKeys.detail(variables.slug) });
            }
            
            addNotification({
                message: 'Version uploaded successfully!',
                type: 'success',
            });
            
            // Smooth scroll to the new version after queries refetch
            setTimeout(() => {
                const versionElement = document.querySelector(`[data-version-id="${data.versionId}"]`);
                if (versionElement) {
                    versionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 500); // Wait for refetch to complete
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
 * Always fetches fresh data - no caching
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
        // Always fetch fresh data - disable all caching
        staleTime: 0, // Data is immediately stale, will refetch
        gcTime: 0, // Don't keep data in cache (formerly cacheTime)
        refetchOnMount: 'always', // Always refetch when component mounts
        refetchOnWindowFocus: true, // Refetch when window regains focus
    });
}

/**
 * Get mod review query (admin/uploader only)
 * Always fetches fresh data - no caching
 */
export function useModReview(slug: string) {
    return useQuery({
        queryKey: modKeys.review(slug),
        queryFn: () => api.getModReview(slug),
        enabled: !!slug,
        // Always fetch fresh data - disable all caching
        staleTime: 0, // Data is immediately stale, will refetch
        gcTime: 0, // Don't keep data in cache (formerly cacheTime)
        refetchOnMount: 'always', // Always refetch when component mounts
        refetchOnWindowFocus: true, // Refetch when window regains focus
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
 * Always fetches fresh data - no caching
 */
export function useModRatings(modId: string) {
    return useQuery({
        queryKey: [...modKeys.details(), modId, 'ratings'],
        queryFn: () => api.getModRatings(modId),
        enabled: !!modId,
        // Always fetch fresh data - disable all caching
        staleTime: 0, // Data is immediately stale, will refetch
        gcTime: 0, // Don't keep data in cache (formerly cacheTime)
        refetchOnMount: 'always', // Always refetch when component mounts
        refetchOnWindowFocus: true, // Refetch when window regains focus
    });
}

/**
 * List drafts query (authenticated customers only)
 * Filters mods by authorId (current customer) and status='draft'
 */
export function useDrafts(params?: {
    page?: number;
    pageSize?: number;
}) {
    const { customer } = useAuthStore();
    
    return useQuery({
        queryKey: [...modKeys.all, 'drafts', customer?.customerId || '', params || {}],
        queryFn: async () => {
            if (!customer?.customerId) {
                return { mods: [], total: 0, page: 1, pageSize: 20 };
            }
            // Use listMods with authorId filter - this returns all statuses for the author
            const result = await api.listMods({
                ...params,
                authorId: customer.customerId,
            });
            // Filter to only show drafts
            return {
                ...result,
                mods: result.mods.filter(mod => mod.status === 'draft'),
                total: result.mods.filter(mod => mod.status === 'draft').length,
            };
        },
        enabled: !!customer?.customerId,
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
 * Get mod upload settings (authenticated users)
 * Returns allowed file extensions and upload enabled status
 */
export function useModSettings() {
    return useQuery({
        queryKey: ['mod', 'settings'],
        queryFn: () => api.getModSettings(),
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    });
}

/**
 * Get admin settings query (super admins only)
 * Only runs if enabled (e.g., for super admins only)
 */
export function useAdminSettings(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: ['admin', 'settings'],
        queryFn: () => api.getAdminSettings(),
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        enabled: options?.enabled ?? true, // Only run if enabled
    });
}

/**
 * Update admin settings mutation
 */
export function useUpdateAdminSettings() {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);
    
    return useMutation({
        mutationFn: (settings: { allowedFileExtensions?: string[]; uploadsEnabled?: boolean }) => api.updateAdminSettings(settings),
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

/**
 * List variant versions query
 * Always fetches fresh data - no caching
 */
export function useVariantVersions(modSlug: string, variantId: string) {
    return useQuery({
        queryKey: modKeys.variantVersions(modSlug, variantId),
        queryFn: () => api.listVariantVersions(modSlug, variantId),
        enabled: !!modSlug && !!variantId,
        // Always fetch fresh data - disable all caching
        staleTime: 0, // Data is immediately stale, will refetch
        gcTime: 0, // Don't keep data in cache (formerly cacheTime)
        refetchOnMount: 'always', // Always refetch when component mounts
        refetchOnWindowFocus: true, // Refetch when window regains focus
    });
}

/**
 * Delete mod version mutation
 * UNIFIED SYSTEM: Works for both main mod and variant versions
 */
export function useDeleteModVersion() {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);
    
    return useMutation({
        mutationFn: ({ modId, versionId }: { modId: string; versionId: string }) => 
            api.deleteModVersion(modId, versionId),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: modKeys.detail(variables.modId) });
            addNotification({
                message: 'Version deleted successfully!',
                type: 'success',
            });
        },
        onError: (error: Error) => {
            addNotification({
                message: error.message || 'Failed to delete version',
                type: 'error',
            });
        },
    });
}

/**
 * Delete entire variant mutation
 */
export function useDeleteVariant() {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);
    
    return useMutation({
        mutationFn: ({ modId, variantId }: { 
            modId: string; 
            variantId: string;
        }) => api.deleteVariant(modId, variantId),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: modKeys.detail(variables.modId) });
            addNotification({
                message: 'Variant deleted successfully!',
                type: 'success',
            });
        },
        onError: (error: Error) => {
            addNotification({
                message: error.message || 'Failed to delete variant',
                type: 'error',
            });
        },
    });
}

/**
 * Update mod version metadata mutation
 */
export function useUpdateModVersion() {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);
    
    return useMutation({
        mutationFn: ({ modId, versionId, updates }: { 
            modId: string; 
            versionId: string; 
            updates: Partial<VersionUploadRequest>;
        }) => api.updateModVersion(modId, versionId, updates),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: modKeys.detail(variables.modId) });
            addNotification({
                message: 'Version updated successfully!',
                type: 'success',
            });
        },
        onError: (error: Error) => {
            addNotification({
                message: error.message || 'Failed to update version',
                type: 'error',
            });
        },
    });
}

/**
 * Update variant version metadata mutation
 */
export function useUpdateVariantVersion() {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);
    
    return useMutation({
        mutationFn: ({ modId, variantId, variantVersionId, updates }: { 
            modId: string; 
            variantId: string;
            variantVersionId: string;
            updates: Partial<VariantVersionUploadRequest>;
        }) => api.updateVariantVersion(modId, variantId, variantVersionId, updates),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: modKeys.variantVersions(variables.modId, variables.variantId) });
            queryClient.invalidateQueries({ queryKey: modKeys.detail(variables.modId) });
            addNotification({
                message: 'Variant version updated successfully!',
                type: 'success',
            });
        },
        onError: (error: Error) => {
            addNotification({
                message: error.message || 'Failed to update variant version',
                type: 'error',
            });
        },
    });
}
