/**
 * Core Mods API - CRUD Operations
 * Handles basic mod operations: list, get, create, update, delete
 */

import { createAPIClient } from '@strixun/api-framework/client';
import type { 
    ModMetadata,
    ModVersion,
    ModListResponse,
    ModDetailResponse,
    ModUpdateRequest, 
    ModUploadRequest,
} from '../../types/mod';
import { encryptFileForUpload } from '../../utils/fileEncryption';
import { sharedClientConfig } from '../authConfig';

/**
 * Mods API base URL
 */
export const API_BASE_URL = import.meta.env.DEV 
  ? '/mods-api'
  : (import.meta.env.VITE_MODS_API_URL || 'https://mods-api.idling.app');

/**
 * Singleton mods API client instance
 */
const api = createAPIClient({
    ...sharedClientConfig,
    baseURL: API_BASE_URL,
});

/**
 * List mods (public endpoint - returns approved mods only)
 */
export async function listMods(filters: {
    page?: number;
    pageSize?: number;
    category?: string;
    search?: string;
    authorId?: string;
    featured?: boolean;
    visibility?: string;
}): Promise<ModListResponse> {
    try {
        const params = new URLSearchParams();
        if (filters.page) params.append('page', filters.page.toString());
        if (filters.pageSize) params.append('pageSize', filters.pageSize.toString());
        if (filters.category) params.append('category', filters.category);
        if (filters.search) params.append('search', filters.search);
        if (filters.authorId) params.append('authorId', filters.authorId);
        if (filters.featured !== undefined) params.append('featured', filters.featured.toString());
        if (filters.visibility) params.append('visibility', filters.visibility);
        
        const queryString = params.toString() ? `?${params.toString()}` : '';
        const response = await api.get<ModListResponse>(`/mods${queryString}`);
        return response.data;
    } catch (error) {
        console.error('[ModsAPI] Failed to list mods:', error);
        throw new Error(`Failed to list mods: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Get mod detail by ID or slug
 */
export async function getModDetail(identifier: string): Promise<ModDetailResponse> {
    try {
        const response = await api.get<ModDetailResponse>(`/mods/${identifier}`);
        return response.data;
    } catch (error) {
        console.error(`[ModsAPI] Failed to get mod detail for ${identifier}:`, error);
        throw new Error(`Failed to get mod details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Upload mod (requires authentication and upload permission)
 */
export async function uploadMod(
    file: File,
    metadata: ModUploadRequest,
    thumbnail?: File
): Promise<{ mod: ModMetadata; version: ModVersion }> {
    try {
        const encryptedFileObj = await encryptFileForUpload(file);

        const formData = new FormData();
        formData.append('file', encryptedFileObj);
        formData.append('metadata', JSON.stringify(metadata));
        if (thumbnail) {
            formData.append('thumbnail', thumbnail);
        }
        
        const response = await api.post<{ mod: ModMetadata; version: ModVersion }>('/mods', formData);
        return response.data;
    } catch (error) {
        console.error('[ModsAPI] Failed to upload mod:', error);
        throw new Error(`Failed to upload mod: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Update mod (requires authentication and ownership/admin)
 */
export async function updateMod(
    slug: string, 
    updates: ModUpdateRequest, 
    thumbnail?: File, 
    variantFiles?: Record<string, File>
): Promise<ModMetadata> {
    try {
        if (thumbnail || (variantFiles && Object.keys(variantFiles).length > 0)) {
            const formData = new FormData();
            formData.append('metadata', JSON.stringify(updates));
            
            if (thumbnail) {
                formData.append('thumbnail', thumbnail);
            }
            
            if (variantFiles) {
                for (const [variantId, file] of Object.entries(variantFiles)) {
                    try {
                        const encryptedFileObj = await encryptFileForUpload(file);
                        formData.append(`variant_${variantId}`, encryptedFileObj);
                    } catch (error) {
                        if (error instanceof Error) {
                            throw new Error(`Failed to encrypt variant file "${file.name}" (variantId: ${variantId}): ${error.message}`);
                        }
                        throw error;
                    }
                }
            }
            
            const response = await api.put<ModMetadata>(`/mods/${slug}`, formData);
            return response.data;
        } else {
            const response = await api.put<ModMetadata>(`/mods/${slug}`, updates);
            return response.data;
        }
    } catch (error) {
        console.error(`[ModsAPI] Failed to update mod ${slug}:`, error);
        throw new Error(`Failed to update mod: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Delete mod (requires authentication and ownership/admin)
 */
export async function deleteMod(slug: string): Promise<void> {
    try {
        await api.delete(`/mods/${slug}`);
    } catch (error) {
        console.error(`[ModsAPI] Failed to delete mod ${slug}:`, error);
        throw new Error(`Failed to delete mod: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
