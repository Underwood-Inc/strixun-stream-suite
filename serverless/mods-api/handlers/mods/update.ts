/**
 * Update mod handler
 * PATCH /mods/:modId
 * Updates mod metadata (not versions)
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, getCustomerR2Key } from '../../utils/customer.js';
import { findModBySlug } from '../../utils/slug.js';
import { generateUniqueSlug } from './upload.js';
import { isEmailAllowed } from '../../utils/auth.js';
import { handleThumbnailUpload } from './upload.js';
import type { ModMetadata, ModUpdateRequest } from '../../types/mod.js';

/**
 * Handle update mod request
 */
export async function handleUpdateMod(
    request: Request,
    env: Env,
    slug: string,
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

        // Find mod by slug
        let mod = await findModBySlug(slug, env, auth);
        
        // Fallback: if slug lookup fails, try treating it as modId (backward compatibility)
        let modKey: string;
        if (!mod) {
            // Try customer scope first
            modKey = getCustomerKey(auth.customerId, `mod_${slug}`);
            mod = await env.MODS_KV.get(modKey, { type: 'json' }) as ModMetadata | null;
            
            // If not found in customer scope, try global scope (for public mods)
            if (!mod) {
                const globalModKey = `mod_${slug}`;
                mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
                if (mod) {
                    modKey = getCustomerKey(auth.customerId, `mod_${slug}`); // Still use customer key for primary storage
                }
            } else {
                modKey = getCustomerKey(auth.customerId, `mod_${slug}`);
            }
        } else {
            // Found by slug, determine the correct key
            const modId = mod.modId;
            modKey = getCustomerKey(auth.customerId, `mod_${modId}`);
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
                mod.thumbnailUrl = await handleThumbnailUpload(updateData.thumbnail, modId, env, auth.customerId);
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

