/**
 * Update Version Handler
 * PATCH /mods/:modId/versions/:versionId
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import {
    getEntity,
    putEntity,
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

interface VersionUpdateRequest {
    version?: string;
    changelog?: string;
}

export async function handleUpdateVersion(
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
        let updates: VersionUpdateRequest;
        try {
            updates = await request.json() as VersionUpdateRequest;
        } catch {
            return errorResponse(request, env, 400, 'Invalid Request', 'Request body must be valid JSON');
        }

        const mod = await getEntity<ModMetadata>(env.MODS_KV, 'mods', 'mod', modId);

        if (!mod) {
            return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
        }

        if (!canModify({ ...mod, id: mod.modId }, { customerId: auth.customerId, isAdmin: false })) {
            return errorResponse(request, env, 403, 'Forbidden', 'You do not have permission to update this version');
        }

        const version = await getEntity<ModVersion>(env.MODS_KV, 'mods', 'version', versionId);

        if (!version) {
            return errorResponse(request, env, 404, 'Version Not Found', 'The requested version was not found');
        }

        if (version.modId !== modId) {
            return errorResponse(request, env, 400, 'Invalid Version', 'This version does not belong to the specified mod');
        }

        if (updates.version !== undefined) {
            version.version = updates.version;
        }
        if (updates.changelog !== undefined) {
            version.changelog = updates.changelog;
        }
        (version as any).updatedAt = new Date().toISOString();

        await putEntity(env.MODS_KV, 'mods', 'version', versionId, version);

        return new Response(JSON.stringify(version), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        });
    } catch (error: any) {
        console.error('[UpdateVersion] Error:', error);
        return errorResponse(
            request, env, 500, 'Update Failed',
            env.ENVIRONMENT === 'development' ? error.message : 'Failed to update version'
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
