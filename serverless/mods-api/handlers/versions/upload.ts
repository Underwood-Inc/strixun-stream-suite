/**
 * Upload version handler
 * POST /mods/:modId/versions
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { decryptBinaryWithSharedKey } from '@strixun/api-framework';
import { createError } from '../../utils/errors.js';
import {
    getEntity,
    putEntity,
    indexAdd,
} from '@strixun/kv-entities';
import { calculateStrixunHash } from '../../utils/hash.js';
import { MAX_VERSION_FILE_SIZE, validateFileSize } from '../../utils/upload-limits.js';
import { checkUploadQuota, trackUpload } from '../../utils/upload-quota.js';
import { isSuperAdmin } from '../../utils/admin.js';
import { addR2SourceMetadata, getR2SourceInfo } from '../../utils/r2-source.js';
import type { ModMetadata, ModVersion, VersionUploadRequest } from '../../types/mod.js';
import type { Env } from '../../worker.js';
import type { AuthResult } from '../../utils/auth.js';

function generateVersionId(): string {
    return `ver_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

export async function handleUploadVersion(
    request: Request,
    env: Env,
    modId: string,
    auth: AuthResult,
    variantId?: string | null
): Promise<Response> {
    try {
        const { areUploadsEnabled } = await import('../admin/settings.js');
        if (!(await areUploadsEnabled(env))) {
            return errorResponse(request, env, 503, 'Uploads Disabled', 'Uploads are currently disabled');
        }

        if (!auth.customerId) {
            return errorResponse(request, env, 400, 'Missing Customer ID', 'Customer ID is required');
        }

        const mod = await getEntity<ModMetadata>(env.MODS_KV, 'mods', 'mod', modId);

        if (!mod) {
            return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
        }

        if (mod.authorId !== auth.customerId) {
            return errorResponse(request, env, 403, 'Forbidden', 'You do not have permission to upload versions');
        }

        const isSuper = await isSuperAdmin(auth.customerId, auth.jwtToken, env);
        if (!isSuper) {
            const quotaCheck = await checkUploadQuota(auth.customerId, env, auth.jwtToken);
            if (!quotaCheck.allowed) {
                return errorResponse(request, env, 429, 'Upload Quota Exceeded', 
                    `Quota exceeded. Resets at ${new Date(quotaCheck.resetAt).toLocaleString()}`);
            }
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        
        if (!file) {
            return errorResponse(request, env, 400, 'File Required', 'File is required');
        }

        const sizeValidation = validateFileSize(file.size, MAX_VERSION_FILE_SIZE);
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

        const metadataJson = formData.get('metadata') as string | null;
        if (!metadataJson) {
            return errorResponse(request, env, 400, 'Metadata Required', 'Metadata is required');
        }

        const metadata = JSON.parse(metadataJson) as VersionUploadRequest;
        if (!metadata.version) {
            return errorResponse(request, env, 400, 'Validation Error', 'Version is required');
        }

        const versionId = generateVersionId();
        const now = new Date().toISOString();

        const extensionForR2 = fileExtension.startsWith('.') ? fileExtension.substring(1) : fileExtension || 'zip';
        const r2Path = variantId 
            ? `mods/${modId}/variants/${variantId}/versions/${versionId}.${extensionForR2}`
            : `mods/${modId}/${versionId}.${extensionForR2}`;
        
        const r2SourceInfo = getR2SourceInfo(env, request);
        
        await env.MODS_R2.put(r2Path, fileBytes, {
            httpMetadata: {
                contentType: 'application/octet-stream',
                cacheControl: 'private, no-cache',
            },
            customMetadata: addR2SourceMetadata({
                modId,
                versionId,
                ...(variantId && { variantId }),
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
            ? `${env.MODS_PUBLIC_URL}/${r2Path}`
            : r2Path;

        const version: ModVersion = {
            versionId,
            modId,
            variantId: variantId || null,
            version: metadata.version,
            changelog: metadata.changelog || '',
            fileSize,
            fileName: originalFileName,
            r2Key: r2Path,
            downloadUrl,
            sha256: fileHash,
            createdAt: now,
            downloads: 0,
            gameVersions: metadata.gameVersions || [],
            dependencies: metadata.dependencies || [],
        };

        // Store version entity
        await putEntity(env.MODS_KV, 'mods', 'version', versionId, version);

        // Add to appropriate index
        if (variantId) {
            await indexAdd(env.MODS_KV, 'mods', 'versions-for-variant', variantId, versionId);
            
            // Update variant's currentVersionId
            const variant = mod.variants?.find(v => v.variantId === variantId);
            if (variant) {
                variant.currentVersionId = versionId;
                variant.versionCount = (variant.versionCount || 0) + 1;
                variant.updatedAt = now;
            }
        } else {
            await indexAdd(env.MODS_KV, 'mods', 'versions-for', modId, versionId);
            mod.latestVersion = metadata.version;
        }
        
        mod.updatedAt = now;
        await putEntity(env.MODS_KV, 'mods', 'mod', modId, mod);

        if (!isSuper) {
            await trackUpload(auth.customerId, env, auth.jwtToken);
        }

        return new Response(JSON.stringify({ version }), {
            status: 201,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        });
    } catch (error: any) {
        console.error('Upload version error:', error);
        return errorResponse(
            request, env, 500, 'Failed to Upload Version',
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
