/**
 * Admin settings handler
 * Manages system-wide settings like allowed file types
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';

const SETTINGS_KEY = 'admin_settings';
const DEFAULT_ALLOWED_EXTENSIONS = ['.lua', '.js', '.java', '.jar', '.zip', '.json', '.txt', '.xml', '.yaml', '.yml'];

interface AdminSettings {
    allowedFileExtensions: string[];
    uploadsEnabled: boolean;
    updatedAt: string;
    updatedBy: string;
}

/**
 * Get admin settings
 */
export async function handleGetSettings(
    request: Request,
    env: Env,
    auth: { userId: string; email?: string; customerId: string | null }
): Promise<Response> {
    try {
        // Route-level protection ensures user is super admin
        // Get settings from KV
        const settingsData = await env.MODS_KV.get(SETTINGS_KEY, { type: 'json' }) as AdminSettings | null;
        
        // Return default if not set
        const settings: AdminSettings = settingsData || {
            allowedFileExtensions: DEFAULT_ALLOWED_EXTENSIONS,
            uploadsEnabled: true, // Default to enabled for backward compatibility
            updatedAt: new Date().toISOString(),
            updatedBy: auth.userId,
        };
        
        // Ensure uploadsEnabled exists for legacy settings
        if (settings.uploadsEnabled === undefined) {
            settings.uploadsEnabled = true;
        }

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });

        return new Response(JSON.stringify(settings), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error) {
        console.error('[GetSettings] Error:', error);
        const rfcError = createError(request, 500, 'Internal Server Error', 'Failed to retrieve settings');
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}

/**
 * Update admin settings
 */
export async function handleUpdateSettings(
    request: Request,
    env: Env,
    auth: { userId: string; email?: string; customerId: string | null }
): Promise<Response> {
    try {
        // Route-level protection ensures user is super admin
        // Parse request body
        const updateData = await request.json() as Partial<AdminSettings>;
        
        // Validate allowed file extensions
        if (updateData.allowedFileExtensions) {
            if (!Array.isArray(updateData.allowedFileExtensions)) {
                const rfcError = createError(request, 400, 'Invalid Input', 'allowedFileExtensions must be an array');
                const corsHeaders = createCORSHeaders(request, {
                    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                });
                return new Response(JSON.stringify(rfcError), {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/problem+json',
                        ...Object.fromEntries(corsHeaders.entries()),
                    },
                });
            }

            // Validate each extension starts with a dot
            for (const ext of updateData.allowedFileExtensions) {
                if (typeof ext !== 'string' || !ext.startsWith('.')) {
                    const rfcError = createError(request, 400, 'Invalid Input', `Invalid extension format: ${ext}. Extensions must start with a dot (e.g., .lua)`);
                    const corsHeaders = createCORSHeaders(request, {
                        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                    });
                    return new Response(JSON.stringify(rfcError), {
                        status: 400,
                        headers: {
                            'Content-Type': 'application/problem+json',
                            ...Object.fromEntries(corsHeaders.entries()),
                        },
                    });
                }
            }
        }

        // Get existing settings
        const existingSettings = await env.MODS_KV.get(SETTINGS_KEY, { type: 'json' }) as AdminSettings | null;
        
        // Merge with existing settings
        const baseSettings = existingSettings || {
            allowedFileExtensions: DEFAULT_ALLOWED_EXTENSIONS,
            uploadsEnabled: true,
            updatedAt: new Date().toISOString(),
            updatedBy: auth.userId,
        };
        
        const updatedSettings: AdminSettings = {
            ...baseSettings,
            ...updateData,
            updatedAt: new Date().toISOString(),
            updatedBy: auth.userId,
        };
        
        // Ensure uploadsEnabled is a boolean
        if (updateData.uploadsEnabled !== undefined) {
            updatedSettings.uploadsEnabled = Boolean(updateData.uploadsEnabled);
        }

        // Save to KV
        await env.MODS_KV.put(SETTINGS_KEY, JSON.stringify(updatedSettings));

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });

        return new Response(JSON.stringify(updatedSettings), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error) {
        console.error('[UpdateSettings] Error:', error);
        const rfcError = createError(request, 500, 'Internal Server Error', 'Failed to update settings');
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}

/**
 * Get allowed file extensions (public helper for validation)
 */
export async function getAllowedFileExtensions(env: Env): Promise<string[]> {
    const settingsData = await env.MODS_KV.get(SETTINGS_KEY, { type: 'json' }) as AdminSettings | null;
    return settingsData?.allowedFileExtensions || DEFAULT_ALLOWED_EXTENSIONS;
}

/**
 * Check if uploads are globally enabled
 */
export async function areUploadsEnabled(env: Env): Promise<boolean> {
    const settingsData = await env.MODS_KV.get(SETTINGS_KEY, { type: 'json' }) as AdminSettings | null;
    // Default to enabled for backward compatibility
    return settingsData?.uploadsEnabled !== false;
}

interface Env {
    MODS_KV: KVNamespace;
    SUPER_ADMIN_EMAILS?: string;
    ALLOWED_ORIGINS?: string;
    [key: string]: any;
}

