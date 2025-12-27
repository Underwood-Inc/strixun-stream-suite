/**
 * Upload mod handler
 * POST /mods
 * Creates a new mod with initial version
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { decryptWithJWT } from '@strixun/api-framework';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, getCustomerR2Key } from '../../utils/customer.js';
import { isEmailAllowed } from '../../utils/auth.js';
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
            const globalModKey = `mod_${modId}`;
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
        // Check email whitelist
        if (!isEmailAllowed(auth.email, env)) {
            const rfcError = createError(request, 403, 'Forbidden', 'Your email address is not authorized to upload mods');
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

        // Check if file is encrypted (has .encrypted suffix or is JSON)
        const isEncrypted = file.name.endsWith('.encrypted') || file.type === 'application/json';
        let originalFileName = file.name;
        
        if (isEncrypted) {
            // Remove .encrypted suffix if present
            if (originalFileName.endsWith('.encrypted')) {
                originalFileName = originalFileName.slice(0, -10); // Remove '.encrypted'
            }
            
            // Decrypt the file
            try {
                const encryptedData = await file.text();
                const encryptedJson = JSON.parse(encryptedData);
                const jwtToken = request.headers.get('Authorization')?.replace('Bearer ', '') || '';
                
                if (!jwtToken) {
                    throw new Error('JWT token required for file decryption');
                }
                
                // Decrypt the base64 file data
                const decryptedBase64 = await decryptWithJWT(encryptedJson, jwtToken) as string;
                
                // Convert base64 back to binary (exact reverse of client's btoa conversion)
                // This ensures the file is fully intact - no data loss or corruption
                const binaryString = atob(decryptedBase64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                
                // Create new File object with decrypted data and original filename
                // The file is now identical to the original uploaded file
                file = new File([bytes], originalFileName, { type: 'application/zip' });
            } catch (error) {
                console.error('File decryption error:', error);
                const rfcError = createError(request, 400, 'Decryption Failed', 'Failed to decrypt uploaded file. Please ensure you are authenticated.');
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

        // Upload file to R2
        const fileExtension = file.name.split('.').pop() || 'zip';
        const r2Key = getCustomerR2Key(auth.customerId, `mods/${modId}/${versionId}.${fileExtension}`);
        
        await env.MODS_R2.put(r2Key, file.stream(), {
            httpMetadata: {
                contentType: file.type || 'application/zip',
                cacheControl: 'public, max-age=31536000',
            },
            customMetadata: {
                modId,
                versionId,
                uploadedBy: auth.userId,
                uploadedAt: now,
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
            fileSize: file.size,
            fileName: file.name,
            r2Key,
            downloadUrl,
            createdAt: now,
            downloads: 0,
            gameVersions: metadata.gameVersions || [],
            dependencies: metadata.dependencies || [],
        };

        // Create mod metadata
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
        };

        // Store in KV
        const modKey = getCustomerKey(auth.customerId, `mod_${modId}`);
        const versionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
        const versionsListKey = getCustomerKey(auth.customerId, `mod_${modId}_versions`);
        const modsListKey = getCustomerKey(auth.customerId, 'mods_list');

        // Store mod and version in customer scope
        await env.MODS_KV.put(modKey, JSON.stringify(mod));
        await env.MODS_KV.put(versionKey, JSON.stringify(version));

        // Also store in global scope if public (for public browsing)
        if (mod.visibility === 'public') {
            const globalModKey = `mod_${modId}`;
            const globalVersionKey = `version_${versionId}`;
            const globalVersionsListKey = `mod_${modId}_versions`;
            
            await env.MODS_KV.put(globalModKey, JSON.stringify(mod));
            await env.MODS_KV.put(globalVersionKey, JSON.stringify(version));
            
            // Add version to global versions list
            const globalVersionsList = await env.MODS_KV.get(globalVersionsListKey, { type: 'json' }) as string[] | null;
            const updatedGlobalVersionsList = [...(globalVersionsList || []), versionId];
            await env.MODS_KV.put(globalVersionsListKey, JSON.stringify(updatedGlobalVersionsList));
        }

        // Add version to mod's version list
        const versionsList = await env.MODS_KV.get(versionsListKey, { type: 'json' }) as string[] | null;
        const updatedVersionsList = [...(versionsList || []), versionId];
        await env.MODS_KV.put(versionsListKey, JSON.stringify(updatedVersionsList));

        // Add mod to customer-specific list (for management)
        const modsList = await env.MODS_KV.get(modsListKey, { type: 'json' }) as string[] | null;
        const updatedModsList = [...(modsList || []), modId];
        await env.MODS_KV.put(modsListKey, JSON.stringify(updatedModsList));

        // Add mod to global public list if visibility is public
        if (mod.visibility === 'public') {
            const globalListKey = 'mods_list_public';
            const globalModsList = await env.MODS_KV.get(globalListKey, { type: 'json' }) as string[] | null;
            const updatedGlobalList = [...(globalModsList || []), modId];
            await env.MODS_KV.put(globalListKey, JSON.stringify(updatedGlobalList));
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
 * Handle thumbnail upload (base64 to R2)
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
        const imageBuffer = Uint8Array.from(atob(base64Content), c => c.charCodeAt(0));

        // Upload to R2
        const r2Key = getCustomerR2Key(customerId, `thumbnails/${modId}.${imageType}`);
        await env.MODS_R2.put(r2Key, imageBuffer, {
            httpMetadata: {
                contentType: `image/${imageType}`,
                cacheControl: 'public, max-age=31536000',
            },
        });

        // Return API proxy URL (thumbnails should be served through API, not direct R2)
        const API_BASE_URL = 'https://mods-api.idling.app';
        return `${API_BASE_URL}/mods/${modId}/thumbnail`;
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

