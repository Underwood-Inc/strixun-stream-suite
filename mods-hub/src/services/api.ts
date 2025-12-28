// ... existing code ...

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
