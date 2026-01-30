/**
 * Update variant handler
 * PUT /mods/:modId/variants/:variantId
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import {
    getEntity,
    putEntity,
    canModify,
} from '@strixun/kv-entities';
import type { ModMetadata } from '../../types/mod.js';
import type { Env } from '../../worker.js';

export interface UpdateVariantRequest {
    name?: string;
    description?: string;
}

export async function handleUpdateVariant(
    request: Request,
    env: Env,
    modId: string,
    variantId: string,
    auth: { customerId: string }
): Promise<Response> {
    try {
        const body = await request.json() as UpdateVariantRequest;

        const mod = await getEntity<ModMetadata>(env.MODS_KV, 'mods', 'mod', modId);

        if (!mod) {
            return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
        }

        if (!canModify({ ...mod, id: mod.modId }, { customerId: auth.customerId, isAdmin: false })) {
            return errorResponse(request, env, 403, 'Forbidden', 'You do not have permission to update this variant');
        }

        if (!mod.variants) {
            mod.variants = [];
        }

        const variantIndex = mod.variants.findIndex(v => v.variantId === variantId);
        if (variantIndex === -1) {
            return errorResponse(request, env, 404, 'Variant Not Found', 'The requested variant was not found');
        }

        const variant = mod.variants[variantIndex];

        if (body.name !== undefined) {
            if (!body.name?.trim()) {
                return errorResponse(request, env, 400, 'Invalid Variant Data', 'Variant name cannot be empty');
            }
            variant.name = body.name.trim();
        }

        if (body.description !== undefined) {
            variant.description = body.description.trim();
        }

        variant.updatedAt = new Date().toISOString();
        mod.variants[variantIndex] = variant;
        mod.updatedAt = new Date().toISOString();

        await putEntity(env.MODS_KV, 'mods', 'mod', modId, mod);

        return new Response(JSON.stringify({ variant }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        });
    } catch (error: any) {
        console.error('[UpdateVariant] Error:', error);
        return errorResponse(request, env, 500, 'Internal Server Error', error.message || 'Failed to update variant');
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
