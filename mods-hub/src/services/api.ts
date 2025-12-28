/**
 * Mods Hub API Service
 * Uses the shared @strixun/api-framework for secure, type-safe API calls
 */

import { createAPIClient } from '@strixun/api-framework/client';
import type { ModStatus, ModUpdateRequest, ModUploadRequest, VersionUploadRequest } from '../types/mod';
import type { UpdateUserRequest } from '../types/user';

/**
 * API base URL for constructing absolute URLs
 * In dev mode, uses Vite proxy (/mods-api) to avoid CORS issues
 * In production, uses environment variable or defaults to production URL
 */
export const API_BASE_URL = import.meta.env.DEV 
  ? '/mods-api'  // Vite proxy in development
  : (import.meta.env.VITE_MODS_API_URL || 'https://mods-api.idling.app');

/**
 * Create API client instance with auth token getter
 * Reads token from Zustand persisted auth store (localStorage['auth-storage'])
 * Uses dynamic import to avoid circular dependencies
 */
const createClient = () => {
    return createAPIClient({
        baseURL: API_BASE_URL,
        defaultHeaders: {
            'Content-Type': 'application/json',
        },
        auth: {
            tokenGetter: async () => {
                if (typeof window !== 'undefined') {
                    try {
                        // Try to get token from Zustand store directly (preferred method)
                        // Dynamic import to avoid circular dependencies
                        const { useAuthStore } = await import('../stores/auth');
                        const store = useAuthStore.getState();
                        if (store.user?.token) {
                            return store.user.token;
                        }
                    } catch (error) {
                        // If store import fails, fall back to localStorage parsing
                        console.debug('[API] Could not access auth store directly, falling back to localStorage:', error);
                    }
                    
                    try {
                        // Fallback: Read from Zustand persisted store in localStorage
                        // Auth store uses 'auth-storage' key and stores: { user: { token: '...', ... } }
                        const authStorage = localStorage.getItem('auth-storage');
                        if (authStorage) {
                            const parsed = JSON.parse(authStorage);
                            // Zustand persist with partialize stores as { user: { token: '...' } }
                            if (parsed?.user?.token) {
                                return parsed.user.token;
                            }
                            // Some Zustand versions might wrap in state: { state: { user: { token: '...' } } }
                            if (parsed?.state?.user?.token) {
                                return parsed.state.user.token;
                            }
                        }
                    } catch (error) {
                        console.warn('[API] Failed to parse auth storage:', error);
                    }
                    
                    // Final fallback to legacy keys for backwards compatibility
                    return localStorage.getItem('auth_token') || localStorage.getItem('access_token');
                }
                return null;
            },
            onTokenExpired: () => {
                if (typeof window !== 'undefined') {
                    // Clear Zustand persisted store
                    localStorage.removeItem('auth-storage');
                    // Clear legacy keys for backwards compatibility
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('access_token');
                    window.dispatchEvent(new CustomEvent('auth:logout'));
                }
            },
        },
        timeout: 30000,
        retry: {
            maxAttempts: 3,
            backoff: 'exponential',
            retryableErrors: [408, 429, 500, 502, 503, 504],
        },
    });
};

// Create singleton API client instance
const api = createClient();

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
}): Promise<{
    mods: any[];
    total: number;
    page: number;
    pageSize: number;
}> {
    const params = new URLSearchParams();
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.pageSize) params.append('pageSize', filters.pageSize.toString());
    if (filters.category) params.append('category', filters.category);
    if (filters.search) params.append('search', filters.search);
    if (filters.authorId) params.append('authorId', filters.authorId);
    if (filters.featured !== undefined) params.append('featured', filters.featured.toString());
    if (filters.visibility) params.append('visibility', filters.visibility);
    
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await api.get<{
        mods: any[];
        total: number;
        page: number;
        pageSize: number;
    }>(`/mods${queryString}`);
    return response.data;
}

/**
 * Get mod detail by ID or slug
 */
export async function getModDetail(identifier: string): Promise<any> {
    const response = await api.get<any>(`/mods/${identifier}`);
    return response.data;
}

/**
 * Upload mod (requires authentication and upload permission)
 */
export async function uploadMod(
    file: File,
    metadata: ModUploadRequest,
    thumbnail?: File
): Promise<{ mod: any; version: any }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata));
    if (thumbnail) {
        formData.append('thumbnail', thumbnail);
    }
    
    // API framework automatically handles FormData - don't set Content-Type header
    const response = await api.post<{ mod: any; version: any }>('/mods', formData);
    return response.data;
}

/**
 * Update mod (requires authentication and ownership/admin)
 */
export async function updateMod(slug: string, updates: ModUpdateRequest): Promise<any> {
    const response = await api.put<any>(`/mods/${slug}`, updates);
    return response.data;
}

/**
 * Delete mod (requires authentication and ownership/admin)
 */
export async function deleteMod(slug: string): Promise<void> {
    await api.delete(`/mods/${slug}`);
}

/**
 * Upload mod version (requires authentication and ownership/admin)
 */
export async function uploadVersion(
    modId: string,
    file: File,
    metadata: VersionUploadRequest
): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata));
    
    // API framework automatically handles FormData - don't set Content-Type header
    const response = await api.post<any>(`/mods/${modId}/versions`, formData);
    return response.data;
}

/**
 * List all mods (admin only - includes all statuses)
 */
export async function listAllMods(filters: {
    page?: number;
    pageSize?: number;
    status?: string;
    category?: string;
    search?: string;
}): Promise<{
    mods: any[];
    total: number;
    page: number;
    pageSize: number;
}> {
    const params = new URLSearchParams();
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.pageSize) params.append('pageSize', filters.pageSize.toString());
    if (filters.status) params.append('status', filters.status);
    if (filters.category) params.append('category', filters.category);
    if (filters.search) params.append('search', filters.search);
    
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await api.get<{
        mods: any[];
        total: number;
        page: number;
        pageSize: number;
    }>(`/admin/mods${queryString}`);
    return response.data;
}

/**
 * Get mod review (admin/uploader only)
 */
export async function getModReview(slug: string): Promise<any> {
    const response = await api.get<any>(`/mods/${slug}/review`);
    return response.data;
}

/**
 * Update mod status (admin only)
 */
export async function updateModStatus(
    modId: string,
    status: ModStatus,
    reason?: string
): Promise<any> {
    const response = await api.put<any>(`/admin/mods/${modId}/status`, { status, reason });
    return response.data;
}

/**
 * Add review comment (admin/uploader only)
 */
export async function addReviewComment(modId: string, content: string): Promise<any> {
    const response = await api.post<any>(`/mods/${modId}/review/comments`, { content });
    return response.data;
}

/**
 * Admin delete mod (admin only, bypasses author check)
 */
export async function adminDeleteMod(modId: string): Promise<void> {
    await api.delete(`/admin/mods/${modId}`);
}

/**
 * Get mod ratings
 */
export async function getModRatings(modId: string): Promise<{
    ratings: any[];
    average: number;
    total: number;
}> {
    const response = await api.get<{
        ratings: any[];
        average: number;
        total: number;
    }>(`/mods/${modId}/ratings`);
    return response.data;
}

/**
 * Submit mod rating (requires authentication)
 */
export async function submitModRating(
    modId: string,
    rating: number,
    comment?: string
): Promise<any> {
    const response = await api.post<any>(`/mods/${modId}/ratings`, { rating, comment });
    return response.data;
}

/**
 * List users (admin only)
 */
export async function listUsers(filters: {
    page?: number;
    pageSize?: number;
    search?: string;
}): Promise<{
    users: any[];
    total: number;
    page: number;
    pageSize: number;
}> {
    const params = new URLSearchParams();
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.pageSize) params.append('pageSize', filters.pageSize.toString());
    if (filters.search) params.append('search', filters.search);
    
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await api.get<{
        users: any[];
        total: number;
        page: number;
        pageSize: number;
    }>(`/admin/users${queryString}`);
    return response.data;
}

/**
 * Get user details (admin only)
 */
export async function getUserDetails(userId: string): Promise<any> {
    const response = await api.get<any>(`/admin/users/${userId}`);
    return response.data;
}

/**
 * Update user (admin only)
 */
export async function updateUser(userId: string, updates: UpdateUserRequest): Promise<any> {
    const response = await api.put<any>(`/admin/users/${userId}`, updates);
    return response.data;
}

/**
 * Get user's mods (admin only)
 */
export async function getUserMods(userId: string, params: {
    page?: number;
    pageSize?: number;
}): Promise<{
    mods: any[];
    total: number;
    page: number;
    pageSize: number;
}> {
    const urlParams = new URLSearchParams();
    if (params.page) urlParams.append('page', params.page.toString());
    if (params.pageSize) urlParams.append('pageSize', params.pageSize.toString());
    
    const queryString = urlParams.toString() ? `?${urlParams.toString()}` : '';
    const response = await api.get<{
        mods: any[];
        total: number;
        page: number;
        pageSize: number;
    }>(`/admin/users/${userId}/mods${queryString}`);
    return response.data;
}

/**
 * Check upload permission (authenticated users)
 */
export async function checkUploadPermission(): Promise<{ hasPermission: boolean }> {
    const response = await api.get<{ hasPermission: boolean }>('/mods/permissions/me');
    return response.data;
}

/**
 * Admin settings API functions
 */

/**
 * Get admin settings
 */
export async function getAdminSettings(): Promise<{ allowedFileExtensions: string[]; updatedAt: string; updatedBy: string }> {
    const response = await api.get<{ allowedFileExtensions: string[]; updatedAt: string; updatedBy: string }>('/admin/settings');
    return response.data;
}

/**
 * Update admin settings
 */
export async function updateAdminSettings(settings: { allowedFileExtensions: string[] }): Promise<{ allowedFileExtensions: string[]; updatedAt: string; updatedBy: string }> {
    const response = await api.put<{ allowedFileExtensions: string[]; updatedAt: string; updatedBy: string }>('/admin/settings', settings);
    return response.data;
}

/**
 * Download mod version
 * Uses API framework for authentication and proper error handling
 * The response handler automatically converts binary responses to ArrayBuffer
 */
export async function downloadVersion(modSlug: string, versionId: string, fileName: string): Promise<void> {
    // Use API framework's get method - response handler converts binary to ArrayBuffer
    const response = await api.get<ArrayBuffer>(`/mods/${modSlug}/versions/${versionId}/download`);

    if (response.status < 200 || response.status >= 300) {
        throw new Error(`Failed to download version: ${response.statusText || 'Unknown error'}`);
    }

    // Convert ArrayBuffer to Blob for download
    const blob = new Blob([response.data as ArrayBuffer]);
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
}

/**
 * List R2 files
 */
export async function listR2Files(options?: { limit?: number }): Promise<{
    files: Array<{
        key: string;
        size: number;
        uploaded: Date;
        contentType?: string;
        customMetadata?: Record<string, string>;
    }>;
    total: number;
}> {
    const params = new URLSearchParams();
    if (options?.limit) {
        params.append('limit', options.limit.toString());
    }
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await api.get<{
        files: Array<{
            key: string;
            size: number;
            uploaded: string;
            contentType?: string;
            customMetadata?: Record<string, string>;
        }>;
        total: number;
    }>(`/admin/r2/files${queryString}`);
    return {
        ...response.data,
        files: response.data.files.map(file => ({
            ...file,
            uploaded: new Date(file.uploaded),
        })),
    };
}

/**
 * Detect duplicate and orphaned R2 files
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
        files: Array<{
            key: string;
            size: number;
            uploaded: Date;
            contentType?: string;
            customMetadata?: Record<string, string>;
        }>;
        count: number;
        totalSize: number;
        recommendedKeep?: string;
    }>;
    orphanedFiles: Array<{
        key: string;
        size: number;
        uploaded: Date;
        contentType?: string;
        customMetadata?: Record<string, string>;
    }>;
}> {
    const response = await api.get<{
        summary: {
            totalFiles: number;
            referencedFiles: number;
            orphanedFiles: number;
            orphanedSize: number;
            duplicateGroups: number;
            duplicateWastedSize: number;
        };
        duplicateGroups: Array<{
            files: Array<{
                key: string;
                size: number;
                uploaded: string;
                contentType?: string;
                customMetadata?: Record<string, string>;
            }>;
            count: number;
            totalSize: number;
            recommendedKeep?: string;
        }>;
        orphanedFiles: Array<{
            key: string;
            size: number;
            uploaded: string;
            contentType?: string;
            customMetadata?: Record<string, string>;
        }>;
    }>('/admin/r2/duplicates');
    return {
        summary: response.data.summary,
        duplicateGroups: response.data.duplicateGroups.map(group => ({
            ...group,
            files: group.files.map(file => ({
                ...file,
                uploaded: new Date(file.uploaded),
            })),
        })),
        orphanedFiles: response.data.orphanedFiles.map(file => ({
            ...file,
            uploaded: new Date(file.uploaded),
        })),
    };
}

/**
 * Delete single R2 file
 */
export async function deleteR2File(key: string): Promise<void> {
    const encodedKey = encodeURIComponent(key);
    await api.delete(`/admin/r2/files/${encodedKey}`);
}

/**
 * Bulk delete R2 files
 */
export async function bulkDeleteR2Files(keys: string[]): Promise<{
    deleted: number;
    failed: number;
    errors?: Array<{ key: string; error: string }>;
}> {
    const response = await api.post<{
        deleted: number;
        failed: number;
        errors?: Array<{ key: string; error: string }>;
    }>('/admin/r2/files/delete', { keys });
    return response.data;
}
