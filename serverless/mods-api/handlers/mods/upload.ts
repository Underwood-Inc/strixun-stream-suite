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
import { hasUploadPermission } from '../../utils/admin.js';
import { calculateFileHash, formatStrixunHash } from '../../utils/hash.js';
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
 * Check if slug already exists
 */
export async function slugExists(slug: string, env: Env, excludeModId?: string): Promise<boolean> {
    // Check in global scope (public mods)
    const globalListKey = 'mods_list_public';
    const globalModsList = await env.MODS_KV.get(globalListKey, { type: 'json' }) as string[] | null;
    
    if (globalModsList) {
        for (const modId of globalModsList) {
            if (excludeModId && modId === excludeModId) continue;
            // Normalize modId for key lookup
            const normalizedListModId = normalizeModId(modId);
            const globalModKey = `mod_${normalizedListModId}`;
            const mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
            if (mod && mod.slug === slug) {
                return true;
            }
        }
    }
    
    // Also check customer scopes for private mods
    // Note: This is a simplified check. In production, you'd want a slug index in KV
    // For now, we check all customer lists (this could be expensive at scale)
    // TODO: Implement slug index for better performance
    
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

        // SECURITY: Files are already encrypted by the client
        // Store encrypted files in R2 as-is (encryption at rest)
        // Files are decrypted on-the-fly during download
        const isEncrypted = file.name.endsWith('.encrypted') || file.type === 'application/json';
        let originalFileName = file.name;
        
        if (!isEncrypted) {
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
        
        // Remove .encrypted suffix if present to get original filename
        if (originalFileName.endsWith('.encrypted')) {
            originalFileName = originalFileName.slice(0, -10); // Remove '.encrypted'
        }
        
        // Get encrypted file data (already encrypted by client - store as-is)
        let encryptedData: string;
        let encryptedJson: any;
        try {
            encryptedData = await file.text();
            encryptedJson = JSON.parse(encryptedData);
            
            // Verify it's a valid encrypted structure
            if (!encryptedJson || typeof encryptedJson !== 'object' || !encryptedJson.encrypted) {
                throw new Error('Invalid encrypted file format');
            }
        } catch (error) {
            console.error('Encrypted file validation error:', error);
            const rfcError = createError(request, 400, 'Invalid Encrypted File', 'The uploaded file does not appear to be properly encrypted. Please ensure the file is encrypted before upload.');
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
        
        // Temporarily decrypt to calculate file hash (for integrity verification)
        let fileHash: string;
        let fileSize: number;
        try {
            const decryptedBase64 = await decryptWithJWT(encryptedJson, jwtToken) as string;
            
            // Convert base64 back to binary for hash calculation
            const binaryString = atob(decryptedBase64);
            const fileBytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                fileBytes[i] = binaryString.charCodeAt(i);
            }
            fileSize = fileBytes.length;
            
            // Calculate hash from decrypted data
            fileHash = await calculateFileHash(fileBytes);
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
        const slug = await generateUniqueSlug(metadata.title, env);

        // SECURITY: Store encrypted file in R2 as-is (already encrypted by client)
        // Files are decrypted on-the-fly during download
        const fileExtension = originalFileName.split('.').pop() || 'zip';
        // Use normalized modId for R2 key consistency
        const normalizedModId = normalizeModId(modId);
        const r2Key = getCustomerR2Key(auth.customerId, `mods/${normalizedModId}/${versionId}.${fileExtension}`);
        
        // Store encrypted file data as-is (the original encrypted JSON from client)
        const encryptedFileBytes = new TextEncoder().encode(encryptedData);
        await env.MODS_R2.put(r2Key, encryptedFileBytes, {
            httpMetadata: {
                contentType: 'application/json', // Stored as encrypted JSON
                cacheControl: 'private, no-cache', // Don't cache encrypted files
            },
            customMetadata: {
                modId,
                versionId,
                uploadedBy: auth.userId,
                uploadedAt: now,
                encrypted: 'true', // Mark as encrypted
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

        // Create mod metadata with initial status
        const mod: ModMetadata = {
            modId,
            slug,
            authorId: auth.userId,
            authorEmail: auth.email || '',
            title: metadata.title,
            description: metadata.description || '',
            category: metadata.category,
            tags: metadata.tags || [],
            thumbnailUrl: metadata.thumbnail ? await handleThumbnailUpload(metadata.thumbnail, modId, env, auth.customerId) : undefined,
            createdAt: now,
            updatedAt: now,
            latestVersion: metadata.version,
            downloadCount: 0,
            visibility: metadata.visibility || 'public',
            featured: false,
            customerId: auth.customerId,
            status: 'pending', // New mods start as pending review
            statusHistory: [{
                status: 'pending',
                changedBy: auth.userId,
                changedByEmail: auth.email,
                changedAt: now,
            }],
            reviewComments: [],
        };

        // Store in KV
        // Use normalized modId (already computed above) to ensure consistent key generation
        const modKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
        const versionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
        const versionsListKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}_versions`);
        const modsListKey = getCustomerKey(auth.customerId, 'mods_list');

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
 * Handle thumbnail upload (base64 to R2)
 * Validates image format and ensures it's renderable
 */
async function handleThumbnailUpload(
    base64Data: string,
    modId: string,
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
        const r2Key = getCustomerR2Key(customerId, `thumbnails/${modId}.${normalizedType}`);
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
        // Get the mod to get its slug
        // Use normalized modId for key lookup
        const normalizedModId = normalizeModId(modId);
        const modKey = `mod_${normalizedModId}`;
        const mod = await env.MODS_KV.get(modKey, { type: 'json' }) as ModMetadata | null;
        const slug = mod?.slug || modId; // Fallback to modId if mod not found yet
        const API_BASE_URL = 'https://mods-api.idling.app';
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

