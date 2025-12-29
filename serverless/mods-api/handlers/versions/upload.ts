/**
 * Upload version handler
 * POST /mods/:modId/versions
 * Adds a new version to an existing mod
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { decryptWithJWT } from '@strixun/api-framework';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, getCustomerR2Key, normalizeModId } from '../../utils/customer.js';
import { isEmailAllowed } from '../../utils/auth.js';
import { calculateStrixunHash, formatStrixunHash } from '../../utils/hash.js';
import { MAX_VERSION_FILE_SIZE, validateFileSize } from '../../utils/upload-limits.js';
import { checkUploadQuota, trackUpload } from '../../utils/upload-quota.js';
import { isSuperAdminEmail } from '../../utils/admin.js';
import type { ModMetadata, ModVersion, VersionUploadRequest } from '../../types/mod.js';

/**
 * Generate unique version ID
 */
function generateVersionId(): string {
    return `ver_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Handle upload version request
 */
export async function handleUploadVersion(
    request: Request,
    env: Env,
    modId: string,
    auth: { userId: string; email?: string; customerId: string | null }
): Promise<Response> {
    try {
        // Check email whitelist
        if (!isEmailAllowed(auth.email, env)) {
            const rfcError = createError(request, 403, 'Forbidden', 'Your email address is not authorized to upload mod versions');
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
        if (mod.authorId !== auth.userId) {
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
        const isSuperAdmin = await isSuperAdminEmail(auth.email, env);
        if (!isSuperAdmin) {
            const quotaCheck = await checkUploadQuota(auth.userId, env);
            if (!quotaCheck.allowed) {
                const quotaMessage = quotaCheck.reason === 'daily_quota_exceeded'
                    ? `Daily upload limit exceeded. You have uploaded ${quotaCheck.usage.daily} of ${quotaCheck.quota.maxUploadsPerDay} allowed uploads today.`
                    : `Monthly upload limit exceeded. You have uploaded ${quotaCheck.usage.monthly} of ${quotaCheck.quota.maxUploadsPerMonth} allowed uploads this month.`;
                
                const rfcError = createError(request, 429, 'Upload Quota Exceeded', quotaMessage);
                const corsHeaders = createCORSHeaders(request, {
                    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                });
                return new Response(JSON.stringify(rfcError), {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/problem+json',
                        'X-Quota-Limit-Daily': quotaCheck.quota.maxUploadsPerDay.toString(),
                        'X-Quota-Remaining-Daily': Math.max(0, quotaCheck.quota.maxUploadsPerDay - quotaCheck.usage.daily).toString(),
                        'X-Quota-Limit-Monthly': quotaCheck.quota.maxUploadsPerMonth.toString(),
                        'X-Quota-Remaining-Monthly': Math.max(0, quotaCheck.quota.maxUploadsPerMonth - quotaCheck.usage.monthly).toString(),
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
        
        // Get JWT token for temporary decryption (to calculate hash)
        const jwtToken = request.headers.get('Authorization')?.replace('Bearer ', '') || '';
        if (!jwtToken) {
            const rfcError = createError(request, 401, 'Authentication Required', 'JWT token required for file processing');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 401,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }
        
        // Check file format: binary encrypted (v4) or legacy JSON encrypted (v3)
        const fileBuffer = await file.arrayBuffer();
        const fileBytes = new Uint8Array(fileBuffer);
        
        // Check for binary format (version 4): first byte should be 4
        const isBinaryEncrypted = fileBytes.length >= 4 && fileBytes[0] === 4;
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
                // Binary encrypted format - decrypt directly
                const { decryptBinaryWithJWT } = await import('@strixun/api-framework');
                const decryptedBytes = await decryptBinaryWithJWT(fileBytes, jwtToken);
                fileSize = decryptedBytes.length;
                fileHash = await calculateStrixunHash(decryptedBytes, env);
                encryptionFormat = 'binary-v4';
            } else {
                // Legacy JSON encrypted format
                const encryptedData = await file.text();
                const encryptedJson = JSON.parse(encryptedData);
                
                // Verify it's a valid encrypted structure
                if (!encryptedJson || typeof encryptedJson !== 'object' || !encryptedJson.encrypted) {
                    throw new Error('Invalid encrypted file format');
                }
                
                const decryptedBase64 = await decryptWithJWT(encryptedJson, jwtToken) as string;
                
                // Convert base64 back to binary for hash calculation
                const binaryString = atob(decryptedBase64);
                const fileBytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    fileBytes[i] = binaryString.charCodeAt(i);
                }
                fileSize = fileBytes.length;
                fileHash = await calculateStrixunHash(fileBytes, env);
                encryptionFormat = 'json-v3';
            }
        } catch (error) {
            console.error('File decryption error during upload:', error);
            const rfcError = createError(request, 400, 'Decryption Failed', 'Failed to decrypt uploaded file. Please ensure you are authenticated and the file was encrypted with your token.');
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
        // Strip leading dot from fileExtension for R2 key (fileExtension includes the dot from validation)
        const extensionForR2 = fileExtension.startsWith('.') ? fileExtension.substring(1) : fileExtension || 'zip';
        const r2Key = getCustomerR2Key(auth.customerId, `mods/${normalizedModId}/${versionId}.${extensionForR2}`);
        
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
        
        await env.MODS_R2.put(r2Key, encryptedFileBytes, {
            httpMetadata: {
                contentType: contentType,
                cacheControl: 'private, no-cache', // Don't cache encrypted files
            },
            customMetadata: {
                modId,
                versionId,
                uploadedBy: auth.userId,
                uploadedAt: now,
                encrypted: 'true', // Mark as encrypted
                encryptionFormat: encryptionFormat, // 'binary-v4' or 'json-v3'
                originalFileName,
                originalContentType: 'application/zip', // Original file type
                sha256: fileHash, // Hash of decrypted file for verification
            },
        });

        // Generate download URL
        const downloadUrl = env.MODS_PUBLIC_URL 
            ? `${env.MODS_PUBLIC_URL}/${r2Key}`
            : `https://pub-${(env.MODS_R2 as any).id}.r2.dev/${r2Key}`;

        // Create version metadata
        const version: ModVersion = {
            versionId,
            modId,
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
        const versionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
        await env.MODS_KV.put(versionKey, JSON.stringify(version));

        // Add version to mod's version list (customer scope)
        const versionsListKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}_versions`);
        const versionsList = await env.MODS_KV.get(versionsListKey, { type: 'json' }) as string[] | null;
        const updatedVersionsList = [...(versionsList || []), versionId];
        await env.MODS_KV.put(versionsListKey, JSON.stringify(updatedVersionsList));

        // Update mod's latest version and updatedAt (customer scope)
        mod.latestVersion = metadata.version;
        mod.updatedAt = now;
        await env.MODS_KV.put(modKey, JSON.stringify(mod));

        // Also update in global scope if mod is public
        if (mod.visibility === 'public') {
            const globalModKey = `mod_${normalizedModId}`;
            const globalVersionKey = `version_${versionId}`;
            const globalVersionsListKey = `mod_${normalizedModId}_versions`;
            
            await env.MODS_KV.put(globalVersionKey, JSON.stringify(version));
            
            const globalVersionsList = await env.MODS_KV.get(globalVersionsListKey, { type: 'json' }) as string[] | null;
            const updatedGlobalVersionsList = [...(globalVersionsList || []), versionId];
            await env.MODS_KV.put(globalVersionsListKey, JSON.stringify(updatedGlobalVersionsList));
            
            // Update global mod metadata
            await env.MODS_KV.put(globalModKey, JSON.stringify(mod));
        }

        // Track successful upload (skip for super admins)
        if (!isSuperAdmin) {
            await trackUpload(auth.userId, env);
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

interface Env {
    MODS_KV: KVNamespace;
    MODS_R2: R2Bucket;
    MODS_PUBLIC_URL?: string;
    ALLOWED_EMAILS?: string;
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

