/**
 * API service for mods API
 * Handles all HTTP requests to the Cloudflare Worker
 * Uses shared API framework client
 */

import { createAPIClient } from '@strixun/api-framework/client';

const API_BASE_URL = import.meta.env.VITE_MODS_API_URL || 'https://mods.idling.app';

/**
 * Get auth token from storage
 */
function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');
}

/**
 * Create API client with auth middleware
 */
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
});

// Add auth middleware
import type { APIRequest, APIResponse, Middleware } from '@strixun/api-framework/client';

type NextFunction = (request: APIRequest) => Promise<APIResponse>;

const authMiddleware: Middleware = async (request: APIRequest, next: NextFunction): Promise<APIResponse> => {
    const token = getAuthToken();
    if (token) {
        if (!request.headers) {
            request.headers = {};
        }
        request.headers['Authorization'] = `Bearer ${token}`;
    }
    return next(request);
};

api.use(authMiddleware);

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
    const response = await api.get<ModListResponse>('/mods', params);
    return response.data;
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

