/**
 * Admin triage handler
 * Handles mod status changes and review management
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import {
    getEntity,
    putEntity,
    indexAdd,
    indexRemove,
    indexSetSingle,
    indexDeleteSingle,
    indexGet,
} from '@strixun/kv-entities';
import { isAdmin as checkIsAdmin } from '../../utils/admin.js';
import type { ModMetadata, ModStatus, ModStatusHistory, ModReviewComment, ModVersion } from '../../types/mod.js';

export async function handleUpdateModStatus(
    request: Request,
    env: Env,
    modId: string,
    auth: { customerId: string; jwtToken?: string }
): Promise<Response> {
    try {
        const mod = await getEntity<ModMetadata>(env.MODS_KV, 'mods', 'mod', modId);

        if (!mod) {
            return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
        }

        let updateData: { status: ModStatus; reason?: string };
        try {
            const body = await request.json();
            const requestIsEncrypted = request.headers.get('X-Encrypted') === 'true' ||
                (body && typeof body === 'object' && 'encrypted' in body);

            if (requestIsEncrypted) {
                const cookieHeader = request.headers.get('Cookie');
                const authCookie = cookieHeader?.split(';').find(c => c.trim().startsWith('auth_token='));
                if (!authCookie) {
                    return errorResponse(request, env, 401, 'Unauthorized', 'Authentication required');
                }
                const token = authCookie.split('=')[1]?.trim();
                const { decryptWithJWT } = await import('@strixun/api-framework');
                updateData = await decryptWithJWT(body, token) as { status: ModStatus; reason?: string };
            } else {
                updateData = body as { status: ModStatus; reason?: string };
            }
        } catch (error: any) {
            return errorResponse(request, env, 400, 'Invalid Request', 'Failed to parse request body');
        }

        const validStatuses: ModStatus[] = ['pending', 'approved', 'changes_requested', 'denied', 'draft', 'published', 'archived'];
        if (!validStatuses.includes(updateData.status)) {
            return errorResponse(request, env, 400, 'Invalid Status', `Status must be one of: ${validStatuses.join(', ')}`);
        }

        const oldStatus = mod.status;
        mod.status = updateData.status;
        mod.updatedAt = new Date().toISOString();

        // Fetch displayName
        let changedByDisplayName: string | null = null;
        if (auth.customerId) {
            const { fetchDisplayNameByCustomerId } = await import('@strixun/api-framework');
            changedByDisplayName = await fetchDisplayNameByCustomerId(auth.customerId, env);
        }

        if (!mod.statusHistory) {
            mod.statusHistory = [];
        }
        const statusEntry: ModStatusHistory = {
            status: updateData.status,
            changedBy: auth.customerId,
            changedByDisplayName,
            changedAt: new Date().toISOString(),
            reason: updateData.reason,
        };
        mod.statusHistory.push(statusEntry);

        // Update visibility indexes
        const shouldBePublic = mod.visibility === 'public' && (updateData.status === 'approved' || updateData.status === 'published');
        const wasPublic = mod.visibility === 'public' && (oldStatus === 'approved' || oldStatus === 'published');

        if (shouldBePublic && !wasPublic) {
            await indexAdd(env.MODS_KV, 'mods', 'by-visibility', 'public', modId);
            await indexSetSingle(env.MODS_KV, 'mods', 'by-slug', mod.slug, modId);

            // Copy versions to global scope for public access
            const versionIds = await indexGet(env.MODS_KV, 'mods', 'versions-for', modId);
            for (const versionId of versionIds) {
                const version = await getEntity<ModVersion>(env.MODS_KV, 'mods', 'version', versionId);
                if (version) {
                    await putEntity(env.MODS_KV, 'mods', 'version', versionId, version);
                }
            }
        } else if (wasPublic && !shouldBePublic) {
            await indexRemove(env.MODS_KV, 'mods', 'by-visibility', 'public', modId);
            await indexDeleteSingle(env.MODS_KV, 'mods', 'by-slug', mod.slug);
        }

        await putEntity(env.MODS_KV, 'mods', 'mod', modId, mod);

        return new Response(JSON.stringify({ mod }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        });
    } catch (error: any) {
        console.error('Update mod status error:', error);
        return errorResponse(
            request, env, 500, 'Failed to Update Status',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred'
        );
    }
}

export async function handleAddReviewComment(
    request: Request,
    env: Env,
    modId: string,
    auth: { customerId: string; jwtToken?: string }
): Promise<Response> {
    try {
        const mod = await getEntity<ModMetadata>(env.MODS_KV, 'mods', 'mod', modId);

        if (!mod) {
            return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
        }

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
            return errorResponse(request, env, 403, 'Forbidden', 'Only admins and the mod author can add comments');
        }

        const commentData = await request.json() as { content: string };
        if (!commentData.content?.trim()) {
            return errorResponse(request, env, 400, 'Invalid Comment', 'Comment content is required');
        }

        let authorDisplayName: string | null = null;
        if (auth.customerId) {
            const { fetchDisplayNameByCustomerId } = await import('@strixun/api-framework');
            authorDisplayName = await fetchDisplayNameByCustomerId(auth.customerId, env);
        }

        if (!mod.reviewComments) {
            mod.reviewComments = [];
        }

        const comment: ModReviewComment = {
            commentId: `comment_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
            authorId: auth.customerId,
            authorDisplayName,
            content: commentData.content.trim(),
            createdAt: new Date().toISOString(),
            isAdmin: isAdmin || false,
        };
        mod.reviewComments.push(comment);
        mod.updatedAt = new Date().toISOString();

        await putEntity(env.MODS_KV, 'mods', 'mod', modId, mod);

        return new Response(JSON.stringify({ comment }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        });
    } catch (error: any) {
        console.error('Add review comment error:', error);
        return errorResponse(
            request, env, 500, 'Failed to Add Comment',
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
    SUPER_ADMIN_EMAILS?: string;
    ENVIRONMENT?: string;
    ALLOWED_ORIGINS?: string;
    [key: string]: any;
}
