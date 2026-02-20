/**
 * Mod Permissions API
 * Handles permission checks and settings operations
 */

import { createAPIClient } from '@strixun/api-framework/client';
import { sharedClientConfig } from '../authConfig';
import { API_BASE_URL } from './modsApi';

const api = createAPIClient({
    ...sharedClientConfig,
    baseURL: API_BASE_URL,
});

/**
 * Permissions response shape from GET /mods/permissions/me
 */
export interface PermissionsResponse {
    hasUploadPermission: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    roles: string[];
    permissions: string[];
}

/**
 * Get full permissions (authenticated customers)
 * Same endpoint as checkUploadPermission - used by useAdminAccess and useUploadPermission
 */
export async function getPermissions(): Promise<PermissionsResponse> {
    const response = await api.get<PermissionsResponse>('/mods/permissions/me');
    return response.data;
}

/**
 * Check upload permission (authenticated customers)
 */
export async function checkUploadPermission(): Promise<{ hasPermission: boolean }> {
    try {
        const data = await getPermissions();
        return { hasPermission: data.hasUploadPermission };
    } catch (error) {
        const status = error && typeof error === 'object' && 'status' in error ? (error as { status?: number }).status : undefined;
        if (status !== 401) {
            console.error('[ModPermissionsAPI] Failed to check upload permission:', error);
        }
        throw new Error(`Failed to check upload permission: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Get mod upload settings (authenticated customers)
 */
export async function getModSettings(): Promise<{ allowedFileExtensions: string[]; uploadsEnabled: boolean }> {
    try {
        const response = await api.get<{ allowedFileExtensions: string[]; uploadsEnabled: boolean }>('/mods/settings');
        return response.data;
    } catch (error) {
        console.error('[ModPermissionsAPI] Failed to get mod settings:', error);
        throw new Error(`Failed to get mod settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Get admin settings (admin only)
 */
export async function getAdminSettings(): Promise<{ 
    allowedFileExtensions: string[]; 
    uploadsEnabled?: boolean; 
    updatedAt: string; 
    updatedBy: string 
}> {
    try {
        const response = await api.get<{ 
            allowedFileExtensions: string[]; 
            updatedAt: string; 
            updatedBy: string 
        }>('/admin/settings');
        return response.data;
    } catch (error) {
        console.error('[ModPermissionsAPI] Failed to get admin settings:', error);
        throw new Error(`Failed to get admin settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Update admin settings (admin only)
 */
export async function updateAdminSettings(settings: { 
    allowedFileExtensions?: string[]; 
    uploadsEnabled?: boolean 
}): Promise<{ 
    allowedFileExtensions: string[]; 
    uploadsEnabled?: boolean; 
    updatedAt: string; 
    updatedBy: string 
}> {
    try {
        const response = await api.put<{ 
            allowedFileExtensions: string[]; 
            updatedAt: string; 
            updatedBy: string 
        }>('/admin/settings', settings);
        return response.data;
    } catch (error) {
        console.error('[ModPermissionsAPI] Failed to update admin settings:', error);
        throw new Error(`Failed to update admin settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
