/**
 * Upload mod handler
 * POST /mods
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { decryptBinaryWithSharedKey } from '@strixun/api-framework';
import { createError } from '../../utils/errors.js';
import {
    putEntity,
    indexAdd,
    indexSetSingle,
    indexGetSingle,
} from '@strixun/kv-entities';
import { calculateStrixunHash } from '../../utils/hash.js';
import { MAX_MOD_FILE_SIZE, MAX_THUMBNAIL_SIZE, validateFileSize } from '../../utils/upload-limits.js';
import { checkUploadQuota, trackUpload } from '../../utils/upload-quota.js';
import { addR2SourceMetadata, getR2SourceInfo } from '../../utils/r2-source.js';
import type { ModMetadata, ModVersion, ModUploadRequest } from '../../types/mod.js';
import type { Env } from '../../worker.js';

export function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export async function slugExists(slug: string, env: Env, excludeModId?: string): Promise<boolean> {
    const existingModId = await indexGetSingle(env.MODS_KV, 'mods', 'by-slug', slug);
    if (existingModId) {
        if (excludeModId && existingModId === excludeModId) {
            return false;
        }
        return true;
    }
    return false;
}

function generateModId(): string {
    return `mod_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

function generateVersionId(): string {
    return `ver_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

export async function handleUploadMod(
    request: Request,
    env: Env,
    auth: { customerId: string; jwtToken?: string }
): Promise<Response> {
    try {
        const { areUploadsEnabled } = await import('../admin/settings.js');
        if (!(await areUploadsEnabled(env))) {
            return errorResponse(request, env, 503, 'Uploads Disabled', 'Uploads are currently disabled');
        }

        if (!auth.customerId) {
            return errorResponse(request, env, 400, 'Missing Customer ID', 'Customer ID is required');
        }

        const quotaCheck = await checkUploadQuota(auth.customerId, env, auth.jwtToken);
        if (!quotaCheck.allowed) {
            return errorResponse(request, env, 429, 'Upload Quota Exceeded',
                `Quota exceeded. Resets at ${new Date(quotaCheck.resetAt).toLocaleString()}`);
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return errorResponse(request, env, 400, 'File Required', 'File is required');
        }

        const sizeValidation = validateFileSize(file.size, MAX_MOD_FILE_SIZE);
        if (!sizeValidation.valid) {
            return errorResponse(request, env, 413, 'File Too Large', sizeValidation.error || 'File too large');
        }

        const { getAllowedFileExtensions } = await import('../admin/settings.js');
        const allowedExtensions = await getAllowedFileExtensions(env);

        let originalFileName = file.name;
        if (originalFileName.endsWith('.encrypted')) {
            originalFileName = originalFileName.slice(0, -10);
        }

        const fileExtension = originalFileName.includes('.')
            ? originalFileName.substring(originalFileName.lastIndexOf('.'))
            : '';

        if (!fileExtension || !allowedExtensions.includes(fileExtension.toLowerCase())) {
            return errorResponse(request, env, 400, 'Invalid File Type',
                `Type "${fileExtension}" not allowed. Allowed: ${allowedExtensions.join(', ')}`);
        }

        const metadataJson = formData.get('metadata') as string | null;
        if (!metadataJson) {
            return errorResponse(request, env, 400, 'Metadata Required', 'Metadata is required');
        }

        const metadata = JSON.parse(metadataJson) as ModUploadRequest;

        if (!metadata.title || !metadata.version || !metadata.category) {
            return errorResponse(request, env, 400, 'Validation Error', 'Title, version, and category are required');
        }

        const sharedKey = env.MODS_ENCRYPTION_KEY;
        if (!sharedKey || sharedKey.length < 32) {
            return errorResponse(request, env, 500, 'Server Configuration Error', 'Encryption key not configured');
        }

        const fileBuffer = await file.arrayBuffer();
        const fileBytes = new Uint8Array(fileBuffer);

        const isBinaryEncrypted = fileBytes.length >= 4 && (fileBytes[0] === 4 || fileBytes[0] === 5);
        if (!isBinaryEncrypted) {
            return errorResponse(request, env, 400, 'File Must Be Encrypted', 'Files must be encrypted before upload');
        }

        let fileHash: string;
        let fileSize: number;
        let encryptionFormat: string;

        try {
            const decryptedBytes = await decryptBinaryWithSharedKey(fileBytes, sharedKey);
            fileSize = decryptedBytes.length;
            fileHash = await calculateStrixunHash(decryptedBytes, env);
            encryptionFormat = fileBytes[0] === 5 ? 'binary-v5' : 'binary-v4';
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            return errorResponse(request, env, 400, 'Decryption Failed', `Failed to decrypt: ${errorMsg}`);
        }

        const modId = generateModId();
        const versionId = generateVersionId();
        const now = new Date().toISOString();

        const baseSlug = generateSlug(metadata.title);
        if (!baseSlug) {
            return errorResponse(request, env, 400, 'Invalid Title', 'Title must contain valid characters');
        }

        if (await slugExists(baseSlug, env)) {
            return errorResponse(request, env, 409, 'Slug Already Exists',
                `A mod with slug "${baseSlug}" already exists. Choose a different title.`);
        }

        const slug = baseSlug;

        // Upload file to R2
        const extensionForR2 = fileExtension ? fileExtension.substring(1) : 'zip';
        const r2Key = `mods/${modId}/${versionId}.${extensionForR2}`;

        await env.MODS_R2.put(r2Key, fileBytes, {
            httpMetadata: {
                contentType: 'application/octet-stream',
                cacheControl: 'private, no-cache',
            },
            customMetadata: addR2SourceMetadata({
                modId,
                versionId,
                uploadedBy: auth.customerId,
                uploadedAt: now,
                encrypted: 'true',
                encryptionFormat,
                originalFileName,
                originalContentType: file.type || 'application/octet-stream',
                sha256: fileHash,
            }, env, request),
        });

        const downloadUrl = env.MODS_PUBLIC_URL
            ? `${env.MODS_PUBLIC_URL}/${r2Key}`
            : r2Key;

        const version: ModVersion = {
            versionId,
            modId,
            version: metadata.version,
            changelog: metadata.changelog || '',
            fileSize,
            fileName: originalFileName,
            r2Key,
            downloadUrl,
            sha256: fileHash,
            createdAt: now,
            downloads: 0,
            gameVersions: metadata.gameVersions || [],
            dependencies: metadata.dependencies || [],
        };

        // Handle thumbnail
        let thumbnailUrl: string | undefined;
        let thumbnailExtension: string | undefined;

        const thumbnailFile = formData.get('thumbnail') as File | null;
        if (thumbnailFile) {
            const result = await handleThumbnailUpload(thumbnailFile, modId, slug, request, env);
            thumbnailUrl = result.url;
            thumbnailExtension = result.extension;
        } else if (metadata.thumbnail) {
            const result = await handleBase64ThumbnailUpload(metadata.thumbnail, modId, slug, request, env);
            thumbnailUrl = result.url;
            thumbnailExtension = result.extension;
        }

        // Fetch display name
        let authorDisplayName: string | null = metadata.displayName || null;
        if (!authorDisplayName && auth.customerId) {
            const { fetchDisplayNameByCustomerId } = await import('@strixun/api-framework');
            authorDisplayName = await fetchDisplayNameByCustomerId(auth.customerId, env);
        }

        const mod: ModMetadata = {
            modId,
            slug,
            authorId: auth.customerId,
            authorDisplayName,
            title: metadata.title,
            description: metadata.description || '',
            category: metadata.category,
            tags: metadata.tags || [],
            thumbnailUrl,
            thumbnailExtension,
            createdAt: now,
            updatedAt: now,
            latestVersion: metadata.version,
            downloadCount: 0,
            visibility: metadata.visibility || 'public',
            featured: false,
            customerId: auth.customerId,
            status: 'pending',
            statusHistory: [{
                status: 'pending',
                changedBy: auth.customerId,
                changedByDisplayName: authorDisplayName,
                changedAt: now,
            }],
            reviewComments: [],
        };

        // Store entities
        await putEntity(env.MODS_KV, 'mods', 'mod', modId, mod);
        await putEntity(env.MODS_KV, 'mods', 'version', versionId, version);

        // Update indexes
        await indexAdd(env.MODS_KV, 'mods', 'versions-for', modId, versionId);
        await indexAdd(env.MODS_KV, 'mods', 'by-customer', auth.customerId, modId);
        await indexSetSingle(env.MODS_KV, 'mods', 'by-slug', slug, modId);

        if (mod.visibility === 'public' && (mod.status === 'published' || mod.status === 'approved')) {
            await indexAdd(env.MODS_KV, 'mods', 'by-visibility', 'public', modId);
        }

        await trackUpload(auth.customerId, env, auth.jwtToken);

        return new Response(JSON.stringify({ mod, version }), {
            status: 201,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        });
    } catch (error: any) {
        console.error('Upload mod error:', error);
        return errorResponse(
            request, env, 500, 'Failed to Upload Mod',
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
        throw new Error('Image file too small or corrupted');
    }

    // Validate headers
    const isValid =
        ((imageType === 'jpeg' || imageType === 'jpg') && imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8) ||
        (imageType === 'png' && imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) ||
        (imageType === 'gif' && imageBuffer[0] === 0x47 && imageBuffer[1] === 0x49) ||
        (imageType === 'webp' && imageBuffer[0] === 0x52 && imageBuffer[1] === 0x49);

    if (!isValid) {
        throw new Error(`Invalid ${imageType} image format`);
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
        throw new Error('Invalid base64 image data');
    }

    const [, imageType, base64Content] = matches;
    const normalizedType = imageType.toLowerCase();
    const allowedTypes = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
    if (!allowedTypes.includes(normalizedType)) {
        throw new Error(`Unsupported image type: ${imageType}`);
    }

    const imageBuffer = Uint8Array.from(atob(base64Content), c => c.charCodeAt(0));
    if (imageBuffer.length < 100) {
        throw new Error('Image too small or corrupted');
    }

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
