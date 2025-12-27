/**
 * API service for mods API
 * Handles all HTTP requests to the Cloudflare Worker
 * Uses shared API framework client
 */

import { createAPIClient } from '@strixun/api-framework/client';

const API_BASE_URL = import.meta.env.VITE_MODS_API_URL || 'https://mods-api.idling.app';

/**
 * Get auth token from storage
 */
function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
}

/**
 * Refresh auth token by restoring session from backend
 */
async function refreshAuthToken(): Promise<string | null> {
    const AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL || 'https://auth.idling.app';
    
    try {
        // Use the API framework client which already handles secureFetch internally
        const { createAPIClient } = await import('@strixun/api-framework/client');
        const authClient = createAPIClient({
            baseURL: AUTH_API_URL,
            timeout: 5000, // 5 second timeout for session restoration
        });
        
        const response = await authClient.post<{ restored: boolean; access_token?: string; token?: string; userId?: string; sub?: string; email?: string; expiresAt?: string }>('/auth/restore-session', {});

        if (response.status !== 200 || !response.data) {
            console.warn('[API] Token refresh failed:', response.status);
            return null;
        }

        const data = response.data;
        if (data.restored && data.access_token) {
            // Update token in storage
            if (typeof window !== 'undefined' && window.sessionStorage) {
                sessionStorage.setItem('auth_token', data.access_token);
            }
            
            // Update auth store if available
            try {
                const { useAuthStore } = await import('../stores/auth');
                const store = useAuthStore.getState();
                if (store.setUser) {
                    store.setUser({
                        userId: data.userId || data.sub,
                        email: data.email,
                        token: data.access_token,
                        expiresAt: data.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    });
                }
            } catch (err) {
                // Auth store might not be available, that's okay
                console.debug('[API] Could not update auth store:', err);
            }
            
            console.log('[API] ✅ Token refreshed successfully');
            return data.access_token;
        }

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
            console.log('[API] Token expired, attempting to refresh...');
            const newToken = await refreshAuthToken();
            if (!newToken) {
                console.warn('[API] Token refresh failed, user may need to log in again');
                // Could redirect to login page here if needed
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
 * Get mod detail
 */
export async function getModDetail(modId: string): Promise<ModDetailResponse> {
    const response = await api.get<ModDetailResponse>(`/mods/${modId}`);
    return response.data;
}

/**
 * Upload mod
 */
export async function uploadMod(
    file: File,
    metadata: ModUploadRequest,
    thumbnail?: File
): Promise<{ mod: ModMetadata; version: ModVersion }> {
    const formData = new FormData();
    formData.append('file', file);
    
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
    const formData = new FormData();
    formData.append('file', file);
    formData.append('metadata', JSON.stringify(metadata));
    
    const response = await api.post<{ version: ModVersion }>(`/mods/${modId}/versions`, formData, {
        headers: {
            // Don't set Content-Type for FormData
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

