/**
 * List Variant Versions Handler
 * GET /mods/:modId/variants/:variantId/versions
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import {
    getExistingEntities,
    indexGet,
} from '@strixun/kv-entities';
import type { ModVersion } from '../../types/mod.js';
import type { Env } from '../../worker.js';

function sortByCreatedAtDesc(a: ModVersion, b: ModVersion): number {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return (isNaN(bTime) ? 0 : bTime) - (isNaN(aTime) ? 0 : aTime);
}

export async function handleListVariantVersions(
    request: Request,
    env: Env,
    _modId: string,
    variantId: string,
    _auth: { customerId: string } | null
): Promise<Response> {
    try {
        const versionIds = await indexGet(env.MODS_KV, 'mods', 'versions-for-variant', variantId);

        if (versionIds.length === 0) {
            return new Response(JSON.stringify({ versions: [] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
            });
        }

        const versions = await getExistingEntities<ModVersion>(env.MODS_KV, 'mods', 'version', versionIds);
        versions.sort(sortByCreatedAtDesc);

        return new Response(JSON.stringify({ versions }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        });
    } catch (error) {
        console.error('[ListVariantVersions] Error:', error);
        const rfcError = createError(request, 500, 'Internal Server Error', 'Failed to list variant versions');
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: { 'Content-Type': 'application/problem+json', ...corsHeaders(request, env) },
        });
    }
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
    const headers = createCORSHeaders(request, { 
        credentials: true, 
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
    });
    return Object.fromEntries(headers.entries());
}
