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
 * Check upload permission (authenticated customers)
 */
export async function checkUploadPermission(): Promise<{ hasPermission: boolean }> {
    try {
        const response = await api.get<{ 
            hasUploadPermission: boolean;
            isAdmin: boolean;
            isSuperAdmin: boolean;
            roles: string[];
            permissions: string[];
        }>('/mods/permissions/me');
        return { hasPermission: response.data.hasUploadPermission };
    } catch (error) {
        console.error('[ModPermissionsAPI] Failed to check upload permission:', error);
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
