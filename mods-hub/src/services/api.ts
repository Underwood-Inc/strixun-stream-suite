/**
 * API service for mods API
 * Handles all HTTP requests to the Cloudflare Worker
 * Uses shared API framework client
 */

import { createAPIClient } from '@strixun/api-framework/client';
import type { ModStatus, ModReviewComment } from '../types/mod';

// Use proxy in development (via Vite), direct URL in production
// This matches the pattern used in other projects (e.g., otp-auth-service dashboard)
export const API_BASE_URL = import.meta.env.DEV 
  ? '/mods-api'  // Vite proxy in development
  : (import.meta.env.VITE_MODS_API_URL || 'https://mods-api.idling.app');

/**
 * Get auth token from auth store
 * Token is stored in the user object in localStorage via Zustand persist
 */
function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    
    // Get token from auth store (user object in localStorage)
    // The auth store persists the user object which contains the token
    try {
        // Read directly from localStorage where Zustand persists the auth store
        const authStorage = localStorage.getItem('auth-storage');
        if (authStorage) {
            const parsed = JSON.parse(authStorage);
            if (parsed?.state?.user?.token) {
                return parsed.state.user.token;
            }
        }
    } catch (error) {
        console.debug('[API] Failed to read token from auth store:', error);
    }
    
    return null;
}

/**
 * Refresh auth token by restoring session from backend
 */
async function refreshAuthToken(): Promise<string | null> {
    // Use proxy in development (via Vite), direct URL in production
    const AUTH_API_URL = import.meta.env.DEV 
      ? '/auth-api'  // Vite proxy in development
      : (import.meta.env.VITE_AUTH_API_URL || 'https://auth.idling.app');
    
    try {
        // Use the API framework client which already handles secureFetch internally
        // IMPORTANT: Do NOT add auth config - restore-session is IP-based and doesn't require auth
        const { createAPIClient } = await import('@strixun/api-framework/client');
        const authClient = createAPIClient({
            baseURL: AUTH_API_URL,
            timeout: 5000, // 5 second timeout for session restoration
            // Explicitly no auth config - restore-session is IP-based
        });
        
        // Make request with auth explicitly disabled
        const response = await authClient.post<{ restored: boolean; access_token?: string; token?: string; userId?: string; sub?: string; email?: string; expiresAt?: string }>('/auth/restore-session', {}, {
            metadata: { auth: false } // Explicitly disable auth for this request
        });

        if (response.status !== 200 || !response.data) {
            console.warn('[API] Token refresh failed:', response.status);
            return null;
        }

        const data = response.data;
        console.log('[API] Token refresh response:', { restored: data?.restored, hasAccessToken: !!data?.access_token, hasToken: !!data?.token, keys: data ? Object.keys(data) : [] });
        
        // Check for access_token (preferred) or token (fallback)
        const token = data?.access_token || data?.token;
        const isRestored = data?.restored !== false; // Default to true if not explicitly false
        
        if (token && isRestored) {
            // Token will be stored in auth store when restoreSession is called
            // This function is called by the auth store's restoreSession, so it will handle storage
            console.log('[API] Token restored, auth store will handle storage');
            
            // Update auth store if available
            try {
                const { useAuthStore } = await import('../stores/auth');
                const store = useAuthStore.getState();
                if (store.setUser) {
                    const userId = data.userId || data.sub;
                    const email = data.email;
                    const expiresAt = data.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

                    if (!userId || !email) {
                        console.warn('[API] Token refresh response missing userId/email, but token is valid');
                        // Still return token even if userId/email missing - token is what matters
                    } else {
                        store.setUser({
                            userId,
                            email,
                            token,
                            expiresAt,
                        });
                        console.log('[API] Auth store updated');
                    }
                }
            } catch (err) {
                // Auth store might not be available, that's okay
                console.debug('[API] Could not update auth store:', err);
            }
            
            console.log('[API] ✅ Token refreshed successfully');
            return token;
        }

        console.warn('[API] Token refresh failed - missing token or not restored', { hasToken: !!token, isRestored, data });
        return null;
    } catch (error) {
        console.warn('[API] Token refresh error:', error instanceof Error ? error.message : String(error));
        return null;
    }
}

/**
 * Create API client with auth middleware
 */
console.log('[API] Initializing API client with baseURL:', API_BASE_URL);
const api = createAPIClient({
    baseURL: API_BASE_URL,
    defaultHeaders: {
        'Content-Type': 'application/json',
    },
    timeout: 30000,
    retry: {
        maxAttempts: 3,
        backoff: 'exponential',
    },
    cache: {
        enabled: true,
        defaultStrategy: 'network-first',
        defaultTTL: 5 * 60 * 1000, // 5 minutes
    },
    offline: {
        enabled: false, // Disable offline queue to prevent blocking
    },
    auth: {
        tokenGetter: getAuthToken,
        onTokenExpired: async () => {
            // If user is authenticated, try to refresh token
            // Otherwise, they need to log in again
            console.log('[API] Token expired, attempting to refresh...');
            const newToken = await refreshAuthToken();
            if (!newToken) {
                console.warn('[API] Token refresh failed - user may need to log in again');
                // Don't do anything else - let the 401 error propagate
                // The UI should handle redirecting to login if needed
            } else {
                console.log('[API] Token refreshed successfully');
            }
        },
    },
});
// Verify API client is properly initialized
if (typeof (api as any).getConfig === 'function') {
    console.log('[API] API client initialized, config:', (api as any).getConfig());
} else {
    console.log('[API] API client initialized (getConfig not available)');
}

// Auth middleware is now handled by the API framework's built-in auth config
// No need for manual middleware since we're using the auth config in createAPIClient

/**
 * List mods
 * Always fetches fresh data - caching disabled for this endpoint
 */
export async function listMods(params: {
    page?: number;
    pageSize?: number;
    category?: string;
    search?: string;
    authorId?: string;
    featured?: boolean;
    visibility?: string;
}): Promise<ModListResponse> {
    try {
        console.log('[API] Fetching mods list with params:', params);
        console.log('[API] Base URL:', API_BASE_URL);
        console.log('[API] Calling api.get()...');
        // Disable caching for mods list - always fetch fresh data
        // By not passing cache config, the API client will bypass all caching
        const response = await api.get<ModListResponse>('/mods', params, {
            cache: undefined, // Explicitly disable caching for this request
        });
        console.log('[API] listMods response received:', {
            status: response.status,
            hasData: !!response.data,
            modsCount: response.data?.mods?.length,
        });
        
        if (!response.data) {
            console.error('[API] Response missing data property:', response);
            throw new Error('Invalid response format: missing data property');
        }
        
        // Check if we got HTML instead of JSON (common when proxy is misconfigured or wrangler isn't running)
        if (typeof response.data === 'string' && response.data.trim().startsWith('<!DOCTYPE')) {
            console.error('[API] Received HTML instead of JSON - this usually means:');
            console.error('[API] 1. Wrangler dev server is not running on port 8787');
            console.error('[API] 2. Vite proxy is not working (try restarting Vite)');
            console.error('[API] 3. Request URL:', response.url || 'unknown');
            throw new Error('API returned HTML instead of JSON. Make sure:\n1. Wrangler dev server is running: cd serverless/mods-api && pnpm dev\n2. Vite dev server has been restarted after config changes\n3. Both servers are running (use: pnpm dev:all)');
        }
        
        // Log thumbnail URLs for debugging
        if (response.data.mods && response.data.mods.length > 0) {
            console.log('[API] Sample mod thumbnailUrls:', response.data.mods.slice(0, 3).map(m => ({
                title: m.title,
                slug: m.slug,
                modId: m.modId,
                thumbnailUrl: m.thumbnailUrl,
                thumbnailUrlType: typeof m.thumbnailUrl,
            })));
        }
        
        return response.data;
    } catch (error) {
        console.error('[API] Error fetching mods list:', error);
        console.error('[API] Error details:', {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            name: error instanceof Error ? error.name : typeof error,
        });
        throw error;
    }
}

/**
 * Get mod detail (by slug)
 */
export async function getModDetail(slug: string): Promise<ModDetailResponse> {
    console.log('[API] getModDetail called:', { slug, url: `/mods/${slug}` });
    const response = await api.get<ModDetailResponse>(`/mods/${slug}`);
    console.log('[API] getModDetail response:', {
        status: response.status,
        hasData: !!response.data,
        hasMod: !!response.data?.mod,
        modId: response.data?.mod?.modId,
        slug: response.data?.mod?.slug,
        thumbnailUrl: response.data?.mod?.thumbnailUrl,
        thumbnailUrlType: typeof response.data?.mod?.thumbnailUrl,
        thumbnailUrlLength: response.data?.mod?.thumbnailUrl?.length,
        versionsCount: response.data?.versions?.length,
    });
    return response.data;
}

/**
 * Encrypt file binary data using JWT token
 */
async function encryptFile(file: File, token: string): Promise<File> {
    if (!token) {
        throw new Error('Token required for file encryption');
    }

    // Read file as ArrayBuffer
    const fileBuffer = await file.arrayBuffer();
    
    // Import JWT encryption utilities from shared API
    const { encryptWithJWT } = await import('@strixun/api-framework');
    
    // Convert ArrayBuffer to base64 for encryption
    const uint8Array = new Uint8Array(fileBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
    }
    const fileBase64 = btoa(binary);
    
    // Encrypt the file data
    const encrypted = await encryptWithJWT(fileBase64, token);
    
    // Convert encrypted data back to Blob/File
    const encryptedBlob = new Blob([JSON.stringify(encrypted)], { type: 'application/json' });
    const encryptedFile = new File([encryptedBlob], file.name + '.encrypted', { type: 'application/json' });
    
    return encryptedFile;
}

/**
 * Upload mod
 */
export async function uploadMod(
    file: File,
    metadata: ModUploadRequest,
    thumbnail?: File
): Promise<{ mod: ModMetadata; version: ModVersion }> {
    // Get auth token for encryption
    const token = getAuthToken();
    if (!token) {
        throw new Error('Authentication required - please log in to upload mods');
    }

    // Encrypt file before upload
    console.log('[Upload] Encrypting file before upload...');
    const encryptedFile = await encryptFile(file, token);
    console.log('[Upload] File encrypted successfully');

    const formData = new FormData();
    formData.append('file', encryptedFile);
    
    if (thumbnail) {
        // Convert thumbnail to base64
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
            reader.onload = () => {
                const result = reader.result as string;
                resolve(result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(thumbnail);
        });
        metadata.thumbnail = base64;
    }
    
    formData.append('metadata', JSON.stringify(metadata));
    
    const response = await api.post<{ mod: ModMetadata; version: ModVersion }>('/mods', formData, {
        headers: {
            // Don't set Content-Type for FormData - browser will set it with boundary
        },
    });
    return response.data;
}

/**
 * Update mod
 */
export async function updateMod(
    modId: string,
    updates: ModUpdateRequest
): Promise<{ mod: ModMetadata }> {
    const response = await api.patch<{ mod: ModMetadata }>(`/mods/${modId}`, updates);
    return response.data;
}

/**
 * Delete mod
 */
export async function deleteMod(modId: string): Promise<void> {
    await api.delete(`/mods/${modId}`);
}

/**
 * Upload version
 */
export async function uploadVersion(
    modId: string,
    file: File,
    metadata: VersionUploadRequest
): Promise<{ version: ModVersion }> {
    // Get auth token for encryption
    const token = getAuthToken();
    if (!token) {
        throw new Error('Authentication required - please log in to upload versions');
    }

    // Encrypt file before upload (consistent with uploadMod)
    console.log('[Upload Version] Encrypting file before upload...');
    const encryptedFile = await encryptFile(file, token);
    console.log('[Upload Version] File encrypted successfully');

    const formData = new FormData();
    formData.append('file', encryptedFile);
    formData.append('metadata', JSON.stringify(metadata));
    
    const response = await api.post<{ version: ModVersion }>(`/mods/${modId}/versions`, formData, {
        headers: {
            // Don't set Content-Type for FormData - browser will set it with boundary
        },
    });
    return response.data;
}

/**
 * Download version
 * Accepts either modId or slug (backend supports both)
 */
export function getDownloadUrl(modIdOrSlug: string, versionId: string): string {
    const url = `${API_BASE_URL}/mods/${modIdOrSlug}/versions/${versionId}/download`;
    console.log('[API] getDownloadUrl called:', { modIdOrSlug, versionId, url });
    return url;
}

/**
 * Admin API functions
 */

/**
 * List all mods (admin only)
 */
export async function listAllMods(params: {
    page?: number;
    pageSize?: number;
    status?: string;
    category?: string;
    search?: string;
}): Promise<ModListResponse> {
    const response = await api.get<ModListResponse>('/admin/mods', params);
    return response.data;
}

/**
 * Update mod status (admin only)
 */
export async function updateModStatus(
    modId: string,
    status: ModStatus,
    reason?: string
): Promise<{ mod: ModMetadata }> {
    const response = await api.post<{ mod: ModMetadata }>(`/admin/mods/${modId}/status`, { status, reason });
    return response.data;
}

/**
 * Add review comment (admin or uploader)
 */
export async function addReviewComment(
    modId: string,
    content: string
): Promise<{ comment: ModReviewComment }> {
    const response = await api.post<{ comment: ModReviewComment }>(`/admin/mods/${modId}/comments`, { content });
    return response.data;
}

/**
 * Get mod review (admin or uploader only)
 */
export async function getModReview(slug: string): Promise<ModDetailResponse> {
    const response = await api.get<ModDetailResponse>(`/mods/${slug}/review`);
    return response.data;
}

/**
 * List approved uploaders (admin only)
 */
export async function listApprovedUploaders(): Promise<{ approvedUsers: string[] }> {
    const response = await api.get<{ approvedUsers: string[] }>('/admin/approvals');
    return response.data;
}

/**
 * Approve user for uploads (admin only)
 */
export async function approveUser(userId: string, email?: string): Promise<{ success: boolean; userId: string }> {
    const response = await api.post<{ success: boolean; userId: string }>(`/admin/approvals/${userId}`, { email });
    return response.data;
}

/**
 * Revoke user upload permission (admin only)
 */
export async function revokeUser(userId: string): Promise<{ success: boolean; userId: string }> {
    const response = await api.delete<{ success: boolean; userId: string }>(`/admin/approvals/${userId}`);
    return response.data;
}

/**
 * Delete mod as admin (admin only, bypasses author check)
 */
export async function adminDeleteMod(modId: string): Promise<void> {
    await api.delete(`/admin/mods/${modId}`);
}

/**
 * Rating API functions
 */

/**
 * Get ratings for a mod
 */
export async function getModRatings(modId: string): Promise<ModRatingsResponse> {
    const response = await api.get<ModRatingsResponse>(`/mods/${modId}/ratings`);
    return response.data;
}

/**
 * Submit a rating for a mod
 */
export async function submitModRating(modId: string, rating: number, comment?: string): Promise<{ rating: ModRating }> {
    const response = await api.post<{ rating: ModRating }>(`/mods/${modId}/ratings`, {
        rating,
        comment,
    });
    return response.data;
}

/**
 * Check if current user has upload permission
 * Calls the backend endpoint to get the user's permission status
 */
export async function checkUploadPermission(): Promise<{ hasPermission: boolean; isSuperAdmin?: boolean }> {
    const response = await api.get<{ hasUploadPermission: boolean; isSuperAdmin: boolean; userId: string; email?: string }>('/mods/permissions/me');
    return {
        hasPermission: response.data.hasUploadPermission,
        isSuperAdmin: response.data.isSuperAdmin,
    };
}

/**
 * R2 Management API functions (admin only)
 */

export interface R2FileInfo {
    key: string;
    size: number;
    uploaded: Date;
    contentType?: string;
    customMetadata?: Record<string, string>;
    isOrphaned?: boolean;
    associatedModId?: string;
    associatedVersionId?: string;
}

export interface R2FilesListResponse {
    files: R2FileInfo[];
    total: number;
    cursor?: string;
    hasMore: boolean;
}

export interface DuplicateGroup {
    files: R2FileInfo[];
    count: number;
    totalSize: number;
    recommendedKeep?: string;
}

export interface DuplicatesResponse {
    summary: {
        totalFiles: number;
        referencedFiles: number;
        orphanedFiles: number;
        orphanedSize: number;
        duplicateGroups: number;
        duplicateWastedSize: number;
    };
    orphanedFiles: R2FileInfo[];
    duplicateGroups: DuplicateGroup[];
}

/**
 * List all R2 files (admin only)
 */
export async function listR2Files(params: {
    prefix?: string;
    limit?: number;
    cursor?: string;
}): Promise<R2FilesListResponse> {
    const response = await api.get<R2FilesListResponse>('/admin/r2/files', params);
    return response.data;
}

/**
 * Detect duplicate and orphaned files (admin only)
 */
export async function detectDuplicates(): Promise<DuplicatesResponse> {
    const response = await api.get<DuplicatesResponse>('/admin/r2/duplicates');
    return response.data;
}

/**
 * Delete R2 file(s) (admin only)
 */
export async function deleteR2File(key: string): Promise<{ deleted: boolean; key: string }> {
    const response = await api.delete<{ deleted: boolean; key: string }>(`/admin/r2/files/${encodeURIComponent(key)}`);
    return response.data;
}

/**
 * Bulk delete R2 files (admin only)
 */
export async function bulkDeleteR2Files(keys: string[]): Promise<{
    deleted: number;
    failed: number;
    results: Array<{ key: string; deleted: boolean; error?: string }>;
}> {
    const response = await api.post<{
        deleted: number;
        failed: number;
        results: Array<{ key: string; deleted: boolean; error?: string }>;
    }>('/admin/r2/files/delete', { keys });
    return response.data;
}

// Import types for use in function signatures
import type { 
    ModListResponse, 
    ModDetailResponse, 
    ModMetadata, 
    ModVersion, 
    ModUploadRequest, 
    ModUpdateRequest, 
    VersionUploadRequest,
    ModRating,
    ModRatingsResponse
} from '../types/mod';

