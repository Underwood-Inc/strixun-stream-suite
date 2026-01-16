/**
 * Update Version Handler
 * Updates metadata for a specific version of a mod
 */

import { createError } from '../../utils/errors.js';
import { getCorsHeaders } from '../../utils/cors.js';
import { KVKeys } from '../../utils/kv-keys.js';
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
    const corsHeaders = getCorsHeaders(env, request);

    if (!auth) {
        const rfcError = createError(request, 401, 'Unauthorized', 'Authentication required to update versions');
        return new Response(JSON.stringify(rfcError), {
            status: 401,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }

    try {
        // Parse request body
        let updates: VersionUpdateRequest;
        try {
            updates = await request.json() as VersionUpdateRequest;
        } catch {
            const rfcError = createError(request, 400, 'Invalid Request', 'Request body must be valid JSON');
            return new Response(JSON.stringify(rfcError), {
                status: 400,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Get mod metadata to verify ownership
        const modKey = KVKeys.mod(auth.customerId, modId);
        const mod = await env.MODS_KV.get(modKey, { type: 'json' }) as ModMetadata | null;

        if (!mod) {
            const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod was not found');
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Verify ownership
        if (mod.customerId !== auth.customerId) {
            const rfcError = createError(request, 403, 'Forbidden', 'You do not have permission to update this version');
            return new Response(JSON.stringify(rfcError), {
                status: 403,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Get the version
        const versionKey = KVKeys.version(auth.customerId, versionId);
        const version = await env.MODS_KV.get(versionKey, { type: 'json' }) as ModVersion | null;

        if (!version) {
            const rfcError = createError(request, 404, 'Version Not Found', 'The requested version was not found');
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Verify the version belongs to this mod (normalize both for comparison)
        const normalizedModId = KVKeys.normalizeModId(modId);
        const normalizedVersionModId = KVKeys.normalizeModId(version.modId);
        if (normalizedVersionModId !== normalizedModId) {
            const rfcError = createError(request, 400, 'Invalid Version', 'This version does not belong to the specified mod');
            return new Response(JSON.stringify(rfcError), {
                status: 400,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Update allowed fields
        if (updates.version !== undefined) {
            version.version = updates.version;
        }
        if (updates.changelog !== undefined) {
            version.changelog = updates.changelog;
        }
        version.updatedAt = new Date().toISOString();

        // Save updated version
        await env.MODS_KV.put(versionKey, JSON.stringify(version));

        // Update global key if public
        if (mod.visibility === 'public') {
            await env.MODS_KV.put(KVKeys.versionGlobal(versionId), JSON.stringify(version));
        }

        console.log('[UpdateVersion] Successfully updated version:', {
            modId,
            versionId,
            updates: Object.keys(updates),
        });

        return new Response(JSON.stringify(version), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('[UpdateVersion] Error:', error);
        const rfcError = createError(
            request,
            500,
            'Update Failed',
            env.ENVIRONMENT === 'development' ? error.message : 'Failed to update version'
        );
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}
