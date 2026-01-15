/**
 * Get mod settings (authenticated users)
 * GET /mods/settings
 * 
 * Returns allowed file extensions and other upload-related settings.
 * This is NOT an admin endpoint - any authenticated user can read these settings.
 * Admin management endpoint is separate: PUT /admin/settings (super admin only)
 */

import { getCorsHeaders } from '../../utils/cors.js';
import { getAllowedFileExtensions } from '../admin/settings.js';
import type { Env } from '../../worker.js';

const SETTINGS_KEY = 'admin_settings';

interface AdminSettings {
    allowedFileExtensions: string[];
    uploadsEnabled?: boolean;
    updatedAt: string;
    updatedBy: string;
}

/**
 * Handle get settings request
 * Returns settings needed for uploads (file extensions, upload enabled status)
 * 
 * NO ADMIN CHECK - any authenticated user can read these settings
 */
export async function handleGetSettings(
    request: Request,
    env: Env,
    _auth: { customerId: string }
): Promise<Response> {
    try {
        // Get settings from KV (uses defaults if not set)
        const allowedFileExtensions = await getAllowedFileExtensions(env);
        
        // Get uploads enabled status
        const settingsData = await env.MODS_KV.get(SETTINGS_KEY, { type: 'json' }) as AdminSettings | null;
        const uploadsEnabled = settingsData?.uploadsEnabled ?? true; // Default to enabled
        
        const corsHeaders = getCorsHeaders(env, request);
        
        return new Response(JSON.stringify({
            allowedFileExtensions,
            uploadsEnabled,
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error) {
        console.error('[Settings] Failed to get settings:', error);
        
        const corsHeaders = getCorsHeaders(env, request);
        return new Response(JSON.stringify({
            error: 'Internal Server Error',
            message: 'Failed to get settings',
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}
