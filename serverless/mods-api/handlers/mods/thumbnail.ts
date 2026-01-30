/**
 * Thumbnail handler
 * GET /mods/:modId/thumbnail
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getEntity, canAccessVisible } from '@strixun/kv-entities';
import type { ModMetadata } from '../../types/mod.js';

export async function handleThumbnail(
    request: Request,
    env: Env,
    modId: string,
    auth: { customerId: string; jwtToken?: string } | null
): Promise<Response> {
    try {
        const mod = await getEntity<ModMetadata>(env.MODS_KV, 'mods', 'mod', modId);

        if (!mod) {
            return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
        }

        // Access control
        let jwtToken: string | null = auth?.jwtToken || null;
        if (!jwtToken) {
            const cookieHeader = request.headers.get('Cookie');
            if (cookieHeader) {
                const authCookie = cookieHeader.split(';').find(c => c.trim().startsWith('auth_token='));
                if (authCookie) {
                    jwtToken = authCookie.split('=')[1]?.trim() || null;
                }
            }
        }

        const { isAdmin: checkIsAdmin } = await import('../../utils/admin.js');
        const isAdmin = auth?.customerId && jwtToken ? await checkIsAdmin(auth.customerId, jwtToken, env) : false;
        const modForAccess = { ...mod, id: mod.modId, visibility: mod.visibility || 'public' as const };
        const accessContext = { customerId: auth?.customerId || null, isAdmin };

        if (!canAccessVisible(modForAccess, accessContext)) {
            return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
        }

        // Status check for non-published mods
        const modStatus = mod.status || 'published';
        const isAuthor = mod.authorId === auth?.customerId;

        if (modStatus === 'draft' && !isAuthor && !isAdmin) {
            return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
        }

        if (!mod.thumbnailUrl) {
            return errorResponse(request, env, 404, 'Thumbnail Not Found', 'This mod does not have a thumbnail');
        }

        // Look up thumbnail in R2
        const extensions = mod.thumbnailExtension
            ? [mod.thumbnailExtension, 'png', 'jpg', 'jpeg', 'webp', 'gif']
            : ['png', 'jpg', 'jpeg', 'webp', 'gif'];

        let thumbnail: R2ObjectBody | null = null;
        let foundExt = '';

        console.log(`[Thumbnail] Looking for thumbnail: modId=${modId}, extensions=${extensions.join(',')}`);

        for (const ext of extensions) {
            const r2Key = `thumbnails/${modId}.${ext}`;
            const file = await env.MODS_R2.get(r2Key);
            if (file) {
                thumbnail = file;
                foundExt = ext;
                console.log(`[Thumbnail] Found: ${r2Key}, size=${file.size}`);
                break;
            }
        }

        if (!thumbnail) {
            console.log(`[Thumbnail] NOT FOUND: modId=${modId}, tried extensions=${extensions.join(',')}`);
            return errorResponse(request, env, 404, 'Thumbnail Not Found', 'Thumbnail file not found in storage');
        }

        const cookieHeader = request.headers.get('Cookie');
        const isHttpOnlyCookie = !!(cookieHeader && cookieHeader.includes('auth_token='));
        const shouldEncrypt = jwtToken && !isHttpOnlyCookie;

        const corsHeaders = createCORSHeaders(request, {
            credentials: true,
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        const headers = new Headers(Object.fromEntries(corsHeaders.entries()));

        if (shouldEncrypt && jwtToken) {
            const imageBytes = await thumbnail.arrayBuffer();
            const imageArray = new Uint8Array(imageBytes);
            const { encryptBinaryWithJWT } = await import('@strixun/api-framework');
            const encryptedImage = await encryptBinaryWithJWT(imageArray, jwtToken);

            headers.set('Content-Type', 'application/octet-stream');
            headers.set('X-Encrypted', 'true');
            headers.set('X-Original-Content-Type', thumbnail.httpMetadata?.contentType || 'image/png');
            headers.set('Content-Length', encryptedImage.length.toString());

            return new Response(encryptedImage, { status: 200, headers });
        } else {
            headers.set('Content-Type', thumbnail.httpMetadata?.contentType || 'image/png');
            headers.set('X-Encrypted', 'false');
            headers.set('Content-Length', thumbnail.size.toString());

            return new Response(thumbnail.body, { status: 200, headers });
        }
    } catch (error: any) {
        console.error('Thumbnail error:', error);
        return errorResponse(
            request, env, 500, 'Failed to Load Thumbnail',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred'
        );
    }
}

function errorResponse(request: Request, env: Env, status: number, title: string, detail: string): Response {
    const rfcError = createError(request, status, title, detail);
    const corsHeaders = createCORSHeaders(request, {
        credentials: true,
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
    });
    return new Response(JSON.stringify(rfcError), {
        status,
        headers: {
            'Content-Type': 'application/problem+json',
            ...Object.fromEntries(corsHeaders.entries()),
        },
    });
}

interface Env {
    MODS_KV: KVNamespace;
    MODS_R2: R2Bucket;
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}
