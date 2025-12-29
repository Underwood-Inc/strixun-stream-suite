/**
 * Thumbnail handler
 * GET /mods/:modId/thumbnail
 * Proxies thumbnail images from R2
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, getCustomerR2Key, normalizeModId } from '../../utils/customer.js';
import type { ModMetadata } from '../../types/mod.js';

/**
 * Handle thumbnail request
 */
export async function handleThumbnail(
    request: Request,
    env: Env,
    modId: string,
    auth: { userId: string; customerId: string | null } | null
): Promise<Response> {
    console.log('[Thumbnail] handleThumbnail called:', { modId, hasAuth: !!auth, customerId: auth?.customerId });
    try {
        // Get mod metadata by modId only (slug should be resolved to modId before calling this)
        let mod: ModMetadata | null = null;
        const normalizedModId = normalizeModId(modId);
        console.log('[Thumbnail] Looking up mod by modId:', { normalizedModId, original: modId });
        
        // Check authenticated user's customer scope first
        if (auth?.customerId) {
            const customerModKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
            console.log('[Thumbnail] Checking authenticated customer scope:', { customerModKey });
            mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
        }
        
        // Fall back to global scope if not found
        if (!mod) {
            const globalModKey = `mod_${normalizedModId}`;
            console.log('[Thumbnail] Checking global scope:', { globalModKey });
            mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
        }
        
        // If still not found, search all customer scopes by modId (for cross-customer access)
        // Use direct key pattern matching for efficiency (like admin list handler)
        if (!mod) {
            console.log('[Thumbnail] Searching all customer scopes by modId:', { normalizedModId });
            const customerModPrefix = 'customer_';
            let cursor: string | undefined;
            let found = false;
            
            do {
                const listResult = await env.MODS_KV.list({ prefix: customerModPrefix, cursor });
                for (const key of listResult.keys) {
                    // Look for keys matching pattern: customer_*_mod_{normalizedModId}
                    if (key.name.endsWith(`_mod_${normalizedModId}`)) {
                        mod = await env.MODS_KV.get(key.name, { type: 'json' }) as ModMetadata | null;
                        if (mod) {
                            // Extract customerId from key name
                            const match = key.name.match(/^customer_([^_/]+)_mod_/);
                            const customerId = match ? match[1] : null;
                            console.log('[Thumbnail] Found mod by modId in customer scope:', { customerId, modId: mod.modId, key: key.name });
                            found = true;
                            break;
                        }
                    }
                }
                if (found) break;
                cursor = listResult.listComplete ? undefined : listResult.cursor;
            } while (cursor && !found);
        }
        
        if (mod) console.log('[Thumbnail] Found mod by modId:', { modId: mod.modId, slug: mod.slug, hasThumbnailUrl: !!mod.thumbnailUrl });

        if (!mod) {
            console.error('[Thumbnail] Mod not found:', { modId });
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

        // CRITICAL: Enforce visibility and status filtering
        // Thumbnails are often loaded as images without auth, so we need to be more permissive
        const { isSuperAdminEmail } = await import('../../utils/admin.js');
        const isAdmin = auth?.email ? await isSuperAdminEmail(auth.email, env) : false;
        const isAuthor = mod.authorId === auth?.userId;
        const modVisibility = mod.visibility || 'public';
        const modStatus = mod.status || 'published';
        
        // Visibility check: private mods only visible to author or admin
        if (modVisibility === 'private' && !isAuthor && !isAdmin) {
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
        
        // Status check: allow thumbnails for published/approved mods to everyone
        // For pending/changes_requested/denied, only allow to author or admin
        // This allows thumbnails to work for pending mods when viewed by the author
        if (modStatus !== 'published' && modStatus !== 'approved') {
            if (!isAuthor && !isAdmin) {
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
        }

        // If no thumbnail, return 404
        if (!mod.thumbnailUrl) {
            console.error('[Thumbnail] Mod has no thumbnailUrl:', { modId: mod.modId, slug: mod.slug });
            const rfcError = createError(request, 404, 'Thumbnail Not Found', 'This mod does not have a thumbnail');
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

        console.log('[Thumbnail] Mod has thumbnailUrl:', { thumbnailUrl: mod.thumbnailUrl, modId: mod.modId, slug: mod.slug });

        // Reconstruct R2 key from mod metadata
        // Thumbnails are stored as: customer_xxx/thumbnails/normalizedModId.ext
        // Use mod's customerId (not auth customerId) to ensure correct scope
        // Use mod.modId (actual modId) not the URL parameter (which might be a slug)
        // Normalize modId to match how it was stored (strip mod_ prefix if present)
        const customerId = mod.customerId || null;
        const normalizedStoredModId = normalizeModId(mod.modId);
        console.log('[Thumbnail] Looking up R2 file:', { customerId, normalizedStoredModId, originalModId: mod.modId });
        
        // Try common image extensions to find the actual file
        // This handles cases where extension wasn't stored in metadata
        const extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
        let r2Key: string | null = null;
        let thumbnail: R2ObjectBody | null = null;
        
        for (const ext of extensions) {
            const testKey = getCustomerR2Key(customerId, `thumbnails/${normalizedStoredModId}.${ext}`);
            console.log('[Thumbnail] Trying R2 key:', { testKey, ext });
            const testFile = await env.MODS_R2.get(testKey);
            if (testFile) {
                r2Key = testKey;
                thumbnail = testFile;
                console.log('[Thumbnail] Found thumbnail in R2:', { r2Key, size: thumbnail.size, contentType: thumbnail.httpMetadata?.contentType });
                break;
            }
        }
        
        // If not found, return 404
        if (!r2Key || !thumbnail) {
            console.error('[Thumbnail] Thumbnail file not found in R2:', { customerId, normalizedStoredModId, triedExtensions: extensions });
            const rfcError = createError(request, 404, 'Thumbnail Not Found', 'Thumbnail file not found in storage');
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

        // Return thumbnail with proper headers
        console.log('[Thumbnail] Serving thumbnail:', { r2Key, size: thumbnail.size, contentType: thumbnail.httpMetadata?.contentType });
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        const headers = new Headers(Object.fromEntries(corsHeaders.entries()));
        headers.set('Content-Type', thumbnail.httpMetadata?.contentType || 'image/png');
        headers.set('Cache-Control', 'public, max-age=31536000');
        headers.set('Content-Length', thumbnail.size.toString());

        return new Response(thumbnail.body, {
            status: 200,
            headers,
        });
    } catch (error: any) {
        console.error('Thumbnail error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Load Thumbnail',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while loading the thumbnail'
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
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

