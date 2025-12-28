/**
 * Delete mod handler
 * DELETE /mods/:modId
 * Deletes mod and all its versions
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, getCustomerR2Key, normalizeModId } from '../../utils/customer.js';
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

        // Get mod metadata by modId only (slug should be resolved to modId before calling this)
        let mod: ModMetadata | null = null;
        const normalizedModId = normalizeModId(modId);
        let modKey: string | null = null;
        
        // Try customer scope first
        modKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
        mod = await env.MODS_KV.get(modKey, { type: 'json' }) as ModMetadata | null;
        console.log('[DeleteMod] Customer scope lookup:', { modKey, found: !!mod });
        
        // If not found in customer scope, try global scope (for public mods)
        if (!mod) {
            const globalModKey = `mod_${normalizedModId}`;
            mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
            console.log('[DeleteMod] Global scope lookup:', { globalModKey, found: !!mod });
            if (mod) {
                modKey = globalModKey; // Use global key for deletion
            }
        }
        
        // If still not found, search all customer scopes
        if (!mod) {
            const customerListPrefix = 'customer_';
            let cursor: string | undefined;
            
            do {
                const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor });
                for (const key of listResult.keys) {
                    if (key.name.endsWith('_mods_list')) {
                        const match = key.name.match(/^customer_([^_/]+)[_/]mods_list$/);
                        const customerId = match ? match[1] : null;
                        if (customerId) {
                            const customerModKey = getCustomerKey(customerId, `mod_${normalizedModId}`);
                            mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                            if (mod) {
                                modKey = customerModKey;
                                console.log('[DeleteMod] Found mod in customer scope:', { customerId, modId: mod.modId, modKey });
                                break;
                            }
                        }
                    }
                }
                if (mod) break;
                cursor = listResult.listComplete ? undefined : listResult.cursor;
            } while (cursor);
        }
        
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

        const modId = mod.modId;

        // Get all versions - check both customer scope and global scope
        let versionsListKey = getCustomerKey(auth.customerId, `mod_${modId}_versions`);
        let versionsList = await env.MODS_KV.get(versionsListKey, { type: 'json' }) as string[] | null;
        
        // If not found in customer scope, try global scope
        if (!versionsList) {
            const globalVersionsKey = `mod_${modId}_versions`;
            versionsList = await env.MODS_KV.get(globalVersionsKey, { type: 'json' }) as string[] | null;
            if (versionsList) {
                versionsListKey = globalVersionsKey;
            }
        }
        
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
                // Try multiple extensions since we don't know which one was used
                const normalizedModId = normalizeModId(modId);
                const extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
                for (const ext of extensions) {
                    const thumbnailKey = getCustomerR2Key(auth.customerId, `thumbnails/${normalizedModId}.${ext}`);
                    await env.MODS_R2.delete(thumbnailKey);
                }
            } catch (error) {
                console.error('Failed to delete thumbnail:', error);
            }
        }

        // Delete mod metadata from both scopes if it exists
        await env.MODS_KV.delete(modKey);
        await env.MODS_KV.delete(versionsListKey);
        
        // Also delete from global scope if it exists there
        const globalModKey = `mod_${modId}`;
        const globalVersionsKey = `mod_${modId}_versions`;
        if (modKey !== globalModKey) {
            // Only delete global if we didn't already delete it
            await env.MODS_KV.delete(globalModKey);
        }
        if (versionsListKey !== globalVersionsKey) {
            // Only delete global if we didn't already delete it
            await env.MODS_KV.delete(globalVersionsKey);
        }

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

