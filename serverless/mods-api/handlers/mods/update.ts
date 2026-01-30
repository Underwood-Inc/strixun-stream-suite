/**
 * Update mod handler
 * PATCH /mods/:modId
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
    canModify,
} from '@strixun/kv-entities';
import { generateSlug, slugExists } from './upload.js';
import { MAX_THUMBNAIL_SIZE, validateFileSize } from '../../utils/upload-limits.js';
import { createModSnapshot } from '../../utils/snapshot.js';
import { addR2SourceMetadata, getR2SourceInfo } from '../../utils/r2-source.js';
import type { ModMetadata, ModUpdateRequest, ModVersion } from '../../types/mod.js';
import type { Env } from '../../worker.js';

export async function handleUpdateMod(
    request: Request,
    env: Env,
    modId: string,
    auth: { customerId: string; jwtToken?: string }
): Promise<Response> {
    try {
        if (!auth.customerId) {
            return errorResponse(request, env, 400, 'Missing Customer ID', 'Customer ID is required');
        }

        const mod = await getEntity<ModMetadata>(env.MODS_KV, 'mods', 'mod', modId);

        if (!mod) {
            return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
        }

        if (!canModify({ ...mod, id: mod.modId }, { customerId: auth.customerId, isAdmin: false })) {
            return errorResponse(request, env, 403, 'Forbidden', 'You do not have permission to update this mod');
        }

        const contentType = request.headers.get('content-type') || '';
        let formData: FormData | null = null;
        let updateData: ModUpdateRequest;

        if (contentType.includes('multipart/form-data')) {
            formData = await request.formData();
            const metadataJson = formData.get('metadata') as string | null;
            updateData = metadataJson ? JSON.parse(metadataJson) : {};
        } else {
            updateData = await request.json() as ModUpdateRequest;
        }

        const wasPublic = mod.visibility === 'public';
        const oldSlug = mod.slug;
        let slugChanged = false;

        // Update fields
        if (updateData.title !== undefined) {
            mod.title = updateData.title;
            const baseSlug = generateSlug(updateData.title);
            if (!baseSlug) {
                return errorResponse(request, env, 400, 'Invalid Title', 'Title must contain valid characters');
            }
            if (baseSlug !== oldSlug && await slugExists(baseSlug, env, modId)) {
                return errorResponse(request, env, 409, 'Slug Already Exists', `Slug "${baseSlug}" already exists`);
            }
            if (baseSlug !== oldSlug) {
                mod.slug = baseSlug;
                slugChanged = true;
            }
        }

        if (updateData.summary !== undefined) mod.summary = updateData.summary || undefined;
        if (updateData.description !== undefined) mod.description = updateData.description;
        if (updateData.category !== undefined) mod.category = updateData.category;
        if (updateData.tags !== undefined) mod.tags = updateData.tags;
        if (updateData.visibility !== undefined) mod.visibility = updateData.visibility;
        if (updateData.gameId !== undefined) mod.gameId = updateData.gameId;

        // Merge variants
        if (updateData.variants !== undefined) {
            const existingVariants = mod.variants || [];
            mod.variants = updateData.variants.map(updatedVariant => {
                const existing = existingVariants.find(v => v.variantId === updatedVariant.variantId);
                if (existing) {
                    return {
                        ...existing,
                        name: updatedVariant.name,
                        description: updatedVariant.description,
                        updatedAt: new Date().toISOString(),
                    };
                }
                return {
                    ...updatedVariant,
                    createdAt: updatedVariant.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    currentVersionId: null,
                    versionCount: 0,
                    totalDownloads: 0,
                };
            });
        }

        mod.updatedAt = new Date().toISOString();

        // Handle thumbnail
        if (formData) {
            const thumbnailFile = formData.get('thumbnail') as File | null;
            if (thumbnailFile) {
                const thumbBuffer = new Uint8Array(await thumbnailFile.arrayBuffer());
                if (thumbBuffer.length >= 4 && (thumbBuffer[0] === 4 || thumbBuffer[0] === 5)) {
                    return errorResponse(request, env, 400, 'Invalid Thumbnail', 'Thumbnails must not be encrypted');
                }
                const result = await handleThumbnailUpload(thumbnailFile, modId, mod.slug, request, env);
                mod.thumbnailUrl = result.url;
                mod.thumbnailExtension = result.extension;
            }
        }

        if (updateData.thumbnail) {
            const result = await handleBase64ThumbnailUpload(updateData.thumbnail, modId, mod.slug, request, env);
            mod.thumbnailUrl = result.url;
            mod.thumbnailExtension = result.extension;
        }

        // Validate and upload variant files
        if (formData && mod.variants?.length) {
            const { handleUploadVersion } = await import('../versions/upload.js');
            const uploadResults: Array<{ variantId: string; versionId: string; success: boolean }> = [];

            for (const variant of mod.variants) {
                const variantFile = formData.get(`variant_${variant.variantId}`) as File | null;
                if (!variantFile) continue;

                try {
                    const variantFormData = new FormData();
                    variantFormData.append('file', variantFile);

                    const existingVersions = await indexGet(env.MODS_KV, 'mods', 'versions-for-variant', variant.variantId);
                    const versionCount = existingVersions.length;
                    const newVersionNumber = versionCount > 0 ? `1.0.${versionCount}` : '1.0.0';

                    variantFormData.append('metadata', JSON.stringify({
                        version: newVersionNumber,
                        changelog: 'Uploaded via mod update',
                        gameVersions: [],
                        dependencies: [],
                    }));

                    const headers = new Headers();
                    const cookieHeader = request.headers.get('Cookie');
                    if (cookieHeader) headers.set('Cookie', cookieHeader);

                    const variantRequest = new Request(request.url, {
                        method: 'POST',
                        headers,
                        body: variantFormData,
                    });

                    const uploadResponse = await handleUploadVersion(variantRequest, env, modId, auth as any, variant.variantId);

                    if (uploadResponse.status !== 201) {
                        throw new Error(`Upload failed: ${uploadResponse.status}`);
                    }

                    const result = await uploadResponse.json() as { version?: { versionId?: string } };
                    if (!result.version?.versionId) {
                        throw new Error('Missing versionId in response');
                    }

                    uploadResults.push({ variantId: variant.variantId, versionId: result.version.versionId, success: true });
                } catch (error: any) {
                    // Rollback on failure
                    for (const success of uploadResults.filter(r => r.success)) {
                        try {
                            const ver = await getEntity<ModVersion>(env.MODS_KV, 'mods', 'version', success.versionId);
                            if (ver?.r2Key) {
                                await env.MODS_R2.delete(ver.r2Key);
                            }
                            await env.MODS_KV.delete(`mods:version:${success.versionId}`);
                            await indexRemove(env.MODS_KV, 'mods', 'versions-for-variant', success.variantId, success.versionId);
                        } catch {
                            // Continue rollback
                        }
                    }
                    return errorResponse(request, env, 500, 'Variant Upload Failed', error.message);
                }
            }

            // Update variant currentVersionId
            for (const result of uploadResults) {
                const variant = mod.variants.find(v => v.variantId === result.variantId);
                if (variant && result.success) {
                    variant.currentVersionId = result.versionId;
                    variant.updatedAt = new Date().toISOString();
                    variant.versionCount = (variant.versionCount || 0) + 1;
                }
            }
        }

        // Ensure customerId
        if (!mod.customerId && auth.customerId) {
            mod.customerId = auth.customerId;
        }

        // Update display name
        let newDisplayName = updateData.displayName || null;
        if (!newDisplayName && mod.customerId) {
            const { fetchDisplayNameByCustomerId } = await import('@strixun/api-framework');
            newDisplayName = await fetchDisplayNameByCustomerId(mod.customerId, env);
        }
        mod.authorDisplayName = newDisplayName || mod.authorDisplayName || null;

        // Save mod
        await putEntity(env.MODS_KV, 'mods', 'mod', modId, mod);

        // Update slug indexes
        if (slugChanged) {
            await indexDeleteSingle(env.MODS_KV, 'mods', 'by-slug', oldSlug);
            await indexSetSingle(env.MODS_KV, 'mods', 'by-slug', mod.slug, modId);
        }

        // Update visibility indexes
        if (mod.visibility === 'public' && !wasPublic) {
            await indexAdd(env.MODS_KV, 'mods', 'by-visibility', 'public', modId);
        } else if (mod.visibility !== 'public' && wasPublic) {
            await indexRemove(env.MODS_KV, 'mods', 'by-visibility', 'public', modId);
        }

        // Create snapshot
        const snapshot = await createModSnapshot(mod, auth.customerId, mod.authorDisplayName, env);
        await putEntity(env.MODS_KV, 'mods', 'snapshot', snapshot.snapshotId, snapshot);
        await indexAdd(env.MODS_KV, 'mods', 'snapshots-for', modId, snapshot.snapshotId);

        return new Response(JSON.stringify({ mod }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        });
    } catch (error: any) {
        console.error('Update mod error:', error);
        return errorResponse(
            request, env, 500, 'Failed to Update Mod',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred'
        );
    }
}

async function handleThumbnailUpload(
    thumbnailFile: File,
    modId: string,
    slug: string,
    request: Request,
    env: Env
): Promise<{ url: string; extension: string }> {
    if (!thumbnailFile.type.startsWith('image/')) {
        throw new Error('File must be an image');
    }

    const sizeValidation = validateFileSize(thumbnailFile.size, MAX_THUMBNAIL_SIZE);
    if (!sizeValidation.valid) {
        throw new Error(sizeValidation.error || 'Thumbnail too large');
    }

    const allowedTypes = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
    const imageType = thumbnailFile.type.split('/')[1]?.toLowerCase();
    if (!imageType || !allowedTypes.includes(imageType)) {
        throw new Error(`Unsupported image type: ${imageType}`);
    }

    const imageBuffer = new Uint8Array(await thumbnailFile.arrayBuffer());
    if (imageBuffer.length < 100) {
        throw new Error('Image file too small');
    }

    const extension = imageType === 'jpeg' ? 'jpg' : imageType;
    const r2Key = `thumbnails/${modId}.${extension}`;

    await env.MODS_R2.put(r2Key, imageBuffer, {
        httpMetadata: {
            contentType: thumbnailFile.type,
            cacheControl: 'public, max-age=31536000',
        },
        customMetadata: addR2SourceMetadata({
            modId,
            extension,
            validated: 'true',
        }, env, request),
    });

    const requestUrl = new URL(request.url);
    const API_BASE_URL = env.ENVIRONMENT === 'development'
        ? 'http://localhost:8788'
        : (env.MODS_PUBLIC_URL || `${requestUrl.protocol}//${requestUrl.host}`);

    return { url: `${API_BASE_URL}/mods/${slug}/thumbnail`, extension };
}

async function handleBase64ThumbnailUpload(
    base64Data: string,
    modId: string,
    slug: string,
    request: Request,
    env: Env
): Promise<{ url: string; extension: string }> {
    const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
        throw new Error('Invalid base64 image');
    }

    const [, imageType, base64Content] = matches;
    const normalizedType = imageType.toLowerCase();
    const imageBuffer = Uint8Array.from(atob(base64Content), c => c.charCodeAt(0));

    const extension = normalizedType === 'jpeg' ? 'jpg' : normalizedType;
    const r2Key = `thumbnails/${modId}.${extension}`;

    await env.MODS_R2.put(r2Key, imageBuffer, {
        httpMetadata: {
            contentType: `image/${normalizedType}`,
            cacheControl: 'public, max-age=31536000',
        },
        customMetadata: addR2SourceMetadata({
            modId,
            extension,
            validated: 'true',
        }, env, request),
    });

    const requestUrl = new URL(request.url);
    const API_BASE_URL = env.ENVIRONMENT === 'development'
        ? 'http://localhost:8788'
        : (env.MODS_PUBLIC_URL || `${requestUrl.protocol}//${requestUrl.host}`);

    return { url: `${API_BASE_URL}/mods/${slug}/thumbnail`, extension };
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
