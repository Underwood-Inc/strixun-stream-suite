/**
 * TanStack Query hooks for mods
 * Handles server state management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api';
import type { ModUploadRequest, ModUpdateRequest, VersionUploadRequest } from '../types/mod';
import { useUIStore } from '../stores/ui';

/**
 * Query keys
 */
export const modKeys = {
    all: ['mods'] as const,
    lists: () => [...modKeys.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...modKeys.lists(), filters] as const,
    details: () => [...modKeys.all, 'detail'] as const,
    detail: (id: string) => [...modKeys.details(), id] as const,
};

/**
 * List mods query
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
        queryFn: () => api.listMods(filters),
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
            queryClient.invalidateQueries({ queryKey: modKeys.lists() });
            addNotification({
                message: 'Mod uploaded successfully!',
                type: 'success',
            });
        },
        onError: (error: Error) => {
            addNotification({
                message: error.message || 'Failed to upload mod',
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
        mutationFn: ({ modId, updates }: {
            modId: string;
            updates: ModUpdateRequest;
        }) => api.updateMod(modId, updates),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: modKeys.detail(variables.modId) });
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
        mutationFn: (modId: string) => api.deleteMod(modId),
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
        onSuccess: (data, variables) => {
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

