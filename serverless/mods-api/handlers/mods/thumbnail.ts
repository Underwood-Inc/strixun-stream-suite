/**
 * Thumbnail handler
 * GET /mods/:modId/thumbnail
 * Proxies thumbnail images from R2
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, getCustomerR2Key } from '../../utils/customer.js';
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
    try {
        // Get mod metadata - modId parameter might be a slug or actual modId
        // Try slug lookup first (more common for public URLs), then fall back to direct modId lookup
        let mod: ModMetadata | null = await findModBySlug(modId, env, auth);
        
        // If slug lookup failed, try direct modId lookup
        if (!mod) {
            // First try global scope (for public mods)
            const globalModKey = `mod_${modId}`;
            mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
            
            // If not found and authenticated, check customer scope
            if (!mod && auth?.customerId) {
                const customerModKey = getCustomerKey(auth.customerId, `mod_${modId}`);
                mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
            }
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

        // Check if user is super admin
        const { isSuperAdminEmail } = await import('../../utils/admin.js');
        const isAdmin = auth?.email ? await isSuperAdminEmail(auth.email, env) : false;
        
        // CRITICAL: Enforce strict visibility and status filtering
        // Only super admins can bypass these checks
        if (!isAdmin) {
            // For non-super users: ONLY public, published mods are allowed
            // Legacy mods without proper fields are filtered out
            
            // Check visibility: MUST be 'public'
            if (mod.visibility !== 'public') {
                // Only show private/unlisted mods to their author
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
            
            // Check status: MUST be 'published'
            // Legacy mods without status field are filtered out (undefined !== 'published')
            if (mod.status !== 'published') {
                // Only show non-published mods to their author
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
            if (mod.visibility === 'private' && mod.authorId !== auth?.userId) {
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

        // Reconstruct R2 key from mod metadata
        // Thumbnails are stored as: customer_xxx/thumbnails/modId.ext
        // Use mod's customerId (not auth customerId) to ensure correct scope
        // Use mod.modId (actual modId) not the URL parameter (which might be a slug)
        const customerId = mod.customerId || null;
        const actualModId = mod.modId;
        
        // Try common image extensions to find the actual file
        // This handles cases where extension wasn't stored in metadata
        const extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
        let r2Key: string | null = null;
        let thumbnail: R2ObjectBody | null = null;
        
        for (const ext of extensions) {
            const testKey = getCustomerR2Key(customerId, `thumbnails/${actualModId}.${ext}`);
            const testFile = await env.MODS_R2.get(testKey);
            if (testFile) {
                r2Key = testKey;
                thumbnail = testFile;
                break;
            }
        }
        
        // If not found, return 404
        if (!r2Key || !thumbnail) {
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

