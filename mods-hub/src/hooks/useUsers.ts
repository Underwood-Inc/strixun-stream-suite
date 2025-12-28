/**
 * TanStack Query hooks for user management (admin only)
 * Handles server state management
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api';
import { useUIStore } from '../stores/ui';
import type { UpdateUserRequest } from '../types/user';

/**
 * Query keys
 */
export const userKeys = {
    all: ['users'] as const,
    lists: () => [...userKeys.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...userKeys.lists(), filters] as const,
    details: () => [...userKeys.all, 'detail'] as const,
    detail: (userId: string) => [...userKeys.details(), userId] as const,
    mods: (userId: string) => [...userKeys.detail(userId), 'mods'] as const,
};

/**
 * List users query (admin only)
 */
export function useUsersList(filters: {
    page?: number;
    pageSize?: number;
    search?: string;
}) {
    return useQuery({
        queryKey: userKeys.list(filters),
        queryFn: () => api.listUsers(filters),
        staleTime: 30000, // 30 seconds
        refetchOnMount: 'always',
    });
}

/**
 * Get user details query (admin only)
 */
export function useUserDetails(userId: string) {
    return useQuery({
        queryKey: userKeys.detail(userId),
        queryFn: () => api.getUserDetails(userId),
        enabled: !!userId,
    });
}

/**
 * Update user mutation (admin only)
 */
export function useUpdateUser() {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);
    
    return useMutation({
        mutationFn: ({ userId, updates }: {
            userId: string;
            updates: UpdateUserRequest;
        }) => api.updateUser(userId, updates),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: userKeys.detail(variables.userId) });
            queryClient.invalidateQueries({ queryKey: userKeys.lists() });
            addNotification({
                message: 'User updated successfully!',
                type: 'success',
            });
        },
        onError: (error: Error) => {
            addNotification({
                message: error.message || 'Failed to update user',
                type: 'error',
            });
        },
    });
}

/**
 * Get user's mods query (admin only)
 */
export function useUserMods(userId: string, params: {
    page?: number;
    pageSize?: number;
}) {
    return useQuery({
        queryKey: [...userKeys.mods(userId), params],
        queryFn: () => api.getUserMods(userId, params),
        enabled: !!userId,
    });
}

