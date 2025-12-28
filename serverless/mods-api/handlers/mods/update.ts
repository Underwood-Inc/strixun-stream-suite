/**
 * Update mod handler
 * PATCH /mods/:modId
 * Updates mod metadata (not versions)
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, getCustomerR2Key, normalizeModId } from '../../utils/customer.js';
import { generateUniqueSlug } from './upload.js';
import { isEmailAllowed } from '../../utils/auth.js';
// handleThumbnailUpload is defined locally in this file
import type { ModMetadata, ModUpdateRequest } from '../../types/mod.js';

/**
 * Handle update mod request
 */
export async function handleUpdateMod(
    request: Request,
    env: Env,
    modId: string,
    auth: { userId: string; email?: string; customerId: string | null }
): Promise<Response> {
    try {
        // Check email whitelist
        if (!isEmailAllowed(auth.email, env)) {
            const rfcError = createError(request, 403, 'Forbidden', 'Your email address is not authorized to manage mods');
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

        // Get mod metadata by modId only (slug should be resolved to modId before calling this)
        let mod: ModMetadata | null = null;
        const normalizedModId = normalizeModId(modId);
        let modKey: string;
        
        // Try customer scope first
        modKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
        mod = await env.MODS_KV.get(modKey, { type: 'json' }) as ModMetadata | null;
        
        // If not found in customer scope, try global scope (for public mods)
        if (!mod) {
            const globalModKey = `mod_${normalizedModId}`;
            mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
            if (mod) {
                modKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`); // Use customer key for storage
            }
        }
        
        // If still not found, search all customer scopes
        if (!mod) {
            const customerListPrefix = 'customer_';
            let cursor: string | undefined;
            
            do {
                const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor });
                for (const key of listResult.keys) {
                    if (key.name.endsWith('_mods_list')) {
                        const match = key.name.match(/^customer_([^_/]+)[_/]mods_list$/);
                        const customerId = match ? match[1] : null;
                        if (customerId) {
                            const customerModKey = getCustomerKey(customerId, `mod_${normalizedModId}`);
                            mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                            if (mod) {
                                modKey = customerModKey;
                                break;
                            }
                        }
                    }
                }
                if (mod) break;
                cursor = listResult.listComplete ? undefined : listResult.cursor;
            } while (cursor);
        }

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
            const rfcError = createError(request, 403, 'Forbidden', 'You do not have permission to update this mod');
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

        // Parse update request
        const updateData = await request.json() as ModUpdateRequest;

        // Track visibility change for global list management
        const wasPublic = mod.visibility === 'public';
        const visibilityChanged = updateData.visibility !== undefined && updateData.visibility !== mod.visibility;
        
        const modId = mod.modId;

        // Update mod metadata
        if (updateData.title !== undefined) {
            mod.title = updateData.title;
            // Regenerate slug if title changed
            const newSlug = await generateUniqueSlug(updateData.title, env, modId);
            mod.slug = newSlug;
        }
        if (updateData.description !== undefined) mod.description = updateData.description;
        if (updateData.category !== undefined) mod.category = updateData.category;
        if (updateData.tags !== undefined) mod.tags = updateData.tags;
        if (updateData.visibility !== undefined) mod.visibility = updateData.visibility;
        mod.updatedAt = new Date().toISOString();

        // Handle thumbnail update
        if (updateData.thumbnail) {
            try {
                // Use current slug (may have been updated if title changed)
                mod.thumbnailUrl = await handleThumbnailUpload(updateData.thumbnail, modId, mod.slug, request, env, auth.customerId);
            } catch (error) {
                console.error('Thumbnail update error:', error);
                // Continue without thumbnail update
            }
        }

        // Save updated mod (customer scope)
        await env.MODS_KV.put(modKey, JSON.stringify(mod));

        // Update global scope if mod is public
        if (mod.visibility === 'public') {
            const globalModKey = `mod_${modId}`;
            await env.MODS_KV.put(globalModKey, JSON.stringify(mod));
        }

        // Update global public list if visibility changed
        if (visibilityChanged) {
            const globalListKey = 'mods_list_public';
            const globalModsList = await env.MODS_KV.get(globalListKey, { type: 'json' }) as string[] | null;
            
            if (mod.visibility === 'public' && !wasPublic) {
                // Add to global list
                const updatedGlobalList = [...(globalModsList || []), modId];
                await env.MODS_KV.put(globalListKey, JSON.stringify(updatedGlobalList));
            } else if (mod.visibility !== 'public' && wasPublic) {
                // Remove from global list and delete global mod metadata
                const updatedGlobalList = (globalModsList || []).filter(id => id !== modId);
                await env.MODS_KV.put(globalListKey, JSON.stringify(updatedGlobalList));
                
                // Delete global mod metadata
                const globalModKey = `mod_${modId}`;
                await env.MODS_KV.delete(globalModKey);
            }
        } else if (mod.visibility === 'public') {
            // If visibility didn't change but mod is public, ensure it's in global list
            const globalListKey = 'mods_list_public';
            const globalModsList = await env.MODS_KV.get(globalListKey, { type: 'json' }) as string[] | null;
            if (!globalModsList || !globalModsList.includes(modId)) {
                const updatedGlobalList = [...(globalModsList || []), modId];
                await env.MODS_KV.put(globalListKey, JSON.stringify(updatedGlobalList));
            }
        }

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify({ mod }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Update mod error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Update Mod',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while updating the mod'
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

        // Return API proxy URL using slug (thumbnails should be served through API, not direct R2)
        // Slug is passed as parameter to avoid race condition
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

