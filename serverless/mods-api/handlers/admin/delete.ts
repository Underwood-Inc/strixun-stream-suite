/**
 * Admin delete mod handler
 * DELETE /admin/mods/:modId
 * Allows admins to delete any mod (bypasses author check)
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, getCustomerR2Key } from '../../utils/customer.js';
import { isSuperAdminEmail } from '../../utils/admin.js';
import type { ModMetadata, ModVersion } from '../../types/mod.js';

/**
 * Handle admin delete mod request
 * Allows super admins to delete any mod regardless of author
 */
export async function handleAdminDeleteMod(
    request: Request,
    env: Env,
    modId: string,
    auth: { userId: string; email?: string; customerId: string | null }
): Promise<Response> {
    try {
        // Verify admin access
        if (!auth.email || !(await isSuperAdminEmail(auth.email, env))) {
            const rfcError = createError(request, 403, 'Forbidden', 'Admin access required');
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

        // Get mod metadata - check both customer scope and global scope
        let mod: ModMetadata | null = null;
        let modKey: string;
        
        // Try customer scope first
        modKey = getCustomerKey(auth.customerId, `mod_${modId}`);
        mod = await env.MODS_KV.get(modKey, { type: 'json' }) as ModMetadata | null;
        
        // If not found in customer scope, try global scope
        if (!mod) {
            const globalModKey = `mod_${modId}`;
            mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
            if (mod) {
                modKey = globalModKey; // Use global key for deletion
            }
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

        // Admin can delete any mod - no author check needed

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
            // Try customer scope first
            let versionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
            let version = await env.MODS_KV.get(versionKey, { type: 'json' }) as ModVersion | null;
            
            // If not found, try global scope
            if (!version) {
                const globalVersionKey = `version_${versionId}`;
                version = await env.MODS_KV.get(globalVersionKey, { type: 'json' }) as ModVersion | null;
                if (version) {
                    versionKey = globalVersionKey;
                }
            }
            
            if (version) {
                // Delete file from R2
                try {
                    await env.MODS_R2.delete(version.r2Key);
                } catch (error) {
                    console.error(`Failed to delete R2 file ${version.r2Key}:`, error);
                }
                
                // Delete version metadata from both scopes
                await env.MODS_KV.delete(versionKey);
                // Also try deleting from customer scope if we used global
                if (versionKey.startsWith('version_') && !versionKey.includes('customer_')) {
                    const customerVersionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
                    await env.MODS_KV.delete(customerVersionKey);
                }
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

        // Also remove from admin list if it exists
        const adminListKey = 'mods_list_admin';
        const adminModsList = await env.MODS_KV.get(adminListKey, { type: 'json' }) as string[] | null;
        if (adminModsList) {
            const updatedAdminList = adminModsList.filter(id => id !== modId);
            await env.MODS_KV.put(adminListKey, JSON.stringify(updatedAdminList));
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
        console.error('Admin delete mod error:', error);
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
    SUPER_ADMIN_EMAILS?: string;
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

