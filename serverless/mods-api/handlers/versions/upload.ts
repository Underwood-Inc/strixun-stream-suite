/**
 * Upload version handler
 * POST /mods/:modId/versions
 * Adds a new version to an existing mod
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { decryptBinaryWithSharedKey } from '@strixun/api-framework';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, getCustomerR2Key, normalizeModId } from '../../utils/customer.js';
import { calculateStrixunHash } from '../../utils/hash.js';
import { MAX_VERSION_FILE_SIZE, validateFileSize } from '../../utils/upload-limits.js';
import { checkUploadQuota, trackUpload } from '../../utils/upload-quota.js';
import { isSuperAdmin } from '../../utils/admin.js';
import { addR2SourceMetadata, getR2SourceInfo } from '../../utils/r2-source.js';
import type { ModMetadata, ModVersion, VersionUploadRequest } from '../../types/mod.js';
import type { Env } from '../../worker.js';

/**
 * Generate unique version ID
 */
function generateVersionId(): string {
    return `ver_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Handle upload version request
 * UNIFIED SYSTEM: Supports both main mod versions and variant versions
 * @param variantId - Optional variant ID for variant versions, null/undefined for main mod versions
 */
export async function handleUploadVersion(
    request: Request,
    env: Env,
    modId: string,
    auth: { customerId: string },
    variantId?: string | null
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
        // All authenticated users can upload versions for their own mods (authorization check happens below)

        // CRITICAL: Validate customerId is present - required for data scoping and display name lookups
        if (!auth.customerId) {
            console.error('[UploadVersion] CRITICAL: customerId is null for authenticated customer:', { customerId: auth.customerId,
                note: 'Rejecting version upload - customerId is required for data scoping and display name lookups'
            });
            const rfcError = createError(request, 400, 'Missing Customer ID', 'Customer ID is required for mod version uploads. Please ensure your account has a valid customer association.');
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
        // Normalize modId to ensure consistent key generation (strip mod_ prefix if present)
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

        // Check authorization
        if (mod.authorId !== auth.customerId) {
            const rfcError = createError(request, 403, 'Forbidden', 'You do not have permission to upload versions for this mod');
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

        // Check upload quota (skip for super admins)
        const isSuper = await isSuperAdmin(auth.customerId, auth.jwtToken, env);
        if (!isSuper) {
            const quotaCheck = await checkUploadQuota(auth.customerId, env);
            if (!quotaCheck.allowed) {
                const quotaMessage = `Upload quota exceeded. Limit: ${quotaCheck.limit}, Remaining: ${quotaCheck.remaining}. Resets at ${new Date(quotaCheck.resetAt).toLocaleString()}.`;
                
                const rfcError = createError(request, 429, 'Upload Quota Exceeded', quotaMessage);
                const corsHeaders = createCORSHeaders(request, {
                    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                });
                return new Response(JSON.stringify(rfcError), {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/problem+json',
                        'X-Quota-Limit': quotaCheck.limit.toString(),
                        'X-Quota-Remaining': quotaCheck.remaining.toString(),
                        'X-Quota-Reset': quotaCheck.resetAt,
                        ...Object.fromEntries(corsHeaders.entries()),
                    },
                });
            }
        }

        // Parse multipart form data
        const formData = await request.formData();
        let file = formData.get('file') as File | null;
        
        if (!file) {
            const rfcError = createError(request, 400, 'File Required', 'File is required for version upload');
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
        
        // Remove .encrypted suffix if present to get original filename
        if (originalFileName.endsWith('.encrypted')) {
            originalFileName = originalFileName.slice(0, -10); // Remove '.encrypted'
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

        // SECURITY: Files are already encrypted by the client
        // Store encrypted files in R2 as-is (encryption at rest)
        // Files are decrypted on-the-fly during download
        // Support both binary encryption (v4) and legacy JSON encryption (v3)
        
        // Get shared encryption key for decryption (MANDATORY - all files must be encrypted with shared key)
        const sharedKey = env.MODS_ENCRYPTION_KEY;
        
        if (!sharedKey || sharedKey.length < 32) {
            const rfcError = createError(request, 500, 'Server Configuration Error', 'MODS_ENCRYPTION_KEY is not configured. Please ensure the encryption key is set in the environment.');
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
        
        // Check file format: binary encrypted (v4/v5) or legacy JSON encrypted (v3)
        const fileBuffer = await file.arrayBuffer();
        const fileBytes = new Uint8Array(fileBuffer);
        
        // Check for binary format (version 4 or 5): first byte should be 4 or 5
        const isBinaryEncrypted = fileBytes.length >= 4 && (fileBytes[0] === 4 || fileBytes[0] === 5);
        const isLegacyEncrypted = file.type === 'application/json' || 
                                  (fileBytes.length > 0 && fileBytes[0] === 0x7B); // '{' for JSON
        
        if (!isBinaryEncrypted && !isLegacyEncrypted) {
            const rfcError = createError(request, 400, 'File Must Be Encrypted', 'Files must be encrypted before upload for security. Please ensure the file is encrypted.');
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
        
        // Temporarily decrypt to calculate file hash (for integrity verification)
        let fileHash: string;
        let fileSize: number;
        let encryptionFormat: string;
        
        try {
            if (isBinaryEncrypted) {
                // Binary encrypted format - Shared key encryption is MANDATORY
                let decryptedBytes: Uint8Array;
                try {
                    decryptedBytes = await decryptBinaryWithSharedKey(fileBytes, sharedKey);
                    console.log('[VersionUpload] Binary decryption successful with shared key');
                } catch (decryptError) {
                    const errorMsg = decryptError instanceof Error ? decryptError.message : String(decryptError);
                    throw new Error(`Failed to decrypt file with shared key. All files must be encrypted with the shared encryption key. Error: ${errorMsg}`);
                }
                
                fileSize = decryptedBytes.length;
                fileHash = await calculateStrixunHash(decryptedBytes, env);
                // Determine version from first byte (4 or 5)
                encryptionFormat = fileBytes[0] === 5 ? 'binary-v5' : 'binary-v4';
            } else {
                // Legacy JSON encrypted format - not supported with shared key encryption
                // All new uploads must use binary format
                throw new Error('Legacy JSON encryption format is not supported. Please re-upload the file using the latest client version.');
            }
        } catch (error) {
            console.error('File decryption error during upload:', error);
            const errorMsg = error instanceof Error ? error.message : String(error);
            const rfcError = createError(request, 400, 'Decryption Failed', `Failed to decrypt uploaded file. All files must be encrypted with the shared encryption key. ${errorMsg}`);
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

        // Parse metadata from form data
        const metadataJson = formData.get('metadata') as string | null;
        if (!metadataJson) {
            const rfcError = createError(request, 400, 'Metadata Required', 'Metadata is required for version upload');
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

        const metadata = JSON.parse(metadataJson) as VersionUploadRequest;

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
        const versionId = generateVersionId();
        const now = new Date().toISOString();

        // SECURITY: Store encrypted file in R2 as-is (already encrypted by client)
        // Files are decrypted on-the-fly during download
        // Use normalized modId for R2 key consistency
        // UNIFIED SYSTEM: Support both main mod and variant paths
        // Strip leading dot from fileExtension for R2 key (fileExtension includes the dot from validation)
        const extensionForR2 = fileExtension.startsWith('.') ? fileExtension.substring(1) : fileExtension || 'zip';
        const r2Path = variantId 
            ? `mods/${normalizedModId}/variants/${variantId}/versions/${versionId}.${extensionForR2}`
            : `mods/${normalizedModId}/${versionId}.${extensionForR2}`;
        const r2Key = getCustomerR2Key(auth.customerId, r2Path);
        
        // Store encrypted file data as-is (binary or JSON format)
        let encryptedFileBytes: Uint8Array;
        let contentType: string;
        
        if (isBinaryEncrypted) {
            // Binary encrypted format - store directly
            encryptedFileBytes = fileBytes;
            contentType = 'application/octet-stream';
        } else {
            // Legacy JSON encrypted format
            const encryptedData = await file.text();
            encryptedFileBytes = new TextEncoder().encode(encryptedData);
            contentType = 'application/json';
        }
        
        // Add R2 source metadata to track storage location
        const r2SourceInfo = getR2SourceInfo(env, request);
        console.log('[VersionUpload] R2 storage source:', r2SourceInfo);
        
        await env.MODS_R2.put(r2Key, encryptedFileBytes, {
            httpMetadata: {
                contentType: contentType,
                cacheControl: 'private, no-cache', // Don't cache encrypted files
            },
            customMetadata: addR2SourceMetadata({
                modId,
                versionId,
                ...(variantId && { variantId }), // Add variantId if present
                uploadedBy: auth.customerId,
                uploadedAt: now,
                encrypted: 'true', // Mark as encrypted
                encryptionFormat: encryptionFormat, // 'binary-v4' or 'json-v3'
                originalFileName,
                originalContentType: file.type || 'application/octet-stream', // Use actual file type from upload
                sha256: fileHash, // Hash of decrypted file for verification
            }, env, request),
        });

        // Generate download URL
        const downloadUrl = env.MODS_PUBLIC_URL 
            ? `${env.MODS_PUBLIC_URL}/${r2Key}`
            : `https://pub-${(env.MODS_R2 as any).id}.r2.dev/${r2Key}`;

        // Create version metadata
        // UNIFIED SYSTEM: ModVersion supports both main mod and variant versions via variantId field
        const version: ModVersion = {
            versionId,
            modId,
            variantId: variantId || null, // null for main mod versions, variantId for variant versions
            version: metadata.version,
            changelog: metadata.changelog || '',
            fileSize: fileSize, // Use calculated size from decrypted data
            fileName: originalFileName, // Use original filename (without .encrypted)
            r2Key,
            downloadUrl,
            sha256: fileHash, // Store hash for verification
            createdAt: now,
            downloads: 0,
            gameVersions: metadata.gameVersions || [],
            dependencies: metadata.dependencies || [],
        };

        // Store version in KV (customer scope)
        // UNIFIED SYSTEM: All versions (main mod and variant) stored with same key pattern
        const versionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
        await env.MODS_KV.put(versionKey, JSON.stringify(version));

        // Add version to appropriate version list (customer scope)
        // UNIFIED SYSTEM: Variant versions go to variant-specific list, main mod versions to mod list
        if (variantId) {
            // Variant version: store in variant's version list
            const variantVersionsListKey = getCustomerKey(auth.customerId, `variant_${variantId}_versions`);
            const variantVersionsList = await env.MODS_KV.get(variantVersionsListKey, { type: 'json' }) as string[] | null;
            const updatedVariantVersionsList = [...(variantVersionsList || []), versionId];
            await env.MODS_KV.put(variantVersionsListKey, JSON.stringify(updatedVariantVersionsList));
            
            // NOTE: We do NOT update variant's currentVersionId here
            // This is handled by the calling code (update.ts) which manages mod metadata
            // Separating concerns prevents race conditions and KV synchronization issues
            console.log('[UploadVersion] Variant version created:', {
                variantId,
                versionId,
                note: 'currentVersionId will be updated by caller'
            });
        } else {
            // Main mod version: store in mod's version list
            const versionsListKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}_versions`);
            const versionsList = await env.MODS_KV.get(versionsListKey, { type: 'json' }) as string[] | null;
            const updatedVersionsList = [...(versionsList || []), versionId];
            await env.MODS_KV.put(versionsListKey, JSON.stringify(updatedVersionsList));

            // Update mod's latest version and updatedAt (customer scope)
            mod.latestVersion = metadata.version;
            mod.updatedAt = now;
            await env.MODS_KV.put(modKey, JSON.stringify(mod));
        }

        // Also update in global scope if mod is public
        if (mod.visibility === 'public') {
            const globalModKey = `mod_${normalizedModId}`;
            const globalVersionKey = `version_${versionId}`;
            
            await env.MODS_KV.put(globalVersionKey, JSON.stringify(version));
            
            if (variantId) {
                // Variant version: update global variant list
                const globalVariantVersionsListKey = `variant_${variantId}_versions`;
                const globalVariantVersionsList = await env.MODS_KV.get(globalVariantVersionsListKey, { type: 'json' }) as string[] | null;
                const updatedGlobalVariantVersionsList = [...(globalVariantVersionsList || []), versionId];
                await env.MODS_KV.put(globalVariantVersionsListKey, JSON.stringify(updatedGlobalVariantVersionsList));
            } else {
                // Main mod version: update global mod list
                const globalVersionsListKey = `mod_${normalizedModId}_versions`;
                const globalVersionsList = await env.MODS_KV.get(globalVersionsListKey, { type: 'json' }) as string[] | null;
                const updatedGlobalVersionsList = [...(globalVersionsList || []), versionId];
                await env.MODS_KV.put(globalVersionsListKey, JSON.stringify(updatedGlobalVersionsList));
            }
            
            // Update global mod metadata
            await env.MODS_KV.put(globalModKey, JSON.stringify(mod));
        }

        // Track successful upload (skip for super admins)
        if (!isSuperAdmin) {
            await trackUpload(auth.customerId, env);
        }

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify({ version }), {
            status: 201,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Upload version error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Upload Version',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while uploading the version'
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

