/**
 * Update mod handler
 * PATCH /mods/:modId
 * Updates mod metadata (not versions)
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, getCustomerR2Key } from '../../utils/customer.js';
import type { ModMetadata, ModUpdateRequest } from '../../types/mod.js';

/**
 * Handle update mod request
 */
export async function handleUpdateMod(
    request: Request,
    env: Env,
    modId: string,
    auth: { userId: string; customerId: string | null }
): Promise<Response> {
    try {
        // Get existing mod
        const modKey = getCustomerKey(auth.customerId, `mod_${modId}`);
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

        // Update mod metadata
        if (updateData.title !== undefined) mod.title = updateData.title;
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

        // Save updated mod
        await env.MODS_KV.put(modKey, JSON.stringify(mod));

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

        // Return public URL
        return env.MODS_PUBLIC_URL 
            ? `${env.MODS_PUBLIC_URL}/${r2Key}`
            : `https://pub-${(env.MODS_R2 as any).id}.r2.dev/${r2Key}`;
    } catch (error) {
        console.error('Thumbnail upload error:', error);
        throw error;
    }
}

interface Env {
    MODS_KV: KVNamespace;
    MODS_R2: R2Bucket;
    MODS_PUBLIC_URL?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

