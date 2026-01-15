/**
 * Admin delete mod handler
 * DELETE /admin/mods/:modId
 * Allows admins to delete any mod (bypasses author check)
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, getCustomerR2Key, normalizeModId } from '../../utils/customer.js';
import type { ModMetadata, ModVersion } from '../../types/mod.js';
import type { KVNamespaceListResult } from '@cloudflare/workers-types';

/**
 * Handle admin delete mod request
 * Allows super admins to delete any mod regardless of author
 */
export async function handleAdminDeleteMod(
    request: Request,
    env: Env,
    modId: string,
    _auth: { customerId: string }
): Promise<Response> {
    try {
        // Route-level protection ensures user is super admin
        // Get mod metadata - admin needs to search ALL customer scopes, not just their own
        // Normalize modId (strip mod_ prefix if present)
        const normalizedModId = normalizeModId(modId);
        let mod: ModMetadata | null = null;
        let modKey: string | null = null;
        let modCustomerId: string | null = null;
        
        // Try global scope first
        const globalModKey = `mod_${normalizedModId}`;
        mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
        if (mod) {
            modKey = globalModKey;
            modCustomerId = null; // Global scope
            console.log('[AdminDelete] Found mod in global scope:', { modId: mod.modId, slug: mod.slug });
        }
        
        // If not found in global scope, search ALL customer scopes
        // Try direct lookup first (faster), then fall back to list-based search
        if (!mod) {
            console.log('[AdminDelete] Searching all customer scopes for mod:', { normalizedModId, originalModId: modId });
            const customerListPrefix = 'customer_';
            let cursor: string | undefined;
            let found = false;
            
            do {
                const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor });
                for (const key of listResult.keys) {
                    // Look for customer mod keys directly: customer_{id}_mod_{normalizedModId}
                    if (key.name.includes(`_mod_${normalizedModId}`) || key.name.includes(`_mod_${modId}`)) {
                        const candidateMod = await env.MODS_KV.get(key.name, { type: 'json' }) as ModMetadata | null;
                        if (candidateMod) {
                            // Verify it's the right mod by comparing modId (normalized)
                            const candidateNormalizedId = normalizeModId(candidateMod.modId);
                            if (candidateNormalizedId === normalizedModId) {
                                mod = candidateMod;
                                modKey = key.name;
                                // Extract customerId from key name
                                const match = key.name.match(/^customer_([^_/]+)[_/]mod_/);
                                modCustomerId = match ? match[1] : null;
                                found = true;
                                console.log('[AdminDelete] Found mod in customer scope (direct lookup):', { customerId: modCustomerId, modId: mod.modId, slug: mod.slug });
                                break;
                            }
                        }
                    }
                }
                if (found) break;
                cursor = listResult.list_complete ? undefined : listResult.cursor;
            } while (cursor && !found);
            
            // Fallback: search through customer lists if direct lookup failed
            if (!mod) {
                cursor = undefined;
                do {
                    const listResult: KVNamespaceListResult<unknown, string> = await env.MODS_KV.list({ prefix: customerListPrefix, cursor });
                    for (const key of listResult.keys) {
                        if (key.name.endsWith('_mods_list')) {
                            // Extract customerId from key name
                            const match = key.name.match(/^customer_([^_/]+)[_/]mods_list$/);
                            const customerId = match ? match[1] : null;
                            
                            if (customerId) {
                                // Try direct fetch from customer scope
                                const customerModKey = getCustomerKey(customerId, `mod_${normalizedModId}`);
                                const candidateMod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                                
                                if (candidateMod) {
                                    // Verify it's the right mod by comparing modId (normalized)
                                    const candidateNormalizedId = normalizeModId(candidateMod.modId);
                                    if (candidateNormalizedId === normalizedModId) {
                                        mod = candidateMod;
                                        modKey = customerModKey;
                                        modCustomerId = customerId;
                                        found = true;
                                        console.log('[AdminDelete] Found mod in customer scope (list search):', { customerId, modId: mod.modId, slug: mod.slug });
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    if (found) break;
                    cursor = listResult.list_complete ? undefined : listResult.cursor;
                } while (cursor && !found);
            }
        }

        if (!mod || !modKey) {
            console.error('[AdminDelete] Mod not found:', { modId, normalizedModId });
            const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod was not found');
            const corsHeaders = createCORSHeaders(request, { credentials: true, allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Admin can delete any mod - no author check needed

        // Get all versions - use the mod's customer scope (not admin's)
        let versionsListKey: string;
        let versionsList: string[] | null = null;
        
        if (modCustomerId) {
            // Mod is in a specific customer scope
            versionsListKey = getCustomerKey(modCustomerId, `mod_${normalizedModId}_versions`);
            versionsList = await env.MODS_KV.get(versionsListKey, { type: 'json' }) as string[] | null;
        } else {
            // Mod is in global scope
            versionsListKey = `mod_${normalizedModId}_versions`;
            versionsList = await env.MODS_KV.get(versionsListKey, { type: 'json' }) as string[] | null;
        }
        
        const versionIds = versionsList || [];

        // Delete all version files from R2 and metadata from KV
        // Use mod's customer scope (not admin's)
        for (const versionId of versionIds) {
            let versionKey: string;
            let version: ModVersion | null = null;
            
            if (modCustomerId) {
                // Version is in mod's customer scope
                versionKey = getCustomerKey(modCustomerId, `version_${versionId}`);
                version = await env.MODS_KV.get(versionKey, { type: 'json' }) as ModVersion | null;
            } else {
                // Version is in global scope
                versionKey = `version_${versionId}`;
                version = await env.MODS_KV.get(versionKey, { type: 'json' }) as ModVersion | null;
            }
            
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

        // Delete thumbnail if exists - CRITICAL: Delete from BOTH customer scope AND global scope
        // Thumbnails may exist in both places if mod was approved/published
        try {
            const extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
            for (const ext of extensions) {
                // Delete from customer scope
                if (modCustomerId) {
                    const customerThumbnailKey = getCustomerR2Key(modCustomerId, `thumbnails/${normalizedModId}.${ext}`);
                    try {
                        await env.MODS_R2.delete(customerThumbnailKey);
                    } catch (error) {
                        // Ignore if not found
                    }
                }
                // Delete from global scope (no customer prefix)
                const globalThumbnailKey = `thumbnails/${normalizedModId}.${ext}`;
                try {
                    await env.MODS_R2.delete(globalThumbnailKey);
                } catch (error) {
                    // Ignore if not found
                }
            }
        } catch (error) {
            console.error('Failed to delete thumbnail:', error);
        }

        // Delete mod metadata - use mod's customer scope (not admin's)
        await env.MODS_KV.delete(modKey);
        await env.MODS_KV.delete(versionsListKey);
        
        // Also try deleting from global scope (in case it exists there too)
        // Reuse globalModKey declared earlier (line 47)
        const globalVersionsKey = `mod_${normalizedModId}_versions`;
        if (modKey !== globalModKey) {
            await env.MODS_KV.delete(globalModKey);
        }
        if (versionsListKey !== globalVersionsKey) {
            await env.MODS_KV.delete(globalVersionsKey);
        }

        // Remove from mod's customer-specific list (not admin's)
        // Need to remove both normalized and original modId formats
        if (modCustomerId) {
            const modsListKey = getCustomerKey(modCustomerId, 'mods_list');
            const modsList = await env.MODS_KV.get(modsListKey, { type: 'json' }) as string[] | null;
            if (modsList) {
                const updatedList = modsList.filter(id => {
                    const normalizedListId = normalizeModId(id);
                    return normalizedListId !== normalizedModId && id !== modId;
                });
                await env.MODS_KV.put(modsListKey, JSON.stringify(updatedList));
            }
        }

        // Remove from global public list if it was public
        // Need to remove both normalized and original modId formats
        if (mod.visibility === 'public') {
            const globalListKey = 'mods_list_public';
            const globalModsList = await env.MODS_KV.get(globalListKey, { type: 'json' }) as string[] | null;
            if (globalModsList) {
                const updatedGlobalList = globalModsList.filter(id => {
                    const normalizedListId = normalizeModId(id);
                    return normalizedListId !== normalizedModId && id !== modId;
                });
                await env.MODS_KV.put(globalListKey, JSON.stringify(updatedGlobalList));
            }
        }

        // Also remove from admin list if it exists
        // Need to remove both normalized and original modId formats
        const adminListKey = 'mods_list_admin';
        const adminModsList = await env.MODS_KV.get(adminListKey, { type: 'json' }) as string[] | null;
        if (adminModsList) {
            const updatedAdminList = adminModsList.filter(id => {
                const normalizedListId = normalizeModId(id);
                return normalizedListId !== normalizedModId && id !== modId;
            });
            await env.MODS_KV.put(adminListKey, JSON.stringify(updatedAdminList));
        }

        const corsHeaders = createCORSHeaders(request, { credentials: true, allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Admin delete mod error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Delete Mod',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while deleting the mod'
        );
        const corsHeaders = createCORSHeaders(request, { credentials: true, allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
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
    SUPER_ADMIN_EMAILS?: string;
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

