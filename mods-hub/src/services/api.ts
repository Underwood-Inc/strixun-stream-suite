/**
 * Mods Hub API Service
 * Uses the shared @strixun/api-framework for secure, type-safe API calls
 */

import { createAPIClient } from '@strixun/api-framework/client';
import { encryptBinaryWithJWT, encryptBinaryWithServiceKey } from '@strixun/api-framework';
import { getOtpEncryptionKey } from '../../../shared-config/otp-encryption';
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
 * 
 * CRITICAL: Token getter must always check multiple sources to ensure token is found
 */
const createClient = () => {
    return createAPIClient({
        baseURL: API_BASE_URL,
        defaultHeaders: {
            'Content-Type': 'application/json',
        },
        auth: {
            tokenGetter: async () => {
                if (typeof window === 'undefined') {
                    return null;
                }

                // Priority 1: Try to get token from Zustand store directly (most reliable)
                try {
                    const { useAuthStore } = await import('../stores/auth');
                    const store = useAuthStore.getState();
                    if (store.user?.token) {
                        const token = store.user.token.trim();
                        if (token && token.length > 0) {
                            console.debug('[API] Token retrieved from Zustand store');
                            return token;
                        }
                    }
                } catch (error) {
                    console.debug('[API] Could not access auth store directly:', error);
                }
                
                // Priority 2: Read directly from localStorage (works even if store isn't hydrated)
                try {
                    const authStorage = localStorage.getItem('auth-storage');
                    if (authStorage) {
                        const parsed = JSON.parse(authStorage);
                        // Zustand persist with partialize stores as { user: { token: '...' } }
                        let token: string | null = null;
                        if (parsed?.user?.token) {
                            token = parsed.user.token;
                        } else if (parsed?.state?.user?.token) {
                            // Some Zustand versions might wrap in state
                            token = parsed.state.user.token;
                        }
                        
                        if (token) {
                            const trimmedToken = token.trim();
                            if (trimmedToken && trimmedToken.length > 0) {
                                console.debug('[API] Token retrieved from localStorage');
                                return trimmedToken;
                            }
                        }
                    }
                } catch (error) {
                    console.warn('[API] Failed to parse auth storage:', error);
                }
                
                // Priority 3: Legacy keys for backwards compatibility
                const legacyToken = localStorage.getItem('auth_token') || localStorage.getItem('access_token');
                if (legacyToken) {
                    const trimmedToken = legacyToken.trim();
                    if (trimmedToken && trimmedToken.length > 0) {
                        console.debug('[API] Token retrieved from legacy storage');
                        return trimmedToken;
                    }
                }
                
                console.warn('[API] No token found in any storage location');
                return null;
            },
            onTokenExpired: () => {
                if (typeof window !== 'undefined') {
                    console.warn('[API] Token expired, clearing auth state');
                    // Clear Zustand persisted store
                    localStorage.removeItem('auth-storage');
                    // Clear legacy keys for backwards compatibility
                    localStorage.removeItem('auth_token');
                    localStorage.removeItem('access_token');
                    // Dispatch logout event
                    window.dispatchEvent(new CustomEvent('auth:logout'));
                    // Also clear the store if possible
                    import('../stores/auth').then(({ useAuthStore }) => {
                        useAuthStore.getState().logout();
                    }).catch(() => {
                        // Ignore errors if store isn't available
                    });
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
 * Get authentication token using the same logic as the API client
 * This is a helper function to access the token for encryption without
 * accessing the private config property
 */
async function getAuthToken(): Promise<string | null> {
    if (typeof window === 'undefined') {
        return null;
    }

    // Priority 1: Try to get token from Zustand store directly (most reliable)
    try {
        const { useAuthStore } = await import('../stores/auth');
        const store = useAuthStore.getState();
        if (store.user?.token) {
            const token = store.user.token.trim();
            if (token && token.length > 0) {
                return token;
            }
        }
    } catch {
        // Ignore errors if store isn't available
    }
    
    // Priority 2: Read directly from localStorage (works even if store isn't hydrated)
    try {
        const authStorage = localStorage.getItem('auth-storage');
        if (authStorage) {
            const parsed = JSON.parse(authStorage);
            let token: string | null = null;
            if (parsed?.user?.token) {
                token = parsed.user.token;
            } else if (parsed?.state?.user?.token) {
                token = parsed.state.user.token;
            }
            
            if (token) {
                const trimmedToken = token.trim();
                if (trimmedToken && trimmedToken.length > 0) {
                    return trimmedToken;
                }
            }
        }
    } catch {
        // Ignore parse errors
    }
    
    // Priority 3: Legacy keys for backwards compatibility
    const legacyToken = localStorage.getItem('auth_token') || localStorage.getItem('access_token');
    if (legacyToken) {
        const trimmedToken = legacyToken.trim();
        if (trimmedToken && trimmedToken.length > 0) {
            return trimmedToken;
        }
    }
    
    return null;
}

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
    // Determine encryption method based on mod visibility
    // CRITICAL FIX: Public mods use service key regardless of status (pending/published)
    // This allows anonymous downloads once mod is published, even if uploaded as pending
    // Private/draft mods use JWT (requires authentication to download)
    const isPublic = metadata.visibility === 'public';
    let encryptedFile: Uint8Array;
    
    if (isPublic) {
        // Public mods: encrypt with service key for anonymous downloads
        // This works even if status is 'pending' - allows downloads once published
        const serviceKey = getOtpEncryptionKey();
        if (!serviceKey) {
            // Enhanced error message for production debugging
            const isProduction = typeof window !== 'undefined' && import.meta.env?.MODE === 'production';
            const errorMsg = isProduction
                ? 'Service encryption key not configured in production build. The GitHub secret VITE_SERVICE_ENCRYPTION_KEY must match the Cloudflare Worker secret SERVICE_ENCRYPTION_KEY. Check the deployment workflow and ensure both secrets are set to the same value.'
                : 'Service encryption key not configured. Set VITE_SERVICE_ENCRYPTION_KEY in environment.';
            console.error('[uploadMod] Service key missing:', {
                isProduction,
                hasImportMeta: typeof import.meta !== 'undefined',
                hasEnv: !!import.meta?.env,
                envKeys: typeof import.meta?.env === 'object' ? Object.keys(import.meta.env || {}).filter(k => k.startsWith('VITE_')) : [],
            });
            throw new Error(errorMsg);
        }
        if (serviceKey.length < 32) {
            throw new Error(`Service encryption key is too short (${serviceKey.length} chars, minimum 32). Check VITE_SERVICE_ENCRYPTION_KEY configuration.`);
        }
        const fileBuffer = await file.arrayBuffer();
        encryptedFile = await encryptBinaryWithServiceKey(fileBuffer, serviceKey);
    } else {
        // Private/draft mods: encrypt with JWT (requires authentication to download)
        const token = await getAuthToken();
        if (!token) {
            throw new Error('Authentication token required for file encryption');
        }
        const fileBuffer = await file.arrayBuffer();
        encryptedFile = await encryptBinaryWithJWT(fileBuffer, token);
    }
    
    // Create encrypted File object with .encrypted extension
    // Convert Uint8Array to ArrayBuffer for Blob constructor compatibility
    // Create a new ArrayBuffer copy to ensure type compatibility
    const encryptedArrayBuffer = encryptedFile.buffer.slice(
        encryptedFile.byteOffset,
        encryptedFile.byteOffset + encryptedFile.byteLength
    ) as ArrayBuffer;
    const encryptedBlob = new Blob([encryptedArrayBuffer], { type: 'application/octet-stream' });
    const encryptedFileObj = new File([encryptedBlob], `${file.name}.encrypted`, { type: 'application/octet-stream' });

    const formData = new FormData();
    formData.append('file', encryptedFileObj);
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
export async function updateMod(slug: string, updates: ModUpdateRequest, thumbnail?: File, variantFiles?: Record<string, File>): Promise<any> {
    // If thumbnail or variant files are provided, use FormData; otherwise use JSON
    if (thumbnail || (variantFiles && Object.keys(variantFiles).length > 0)) {
        const formData = new FormData();
        formData.append('metadata', JSON.stringify(updates));
        if (thumbnail) {
            formData.append('thumbnail', thumbnail);
        }
        // Add variant files to FormData
        if (variantFiles) {
            for (const [variantId, file] of Object.entries(variantFiles)) {
                formData.append(`variant_${variantId}`, file);
            }
        }
        // API framework automatically handles FormData - don't set Content-Type header
        const response = await api.put<any>(`/mods/${slug}`, formData);
        return response.data;
    } else {
        const response = await api.put<any>(`/mods/${slug}`, updates);
        return response.data;
    }
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
    // Fetch mod to check visibility - versions inherit mod's visibility
    // CRITICAL FIX: Public mods use service key regardless of status (pending/published)
    let isPublic = false;
    try {
        const mod = await getModDetail(modId);
        isPublic = mod.visibility === 'public';
    } catch (error) {
        console.warn('[uploadVersion] Could not fetch mod to check visibility, defaulting to private encryption:', error);
        // Default to private if we can't fetch mod (backward compatible)
    }
    
    let encryptedFile: Uint8Array;
    
    if (isPublic) {
        // Public mods: encrypt with service key for anonymous downloads
        const serviceKey = getOtpEncryptionKey();
        if (!serviceKey) {
            // Enhanced error message for production debugging
            const isProduction = typeof window !== 'undefined' && import.meta.env?.MODE === 'production';
            const errorMsg = isProduction
                ? 'Service encryption key not configured in production build. The GitHub secret VITE_SERVICE_ENCRYPTION_KEY must match the Cloudflare Worker secret SERVICE_ENCRYPTION_KEY. Check the deployment workflow and ensure both secrets are set to the same value.'
                : 'Service encryption key not configured. Set VITE_SERVICE_ENCRYPTION_KEY in environment.';
            console.error('[uploadVersion] Service key missing:', {
                isProduction,
                hasImportMeta: typeof import.meta !== 'undefined',
                hasEnv: !!import.meta?.env,
                envKeys: typeof import.meta?.env === 'object' ? Object.keys(import.meta.env || {}).filter(k => k.startsWith('VITE_')) : [],
            });
            throw new Error(errorMsg);
        }
        if (serviceKey.length < 32) {
            throw new Error(`Service encryption key is too short (${serviceKey.length} chars, minimum 32). Check VITE_SERVICE_ENCRYPTION_KEY configuration.`);
        }
        const fileBuffer = await file.arrayBuffer();
        encryptedFile = await encryptBinaryWithServiceKey(fileBuffer, serviceKey);
    } else {
        // Private/draft mods: encrypt with JWT (requires authentication to download)
        const token = await getAuthToken();
        if (!token) {
            throw new Error('Authentication token required for file encryption');
        }
        const fileBuffer = await file.arrayBuffer();
        encryptedFile = await encryptBinaryWithJWT(fileBuffer, token);
    }
    
    // Create encrypted File object with .encrypted extension
    // Convert Uint8Array to ArrayBuffer for Blob constructor compatibility
    // Create a new ArrayBuffer copy to ensure type compatibility
    const encryptedArrayBuffer = encryptedFile.buffer.slice(
        encryptedFile.byteOffset,
        encryptedFile.byteOffset + encryptedFile.byteLength
    ) as ArrayBuffer;
    const encryptedBlob = new Blob([encryptedArrayBuffer], { type: 'application/octet-stream' });
    const encryptedFileObj = new File([encryptedBlob], `${file.name}.encrypted`, { type: 'application/octet-stream' });

    const formData = new FormData();
    formData.append('file', encryptedFileObj);
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
 * Download mod variant
 * Uses API framework for authentication and proper error handling
 * The response handler automatically converts binary responses to ArrayBuffer
 */
export async function downloadVariant(modSlug: string, variantId: string, fileName: string): Promise<void> {
    // Use API framework's get method - response handler converts binary to ArrayBuffer
    const response = await api.get<ArrayBuffer>(`/mods/${modSlug}/variants/${variantId}/download`);

    if (response.status < 200 || response.status >= 300) {
        throw new Error(`Failed to download variant: ${response.statusText || 'Unknown error'}`);
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
 * Associated data types for R2 files
 */
export interface R2FileAssociatedMod {
    modId: string;
    title: string;
    slug: string;
    authorId: string;
    authorDisplayName?: string | null;
    description: string;
    category: string;
    status: string;
    customerId: string | null;
    createdAt: string;
    updatedAt: string;
    latestVersion: string;
    downloadCount: number;
    visibility: string;
    featured: boolean;
}

export interface R2FileAssociatedVersion {
    versionId: string;
    modId: string;
    version: string;
    changelog: string;
    fileSize: number;
    fileName: string;
    sha256: string;
    createdAt: string;
    downloads: number;
    gameVersions: string[];
    dependencies?: Array<{ modId: string; version?: string; required: boolean }>;
}

export interface R2FileAssociatedUser {
    userId: string;
    displayName?: string | null;
}

export interface R2FileAssociatedData {
    mod?: R2FileAssociatedMod;
    version?: R2FileAssociatedVersion;
    uploadedBy?: R2FileAssociatedUser;
    isThumbnail?: boolean;
    isModFile?: boolean;
}

export interface R2FileInfo {
    key: string;
    size: number;
    uploaded: Date;
    contentType?: string;
    customMetadata?: Record<string, string>;
    isOrphaned?: boolean;
    associatedModId?: string;
    associatedVersionId?: string;
    associatedData?: R2FileAssociatedData;
}

/**
 * List R2 files
 */
export async function listR2Files(options?: { limit?: number }): Promise<{
    files: R2FileInfo[];
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
            isOrphaned?: boolean;
            associatedModId?: string;
            associatedVersionId?: string;
            associatedData?: R2FileAssociatedData;
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
        files: R2FileInfo[];
        count: number;
        totalSize: number;
        recommendedKeep?: string;
    }>;
    orphanedFiles: R2FileInfo[];
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
                isOrphaned?: boolean;
                associatedModId?: string;
                associatedVersionId?: string;
                associatedData?: R2FileAssociatedData;
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
            isOrphaned?: boolean;
            associatedModId?: string;
            associatedVersionId?: string;
            associatedData?: R2FileAssociatedData;
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
    protected?: number;
    results?: Array<{ key: string; deleted: boolean; error?: string; protected?: boolean }>;
}> {
    const response = await api.post<{
        deleted: number;
        failed: number;
        protected?: number;
        results?: Array<{ key: string; deleted: boolean; error?: string; protected?: boolean }>;
    }>('/admin/r2/files/delete', { keys });
    return response.data;
}
