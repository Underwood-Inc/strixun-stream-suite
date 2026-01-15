/**
 * Mod Admin API
 * Handles admin-only mod operations: list all, review, status, comments, delete
 */

import { createAPIClient } from '@strixun/api-framework/client';
import type { 
    ModStatus,
    ModMetadata,
    ModListResponse,
    ModDetailResponse,
} from '../../types/mod';
import { sharedClientConfig } from '../authConfig';
import { API_BASE_URL } from './modsApi';

const api = createAPIClient({
    ...sharedClientConfig,
    baseURL: API_BASE_URL,
});

/**
 * List all mods (admin only - includes all statuses)
 */
export async function listAllMods(filters: {
    page?: number;
    pageSize?: number;
    status?: string;
    category?: string;
    search?: string;
}): Promise<ModListResponse> {
    try {
        const params = new URLSearchParams();
        if (filters.page) params.append('page', filters.page.toString());
        if (filters.pageSize) params.append('pageSize', filters.pageSize.toString());
        if (filters.status) params.append('status', filters.status);
        if (filters.category) params.append('category', filters.category);
        if (filters.search) params.append('search', filters.search);
        
        const queryString = params.toString() ? `?${params.toString()}` : '';
        const response = await api.get<ModListResponse>(`/admin/mods${queryString}`);
        return response.data;
    } catch (error) {
        console.error('[ModAdminAPI] Failed to list all mods (admin):', error);
        throw new Error(`Failed to list mods: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Get mod review (admin/uploader only)
 */
export async function getModReview(slug: string): Promise<ModDetailResponse> {
    try {
        const response = await api.get<ModDetailResponse>(`/mods/${slug}/review`);
        return response.data;
    } catch (error) {
        console.error(`[ModAdminAPI] Failed to get review for mod ${slug}:`, error);
        throw new Error(`Failed to get mod review: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Update mod status (admin only)
 */
export async function updateModStatus(
    modId: string,
    status: ModStatus,
    reason?: string
): Promise<ModMetadata> {
    try {
        const response = await api.put<ModMetadata>(`/admin/mods/${modId}/status`, { status, reason });
        return response.data;
    } catch (error) {
        console.error(`[ModAdminAPI] Failed to update status for mod ${modId}:`, error);
        throw new Error(`Failed to update mod status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Add review comment (admin/uploader only)
 */
export async function addReviewComment(modId: string, content: string): Promise<ModDetailResponse> {
    try {
        const response = await api.post<ModDetailResponse>(`/mods/${modId}/review/comments`, { content });
        return response.data;
    } catch (error) {
        console.error(`[ModAdminAPI] Failed to add review comment for mod ${modId}:`, error);
        throw new Error(`Failed to add review comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Admin delete mod (admin only, bypasses author check)
 */
export async function adminDeleteMod(modId: string): Promise<void> {
    try {
        await api.delete(`/admin/mods/${modId}`);
    } catch (error) {
        console.error(`[ModAdminAPI] Failed to admin delete mod ${modId}:`, error);
        throw new Error(`Failed to delete mod: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Get customer's mods (admin only)
 */
export async function getCustomerMods(customerId: string, params: {
    page?: number;
    pageSize?: number;
}): Promise<ModListResponse> {
    try {
        const urlParams = new URLSearchParams();
        if (params.page) urlParams.append('page', params.page.toString());
        if (params.pageSize) urlParams.append('pageSize', params.pageSize.toString());
        
        const queryString = urlParams.toString() ? `?${urlParams.toString()}` : '';
        const response = await api.get<ModListResponse>(`/admin/customers/${customerId}/mods${queryString}`);
        return response.data;
    } catch (error) {
        console.error(`[ModAdminAPI] Failed to get mods for customer ${customerId}:`, error);
        throw new Error(`Failed to get customer mods: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
