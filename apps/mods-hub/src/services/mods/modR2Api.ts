/**
 * Mod R2 API
 * Handles R2 file storage operations (admin only)
 */

import { createAPIClient } from '@strixun/api-framework/client';
import type {
    R2FileInfo,
    R2FileAssociatedData,
} from '../../types/r2';
import { sharedClientConfig } from '../authConfig';
import { API_BASE_URL } from './modsApi';

/** Raw file info from API (uploaded is string, not Date) */
interface R2FileInfoRaw {
    key: string;
    size: number;
    uploaded: string;
    contentType?: string;
    customMetadata?: Record<string, string>;
    isOrphaned?: boolean;
    associatedModId?: string;
    associatedVersionId?: string;
    associatedData?: R2FileAssociatedData;
}

/** Duplicate group from API */
interface DuplicateGroupRaw {
    files: R2FileInfoRaw[];
    count: number;
    totalSize: number;
    recommendedKeep?: string;
}

const api = createAPIClient({
    ...sharedClientConfig,
    baseURL: API_BASE_URL,
});

/**
 * List R2 files (admin only)
 */
export async function listR2Files(options?: { limit?: number }): Promise<{
    files: R2FileInfo[];
    total: number;
}> {
    try {
        const params = new URLSearchParams();
        if (options?.limit) {
            params.append('limit', options.limit.toString());
        }
        const queryString = params.toString() ? `?${params.toString()}` : '';
        const response = await api.get<{
            files: R2FileInfoRaw[];
            total: number;
        }>(`/admin/r2/files${queryString}`);
        return {
            ...response.data,
            files: response.data.files.map((file: R2FileInfoRaw) => ({
                ...file,
                uploaded: new Date(file.uploaded),
            })),
        };
    } catch (error) {
        console.error('[ModR2API] Failed to list R2 files:', error);
        throw new Error(`Failed to list R2 files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Detect duplicate and orphaned R2 files (admin only)
 */
export async function detectDuplicates(): Promise<{
    summary: {
        totalFiles: number;
        referencedFiles: number;
        orphanedFiles: number;
        orphanedSize: number;
        duplicateGroups: number;
        duplicateWastedSize: number;
    };
    duplicateGroups: Array<{
        files: R2FileInfo[];
        count: number;
        totalSize: number;
        recommendedKeep?: string;
    }>;
    orphanedFiles: R2FileInfo[];
}> {
    try {
        const response = await api.get<{
            summary: {
                totalFiles: number;
                referencedFiles: number;
                orphanedFiles: number;
                orphanedSize: number;
                duplicateGroups: number;
                duplicateWastedSize: number;
            };
            duplicateGroups: DuplicateGroupRaw[];
            orphanedFiles: R2FileInfoRaw[];
        }>('/admin/r2/duplicates');
        return {
            summary: response.data.summary,
            duplicateGroups: response.data.duplicateGroups.map((group: DuplicateGroupRaw) => ({
                ...group,
                files: group.files.map((file: R2FileInfoRaw) => ({
                    ...file,
                    uploaded: new Date(file.uploaded),
                })),
            })),
            orphanedFiles: response.data.orphanedFiles.map((file: R2FileInfoRaw) => ({
                ...file,
                uploaded: new Date(file.uploaded),
            })),
        };
    } catch (error) {
        console.error('[ModR2API] Failed to detect duplicates:', error);
        throw new Error(`Failed to detect duplicates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Delete single R2 file (admin only)
 */
export async function deleteR2File(key: string, force?: boolean): Promise<void> {
    try {
        const encodedKey = encodeURIComponent(key);
        const url = `/admin/r2/files/${encodedKey}${force ? '?force=true' : ''}`;
        await api.delete(url);
    } catch (error) {
        console.error(`[ModR2API] Failed to delete R2 file ${key}:`, error);
        throw new Error(`Failed to delete R2 file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Bulk delete R2 files (admin only)
 */
export async function bulkDeleteR2Files(keys: string[], force?: boolean): Promise<{
    deleted: number;
    failed: number;
    protected?: number;
    results?: Array<{ key: string; deleted: boolean; error?: string; protected?: boolean }>;
}> {
    try {
        const response = await api.post<{
            deleted: number;
            failed: number;
            protected?: number;
            results?: Array<{ key: string; deleted: boolean; error?: string; protected?: boolean }>;
        }>('/admin/r2/files/delete', { keys, force });
        return response.data;
    } catch (error) {
        console.error('[ModR2API] Failed to bulk delete R2 files:', error);
        throw new Error(`Failed to bulk delete R2 files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
