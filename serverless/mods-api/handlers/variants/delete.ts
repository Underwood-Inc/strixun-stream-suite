/**
 * Delete Variant Handler
 * DELETE /mods/:modId/variants/:variantId
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import {
    getEntity,
    putEntity,
    deleteEntity,
    deleteEntities,
    getExistingEntities,
    indexGet,
    indexClear,
    canModify,
} from '@strixun/kv-entities';
import { isSuperAdmin as checkIsSuperAdmin } from '../../utils/admin.js';
import type { ModMetadata, ModVersion } from '../../types/mod.js';

interface Env {
    MODS_KV: KVNamespace;
    MODS_R2: R2Bucket;
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

export async function handleDeleteVariant(
    request: Request,
    env: Env,
    modId: string,
    variantId: string,
    auth: { customerId: string; jwtToken?: string }
): Promise<Response> {
    try {
        const mod = await getEntity<ModMetadata>(env.MODS_KV, 'mods', 'mod', modId);

        if (!mod) {
            return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
        }

        const isSuperAdmin = auth.jwtToken 
            ? await checkIsSuperAdmin(auth.customerId, auth.jwtToken, env) 
            : false;

        const accessContext = { customerId: auth.customerId, isAdmin: isSuperAdmin };
        if (!canModify({ ...mod, id: mod.modId }, accessContext)) {
            return errorResponse(request, env, 403, 'Forbidden', 'You do not have permission to delete this variant');
        }

        const variant = mod.variants?.find(v => v.variantId === variantId);
        if (!variant) {
            return errorResponse(request, env, 404, 'Variant Not Found', 'The requested variant was not found');
        }

        // Get all variant version IDs
        const versionIds = await indexGet(env.MODS_KV, 'mods', 'versions-for-variant', variantId);
        
        // Get versions to delete R2 files
        const versions = await getExistingEntities<ModVersion>(env.MODS_KV, 'mods', 'version', versionIds);
        
        // Delete R2 files
        for (const version of versions) {
            if (version.r2Key) {
                try {
                    await env.MODS_R2.delete(version.r2Key);
                } catch (error) {
                    console.error(`[DeleteVariant] Failed to delete R2 file ${version.r2Key}:`, error);
                }
            }
        }

        // Delete version entities
        await deleteEntities(env.MODS_KV, 'mods', 'version', versionIds);

        // Clear versions index
        await indexClear(env.MODS_KV, 'mods', 'versions-for-variant', variantId);

        // Delete variant entity
        await deleteEntity(env.MODS_KV, 'mods', 'variant', variantId);

        // Remove variant from mod
        mod.variants = (mod.variants || []).filter(v => v.variantId !== variantId);
        mod.updatedAt = new Date().toISOString();
        await putEntity(env.MODS_KV, 'mods', 'mod', modId, mod);

        return new Response(JSON.stringify({ 
            success: true,
            message: 'Variant deleted successfully',
            variantId 
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        });
    } catch (error: any) {
        console.error('[DeleteVariant] Error:', error);
        return errorResponse(
            request, env, 500, 'Internal Server Error',
            `Failed to delete variant: ${error.message}`
        );
    }
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
    const headers = createCORSHeaders(request, { 
        credentials: true, 
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
    });
    return Object.fromEntries(headers.entries());
}

function errorResponse(request: Request, env: Env, status: number, title: string, detail: string): Response {
    const rfcError = createError(request, status, title, detail);
    return new Response(JSON.stringify(rfcError), {
        status,
        headers: { 'Content-Type': 'application/problem+json', ...corsHeaders(request, env) },
    });
}
