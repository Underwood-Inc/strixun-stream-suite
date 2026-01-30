/**
 * Create variant handler
 * POST /mods/:modId/variants
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import {
    getEntity,
    putEntity,
    indexGet,
    canModify,
} from '@strixun/kv-entities';
import type { ModMetadata, ModVariant } from '../../types/mod.js';
import type { Env } from '../../worker.js';

export interface CreateVariantRequest {
    name: string;
    description?: string;
    parentVersionId: string;
}

export async function handleCreateVariant(
    request: Request,
    env: Env,
    modId: string,
    auth: { customerId: string }
): Promise<Response> {
    try {
        const body = await request.json() as CreateVariantRequest;

        if (!body.name?.trim()) {
            return errorResponse(request, env, 400, 'Invalid Variant Data', 'Variant name is required');
        }

        if (!body.parentVersionId) {
            return errorResponse(request, env, 400, 'Invalid Variant Data', 'parentVersionId is required');
        }

        const mod = await getEntity<ModMetadata>(env.MODS_KV, 'mods', 'mod', modId);

        if (!mod) {
            return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
        }

        if (!canModify({ ...mod, id: mod.modId }, { customerId: auth.customerId, isAdmin: false })) {
            return errorResponse(request, env, 403, 'Forbidden', 'You do not have permission to create variants');
        }

        // Verify parent version exists
        const versionIds = await indexGet(env.MODS_KV, 'mods', 'versions-for', modId);
        if (!versionIds.includes(body.parentVersionId)) {
            return errorResponse(request, env, 400, 'Invalid Parent Version', 'The specified parentVersionId does not exist');
        }

        const variantId = `variant-${Date.now()}`;
        const now = new Date().toISOString();

        const variant: ModVariant = {
            variantId,
            modId,
            parentVersionId: body.parentVersionId,
            name: body.name.trim(),
            description: body.description?.trim() || '',
            currentVersionId: null,
            createdAt: now,
            updatedAt: now,
            versionCount: 0,
            totalDownloads: 0,
        };

        // Store variant entity
        await putEntity(env.MODS_KV, 'mods', 'variant', variantId, variant);

        // Add to mod's variants array
        if (!mod.variants) {
            mod.variants = [];
        }
        mod.variants.push(variant);
        mod.updatedAt = now;
        await putEntity(env.MODS_KV, 'mods', 'mod', modId, mod);

        return new Response(JSON.stringify({ variant }), {
            status: 201,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        });

    } catch (error: any) {
        console.error('[CreateVariant] Error:', error);
        return errorResponse(request, env, 500, 'Internal Server Error', error.message || 'Failed to create variant');
    }
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
    const headers = createCORSHeaders(request, { 
        credentials: true, 
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
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
