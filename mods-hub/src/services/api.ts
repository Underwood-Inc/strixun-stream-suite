/**
 * Mods Hub API Service
 * Uses the shared @strixun/api-framework for secure, type-safe API calls
 */

import { createAPIClient } from '@strixun/api-framework/client';
import type { 
    ModStatus, 
    ModUpdateRequest, 
    ModUploadRequest, 
    VersionUploadRequest,
    VariantVersionUploadRequest
} from '../types/mod';
import type { UpdateCustomerRequest } from '../types/customer';
import { encryptFileForUpload, downloadFileFromArrayBuffer } from '../utils/fileEncryption';

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
                    if (store.customer?.token) {
                        const rawToken = store.customer.token;
                        const token = rawToken.trim();
                        const wasTrimmed = rawToken !== token;
                        
                        if (token && token.length > 0) {
                            console.log('[API] Token retrieved from Zustand store:', {
                                rawTokenLength: rawToken.length,
                                trimmedTokenLength: token.length,
                                wasTrimmed,
                                rawTokenPrefix: rawToken.substring(0, 20) + '...',
                                trimmedTokenPrefix: token.substring(0, 20) + '...',
                                rawTokenSuffix: '...' + rawToken.substring(rawToken.length - 10),
                                trimmedTokenSuffix: '...' + token.substring(token.length - 10),
                            });
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
                        // Zustand persist with partialize stores as { customer: { token: '...' } }
                        let token: string | null = null;
                        if (parsed?.customer?.token) {
                            token = parsed.customer.token;
                        } else if (parsed?.state?.customer?.token) {
                            // Some Zustand versions might wrap in state
                            token = parsed.state.customer.token;
                        }
                        
                        if (token) {
                            const rawToken = token;
                            const trimmedToken = token.trim();
                            const wasTrimmed = rawToken !== trimmedToken;
                            
                            if (trimmedToken && trimmedToken.length > 0) {
                                console.log('[API] Token retrieved from localStorage:', {
                                    rawTokenLength: rawToken.length,
                                    trimmedTokenLength: trimmedToken.length,
                                    wasTrimmed,
                                    rawTokenPrefix: rawToken.substring(0, 20) + '...',
                                    trimmedTokenPrefix: trimmedToken.substring(0, 20) + '...',
                                    rawTokenSuffix: '...' + rawToken.substring(rawToken.length - 10),
                                    trimmedTokenSuffix: '...' + trimmedToken.substring(trimmedToken.length - 10),
                                });
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
                    const rawToken = legacyToken;
                    const trimmedToken = legacyToken.trim();
                    const wasTrimmed = rawToken !== trimmedToken;
                    
                    if (trimmedToken && trimmedToken.length > 0) {
                        console.log('[API] Token retrieved from legacy storage:', {
                            rawTokenLength: rawToken.length,
                            trimmedTokenLength: trimmedToken.length,
                            wasTrimmed,
                            rawTokenPrefix: rawToken.substring(0, 20) + '...',
                            trimmedTokenPrefix: trimmedToken.substring(0, 20) + '...',
                            rawTokenSuffix: '...' + rawToken.substring(rawToken.length - 10),
                            trimmedTokenSuffix: '...' + trimmedToken.substring(trimmedToken.length - 10),
                        });
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
            initialDelay: 1000,
            maxDelay: 10000,
            retryableErrors: [408, 429, 500, 502, 503, 504],
        },
        // Opt-in to specific features as needed
        features: {
            // Enable cancellation for request cancellation support
            cancellation: true,
            // Enable logging for debugging (can be disabled in production)
            logging: import.meta.env.DEV,
            // Other features disabled by default - enable as needed
            deduplication: false,
            queue: false,
            circuitBreaker: false,
            offlineQueue: false,
            optimisticUpdates: false,
            metrics: false,
            // E2E encryption is handled automatically by response handler
            // No need to enable e2eEncryption feature flag - response handler decrypts based on X-Encrypted header
        },
    });
};

// Create singleton API client instance
const api = createClient();

/**
 * Get authentication token using the same logic as the API client
 * This is a helper function to access the token for encryption without
 * accessing the private config property
 * 
 * Exported for use in components that need to make authenticated requests
 * outside of the API client (e.g., badge images that need auth headers)
 */
export async function getAuthToken(): Promise<string | null> {
    if (typeof window === 'undefined') {
        return null;
    }

    // Priority 1: Try to get token from Zustand store directly (most reliable)
    try {
        const { useAuthStore } = await import('../stores/auth');
        const store = useAuthStore.getState();
        if (store.customer?.token) {
            const token = store.customer.token.trim();
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
            if (parsed?.customer?.token) {
                token = parsed.customer.token;
            } else if (parsed?.state?.customer?.token) {
                token = parsed.state.customer.token;
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
 * Uses API framework client which automatically handles:
 * - Authentication token injection
 * - Encrypted response decryption
 * - Error handling and retries
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
    // API framework automatically handles encrypted responses via X-Encrypted header
    // Response handler decrypts using token from request.metadata.token (set by auth middleware)
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
    // Encrypt file using shared utility (handles compression automatically)
    const encryptedFileObj = await encryptFileForUpload(file);

    const formData = new FormData();
    formData.append('file', encryptedFileObj);
    formData.append('metadata', JSON.stringify(metadata));
    if (thumbnail) {
        // CRITICAL: Thumbnails must NEVER be encrypted - they are public images
        // Append thumbnail directly as unencrypted File object
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
            // CRITICAL: Thumbnails must NEVER be encrypted - they are public images
            // Append thumbnail directly as unencrypted File object
            formData.append('thumbnail', thumbnail);
        }
        // Add variant files to FormData - CRITICAL: Encrypt with shared key (same as uploadMod/uploadVersion)
        if (variantFiles) {
            for (const [variantId, file] of Object.entries(variantFiles)) {
                try {
                    // Encrypt variant file using shared utility (handles compression automatically)
                    // Same encryption system as main mod upload
                    const encryptedFileObj = await encryptFileForUpload(file);
                    formData.append(`variant_${variantId}`, encryptedFileObj);
                } catch (error) {
                    // Re-throw with context about which variant failed
                    if (error instanceof Error) {
                        throw new Error(`Failed to encrypt variant file "${file.name}" (variantId: ${variantId}): ${error.message}`);
                    }
                    throw error;
                }
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
    // Encrypt file using shared utility (handles compression automatically)
    const encryptedFileObj = await encryptFileForUpload(file);

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
 * List customers (admin only)
 */
export async function listCustomers(filters: {
    page?: number;
    pageSize?: number;
    search?: string;
}): Promise<{
    customers: any[];
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
        customers: any[];
        total: number;
        page: number;
        pageSize: number;
    }>(`/admin/customers${queryString}`);
    return response.data;
}

/**
 * Get customer details (admin only)
 */
export async function getCustomerDetails(customerId: string): Promise<any> {
    const response = await api.get<any>(`/admin/customers/${customerId}`);
    return response.data;
}

/**
 * Update customer (admin only)
 */
export async function updateCustomer(customerId: string, updates: UpdateCustomerRequest): Promise<any> {
    const response = await api.put<any>(`/admin/customers/${customerId}`, updates);
    return response.data;
}

/**
 * Get customer's mods (admin only)
 */
export async function getCustomerMods(customerId: string, params: {
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
    }>(`/admin/customers/${customerId}/mods${queryString}`);
    return response.data;
}

/**
 * Check upload permission (authenticated customers)
 */
export async function checkUploadPermission(): Promise<{ hasPermission: boolean }> {
    const response = await api.get<{ 
        hasUploadPermission: boolean;
        isAdmin: boolean;
        isSuperAdmin: boolean;
        roles: string[];
        permissions: string[];
    }>('/mods/permissions/me');
    // Backend returns hasUploadPermission, map to hasPermission for backwards compatibility
    return { hasPermission: response.data.hasUploadPermission };
}

/**
 * Get mod upload settings (authenticated customers)
 * Returns allowed file extensions and upload enabled status
 */
export async function getModSettings(): Promise<{ allowedFileExtensions: string[]; uploadsEnabled: boolean }> {
    const response = await api.get<{ allowedFileExtensions: string[]; uploadsEnabled: boolean }>('/mods/settings');
    return response.data;
}

/**
 * Admin settings API functions
 */

/**
 * Get admin settings
 */
export async function getAdminSettings(): Promise<{ allowedFileExtensions: string[]; uploadsEnabled?: boolean; updatedAt: string; updatedBy: string }> {
    const response = await api.get<{ allowedFileExtensions: string[]; updatedAt: string; updatedBy: string }>('/admin/settings');
    return response.data;
}

/**
 * Update admin settings
 */
export async function updateAdminSettings(settings: { allowedFileExtensions?: string[]; uploadsEnabled?: boolean }): Promise<{ allowedFileExtensions: string[]; uploadsEnabled?: boolean; updatedAt: string; updatedBy: string }> {
    const response = await api.put<{ allowedFileExtensions: string[]; updatedAt: string; updatedBy: string }>('/admin/settings', settings);
    return response.data;
}

/**
 * Download mod version
 * Uses API framework for authentication and proper error handling
 * The response handler automatically converts binary responses to ArrayBuffer
 * Files are decrypted server-side before being sent to the client
 */
export async function downloadVersion(modSlug: string, versionId: string, fileName: string): Promise<void> {
    // Use API framework's get method - response handler converts binary to ArrayBuffer
    const response = await api.get<ArrayBuffer>(`/mods/${modSlug}/versions/${versionId}/download`);

    if (response.status < 200 || response.status >= 300) {
        throw new Error(`Failed to download version: ${response.statusText || 'Unknown error'}`);
    }

    // Use shared utility to handle download (files are already decrypted server-side)
    downloadFileFromArrayBuffer(response.data as ArrayBuffer, fileName);
}

/**
 * Download mod variant (latest version)
 * Uses raw fetch to properly access Content-Disposition headers
 * Files are decrypted server-side before being sent to the client
 * Filename is extracted from Content-Disposition header to preserve the original uploaded filename
 */
export async function downloadVariant(modSlug: string, variantId: string): Promise<void> {
    // Get auth token
    const token = await getAuthToken();
    
    // Use raw fetch to get headers properly
    const url = `${API_BASE_URL}/mods/${modSlug}/variants/${variantId}/download`;
    const response = await fetch(url, {
        headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to download variant: ${response.statusText || 'Unknown error'}`);
    }

    // Extract filename from Content-Disposition header (preserves original uploaded filename)
    const contentDisposition = response.headers.get('content-disposition') || '';
    const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
    
    if (!fileNameMatch || !fileNameMatch[1]) {
        throw new Error(`Failed to extract filename from Content-Disposition header: ${contentDisposition}`);
    }
    
    const fileName = fileNameMatch[1];

    // Convert response to ArrayBuffer
    const arrayBuffer = await response.arrayBuffer();

    // Use shared utility to handle download (files are already decrypted server-side)
    downloadFileFromArrayBuffer(arrayBuffer, fileName);
}

/**
 * List all versions for a variant
 */
export async function listVariantVersions(
    modSlug: string,
    variantId: string
): Promise<{ versions: any[] }> {
    const response = await api.get<{ versions: any[] }>(`/mods/${modSlug}/variants/${variantId}/versions`);
    return response.data;
}

/**
 * Delete mod version (requires authentication and ownership/admin)
 */
export async function deleteModVersion(modId: string, versionId: string): Promise<void> {
    await api.delete(`/mods/${modId}/versions/${versionId}`);
}

/**
 * Delete entire variant and all its versions
 */
export async function deleteVariant(
    modId: string,
    variantId: string
): Promise<void> {
    await api.delete(`/mods/${modId}/variants/${variantId}`);
}

/**
 * Update mod version metadata (requires authentication and ownership/admin)
 */
export async function updateModVersion(
    modId: string,
    versionId: string,
    updates: Partial<VersionUploadRequest>
): Promise<any> {
    const response = await api.put<any>(`/mods/${modId}/versions/${versionId}`, updates);
    return response.data;
}

/**
 * Update variant version metadata (requires authentication and ownership/admin)
 */
export async function updateVariantVersion(
    modId: string,
    variantId: string,
    variantVersionId: string,
    updates: Partial<VariantVersionUploadRequest>
): Promise<any> {
    const response = await api.put<any>(
        `/mods/${modId}/variants/${variantId}/versions/${variantVersionId}`,
        updates
    );
    return response.data;
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

export interface R2FileAssociatedCustomer {
    customerId: string;
    displayName?: string | null;
}

export interface R2FileAssociatedData {
    mod?: R2FileAssociatedMod;
    version?: R2FileAssociatedVersion;
    uploadedBy?: R2FileAssociatedCustomer;
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
 * @param key - File key to delete
 * @param force - If true, allows deletion of protected files (files associated with mods)
 */
export async function deleteR2File(key: string, force?: boolean): Promise<void> {
    const encodedKey = encodeURIComponent(key);
    const url = `/admin/r2/files/${encodedKey}${force ? '?force=true' : ''}`;
    await api.delete(url);
}

/**
 * Bulk delete R2 files
 * @param keys - Array of file keys to delete
 * @param force - If true, allows deletion of protected files (files associated with mods)
 */
export async function bulkDeleteR2Files(keys: string[], force?: boolean): Promise<{
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
    }>('/admin/r2/files/delete', { keys, force });
    return response.data;
}
