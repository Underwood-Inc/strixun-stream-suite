/**
 * File validation handler
 * POST /mods/:modId/versions/:versionId/validate
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getEntity, canAccessVisible } from '@strixun/kv-entities';
import { calculateStrixunHash, verifyStrixunHash, formatStrixunHash } from '../../utils/hash.js';
import type { ModMetadata, ModVersion } from '../../types/mod.js';

export async function handleValidateVersion(
    request: Request,
    env: Env,
    modId: string,
    versionId: string,
    auth: { customerId: string } | null
): Promise<Response> {
    try {
        const mod = await getEntity<ModMetadata>(env.MODS_KV, 'mods', 'mod', modId);

        if (!mod) {
            return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
        }

        const modForAccess = { ...mod, id: mod.modId, visibility: mod.visibility || 'public' as const };
        if (!canAccessVisible(modForAccess, { customerId: auth?.customerId || null, isAdmin: false })) {
            return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
        }

        const version = await getEntity<ModVersion>(env.MODS_KV, 'mods', 'version', versionId);

        if (!version || version.modId !== modId) {
            return errorResponse(request, env, 404, 'Version Not Found', 'The requested version was not found');
        }

        if (!version.sha256) {
            return errorResponse(request, env, 400, 'No Signature Available', 'This version does not have an integrity signature');
        }

        const contentType = request.headers.get('content-type') || '';
        let fileData: ArrayBuffer;

        if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            const file = formData.get('file') as File | null;

            if (!file) {
                return errorResponse(request, env, 400, 'Invalid Request', 'File is required in form data');
            }

            fileData = await file.arrayBuffer();
        } else {
            fileData = await request.arrayBuffer();
        }

        const uploadedFileSignature = await calculateStrixunHash(fileData, env);
        const isValid = await verifyStrixunHash(fileData, version.sha256, env);

        const validationResult = {
            validated: isValid,
            modId: version.modId,
            versionId: version.versionId,
            version: version.version,
            fileName: version.fileName,
            uploadedFileSignature: formatStrixunHash(uploadedFileSignature),
            expectedSignature: formatStrixunHash(version.sha256),
            signaturesMatch: isValid,
            validatedAt: new Date().toISOString(),
            strixunVerified: isValid,
        };

        return new Response(JSON.stringify(validationResult, null, 2), {
            status: isValid ? 200 : 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        });
    } catch (error: any) {
        console.error('Validate version error:', error);
        return errorResponse(
            request, env, 500, 'Failed to Validate Version',
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
    FILE_INTEGRITY_KEYPHRASE?: string;
    ENVIRONMENT?: string;
    ALLOWED_ORIGINS?: string;
    [key: string]: any;
}
