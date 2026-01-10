/**
 * Delete Variant Handler
 * Deletes an entire variant and all its versions
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, normalizeModId } from '../../utils/customer.js';
import { isSuperAdmin as checkIsSuperAdmin } from '../../utils/admin.js';
import type { ModMetadata } from '../../types/mod.js';

interface Env {
    MODS_KV: KVNamespace;
    MODS_R2: R2Bucket;
    MODS_PUBLIC_URL?: string;
    MODS_ENCRYPTION_KEY?: string;
    ALLOWED_EMAILS?: string;
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

export async function handleDeleteVariant(
    request: Request,
    env: Env,
    modId: string,
    variantId: string,
    auth: { customerId: string }
): Promise<Response> {
    try {
        const normalizedModId = normalizeModId(modId);
        const modKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
        let mod = await env.MODS_KV.get(modKey, { type: 'json' }) as ModMetadata | null;

        // Try superadmin context if not found in customer context
        const isSuperAdmin = await checkIsSuperAdmin(auth.customerId, env);
        if (!mod && isSuperAdmin) {
            const superadminModKey = `mod_${normalizedModId}`;
            mod = await env.MODS_KV.get(superadminModKey, { type: 'json' }) as ModMetadata | null;
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
        const isOwner = mod.authorId === auth.customerId || mod.customerId === auth.customerId;

        if (!isSuperAdmin && !isOwner) {
            const rfcError = createError(request, 403, 'Forbidden', 'You do not have permission to delete this variant');
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

        // Find the variant
        const variant = mod.variants?.find(v => v.variantId === variantId);
        if (!variant) {
            const rfcError = createError(request, 404, 'Variant Not Found', 'The requested variant was not found');
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

        // Remove variant from mod metadata
        mod.variants = (mod.variants || []).filter(v => v.variantId !== variantId);
        mod.updatedAt = new Date().toISOString();

        // Save updated mod metadata
        await env.MODS_KV.put(modKey, JSON.stringify(mod));

        // UNIFIED SYSTEM: Delete all variant version metadata and files from R2
        // List all variant versions (using unified key pattern)
        const variantVersionListKey = getCustomerKey(auth.customerId, `variant_${variantId}_versions`);
        const versionList = await env.MODS_KV.get(variantVersionListKey, { type: 'json' }) as string[] | null;

        if (versionList && versionList.length > 0) {
            // Delete each version's metadata and R2 file
            for (const versionId of versionList) {
                // UNIFIED SYSTEM: Variant versions are stored as ModVersion with same key pattern as main versions
                const versionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
                await env.MODS_KV.delete(versionKey);

                // UNIFIED SYSTEM: Delete version file from R2 using unified path pattern
                // R2 keys follow pattern: {customerId}/mods/{modId}/variants/{variantId}/versions/{versionId}.{ext}
                const r2KeyPrefix = auth.customerId 
                    ? `${auth.customerId}/mods/${normalizedModId}/variants/${variantId}/versions/${versionId}`
                    : `mods/${normalizedModId}/variants/${variantId}/versions/${versionId}`;

                // Try common extensions
                for (const ext of ['zip', 'jar', 'lua', 'js', 'mod', 'dat', 'json']) {
                    try {
                        await env.MODS_R2.delete(`${r2KeyPrefix}.${ext}`);
                    } catch (error) {
                        // Continue with other extensions
                    }
                }
            }

            // Delete the version list
            await env.MODS_KV.delete(variantVersionListKey);
        }

        const corsHeaders = createCORSHeaders(request, env, {
            methods: ['DELETE', 'OPTIONS'],
        });

        return new Response(JSON.stringify({ 
            success: true,
            message: 'Variant deleted successfully',
            variantId 
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('[DeleteVariant] Error:', error);
        const rfcError = createError(request, 500, 'Internal Server Error', `Failed to delete variant: ${error.message}`);
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
