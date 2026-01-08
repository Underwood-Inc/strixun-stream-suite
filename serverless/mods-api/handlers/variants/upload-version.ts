/**
 * Upload variant version handler
 * POST /mods/:modId/variants/:variantId/versions
 * Adds a new version to an existing variant
 * ARCHITECTURAL IMPROVEMENT: Full version control for variants
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { decryptBinaryWithSharedKey } from '@strixun/api-framework';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, normalizeModId } from '../../utils/customer.js';
import { isEmailAllowed } from '../../utils/auth.js';
import { calculateStrixunHash } from '../../utils/hash.js';
import { MAX_VERSION_FILE_SIZE, validateFileSize } from '../../utils/upload-limits.js';
import { addR2SourceMetadata, getR2SourceInfo } from '../../utils/r2-source.js';
import {
    generateVariantVersionId,
    getVariant,
    saveVariantVersion,
    addVariantVersionToList,
    updateVariantAfterVersionUpload,
    getVariantVersionR2Key
} from '../../utils/variant-versions.js';
import type { ModMetadata, VariantVersion, VariantVersionUploadRequest } from '../../types/mod.js';

/**
 * Handle upload variant version request
 */
export async function handleUploadVariantVersion(
    request: Request,
    env: Env,
    modId: string,
    variantId: string,
    auth: { customerId: string; email?: string; customerId: string | null }
): Promise<Response> {
    try {
        // Check if uploads are globally enabled
        const { areUploadsEnabled } = await import('../admin/settings.js');
        const uploadsEnabled = await areUploadsEnabled(env);
        if (!uploadsEnabled) {
            const rfcError = createError(request, 503, 'Uploads Disabled', 'Mod uploads are currently disabled globally. Please try again later.');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 503,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Check email whitelist
        if (!isEmailAllowed(auth.email, env)) {
            const rfcError = createError(request, 403, 'Forbidden', 'Your email address is not authorized to upload variant versions');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 403,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // CRITICAL: Validate customerId is present
        if (!auth.customerId) {
            console.error('[UploadVariantVersion] CRITICAL: customerId is null for authenticated customer:', { customerId: auth.customerId,
                email: auth.email,
                note: 'Rejecting variant version upload - customerId is required'
            });
            const rfcError = createError(request, 400, 'Missing Customer ID', 'Customer ID is required for variant version uploads. Please ensure your account has a valid customer association.');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 400,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Get mod metadata
        const normalizedModId = normalizeModId(modId);
        const modKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
        const mod = await env.MODS_KV.get(modKey, { type: 'json' }) as ModMetadata | null;

        if (!mod) {
            const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod was not found');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Check authorization (must be mod author)
        if (mod.authorId !== auth.customerId) {
            const rfcError = createError(request, 403, 'Forbidden', 'You do not have permission to upload versions for this variant');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 403,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Get variant metadata
        const variant = await getVariant(variantId, auth.customerId, env);
        if (!variant) {
            const rfcError = createError(request, 404, 'Variant Not Found', 'The requested variant was not found');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Verify variant belongs to this mod
        if (variant.modId !== modId && variant.modId !== `mod_${normalizedModId}`) {
            const rfcError = createError(request, 400, 'Invalid Variant', 'Variant does not belong to this mod');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 400,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Parse multipart form data
        const formData = await request.formData();
        let file = formData.get('file') as File | null;
        
        if (!file) {
            const rfcError = createError(request, 400, 'File Required', 'File is required for variant version upload');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 400,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Validate file size
        const sizeValidation = validateFileSize(file.size, MAX_VERSION_FILE_SIZE);
        if (!sizeValidation.valid) {
            const rfcError = createError(
                request,
                413,
                'File Too Large',
                sizeValidation.error || `File size exceeds maximum allowed size of ${MAX_VERSION_FILE_SIZE / (1024 * 1024)}MB`
            );
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 413,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Validate file extension
        const { getAllowedFileExtensions } = await import('../admin/settings.js');
        const allowedExtensions = await getAllowedFileExtensions(env);
        
        let originalFileName = file.name;
        
        // Remove .encrypted suffix if present
        if (originalFileName.endsWith('.encrypted')) {
            originalFileName = originalFileName.slice(0, -10);
        }
        
        // Get file extension
        const fileExtension = originalFileName.includes('.') 
            ? originalFileName.substring(originalFileName.lastIndexOf('.'))
            : '';
        
        // Validate extension
        if (!fileExtension || !allowedExtensions.includes(fileExtension.toLowerCase())) {
            const rfcError = createError(
                request, 
                400, 
                'Invalid File Type', 
                `File type "${fileExtension}" is not allowed. Allowed extensions: ${allowedExtensions.join(', ')}`
            );
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 400,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Get shared encryption key
        const sharedKey = env.MODS_ENCRYPTION_KEY;
        
        if (!sharedKey || sharedKey.length < 32) {
            const rfcError = createError(request, 500, 'Server Configuration Error', 'MODS_ENCRYPTION_KEY is not configured.');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 500,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }
        
        // Check file format: binary encrypted (v4/v5)
        const fileBuffer = await file.arrayBuffer();
        const fileBytes = new Uint8Array(fileBuffer);
        
        const isBinaryEncrypted = fileBytes.length >= 4 && (fileBytes[0] === 4 || fileBytes[0] === 5);
        
        if (!isBinaryEncrypted) {
            const rfcError = createError(request, 400, 'File Must Be Encrypted', 'Files must be encrypted with shared key (binary format v4/v5) before upload.');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 400,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }
        
        // Decrypt to calculate hash and size
        let fileHash: string;
        let fileSize: number;
        let encryptionFormat: string;
        
        try {
            const decryptedBytes = await decryptBinaryWithSharedKey(fileBytes, sharedKey);
            fileSize = decryptedBytes.length;
            fileHash = await calculateStrixunHash(decryptedBytes, env);
            encryptionFormat = fileBytes[0] === 5 ? 'binary-v5' : 'binary-v4';
            console.log('[UploadVariantVersion] Binary decryption successful');
        } catch (error) {
            console.error('File decryption error:', error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            const rfcError = createError(request, 400, 'Decryption Failed', `Failed to decrypt file: ${errorMsg}`);
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 400,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Parse metadata
        const metadataJson = formData.get('metadata') as string | null;
        if (!metadataJson) {
            const rfcError = createError(request, 400, 'Metadata Required', 'Metadata is required for variant version upload');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 400,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        const metadata = JSON.parse(metadataJson) as VariantVersionUploadRequest;

        // Validate required fields
        if (!metadata.version) {
            const rfcError = createError(request, 400, 'Validation Error', 'Version is required');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 400,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Generate version ID
        const variantVersionId = generateVariantVersionId();
        const now = new Date().toISOString();

        // Store encrypted file in R2 (new hierarchical structure)
        const extensionForR2 = fileExtension.startsWith('.') ? fileExtension.substring(1) : fileExtension || 'zip';
        const r2Key = getVariantVersionR2Key(normalizedModId, variantId, variantVersionId, extensionForR2, auth.customerId);
        
        const r2SourceInfo = getR2SourceInfo(env, request);
        console.log('[UploadVariantVersion] R2 storage source:', r2SourceInfo);
        
        await env.MODS_R2.put(r2Key, fileBytes, {
            httpMetadata: {
                contentType: 'application/octet-stream',
                cacheControl: 'private, no-cache',
            },
            customMetadata: addR2SourceMetadata({
                modId,
                variantId,
                variantVersionId,
                uploadedBy: auth.customerId,
                uploadedAt: now,
                encrypted: 'true',
                encryptionFormat: encryptionFormat,
                originalFileName,
                originalContentType: 'application/zip',
                sha256: fileHash,
            }, env, request),
        });

        // Generate download URL
        const downloadUrl = env.MODS_PUBLIC_URL 
            ? `${env.MODS_PUBLIC_URL}/${r2Key}`
            : `https://pub-${(env.MODS_R2 as any).id}.r2.dev/${r2Key}`;

        // Create variant version metadata
        const variantVersion: VariantVersion = {
            variantVersionId,
            variantId,
            modId,
            version: metadata.version,
            changelog: metadata.changelog || '',
            fileSize: fileSize,
            fileName: originalFileName,
            r2Key,
            downloadUrl,
            sha256: fileHash,
            createdAt: now,
            downloads: 0,
            gameVersions: metadata.gameVersions || [],
            dependencies: metadata.dependencies || [],
        };

        // Store variant version in KV
        await saveVariantVersion(variantVersion, auth.customerId, env);

        // Add version to variant's version list
        await addVariantVersionToList(variantId, variantVersionId, auth.customerId, env);

        // Update variant metadata (currentVersionId, versionCount, updatedAt)
        await updateVariantAfterVersionUpload(variantId, variantVersionId, auth.customerId, env);

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify({ variantVersion }), {
            status: 201,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Upload variant version error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Upload Variant Version',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while uploading the variant version'
        );
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify(rfcError), {
            status: 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}

interface Env {
    MODS_KV: KVNamespace;
    MODS_R2: R2Bucket;
    MODS_PUBLIC_URL?: string;
    MODS_ENCRYPTION_KEY?: string;
    ALLOWED_EMAILS?: string;
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}
