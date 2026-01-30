/**
 * Delete Version Handler
 * DELETE /mods/:modId/versions/:versionId
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import {
    getEntity,
    putEntity,
    deleteEntity,
    indexGet,
    indexRemove,
    canModify,
} from '@strixun/kv-entities';
import type { ModMetadata, ModVersion } from '../../types/mod.js';

interface Env {
    MODS_KV: KVNamespace;
    MODS_R2: R2Bucket;
    ENVIRONMENT?: string;
    ALLOWED_ORIGINS?: string;
    [key: string]: any;
}

interface Auth {
    customerId: string;
    jwtToken: string;
}

export async function handleDeleteVersion(
    request: Request,
    env: Env,
    modId: string,
    versionId: string,
    auth: Auth | null
): Promise<Response> {
    if (!auth) {
        return errorResponse(request, env, 401, 'Unauthorized', 'Authentication required');
    }

    try {
        const mod = await getEntity<ModMetadata>(env.MODS_KV, 'mods', 'mod', modId);

        if (!mod) {
            return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
        }

        const accessContext = { customerId: auth.customerId, isAdmin: false };
        if (!canModify({ ...mod, id: mod.modId }, accessContext)) {
            return errorResponse(request, env, 403, 'Forbidden', 'You do not have permission to delete this version');
        }

        const version = await getEntity<ModVersion>(env.MODS_KV, 'mods', 'version', versionId);

        if (!version) {
            return errorResponse(request, env, 404, 'Version Not Found', 'The requested version was not found');
        }

        if (version.modId !== modId) {
            return errorResponse(request, env, 400, 'Invalid Version', 'This version does not belong to the specified mod');
        }

        // Delete R2 file
        if (version.r2Key) {
            try {
                await env.MODS_R2.delete(version.r2Key);
            } catch (error) {
                console.error('[DeleteVersion] Failed to delete R2 file:', version.r2Key, error);
            }
        }

        // Delete version entity
        await deleteEntity(env.MODS_KV, 'mods', 'version', versionId);

        // Remove from appropriate index based on whether it's a variant version
        const variantId = (version as any).variantId;
        if (variantId) {
            await indexRemove(env.MODS_KV, 'mods', 'versions-for-variant', variantId, versionId);
            
            // Update variant's currentVersionId if this was it
            const variant = mod.variants?.find(v => v.variantId === variantId);
            if (variant && variant.currentVersionId === versionId) {
                const remainingIds = await indexGet(env.MODS_KV, 'mods', 'versions-for-variant', variantId);
                if (remainingIds.length > 0) {
                    // Get remaining versions to find newest
                    const remaining: ModVersion[] = [];
                    for (const id of remainingIds) {
                        const v = await getEntity<ModVersion>(env.MODS_KV, 'mods', 'version', id);
                        if (v) remaining.push(v);
                    }
                    remaining.sort((a, b) => 
                        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    );
                    variant.currentVersionId = remaining[0]?.versionId || null;
                } else {
                    variant.currentVersionId = null;
                }
                variant.versionCount = remainingIds.length;
                mod.updatedAt = new Date().toISOString();
                await putEntity(env.MODS_KV, 'mods', 'mod', modId, mod);
            }
        } else {
            await indexRemove(env.MODS_KV, 'mods', 'versions-for', modId, versionId);
            
            // Update mod's latestVersion if needed
            const remainingIds = await indexGet(env.MODS_KV, 'mods', 'versions-for', modId);
            if (remainingIds.length > 0) {
                const remaining: ModVersion[] = [];
                for (const id of remainingIds) {
                    const v = await getEntity<ModVersion>(env.MODS_KV, 'mods', 'version', id);
                    if (v) remaining.push(v);
                }
                remaining.sort((a, b) => 
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                mod.latestVersion = remaining[0]?.version || '';
            } else {
                mod.latestVersion = '';
            }
            mod.updatedAt = new Date().toISOString();
            await putEntity(env.MODS_KV, 'mods', 'mod', modId, mod);
        }

        return new Response(JSON.stringify({ success: true, message: 'Version deleted successfully' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        });
    } catch (error: any) {
        console.error('[DeleteVersion] Error:', error);
        return errorResponse(
            request, env, 500, 'Delete Failed',
            env.ENVIRONMENT === 'development' ? error.message : 'Failed to delete version'
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
