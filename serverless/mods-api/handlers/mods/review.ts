/**
 * Mod review page handler
 * GET /mods/:slug/review
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import {
    getEntity,
    getExistingEntities,
    indexGet,
} from '@strixun/kv-entities';
import { isAdmin as checkIsAdmin } from '../../utils/admin.js';
import type { ModMetadata, ModVersion, ModDetailResponse } from '../../types/mod.js';

export async function handleGetModReview(
    request: Request,
    env: Env,
    modId: string,
    auth: { customerId: string; jwtToken?: string } | null
): Promise<Response> {
    try {
        if (!auth) {
            return errorResponse(request, env, 401, 'Unauthorized', 'Authentication required');
        }

        const mod = await getEntity<ModMetadata>(env.MODS_KV, 'mods', 'mod', modId);

        if (!mod) {
            return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
        }

        // Check access
        let jwtToken = auth.jwtToken || null;
        if (!jwtToken) {
            const cookieHeader = request.headers.get('Cookie');
            const authCookie = cookieHeader?.split(';').find(c => c.trim().startsWith('auth_token='));
            if (authCookie) {
                jwtToken = authCookie.split('=')[1]?.trim() || null;
            }
        }

        const isAdmin = auth.customerId && jwtToken ? await checkIsAdmin(auth.customerId, jwtToken, env) : false;
        const isUploader = mod.authorId === auth.customerId;

        if (!isAdmin && !isUploader) {
            return errorResponse(request, env, 403, 'Forbidden', 'Only admins and the mod author can access the review page');
        }

        const versionIds = await indexGet(env.MODS_KV, 'mods', 'versions-for', modId);
        const versions = await getExistingEntities<ModVersion>(env.MODS_KV, 'mods', 'version', versionIds);

        // Sort by semantic version
        versions.sort((a, b) => {
            const aParts = a.version.split('.').map(Number);
            const bParts = b.version.split('.').map(Number);
            for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                const aPart = aParts[i] || 0;
                const bPart = bParts[i] || 0;
                if (aPart !== bPart) {
                    return bPart - aPart;
                }
            }
            return 0;
        });

        const response: ModDetailResponse = { mod, versions };

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        });
    } catch (error: any) {
        console.error('Get mod review error:', error);
        return errorResponse(
            request, env, 500, 'Failed to Get Mod Review',
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
    ENVIRONMENT?: string;
    ALLOWED_ORIGINS?: string;
    SUPER_ADMIN_EMAILS?: string;
    [key: string]: any;
}
