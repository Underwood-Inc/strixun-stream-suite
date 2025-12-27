/**
 * Thumbnail handler
 * GET /mods/:modId/thumbnail
 * Proxies thumbnail images from R2
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, getCustomerR2Key } from '../../utils/customer.js';
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
        // Get mod metadata - check both customer scope and global scope
        let mod: ModMetadata | null = null;
        
        // First try global scope (for public mods)
        const globalModKey = `mod_${modId}`;
        mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
        
        // If not found and authenticated, check customer scope
        if (!mod && auth?.customerId) {
            const customerModKey = getCustomerKey(auth.customerId, `mod_${modId}`);
            mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
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
        // Thumbnails are stored as: cust_xxx/thumbnails/mod_xxx.png
        // Try to extract from thumbnailUrl if it's an old format, otherwise reconstruct
        let r2Key: string;
        try {
            const url = new URL(mod.thumbnailUrl);
            // If it's an API URL (new format), reconstruct the R2 key
            if (url.hostname.includes('mods-api.idling.app')) {
                // Reconstruct: use customerId from mod or try to find it
                const customerId = mod.customerId || auth?.customerId || null;
                // Try common image extensions
                const extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
                for (const ext of extensions) {
                    r2Key = getCustomerR2Key(customerId, `thumbnails/${modId}.${ext}`);
                    const testFile = await env.MODS_R2.get(r2Key);
                    if (testFile) {
                        break;
                    }
                }
                // If still not found, use png as default
                if (!r2Key || !(await env.MODS_R2.get(r2Key))) {
                    r2Key = getCustomerR2Key(customerId, `thumbnails/${modId}.png`);
                }
            } else {
                // Old format: extract from URL path
                r2Key = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
            }
        } catch {
            // If URL parsing fails, reconstruct from modId
            const customerId = mod.customerId || auth?.customerId || null;
            r2Key = getCustomerR2Key(customerId, `thumbnails/${modId}.png`);
        }

        // Get thumbnail from R2
        const thumbnail = await env.MODS_R2.get(r2Key);
        
        if (!thumbnail) {
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

