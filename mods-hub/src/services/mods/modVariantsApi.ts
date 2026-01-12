/**
 * Mod Variants API
 * Handles mod variant operations: list versions, delete, update, download
 */

import { createAPIClient } from '@strixun/api-framework/client';
import type { 
    VariantVersion,
    VariantVersionUploadRequest,
} from '../../types/mod';
import { downloadFileFromArrayBuffer } from '../../utils/fileEncryption';
import { sharedClientConfig, getAuthToken } from '../authConfig';
import { API_BASE_URL } from './modsApi';

const api = createAPIClient({
    ...sharedClientConfig,
    baseURL: API_BASE_URL,
});

/**
 * List all versions for a variant
 */
export async function listVariantVersions(
    modSlug: string,
    variantId: string
): Promise<{ versions: VariantVersion[] }> {
    try {
        const response = await api.get<{ versions: VariantVersion[] }>(`/mods/${modSlug}/variants/${variantId}/versions`);
        return response.data;
    } catch (error) {
        console.error(`[ModVariantsAPI] Failed to list versions for variant ${variantId}:`, error);
        throw new Error(`Failed to list variant versions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Delete entire variant and all its versions
 */
export async function deleteVariant(
    modId: string,
    variantId: string
): Promise<void> {
    try {
        await api.delete(`/mods/${modId}/variants/${variantId}`);
    } catch (error) {
        console.error(`[ModVariantsAPI] Failed to delete variant ${variantId} for mod ${modId}:`, error);
        throw new Error(`Failed to delete variant: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Update variant version metadata (requires authentication and ownership/admin)
 */
export async function updateVariantVersion(
    modId: string,
    variantId: string,
    variantVersionId: string,
    updates: Partial<VariantVersionUploadRequest>
): Promise<VariantVersion> {
    try {
        const response = await api.put<VariantVersion>(
            `/mods/${modId}/variants/${variantId}/versions/${variantVersionId}`,
            updates
        );
        return response.data;
    } catch (error) {
        console.error(`[ModVariantsAPI] Failed to update variant version ${variantVersionId}:`, error);
        throw new Error(`Failed to update variant version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Download mod variant (latest version)
 */
export async function downloadVariant(modSlug: string, variantId: string): Promise<void> {
    try {
        const token = await getAuthToken();
        
        const url = `${API_BASE_URL}/mods/${modSlug}/variants/${variantId}/download`;
        const response = await fetch(url, {
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to download variant: ${response.statusText || 'Unknown error'}`);
        }

        const contentDisposition = response.headers.get('content-disposition') || '';
        const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        
        if (!fileNameMatch || !fileNameMatch[1]) {
            throw new Error(`Failed to extract filename from Content-Disposition header: ${contentDisposition}`);
        }
        
        const fileName = fileNameMatch[1];
        const arrayBuffer = await response.arrayBuffer();

        downloadFileFromArrayBuffer(arrayBuffer, fileName);
    } catch (error) {
        console.error(`[ModVariantsAPI] Failed to download variant ${variantId} for mod ${modSlug}:`, error);
        throw new Error(`Failed to download variant: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
