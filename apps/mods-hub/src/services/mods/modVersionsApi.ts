/**
 * Mod Versions API
 * Handles mod version operations: upload, delete, update, download
 */

import { createAPIClient } from '@strixun/api-framework/client';
import type { 
    ModVersion,
    VersionUploadRequest,
} from '../../types/mod';
import { encryptFileForUpload, downloadFileFromArrayBuffer } from '../../utils/fileEncryption';
import { sharedClientConfig } from '../authConfig';
import { API_BASE_URL } from './modsApi';

const api = createAPIClient({
    ...sharedClientConfig,
    baseURL: API_BASE_URL,
});

/**
 * Upload mod version (requires authentication and ownership/admin)
 */
export async function uploadVersion(
    modId: string,
    file: File,
    metadata: VersionUploadRequest
): Promise<ModVersion> {
    try {
        const encryptedFileObj = await encryptFileForUpload(file);

        const formData = new FormData();
        formData.append('file', encryptedFileObj);
        formData.append('metadata', JSON.stringify(metadata));
        
        const response = await api.post<ModVersion>(`/mods/${modId}/versions`, formData);
        return response.data;
    } catch (error) {
        console.error(`[ModVersionsAPI] Failed to upload version for mod ${modId}:`, error);
        throw new Error(`Failed to upload version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Delete mod version (requires authentication and ownership/admin)
 */
export async function deleteModVersion(modId: string, versionId: string): Promise<void> {
    try {
        await api.delete(`/mods/${modId}/versions/${versionId}`);
    } catch (error) {
        console.error(`[ModVersionsAPI] Failed to delete version ${versionId} for mod ${modId}:`, error);
        throw new Error(`Failed to delete version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Update mod version metadata (requires authentication and ownership/admin)
 */
export async function updateModVersion(
    modId: string,
    versionId: string,
    updates: Partial<VersionUploadRequest>
): Promise<ModVersion> {
    try {
        const response = await api.put<ModVersion>(`/mods/${modId}/versions/${versionId}`, updates);
        return response.data;
    } catch (error) {
        console.error(`[ModVersionsAPI] Failed to update version ${versionId} for mod ${modId}:`, error);
        throw new Error(`Failed to update version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Download mod version
 */
export async function downloadVersion(modSlug: string, versionId: string, fileName: string): Promise<void> {
    try {
        const response = await api.get<ArrayBuffer>(`/mods/${modSlug}/versions/${versionId}/download`);

        if (response.status < 200 || response.status >= 300) {
            throw new Error(`Failed to download version: ${response.statusText || 'Unknown error'}`);
        }

        downloadFileFromArrayBuffer(response.data as ArrayBuffer, fileName);
    } catch (error) {
        console.error(`[ModVersionsAPI] Failed to download version ${versionId} for mod ${modSlug}:`, error);
        throw new Error(`Failed to download version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
