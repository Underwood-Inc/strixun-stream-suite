/**
 * TanStack Query hooks for customer management (admin only)
 * Handles server state management
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api';
import { useUIStore } from '../stores/ui';
import type { UpdateCustomerRequest } from '../types/user';

/**
 * Query keys
 */
export const customerKeys = {
    all: ['customers'] as const,
    lists: () => [...customerKeys.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...customerKeys.lists(), filters] as const,
    details: () => [...customerKeys.all, 'detail'] as const,
    detail: (customerId: string) => [...customerKeys.details(), customerId] as const,
    mods: (customerId: string) => [...customerKeys.detail(customerId), 'mods'] as const,
};

/**
 * List customers query (admin only)
 */
export function useCustomersList(filters: {
    page?: number;
    pageSize?: number;
    search?: string;
}) {
    return useQuery({
        queryKey: customerKeys.list(filters),
        queryFn: () => api.listCustomers(filters),
        staleTime: 30000, // 30 seconds
        refetchOnMount: 'always',
    });
}

/**
 * Get customer details query (admin only)
 */
export function useCustomerDetails(customerId: string) {
    return useQuery({
        queryKey: customerKeys.detail(customerId),
        queryFn: () => api.getCustomerDetails(customerId),
        enabled: !!customerId,
    });
}

/**
 * Update customer mutation (admin only)
 */
export function useUpdateCustomer() {
    const queryClient = useQueryClient();
    const addNotification = useUIStore((state) => state.addNotification);
    
    return useMutation({
        mutationFn: ({ customerId, updates }: {
            customerId: string;
            updates: UpdateCustomerRequest;
        }) => api.updateCustomer(customerId, updates),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: customerKeys.detail(variables.customerId) });
            queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
            addNotification({
                message: 'Customer updated successfully!',
                type: 'success',
            });
        },
        onError: (error: Error) => {
            addNotification({
                message: error.message || 'Failed to update customer',
                type: 'error',
            });
        },
    });
}

/**
 * Get customer's mods query (admin only)
 */
export function useCustomerMods(customerId: string, params: {
    page?: number;
    pageSize?: number;
}) {
    return useQuery({
        queryKey: [...customerKeys.mods(customerId), params],
        queryFn: () => api.getCustomerMods(customerId, params),
        enabled: !!customerId,
    });
}

