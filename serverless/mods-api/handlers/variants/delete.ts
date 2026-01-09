/**
 * Delete Variant Handler
 * Deletes an entire variant and all its versions
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, normalizeModId } from '../../utils/customer.js';
import { isSuperAdminEmail } from '../../utils/admin.js';
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
    auth: { customerId: string; email?: string }
): Promise<Response> {
    try {
        const normalizedModId = normalizeModId(modId);
        const modKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
        let mod = await env.MODS_KV.get(modKey, { type: 'json' }) as ModMetadata | null;

        // Try superadmin context if not found in customer context
        if (!mod && auth.email && isSuperAdminEmail(auth.email, env)) {
            const superadminModKey = `mod_${normalizedModId}`;
            mod = await env.MODS_KV.get(superadminModKey, { type: 'json' }) as ModMetadata | null;
        }

        if (!mod) {
            return createError(request, env, 404, 'Mod not found');
        }

        // Check authorization
        const isSuperAdmin = auth.email && isSuperAdminEmail(auth.email, env);
        const isOwner = mod.authorId === auth.customerId || mod.customerId === auth.customerId;

        if (!isSuperAdmin && !isOwner) {
            return createError(request, env, 403, 'You do not have permission to delete this variant');
        }

        // Find the variant
        const variant = mod.variants?.find(v => v.variantId === variantId);
        if (!variant) {
            return createError(request, env, 404, 'Variant not found');
        }

        // Remove variant from mod metadata
        mod.variants = (mod.variants || []).filter(v => v.variantId !== variantId);
        mod.updatedAt = new Date().toISOString();

        // Save updated mod metadata
        await env.MODS_KV.put(modKey, JSON.stringify(mod));

        // Delete the variant metadata from KV
        const variantKey = getCustomerKey(auth.customerId, `variant_${variantId}`);
        await env.MODS_KV.delete(variantKey);

        // Delete all variant version metadata and files from R2
        // List all variant versions
        const variantVersionListKey = getCustomerKey(auth.customerId, `variant_versions_${variantId}`);
        const versionList = await env.MODS_KV.get(variantVersionListKey, { type: 'json' }) as string[] | null;

        if (versionList && versionList.length > 0) {
            // Delete each version's metadata and R2 file
            for (const versionId of versionList) {
                // Delete version metadata from KV
                const versionKey = getCustomerKey(auth.customerId, `variant_version_${versionId}`);
                await env.MODS_KV.delete(versionKey);

                // Delete version file from R2
                // Try to delete with various possible R2 key patterns
                const possibleR2Keys = [
                    `variants/${variantId}/versions/${versionId}`,
                    `mods/${normalizedModId}/variants/${variantId}/versions/${versionId}`,
                    `${auth.customerId}/variants/${variantId}/versions/${versionId}`,
                    `${auth.customerId}/mods/${normalizedModId}/variants/${variantId}/versions/${versionId}`,
                ];

                for (const r2Key of possibleR2Keys) {
                    try {
                        await env.MODS_R2.delete(r2Key);
                    } catch (error) {
                        // Continue trying other keys
                    }
                }

                // Also try with common extensions
                for (const r2Key of possibleR2Keys) {
                    for (const ext of ['zip', 'jar', 'lua', 'js']) {
                        try {
                            await env.MODS_R2.delete(`${r2Key}.${ext}`);
                        } catch (error) {
                            // Continue
                        }
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
        return createError(request, env, 500, 'Failed to delete variant', error.message);
    }
}
