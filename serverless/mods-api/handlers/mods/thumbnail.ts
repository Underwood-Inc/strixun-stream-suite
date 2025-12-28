/**
 * Thumbnail handler
 * GET /mods/:modId/thumbnail
 * Proxies thumbnail images from R2
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, getCustomerR2Key, normalizeModId } from '../../utils/customer.js';
import { findModBySlug } from '../../utils/slug.js';
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
        // Get mod metadata - modId parameter might be a slug or actual modId
        // Try slug lookup first (more common for public URLs), then fall back to direct modId lookup
        console.log('[Thumbnail] Strategy 1: Trying slug lookup:', { modId });
        let mod: ModMetadata | null = await findModBySlug(modId, env, auth);
        if (mod) {
            console.log('[Thumbnail] Found mod by slug:', { modId: mod.modId, slug: mod.slug, hasThumbnailUrl: !!mod.thumbnailUrl });
        } else {
            // If slug lookup failed, try searching ALL customer scopes (thumbnails are public assets)
            console.log('[Thumbnail] Slug lookup failed, searching all customer scopes:', { modId });
            
            // Search all customer mod lists for this slug
            const customerListPrefix = 'customer_';
            let cursor: string | undefined;
            let found = false;
            
            do {
                const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor });
                for (const key of listResult.keys) {
                    if (key.name.endsWith('_mods_list')) {
                        const customerListData = await env.MODS_KV.get(key.name, { type: 'json' }) as string[] | null;
                        if (customerListData) {
                            // Extract customerId from key name
                            const match = key.name.match(/^customer_([^_/]+)[_/]mods_list$/);
                            const customerId = match ? match[1] : null;
                            
                            // Check each mod in this customer's list
                            for (const listModId of customerListData) {
                                const normalizedListModId = normalizeModId(listModId);
                                const customerModKey = getCustomerKey(customerId, `mod_${normalizedListModId}`);
                                const candidateMod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                                
                                if (candidateMod && candidateMod.slug === modId) {
                                    mod = candidateMod;
                                    found = true;
                                    console.log('[Thumbnail] Found mod in customer scope:', { customerId, modId: mod.modId, slug: mod.slug });
                                    break;
                                }
                            }
                            if (found) break;
                        }
                    }
                }
                if (found) break;
                cursor = listResult.listComplete ? undefined : listResult.cursor;
            } while (cursor && !found);
        }
        
        // If still not found, try direct modId lookup (fallback)
        if (!mod) {
            console.log('[Thumbnail] Strategy 2: Trying modId lookup:', { modId });
            const normalizedModId = normalizeModId(modId);
            
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
            
            // If still not found, search all customer scopes by modId
            if (!mod) {
                console.log('[Thumbnail] Searching all customer scopes by modId:', { normalizedModId });
                const customerListPrefix = 'customer_';
                let cursor: string | undefined;
                let found = false;
                
                do {
                    const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor });
                    for (const key of listResult.keys) {
                        if (key.name.endsWith('_mods_list')) {
                            const match = key.name.match(/^customer_([^_/]+)[_/]mods_list$/);
                            const customerId = match ? match[1] : null;
                            const customerModKey = getCustomerKey(customerId, `mod_${normalizedModId}`);
                            const candidateMod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                            
                            if (candidateMod) {
                                mod = candidateMod;
                                found = true;
                                console.log('[Thumbnail] Found mod by modId in customer scope:', { customerId, modId: mod.modId });
                                break;
                            }
                        }
                    }
                    if (found) break;
                    cursor = listResult.listComplete ? undefined : listResult.cursor;
                } while (cursor && !found);
            }
            
            if (mod) console.log('[Thumbnail] Found mod by modId:', { modId: mod.modId, slug: mod.slug, hasThumbnailUrl: !!mod.thumbnailUrl });
        }

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

        // Check if user is super admin
        const { isSuperAdminEmail } = await import('../../utils/admin.js');
        const isAdmin = auth?.email ? await isSuperAdminEmail(auth.email, env) : false;
        
        // CRITICAL: Enforce strict visibility and status filtering
        // Only super admins can bypass these checks
        if (!isAdmin) {
            // For non-super users: ONLY public, published mods are allowed
            // Legacy mods without visibility field are treated as public
            const modVisibility = mod.visibility || 'public';
            if (modVisibility === 'private' && mod.authorId !== auth?.userId) {
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
            
            // Check status: only allow viewing thumbnails of published mods to public, admins and authors can view all statuses
            // Legacy mods without status field are treated as published
            const modStatus = mod.status || 'published';
            if (modStatus !== 'published' && modStatus !== 'approved') {
                // Only allow viewing thumbnails of non-published mods to admins or the author
                if (mod.authorId !== auth?.userId) {
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
        } else {
            // Super admins: check visibility but allow all statuses
            const modVisibility = mod.visibility || 'public';
            if (modVisibility === 'private' && mod.authorId !== auth?.userId) {
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
        const normalizedModId = normalizeModId(mod.modId);
        console.log('[Thumbnail] Looking up R2 file:', { customerId, normalizedModId, originalModId: mod.modId });
        
        // Try common image extensions to find the actual file
        // This handles cases where extension wasn't stored in metadata
        const extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
        let r2Key: string | null = null;
        let thumbnail: R2ObjectBody | null = null;
        
        for (const ext of extensions) {
            const testKey = getCustomerR2Key(customerId, `thumbnails/${normalizedModId}.${ext}`);
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
            console.error('[Thumbnail] Thumbnail file not found in R2:', { customerId, normalizedModId, triedExtensions: extensions });
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

