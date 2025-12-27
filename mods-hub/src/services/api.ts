/**
 * API service for mods API
 * Handles all HTTP requests to the Cloudflare Worker
 * Uses shared API framework client
 */

import { createAPIClient } from '@strixun/api-framework/client';
import type { ModStatus, ModReviewComment } from '../types/mod';

const API_BASE_URL = import.meta.env.VITE_MODS_API_URL || 'https://mods-api.idling.app';

/**
 * Get auth token from storage
 * Checks both sessionStorage and the auth store
 */
function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    
    // First check sessionStorage (most reliable)
    const sessionToken = sessionStorage.getItem('auth_token');
    if (sessionToken) {
        return sessionToken;
    }
    
    // Fallback to localStorage
    const localToken = localStorage.getItem('auth_token');
    if (localToken) {
        return localToken;
    }
    
    // Last resort: check auth store (might be in memory)
    try {
        const { useAuthStore } = require('../stores/auth');
        const store = useAuthStore.getState();
        if (store.user?.token) {
            // Sync it back to sessionStorage for consistency
            sessionStorage.setItem('auth_token', store.user.token);
            return store.user.token;
        }
    } catch (err) {
        // Auth store might not be available, that's okay
    }
    
    return null;
}

/**
 * Refresh auth token by restoring session from backend
 */
async function refreshAuthToken(): Promise<string | null> {
    const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL || 'https://auth.idling.app';
    
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
            // Update token in storage
            if (typeof window !== 'undefined' && window.sessionStorage) {
                sessionStorage.setItem('auth_token', token);
                console.log('[API] Token stored in sessionStorage');
            }
            
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
        const response = await api.get<ModListResponse>('/mods', params);
        console.log('[API] Response received:', response);
        if (!response.data) {
            console.error('[API] Response missing data property:', response);
            throw new Error('Invalid response format: missing data property');
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
    const response = await api.get<ModDetailResponse>(`/mods/${slug}`);
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
 */
export function getDownloadUrl(modId: string, versionId: string): string {
    return `${API_BASE_URL}/mods/${modId}/versions/${versionId}/download`;
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

// Import types for use in function signatures
import type { 
    ModListResponse, 
    ModDetailResponse, 
    ModMetadata, 
    ModVersion, 
    ModUploadRequest, 
    ModUpdateRequest, 
    VersionUploadRequest 
} from '../types/mod';

