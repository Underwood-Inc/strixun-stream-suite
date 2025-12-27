/**
 * Delete mod handler
 * DELETE /mods/:modId
 * Deletes mod and all its versions
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, getCustomerR2Key } from '../../utils/customer.js';
import { isEmailAllowed } from '../../utils/auth.js';
import type { ModMetadata, ModVersion } from '../../types/mod.js';

/**
 * Handle delete mod request
 */
export async function handleDeleteMod(
    request: Request,
    env: Env,
    modId: string,
    auth: { userId: string; email?: string; customerId: string | null }
): Promise<Response> {
    try {
        // Check email whitelist
        if (!isEmailAllowed(auth.email, env)) {
            const rfcError = createError(request, 403, 'Forbidden', 'Your email address is not authorized to manage mods');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 403,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Get mod metadata
        const modKey = getCustomerKey(auth.customerId, `mod_${modId}`);
        const mod = await env.MODS_KV.get(modKey, { type: 'json' }) as ModMetadata | null;

        if (!mod) {
            const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod was not found');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Check authorization
        if (mod.authorId !== auth.userId) {
            const rfcError = createError(request, 403, 'Forbidden', 'You do not have permission to delete this mod');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 403,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Get all versions
        const versionsListKey = getCustomerKey(auth.customerId, `mod_${modId}_versions`);
        const versionsList = await env.MODS_KV.get(versionsListKey, { type: 'json' }) as string[] | null;
        const versionIds = versionsList || [];

        // Delete all version files from R2 and metadata from KV
        for (const versionId of versionIds) {
            const versionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
            const version = await env.MODS_KV.get(versionKey, { type: 'json' }) as ModVersion | null;
            
            if (version) {
                // Delete file from R2
                try {
                    await env.MODS_R2.delete(version.r2Key);
                } catch (error) {
                    console.error(`Failed to delete R2 file ${version.r2Key}:`, error);
                }
                
                // Delete version metadata
                await env.MODS_KV.delete(versionKey);
            }
        }

        // Delete thumbnail if exists
        if (mod.thumbnailUrl) {
            try {
                // Extract R2 key from URL or construct it
                const thumbnailKey = getCustomerR2Key(auth.customerId, `thumbnails/${modId}.png`);
                await env.MODS_R2.delete(thumbnailKey);
            } catch (error) {
                console.error('Failed to delete thumbnail:', error);
            }
        }

        // Delete mod metadata
        await env.MODS_KV.delete(modKey);
        await env.MODS_KV.delete(versionsListKey);

        // Remove from customer-specific list
        const modsListKey = getCustomerKey(auth.customerId, 'mods_list');
        const modsList = await env.MODS_KV.get(modsListKey, { type: 'json' }) as string[] | null;
        if (modsList) {
            const updatedList = modsList.filter(id => id !== modId);
            await env.MODS_KV.put(modsListKey, JSON.stringify(updatedList));
        }

        // Remove from global public list if it was public
        if (mod.visibility === 'public') {
            const globalListKey = 'mods_list_public';
            const globalModsList = await env.MODS_KV.get(globalListKey, { type: 'json' }) as string[] | null;
            if (globalModsList) {
                const updatedGlobalList = globalModsList.filter(id => id !== modId);
                await env.MODS_KV.put(globalListKey, JSON.stringify(updatedGlobalList));
            }
        }

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Delete mod error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Delete Mod',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while deleting the mod'
        );
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

interface Env {
    MODS_KV: KVNamespace;
    MODS_R2: R2Bucket;
    ALLOWED_EMAILS?: string;
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

