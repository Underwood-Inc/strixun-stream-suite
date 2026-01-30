/**
 * Admin delete mod handler
 * DELETE /admin/mods/:modId
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import {
    getEntity,
    deleteEntity,
    deleteEntities,
    getExistingEntities,
    indexGet,
    indexRemove,
    indexDeleteSingle,
    indexClear,
} from '@strixun/kv-entities';
import type { ModMetadata, ModVersion } from '../../types/mod.js';

export async function handleAdminDeleteMod(
    request: Request,
    env: Env,
    modId: string,
    _auth: { customerId: string }
): Promise<Response> {
    try {
        const mod = await getEntity<ModMetadata>(env.MODS_KV, 'mods', 'mod', modId);

        if (!mod) {
            return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
        }

        // Get all version IDs
        const versionIds = await indexGet(env.MODS_KV, 'mods', 'versions-for', modId);

        // Get versions for R2 cleanup
        const versions = await getExistingEntities<ModVersion>(env.MODS_KV, 'mods', 'version', versionIds);

        // Delete R2 files
        for (const version of versions) {
            if (version.r2Key) {
                try {
                    await env.MODS_R2.delete(version.r2Key);
                } catch (error) {
                    console.error(`Failed to delete R2 file ${version.r2Key}:`, error);
                }
            }
        }

        // Delete variant versions too
        if (mod.variants?.length) {
            for (const variant of mod.variants) {
                const variantVersionIds = await indexGet(env.MODS_KV, 'mods', 'versions-for-variant', variant.variantId);
                const variantVersions = await getExistingEntities<ModVersion>(env.MODS_KV, 'mods', 'version', variantVersionIds);

                for (const vv of variantVersions) {
                    if (vv.r2Key) {
                        try {
                            await env.MODS_R2.delete(vv.r2Key);
                        } catch (error) {
                            console.error(`Failed to delete variant R2 file ${vv.r2Key}:`, error);
                        }
                    }
                }

                await deleteEntities(env.MODS_KV, 'mods', 'version', variantVersionIds);
                await indexClear(env.MODS_KV, 'mods', 'versions-for-variant', variant.variantId);
                await deleteEntity(env.MODS_KV, 'mods', 'variant', variant.variantId);
            }
        }

        // Delete thumbnails
        const extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
        for (const ext of extensions) {
            try {
                await env.MODS_R2.delete(`thumbnails/${modId}.${ext}`);
            } catch {
                // Continue
            }
        }

        // Delete version entities
        await deleteEntities(env.MODS_KV, 'mods', 'version', versionIds);

        // Delete mod entity
        await deleteEntity(env.MODS_KV, 'mods', 'mod', modId);

        // Remove from indexes
        if (mod.customerId) {
            await indexRemove(env.MODS_KV, 'mods', 'by-customer', mod.customerId, modId);
        }
        if (mod.visibility === 'public') {
            await indexRemove(env.MODS_KV, 'mods', 'by-visibility', 'public', modId);
        }
        if (mod.slug) {
            await indexDeleteSingle(env.MODS_KV, 'mods', 'by-slug', mod.slug);
        }
        await indexClear(env.MODS_KV, 'mods', 'versions-for', modId);

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        });
    } catch (error: any) {
        console.error('Admin delete mod error:', error);
        return errorResponse(
            request, env, 500, 'Failed to Delete Mod',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred'
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

interface Env {
    MODS_KV: KVNamespace;
    MODS_R2: R2Bucket;
    SUPER_ADMIN_EMAILS?: string;
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}
