/**
 * Upload mod handler
 * POST /mods
 * Creates a new mod with initial version
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { decryptWithJWT } from '@strixun/api-framework';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, getCustomerR2Key, normalizeModId } from '../../utils/customer.js';
import { isEmailAllowed } from '../../utils/auth.js';
import { hasUploadPermission, isSuperAdminEmail } from '../../utils/admin.js';
import { calculateStrixunHash, formatStrixunHash } from '../../utils/hash.js';
import { MAX_MOD_FILE_SIZE, MAX_THUMBNAIL_SIZE, validateFileSize } from '../../utils/upload-limits.js';
import { checkUploadQuota, trackUpload } from '../../utils/upload-quota.js';
import type { ModMetadata, ModVersion, ModUploadRequest } from '../../types/mod.js';

/**
 * Generate URL-friendly slug from title
 */
export function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Check if slug already exists - searches ALL scopes (global + all customer scopes)
 * CRITICAL: Slugs must be globally unique across all scopes
 */
export async function slugExists(slug: string, env: Env, excludeModId?: string): Promise<boolean> {
    // Check in global scope (public mods)
    const globalListKey = 'mods_list_public';
    const globalModsList = await env.MODS_KV.get(globalListKey, { type: 'json' }) as string[] | null;
    
    if (globalModsList) {
        for (const modId of globalModsList) {
            if (excludeModId) {
                const normalizedExclude = normalizeModId(excludeModId);
                const normalizedList = normalizeModId(modId);
                if (normalizedExclude === normalizedList) continue;
            }
            // Normalize modId for key lookup
            const normalizedListModId = normalizeModId(modId);
            const globalModKey = `mod_${normalizedListModId}`;
            const mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
            if (mod && mod.slug === slug) {
                return true;
            }
        }
    }
    
    // CRITICAL: Search ALL customer scopes to ensure global uniqueness
    const customerListPrefix = 'customer_';
    let cursor: string | undefined;
    
    do {
        const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor });
        
        for (const key of listResult.keys) {
            // Look for customer mod lists: customer_{id}_mods_list
            if (key.name.endsWith('_mods_list')) {
                const customerModsList = await env.MODS_KV.get(key.name, { type: 'json' }) as string[] | null;
                
                if (customerModsList) {
                    for (const modId of customerModsList) {
                        if (excludeModId) {
                            const normalizedExclude = normalizeModId(excludeModId);
                            const normalizedList = normalizeModId(modId);
                            if (normalizedExclude === normalizedList) continue;
                        }
                        
                        const normalizedModId = normalizeModId(modId);
                        const match = key.name.match(/^customer_([^_/]+)[_/]mods_list$/);
                        const customerId = match ? match[1] : null;
                        
                        if (customerId) {
                            const customerModKey = getCustomerKey(customerId, `mod_${normalizedModId}`);
                            const mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                            
                            if (mod && mod.slug === slug) {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        
        cursor = listResult.listComplete ? undefined : listResult.cursor;
    } while (cursor);
    
    return false;
}

/**
 * Generate unique slug with conflict resolution
 */
export async function generateUniqueSlug(title: string, env: Env, excludeModId?: string): Promise<string> {
    let baseSlug = generateSlug(title);
    if (!baseSlug) {
        baseSlug = 'untitled-mod';
    }
    
    let slug = baseSlug;
    let counter = 1;
    
    // Check for conflicts and append number if needed
    while (await slugExists(slug, env, excludeModId)) {
        slug = `${baseSlug}-${counter}`;
        counter++;
    }
    
    return slug;
}

/**
 * Generate unique mod ID
 */
function generateModId(): string {
    return `mod_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Generate unique version ID
 */
function generateVersionId(): string {
    return `ver_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Handle upload mod request
 */
export async function handleUploadMod(
    request: Request,
    env: Env,
    auth: { userId: string; email?: string; customerId: string | null }
): Promise<Response> {
    try {
        // Check upload permission (super admins or approved users)
        const hasPermission = await hasUploadPermission(auth.userId, auth.email, env);
        if (!hasPermission) {
            const rfcError = createError(request, 403, 'Upload Permission Required', 'You do not have permission to upload mods. Please request approval from an administrator.');
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
            const rfcError = createError(request, 400, 'File Required', 'File is required for mod upload');
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
        const sizeValidation = validateFileSize(file.size, MAX_MOD_FILE_SIZE);
        if (!sizeValidation.valid) {
            const rfcError = createError(
                request,
                413,
                'File Too Large',
                sizeValidation.error || `File size exceeds maximum allowed size of ${MAX_MOD_FILE_SIZE / (1024 * 1024)}MB`
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
        // CRITICAL: Try service key first (for public mods), then JWT (for private mods)
        let fileHash: string;
        let fileSize: number;
        let encryptionFormat: string;
        
        try {
            if (isBinaryEncrypted) {
                // Binary encrypted format - try service key first, then JWT
                const { decryptBinaryWithServiceKey, decryptBinaryWithJWT } = await import('@strixun/api-framework');
                let decryptedBytes: Uint8Array;
                let decryptionAttempted = false;
                
                // Try service key decryption first (for public mods)
                const serviceKey = env.SERVICE_ENCRYPTION_KEY;
                if (serviceKey && serviceKey.length >= 32) {
                    try {
                        decryptedBytes = await decryptBinaryWithServiceKey(fileBytes, serviceKey);
                        decryptionAttempted = true;
                        console.log('[Upload] Binary decryption successful with service key');
                    } catch (serviceKeyError) {
                        // Service key decryption failed - try JWT as fallback (for private mods)
                        console.log('[Upload] Service key decryption failed, trying JWT fallback:', serviceKeyError instanceof Error ? serviceKeyError.message : String(serviceKeyError));
                    }
                }
                
                // Try JWT decryption if service key didn't work (for private mods)
                if (!decryptionAttempted) {
                    if (!jwtToken) {
                        throw new Error('JWT token required for private mod decryption');
                    }
                    decryptedBytes = await decryptBinaryWithJWT(fileBytes, jwtToken);
                    decryptionAttempted = true;
                    console.log('[Upload] Binary decryption successful with JWT');
                }
                
                if (!decryptionAttempted) {
                    throw new Error('Failed to decrypt file - neither service key nor JWT worked');
                }
                
                fileSize = decryptedBytes.length;
                fileHash = await calculateStrixunHash(decryptedBytes, env);
                // Determine version from first byte (4 or 5)
                encryptionFormat = fileBytes[0] === 5 ? 'binary-v5' : 'binary-v4';
            } else {
                // Legacy JSON encrypted format - try service key first, then JWT
                const encryptedData = await file.text();
                const encryptedJson = JSON.parse(encryptedData);
                
                // Verify it's a valid encrypted structure
                if (!encryptedJson || typeof encryptedJson !== 'object' || !encryptedJson.encrypted) {
                    throw new Error('Invalid encrypted file format');
                }
                
                const { decryptWithServiceKey, decryptWithJWT } = await import('@strixun/api-framework');
                let decryptedBase64: string;
                let decryptionAttempted = false;
                
                // Try service key decryption first (for public mods)
                const serviceKey = env.SERVICE_ENCRYPTION_KEY;
                if (serviceKey && serviceKey.length >= 32) {
                    try {
                        decryptedBase64 = await decryptWithServiceKey(encryptedJson, serviceKey) as string;
                        decryptionAttempted = true;
                        console.log('[Upload] JSON decryption successful with service key');
                    } catch (serviceKeyError) {
                        // Service key decryption failed - try JWT as fallback (for private mods)
                        console.log('[Upload] Service key decryption failed, trying JWT fallback:', serviceKeyError instanceof Error ? serviceKeyError.message : String(serviceKeyError));
                    }
                }
                
                // Try JWT decryption if service key didn't work (for private mods)
                if (!decryptionAttempted) {
                    if (!jwtToken) {
                        throw new Error('JWT token required for private mod decryption');
                    }
                    decryptedBase64 = await decryptWithJWT(encryptedJson, jwtToken) as string;
                    decryptionAttempted = true;
                    console.log('[Upload] JSON decryption successful with JWT');
                }
                
                if (!decryptionAttempted) {
                    throw new Error('Failed to decrypt file - neither service key nor JWT worked');
                }
                
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
            const rfcError = createError(request, 400, 'Decryption Failed', 'Failed to decrypt uploaded file. Please ensure the file was encrypted with either the service key (for public mods) or your JWT token (for private mods).');
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
            const rfcError = createError(request, 400, 'Metadata Required', 'Metadata is required for mod upload');
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

        const metadata = JSON.parse(metadataJson) as ModUploadRequest;

        // Validate required fields
        if (!metadata.title || !metadata.version || !metadata.category) {
            const rfcError = createError(request, 400, 'Validation Error', 'Title, version, and category are required');
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

        // Generate IDs
        const modId = generateModId();
        const versionId = generateVersionId();
        const now = new Date().toISOString();

        // Generate unique slug
        // CRITICAL: Check if slug/title already exists - REJECT duplicates, don't auto-increment
        const baseSlug = generateSlug(metadata.title);
        if (!baseSlug) {
            const rfcError = createError(request, 400, 'Invalid Title', 'Title must contain valid characters for slug generation');
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
        
        // Check if slug already exists - reject if it does
        if (await slugExists(baseSlug, env)) {
            const rfcError = createError(request, 409, 'Slug Already Exists', `A mod with the title "${metadata.title}" (slug: "${baseSlug}") already exists. Please choose a different title.`);
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 409,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }
        
        const slug = baseSlug; // Use the base slug - no auto-incrementing

        // SECURITY: Store encrypted file in R2 as-is (already encrypted by client)
        // Files are decrypted on-the-fly during download
        // Get extension without dot for R2 key (fileExtension already includes the dot)
        const extensionForR2 = fileExtension ? fileExtension.substring(1) : 'zip';
        // Use normalized modId for R2 key consistency
        const normalizedModId = normalizeModId(modId);
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

        // Upload thumbnail first (before creating mod metadata) so we can use the slug
        // Support both binary file upload (preferred) and legacy base64
        const thumbnailFile = formData.get('thumbnail') as File | null;
        let thumbnailUrl: string | undefined;
        let thumbnailExtension: string | undefined;
        
        if (thumbnailFile) {
            // Binary file upload (optimized - no base64 overhead)
            thumbnailUrl = await handleThumbnailBinaryUpload(thumbnailFile, modId, slug, request, env, auth.customerId);
            // CRITICAL FIX: Extract extension from file type for faster lookup
            const imageType = thumbnailFile.type.split('/')[1]?.toLowerCase();
            thumbnailExtension = imageType === 'jpeg' ? 'jpg' : imageType; // Normalize jpeg to jpg
        } else if (metadata.thumbnail) {
            // Legacy base64 upload (backward compatibility)
            thumbnailUrl = await handleThumbnailUpload(metadata.thumbnail, modId, slug, request, env, auth.customerId);
            // CRITICAL FIX: Extract extension from base64 data URL for faster lookup
            const matches = metadata.thumbnail.match(/^data:image\/(\w+);base64,/);
            if (matches) {
                const imageType = matches[1]?.toLowerCase();
                thumbnailExtension = imageType === 'jpeg' ? 'jpg' : imageType; // Normalize jpeg to jpg
            }
        }

        // Fetch author display name from auth API during upload
        // CRITICAL FIX: Make this synchronous - wait for result before storing mod
        // This prevents "Unknown User" from being stored if fetch fails
        // NOTE: /auth/me returns encrypted responses that need to be decrypted
        // Includes timeout handling and retry logic with exponential backoff
        let authorDisplayName: string | null = null;
        const authHeader = request.headers.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const authApiUrl = env.AUTH_API_URL || 'https://auth.idling.app';
            const url = `${authApiUrl}/auth/me`;
            const timeoutMs = 10000; // Increased to 10 second timeout
            const maxAttempts = 3; // Increased retry attempts
            
            // Retry logic with exponential backoff: try up to 3 times
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                try {
                    // Create AbortController for timeout
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
                    
                    try {
                        const response = await fetch(url, {
                            method: 'GET',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json',
                            },
                            // CRITICAL: Prevent caching of service-to-service API calls
                            // Even server-side calls should not be cached to ensure fresh data
                            cache: 'no-store',
                            signal: controller.signal,
                        });
                        
                        clearTimeout(timeoutId);
                        
                        if (response.ok) {
                            const responseData = await response.json();
                            
                            // Check if response is encrypted (has X-Encrypted header or encrypted field)
                            const isEncrypted = response.headers.get('X-Encrypted') === 'true' || 
                                               (typeof responseData === 'object' && responseData && 'encrypted' in responseData);
                            
                            let userData: { displayName?: string | null; [key: string]: any };
                            if (isEncrypted) {
                                // Decrypt the response using JWT token
                                const { decryptWithJWT } = await import('@strixun/api-framework');
                                userData = await decryptWithJWT(responseData, token) as { displayName?: string | null; [key: string]: any };
                            } else {
                                userData = responseData;
                            }
                            
                            authorDisplayName = userData?.displayName || null;
                            console.log('[Upload] Fetched authorDisplayName:', { 
                                authorDisplayName, 
                                hasDisplayName: !!authorDisplayName,
                                userId: auth.userId,
                                userDataKeys: userData ? Object.keys(userData) : [],
                                attempt: attempt + 1
                            });
                            break; // Success, exit retry loop
                            } else if (response.status === 522 || response.status === 504) {
                            // Gateway timeout - retry with exponential backoff
                            if (attempt < maxAttempts - 1) {
                                const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff: 1s, 2s, 4s (max 5s)
                                console.warn('[Upload] /auth/me gateway timeout, will retry:', { 
                                    status: response.status, 
                                    userId: auth.userId,
                                    attempt: attempt + 1,
                                    maxAttempts,
                                    backoffMs
                                });
                                await new Promise(resolve => setTimeout(resolve, backoffMs));
                                continue; // Retry
                            } else {
                                const errorText = await response.text().catch(() => 'Unable to read error');
                                console.error('[Upload] /auth/me gateway timeout after all retries:', { 
                                    status: response.status, 
                                    statusText: response.statusText,
                                    error: errorText,
                                    userId: auth.userId,
                                    attempts: maxAttempts
                                });
                                break; // Give up after all retries
                            }
                        } else {
                            const errorText = await response.text().catch(() => 'Unable to read error');
                            console.warn('[Upload] /auth/me returned non-200 status:', { 
                                status: response.status, 
                                statusText: response.statusText,
                                error: errorText,
                                userId: auth.userId,
                                attempt: attempt + 1
                            });
                            break; // Don't retry on non-timeout errors
                        }
                    } catch (fetchError) {
                        clearTimeout(timeoutId);
                        
                        // Check if it's an abort (timeout)
                        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                            if (attempt < maxAttempts - 1) {
                                const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff
                                console.warn('[Upload] /auth/me request timeout, will retry:', { 
                                    timeoutMs, 
                                    userId: auth.userId,
                                    attempt: attempt + 1,
                                    maxAttempts,
                                    backoffMs
                                });
                                await new Promise(resolve => setTimeout(resolve, backoffMs));
                                continue; // Retry
                            } else {
                                console.error('[Upload] /auth/me request timeout after all retries:', { 
                                    timeoutMs, 
                                    userId: auth.userId,
                                    attempts: maxAttempts
                                });
                                break; // Give up after all retries
                            }
                        }
                        throw fetchError; // Re-throw other errors
                    }
                } catch (error) {
                    // Network errors or other issues
                    if (attempt < maxAttempts - 1) {
                        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000); // Exponential backoff
                        console.warn('[Upload] Failed to fetch displayName from auth service, will retry:', { 
                            error: error instanceof Error ? error.message : String(error),
                            userId: auth.userId,
                            attempt: attempt + 1,
                            maxAttempts,
                            backoffMs
                        });
                        await new Promise(resolve => setTimeout(resolve, backoffMs));
                        continue; // Retry
                    } else {
                        console.error('[Upload] Failed to fetch displayName from auth service after all retries:', { 
                            error: error instanceof Error ? error.message : String(error),
                            userId: auth.userId,
                            attempts: maxAttempts
                        });
                        break; // Give up after all retries
                    }
                }
            }
        } else {
            console.warn('[Upload] No Authorization header found for displayName fetch');
        }
        
        // CRITICAL FIX: Log if displayName is still null after all retries
        // This helps identify persistent issues with auth API
        if (!authorDisplayName) {
            console.warn('[Upload] authorDisplayName is null after all fetch attempts:', {
                userId: auth.userId,
                customerId: auth.customerId,
                note: 'UI will show "Unknown User" - detail handler will attempt to fetch again'
            });
        }
        
        // CRITICAL: Never use authorEmail as fallback - email is ONLY for authentication
        // If displayName is null, UI will show "Unknown User"
        // Note: For previously uploaded mods with null displayName, the detail handler will attempt to fetch it

        // CRITICAL FIX: Validate customerId is present before storing mod
        // This ensures proper data scoping and prevents lookup issues
        if (!auth.customerId) {
            console.error('[Upload] CRITICAL: customerId is null for authenticated user:', {
                userId: auth.userId,
                email: auth.email,
                note: 'This will cause data scoping issues'
            });
            // Still allow upload but log the issue - customerId may be null for some auth flows
        }
        
        // Create mod metadata with initial status
        // CRITICAL: Never store email - email is ONLY for OTP authentication
        const mod: ModMetadata = {
            modId,
            slug,
            authorId: auth.userId, // userId from OTP auth service
            authorDisplayName, // Display name fetched from /auth/me (never use email)
            title: metadata.title,
            description: metadata.description || '',
            category: metadata.category,
            tags: metadata.tags || [],
            thumbnailUrl,
            thumbnailExtension, // Store extension for faster lookup
            createdAt: now,
            updatedAt: now,
            latestVersion: metadata.version,
            downloadCount: 0,
            visibility: metadata.visibility || 'public',
            featured: false,
            customerId: auth.customerId, // Customer ID for data scoping
            status: 'pending', // New mods start as pending review
            statusHistory: [{
                status: 'pending',
                changedBy: auth.userId,
                changedByDisplayName: authorDisplayName, // Use displayName, never email
                changedAt: now,
            }],
            reviewComments: [],
        };

        // Store in KV
        // Use normalized modId (already computed above) to ensure consistent key generation
        // CRITICAL FIX: Log customerId association for debugging
        const modKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
        const versionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
        const versionsListKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}_versions`);
        const modsListKey = getCustomerKey(auth.customerId, 'mods_list');
        
        console.log('[Upload] Storing mod with customerId association:', {
            modId,
            normalizedModId,
            customerId: auth.customerId,
            modKey,
            versionKey,
            versionsListKey,
            modsListKey,
            authorId: auth.userId,
            authorDisplayName
        });

        // Store mod and version in customer scope
        await env.MODS_KV.put(modKey, JSON.stringify(mod));
        await env.MODS_KV.put(versionKey, JSON.stringify(version));

        // NOTE: Do NOT store in global scope yet - mods start as 'pending' status
        // They will only be stored in global scope when an admin changes status to 'published'
        // This ensures pending mods are not visible to the public, even if visibility is 'public'

        // Add version to mod's version list
        const versionsList = await env.MODS_KV.get(versionsListKey, { type: 'json' }) as string[] | null;
        const updatedVersionsList = [...(versionsList || []), versionId];
        await env.MODS_KV.put(versionsListKey, JSON.stringify(updatedVersionsList));

        // Add mod to customer-specific list (for management)
        const modsList = await env.MODS_KV.get(modsListKey, { type: 'json' }) as string[] | null;
        const updatedModsList = [...(modsList || []), modId];
        await env.MODS_KV.put(modsListKey, JSON.stringify(updatedModsList));

        // NOTE: Do NOT add to global public list yet - mods start as 'pending' status
        // They will only be added to the public list when an admin changes status to 'published'
        // This ensures pending mods are not visible to the public, even if visibility is 'public'

        // Track successful upload (skip for super admins)
        if (!isSuperAdmin) {
            await trackUpload(auth.userId, env);
        }

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify({
            mod,
            version
        }), {
            status: 201,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Upload mod error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Upload Mod',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while uploading the mod'
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

/**
 * Get image extension from MIME type
 */
function getImageExtension(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
    };
    return mimeToExt[mimeType.toLowerCase()] || 'png';
}

/**
 * Handle thumbnail upload (binary file to R2)
 * Validates image format and ensures it's renderable
 * Optimized version - no base64 overhead
 */
async function handleThumbnailBinaryUpload(
    thumbnailFile: File,
    modId: string,
    slug: string,
    request: Request,
    env: Env,
    customerId: string | null
): Promise<string> {
    try {
        // Validate file type
        if (!thumbnailFile.type.startsWith('image/')) {
            throw new Error('File must be an image');
        }
        
        // Check file size
        const thumbnailSizeValidation = validateFileSize(thumbnailFile.size, MAX_THUMBNAIL_SIZE);
        if (!thumbnailSizeValidation.valid) {
            throw new Error(thumbnailSizeValidation.error || `Thumbnail file size must be less than ${MAX_THUMBNAIL_SIZE / (1024 * 1024)}MB`);
        }
        
        // Validate image type (only allow common web-safe formats)
        const allowedTypes = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
        const imageType = thumbnailFile.type.split('/')[1]?.toLowerCase();
        if (!imageType || !allowedTypes.includes(imageType)) {
            throw new Error(`Unsupported image type: ${imageType}. Allowed types: ${allowedTypes.join(', ')}`);
        }
        
        // Read file as binary
        const imageBuffer = new Uint8Array(await thumbnailFile.arrayBuffer());
        
        // Basic validation: Check minimum file size (at least 100 bytes)
        if (imageBuffer.length < 100) {
            throw new Error('Image file is too small or corrupted');
        }
        
        // Validate image headers for common formats
        // JPEG: FF D8 FF
        // PNG: 89 50 4E 47
        // GIF: 47 49 46 38
        // WebP: 52 49 46 46 (RIFF) followed by WEBP
        const isValidImage = 
            (imageType === 'jpeg' || imageType === 'jpg') && imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8 && imageBuffer[2] === 0xFF ||
            imageType === 'png' && imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4E && imageBuffer[3] === 0x47 ||
            imageType === 'gif' && imageBuffer[0] === 0x47 && imageBuffer[1] === 0x49 && imageBuffer[2] === 0x46 && imageBuffer[3] === 0x38 ||
            imageType === 'webp' && imageBuffer[0] === 0x52 && imageBuffer[1] === 0x49 && imageBuffer[2] === 0x46 && imageBuffer[3] === 0x46;
        
        if (!isValidImage) {
            throw new Error(`Invalid ${imageType} image format - file may be corrupted or not a valid image`);
        }
        
        // Upload to R2
        const normalizedModId = normalizeModId(modId);
        const extension = getImageExtension(thumbnailFile.type);
        const r2Key = getCustomerR2Key(customerId, `thumbnails/${normalizedModId}.${extension}`);
        await env.MODS_R2.put(r2Key, imageBuffer, {
            httpMetadata: {
                contentType: thumbnailFile.type,
                cacheControl: 'public, max-age=31536000',
            },
            customMetadata: {
                modId,
                extension: extension,
                validated: 'true', // Mark as validated for rendering
            },
        });
        
        // CRITICAL FIX: Store extension in mod metadata for faster lookup
        // This avoids trying multiple extensions during retrieval
        console.log('[Upload] Thumbnail uploaded with extension:', { modId, extension, r2Key });
        
        // Return API proxy URL using slug for consistency
        const requestUrl = new URL(request.url);
        const API_BASE_URL = requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1'
            ? `${requestUrl.protocol}//${requestUrl.hostname}:${requestUrl.port || '8787'}`  // Local dev
            : `https://mods-api.idling.app`;  // Production
        return `${API_BASE_URL}/mods/${slug}/thumbnail`;
    } catch (error) {
        console.error('Thumbnail binary upload error:', error);
        throw error;
    }
}

/**
 * Handle thumbnail upload (base64 to R2) - Legacy support
 * Validates image format and ensures it's renderable
 */
async function handleThumbnailUpload(
    base64Data: string,
    modId: string,
    slug: string,
    request: Request,
    env: Env,
    customerId: string | null
): Promise<string> {
    try {
        // Parse base64 data URL
        const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) {
            throw new Error('Invalid base64 image data');
        }

        const [, imageType, base64Content] = matches;
        
        // Validate image type (only allow common web-safe formats)
        const allowedTypes = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
        const normalizedType = imageType.toLowerCase();
        if (!allowedTypes.includes(normalizedType)) {
            throw new Error(`Unsupported image type: ${imageType}. Allowed types: ${allowedTypes.join(', ')}`);
        }

        // Decode base64 to binary
        const imageBuffer = Uint8Array.from(atob(base64Content), c => c.charCodeAt(0));
        
        // Basic validation: Check minimum file size (at least 100 bytes)
        if (imageBuffer.length < 100) {
            throw new Error('Image file is too small or corrupted');
        }

        // Validate image headers for common formats
        // JPEG: FF D8 FF
        // PNG: 89 50 4E 47
        // GIF: 47 49 46 38
        // WebP: 52 49 46 46 (RIFF) followed by WEBP
        const isValidImage = 
            (normalizedType === 'jpeg' || normalizedType === 'jpg') && imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8 && imageBuffer[2] === 0xFF ||
            normalizedType === 'png' && imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4E && imageBuffer[3] === 0x47 ||
            normalizedType === 'gif' && imageBuffer[0] === 0x47 && imageBuffer[1] === 0x49 && imageBuffer[2] === 0x46 && imageBuffer[3] === 0x38 ||
            normalizedType === 'webp' && imageBuffer[0] === 0x52 && imageBuffer[1] === 0x49 && imageBuffer[2] === 0x46 && imageBuffer[3] === 0x46;

        if (!isValidImage) {
            throw new Error(`Invalid ${imageType} image format - file may be corrupted or not a valid image`);
        }

        // Upload to R2
        // Normalize modId to ensure consistent storage (strip mod_ prefix if present)
        const normalizedModId = normalizeModId(modId);
        const r2Key = getCustomerR2Key(customerId, `thumbnails/${normalizedModId}.${normalizedType}`);
        await env.MODS_R2.put(r2Key, imageBuffer, {
            httpMetadata: {
                contentType: `image/${normalizedType}`,
                cacheControl: 'public, max-age=31536000',
            },
            customMetadata: {
                modId,
                extension: normalizedType, // Store extension for easy retrieval
                validated: 'true', // Mark as validated for rendering
            },
        });

        // Return API proxy URL using slug for consistency (thumbnails should be served through API, not direct R2)
        // Slug is passed as parameter to avoid race condition (mod not stored yet)
        // Use request URL to determine base URL dynamically
        const requestUrl = new URL(request.url);
        const API_BASE_URL = requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1'
            ? `${requestUrl.protocol}//${requestUrl.hostname}:${requestUrl.port || '8787'}`  // Local dev
            : `https://mods-api.idling.app`;  // Production
        return `${API_BASE_URL}/mods/${slug}/thumbnail`;
    } catch (error) {
        console.error('Thumbnail upload error:', error);
        throw error;
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

