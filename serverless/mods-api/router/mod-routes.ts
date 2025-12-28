/**
 * Mod Routes
 * Handles all mod hosting API endpoints
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../utils/errors.js';
import { handleListMods } from '../handlers/mods/list.js';
import { handleGetModDetail } from '../handlers/mods/detail.js';
import { handleUploadMod } from '../handlers/mods/upload.js';
import { handleUpdateMod } from '../handlers/mods/update.js';
import { handleDeleteMod } from '../handlers/mods/delete.js';
import { handleUploadVersion } from '../handlers/versions/upload.js';
import { handleDownloadVersion } from '../handlers/versions/download.js';
import { handleThumbnail } from '../handlers/mods/thumbnail.js';
import { handleOGImage } from '../handlers/mods/og-image.js';
import { authenticateRequest } from '../utils/auth.js';
import { wrapWithEncryption } from '@strixun/api-framework';

/**
 * Helper to resolve slug to modId for URL routing
 * CRITICAL: Slug is for URL/UI only - all data lookups must use modId
 */
async function resolveSlugIfNeeded(
    slugOrModId: string,
    env: Env,
    auth: { userId: string; customerId: string | null; email?: string } | null
): Promise<string | null> {
    // Check if it looks like a slug (short, no mod_ prefix) vs modId (long with mod_ prefix or timestamp)
    const looksLikeSlug = !slugOrModId.startsWith('mod_') && slugOrModId.length < 30;
    if (looksLikeSlug) {
        const { resolveSlugToModId } = await import('../utils/slug-resolver.js');
        const resolvedModId = await resolveSlugToModId(slugOrModId, env, auth);
        if (resolvedModId) {
            console.log('[Router] Resolved slug to modId:', { slug: slugOrModId, modId: resolvedModId });
            return resolvedModId;
        } else {
            console.error('[Router] Failed to resolve slug to modId:', { slug: slugOrModId });
            return null;
        }
    }
    return slugOrModId; // Already a modId
}

/**
 * Handle mod routes
 * Supports both /mods/* and root-level paths (for subdomain routing)
 */
export async function handleModRoutes(request: Request, path: string, env: Env): Promise<RouteResult | null> {
    // Handle both /mods/* and root-level paths (but not /admin or /health)
    // This allows the API to work both at /mods/* and at root level for subdomain routing
    const isModsPath = path.startsWith('/mods');
    const isRootPath = !path.startsWith('/admin') && !path.startsWith('/health');
    
    if (!isModsPath && !isRootPath) {
        return null;
    }

    // Authenticate request (optional for public endpoints)
    const auth = await authenticateRequest(request, env);

    try {
        // Parse path segments and normalize (remove 'mods' prefix if present)
        let pathSegments = path.split('/').filter(Boolean);
        
        // If path starts with /mods, remove 'mods' from segments to normalize
        if (pathSegments[0] === 'mods') {
            pathSegments = pathSegments.slice(1);
        }
        
        // Route: GET /mods or GET / - List mods
        // CRITICAL: Don't encrypt public mod list - it's public data and thumbnailUrls need to remain accessible
        // The list endpoint already filters by status/visibility, so encryption isn't needed for security
        if (pathSegments.length === 0 && request.method === 'GET') {
            const response = await handleListMods(request, env, auth);
            // Return unencrypted response - public mod list doesn't need encryption
            // This ensures thumbnailUrls remain as plain strings that browsers can use
            const headers = new Headers(response.headers);
            headers.set('X-Encrypted', 'false');
            return {
                response: new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: headers,
                }),
                customerId: auth?.customerId || null,
            };
        }

        // Route: POST /mods or POST / - Upload new mod
        if (pathSegments.length === 0 && request.method === 'POST') {
            if (!auth) {
                const rfcError = createError(request, 401, 'Unauthorized', 'Authentication required to upload mods');
                const corsHeaders = createCORSHeaders(request, {
                    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                });
                return {
                    response: new Response(JSON.stringify(rfcError), {
                        status: 401,
                        headers: {
                            'Content-Type': 'application/problem+json',
                            ...Object.fromEntries(corsHeaders.entries()),
                        },
                    }),
                    customerId: null
                };
            }
            const response = await handleUploadMod(request, env, auth);
            return await wrapWithEncryption(response, auth);
        }

        // Route: GET /mods/permissions/me or GET /permissions/me - Get current user's upload permissions
        if (pathSegments.length === 2 && pathSegments[0] === 'permissions' && pathSegments[1] === 'me' && request.method === 'GET') {
            if (!auth) {
                const rfcError = createError(request, 401, 'Unauthorized', 'Authentication required');
                const corsHeaders = createCORSHeaders(request, {
                    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                });
                return {
                    response: new Response(JSON.stringify(rfcError), {
                        status: 401,
                        headers: {
                            'Content-Type': 'application/problem+json',
                            ...Object.fromEntries(corsHeaders.entries()),
                        },
                    }),
                    customerId: null
                };
            }
            const { handleGetUserPermissions } = await import('../handlers/mods/permissions.js');
            const response = await handleGetUserPermissions(request, env, auth);
            return await wrapWithEncryption(response, auth);
        }

        // Route: GET /mods/:slug/review or GET /:slug/review - Get mod review page (admin/uploader only)
        // CRITICAL: URL contains slug, but we must resolve to modId before calling handler
        if (pathSegments.length === 2 && pathSegments[1] === 'review' && request.method === 'GET') {
            const slugOrModId = pathSegments[0];
            const modId = await resolveSlugIfNeeded(slugOrModId, env, auth);
            if (!modId) {
                const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod was not found');
                const corsHeaders = createCORSHeaders(request, {
                    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                });
                return {
                    response: new Response(JSON.stringify(rfcError), {
                        status: 404,
                        headers: {
                            'Content-Type': 'application/problem+json',
                            ...Object.fromEntries(corsHeaders.entries()),
                        },
                    }),
                    customerId: auth?.customerId || null
                };
            }
            const { handleGetModReview } = await import('../handlers/mods/review.js');
            const response = await handleGetModReview(request, env, modId, auth);
            return await wrapWithEncryption(response, auth || undefined);
        }

        // Route: GET /mods/:slug or GET /:slug - Get mod detail (by slug)
        // CRITICAL: URL contains slug, but we must resolve to modId before calling handler
        if (pathSegments.length === 1 && request.method === 'GET') {
            const slugOrModId = pathSegments[0];
            const modId = await resolveSlugIfNeeded(slugOrModId, env, auth);
            if (!modId) {
                const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod was not found');
                const corsHeaders = createCORSHeaders(request, {
                    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                });
                return {
                    response: new Response(JSON.stringify(rfcError), {
                        status: 404,
                        headers: {
                            'Content-Type': 'application/problem+json',
                            ...Object.fromEntries(corsHeaders.entries()),
                        },
                    }),
                    customerId: auth?.customerId || null
                };
            }
            const response = await handleGetModDetail(request, env, modId, auth);
            return await wrapWithEncryption(response, auth || undefined);
        }

        // Route: PATCH /mods/:slug or PATCH /:slug - Update mod (by slug)
        // CRITICAL: URL contains slug, but we must resolve to modId before calling handler
        if (pathSegments.length === 1 && request.method === 'PATCH') {
            if (!auth) {
                const rfcError = createError(request, 401, 'Unauthorized', 'Authentication required');
                const corsHeaders = createCORSHeaders(request, {
                    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                });
                return {
                    response: new Response(JSON.stringify(rfcError), {
                        status: 401,
                        headers: {
                            'Content-Type': 'application/problem+json',
                            ...Object.fromEntries(corsHeaders.entries()),
                        },
                    }),
                    customerId: null
                };
            }
            const slugOrModId = pathSegments[0];
            const modId = await resolveSlugIfNeeded(slugOrModId, env, auth);
            if (!modId) {
                const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod was not found');
                const corsHeaders = createCORSHeaders(request, {
                    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                });
                return {
                    response: new Response(JSON.stringify(rfcError), {
                        status: 404,
                        headers: {
                            'Content-Type': 'application/problem+json',
                            ...Object.fromEntries(corsHeaders.entries()),
                        },
                    }),
                    customerId: auth.customerId || null
                };
            }
            const response = await handleUpdateMod(request, env, modId, auth);
            return await wrapWithEncryption(response, auth);
        }

        // Route: DELETE /mods/:slug or DELETE /:slug - Delete mod (by slug)
        // CRITICAL: URL contains slug, but we must resolve to modId before calling handler
        if (pathSegments.length === 1 && request.method === 'DELETE') {
            if (!auth) {
                const rfcError = createError(request, 401, 'Unauthorized', 'Authentication required');
                const corsHeaders = createCORSHeaders(request, {
                    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                });
                return {
                    response: new Response(JSON.stringify(rfcError), {
                        status: 401,
                        headers: {
                            'Content-Type': 'application/problem+json',
                            ...Object.fromEntries(corsHeaders.entries()),
                        },
                    }),
                    customerId: null
                };
            }
            const slugOrModId = pathSegments[0];
            const modId = await resolveSlugIfNeeded(slugOrModId, env, auth);
            if (!modId) {
                const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod was not found');
                const corsHeaders = createCORSHeaders(request, {
                    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                });
                return {
                    response: new Response(JSON.stringify(rfcError), {
                        status: 404,
                        headers: {
                            'Content-Type': 'application/problem+json',
                            ...Object.fromEntries(corsHeaders.entries()),
                        },
                    }),
                    customerId: auth.customerId || null
                };
            }
            const response = await handleDeleteMod(request, env, modId, auth);
            return await wrapWithEncryption(response, auth);
        }

        // Route: GET /mods/:slug/ratings or GET /:slug/ratings - Get ratings for a mod
        // CRITICAL: URL contains slug, but we must resolve to modId before calling handler
        if (pathSegments.length === 2 && pathSegments[1] === 'ratings' && request.method === 'GET') {
            const slugOrModId = pathSegments[0];
            const modId = await resolveSlugIfNeeded(slugOrModId, env, auth);
            if (!modId) {
                const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod was not found');
                const corsHeaders = createCORSHeaders(request, {
                    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                });
                return {
                    response: new Response(JSON.stringify(rfcError), {
                        status: 404,
                        headers: {
                            'Content-Type': 'application/problem+json',
                            ...Object.fromEntries(corsHeaders.entries()),
                        },
                    }),
                    customerId: auth?.customerId || null
                };
            }
            const { handleGetModRatings } = await import('../handlers/mods/ratings.js');
            const response = await handleGetModRatings(request, env, modId, auth);
            return await wrapWithEncryption(response, auth || undefined);
        }

        // Route: POST /mods/:slug/ratings or POST /:slug/ratings - Submit a rating for a mod
        // CRITICAL: URL contains slug, but we must resolve to modId before calling handler
        if (pathSegments.length === 2 && pathSegments[1] === 'ratings' && request.method === 'POST') {
            if (!auth) {
                const rfcError = createError(request, 401, 'Unauthorized', 'Authentication required to submit ratings');
                const corsHeaders = createCORSHeaders(request, {
                    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                });
                return {
                    response: new Response(JSON.stringify(rfcError), {
                        status: 401,
                        headers: {
                            'Content-Type': 'application/problem+json',
                            ...Object.fromEntries(corsHeaders.entries()),
                        },
                    }),
                    customerId: null
                };
            }
            const slugOrModId = pathSegments[0];
            const modId = await resolveSlugIfNeeded(slugOrModId, env, auth);
            if (!modId) {
                const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod was not found');
                const corsHeaders = createCORSHeaders(request, {
                    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                });
                return {
                    response: new Response(JSON.stringify(rfcError), {
                        status: 404,
                        headers: {
                            'Content-Type': 'application/problem+json',
                            ...Object.fromEntries(corsHeaders.entries()),
                        },
                    }),
                    customerId: auth.customerId || null
                };
            }
            const { handleSubmitModRating } = await import('../handlers/mods/ratings.js');
            const response = await handleSubmitModRating(request, env, modId, auth);
            return await wrapWithEncryption(response, auth);
        }

        // Route: POST /mods/:slug/versions or POST /:slug/versions - Upload new version
        // CRITICAL: URL contains slug, but we must resolve to modId before calling handler
        if (pathSegments.length === 2 && pathSegments[1] === 'versions' && request.method === 'POST') {
            if (!auth) {
                const rfcError = createError(request, 401, 'Unauthorized', 'Authentication required');
                const corsHeaders = createCORSHeaders(request, {
                    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                });
                return {
                    response: new Response(JSON.stringify(rfcError), {
                        status: 401,
                        headers: {
                            'Content-Type': 'application/problem+json',
                            ...Object.fromEntries(corsHeaders.entries()),
                        },
                    }),
                    customerId: null
                };
            }
            const slugOrModId = pathSegments[0];
            const modId = await resolveSlugIfNeeded(slugOrModId, env, auth);
            if (!modId) {
                const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod was not found');
                const corsHeaders = createCORSHeaders(request, {
                    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                });
                return {
                    response: new Response(JSON.stringify(rfcError), {
                        status: 404,
                        headers: {
                            'Content-Type': 'application/problem+json',
                            ...Object.fromEntries(corsHeaders.entries()),
                        },
                    }),
                    customerId: auth.customerId || null
                };
            }
            const response = await handleUploadVersion(request, env, modId, auth);
            return await wrapWithEncryption(response, auth);
        }

        // Route: GET /mods/:slug/thumbnail or GET /:slug/thumbnail - Get thumbnail
        // CRITICAL: URL contains slug, but we must resolve to modId before calling handler
        if (pathSegments.length === 2 && pathSegments[1] === 'thumbnail' && request.method === 'GET') {
            const slugOrModId = pathSegments[0];
            console.log('[Router] Thumbnail request:', { path, pathSegments, slugOrModId, hasAuth: !!auth });
            
            // Resolve slug to modId
            const { resolveSlugToModId } = await import('../utils/slug-resolver.js');
            let modId = slugOrModId;
            const looksLikeSlug = !slugOrModId.startsWith('mod_') && slugOrModId.length < 30;
            if (looksLikeSlug) {
                const resolvedModId = await resolveSlugToModId(slugOrModId, env, auth);
                if (resolvedModId) {
                    modId = resolvedModId;
                    console.log('[Router] Resolved slug to modId for thumbnail:', { slug: slugOrModId, modId });
                } else {
                    const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod was not found');
                    const corsHeaders = createCORSHeaders(request, {
                        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                    });
                    return {
                        response: new Response(JSON.stringify(rfcError), {
                            status: 404,
                            headers: {
                                'Content-Type': 'application/problem+json',
                                ...Object.fromEntries(corsHeaders.entries()),
                            },
                        }),
                        customerId: auth?.customerId || null
                    };
                }
            }
            
            const response = await handleThumbnail(request, env, modId, auth);
            console.log('[Router] Thumbnail response:', { status: response.status, contentType: response.headers.get('content-type') });
            // Don't encrypt binary image data
            return { response, customerId: auth?.customerId || null };
        }

        // Route: GET /mods/:slug/og-image or GET /:slug/og-image - Get Open Graph preview image
        // CRITICAL: URL contains slug, but we must resolve to modId before calling handler
        if (pathSegments.length === 2 && pathSegments[1] === 'og-image' && request.method === 'GET') {
            const slugOrModId = pathSegments[0];
            const modId = await resolveSlugIfNeeded(slugOrModId, env, auth);
            if (!modId) {
                const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod was not found');
                const corsHeaders = createCORSHeaders(request, {
                    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                });
                return {
                    response: new Response(JSON.stringify(rfcError), {
                        status: 404,
                        headers: {
                            'Content-Type': 'application/problem+json',
                            ...Object.fromEntries(corsHeaders.entries()),
                        },
                    }),
                    customerId: auth?.customerId || null
                };
            }
            const response = await handleOGImage(request, env, modId, auth);
            // Don't encrypt image data
            return { response, customerId: auth?.customerId || null };
        }

        // Route: GET /mods/:slug/versions/:versionId/download or GET /:slug/versions/:versionId/download - Download version
        // CRITICAL: URL contains slug, but we must resolve to modId before calling handler
        // Normalized pathSegments = [slug, 'versions', versionId, 'download']
        if (pathSegments.length === 4 && pathSegments[1] === 'versions' && pathSegments[3] === 'download' && request.method === 'GET') {
            const slugOrModId = pathSegments[0];
            const versionId = pathSegments[2];
            console.log('[Router] Download request:', { path, pathSegments, slugOrModId, versionId, hasAuth: !!auth });
            
            // Resolve slug to modId (slug is for URL only, modId is for data lookup)
            const { resolveSlugToModId } = await import('../utils/slug-resolver.js');
            let modId = slugOrModId; // Assume it's already a modId first
            
            // Check if it looks like a slug (short, no mod_ prefix) vs modId (long with mod_ prefix or timestamp)
            const looksLikeSlug = !slugOrModId.startsWith('mod_') && slugOrModId.length < 30;
            if (looksLikeSlug) {
                const resolvedModId = await resolveSlugToModId(slugOrModId, env, auth);
                if (resolvedModId) {
                    modId = resolvedModId;
                    console.log('[Router] Resolved slug to modId:', { slug: slugOrModId, modId });
                } else {
                    console.error('[Router] Failed to resolve slug to modId:', { slug: slugOrModId });
                    const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod was not found');
                    const corsHeaders = createCORSHeaders(request, {
                        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                    });
                    return {
                        response: new Response(JSON.stringify(rfcError), {
                            status: 404,
                            headers: {
                                'Content-Type': 'application/problem+json',
                                ...Object.fromEntries(corsHeaders.entries()),
                            },
                        }),
                        customerId: auth?.customerId || null
                    };
                }
            }
            
            const response = await handleDownloadVersion(request, env, modId, versionId, auth);
            console.log('[Router] Download response:', { status: response.status, contentType: response.headers.get('content-type'), contentLength: response.headers.get('content-length') });
            // Downloads are binary files - DO NOT encrypt, return as-is
            return { response, customerId: auth?.customerId || null };
        }

        // Route: GET /mods/:slug/versions/:versionId/verify or GET /:slug/versions/:versionId/verify - Verify file integrity
        // CRITICAL: URL contains slug, but we must resolve to modId before calling handler
        if (pathSegments.length === 4 && pathSegments[1] === 'versions' && pathSegments[3] === 'verify' && request.method === 'GET') {
            const slugOrModId = pathSegments[0];
            const versionId = pathSegments[2];
            
            // Resolve slug to modId
            const { resolveSlugToModId } = await import('../utils/slug-resolver.js');
            let modId = slugOrModId;
            const looksLikeSlug = !slugOrModId.startsWith('mod_') && slugOrModId.length < 30;
            if (looksLikeSlug) {
                const resolvedModId = await resolveSlugToModId(slugOrModId, env, auth);
                if (resolvedModId) {
                    modId = resolvedModId;
                } else {
                    const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod was not found');
                    const corsHeaders = createCORSHeaders(request, {
                        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                    });
                    return {
                        response: new Response(JSON.stringify(rfcError), {
                            status: 404,
                            headers: {
                                'Content-Type': 'application/problem+json',
                                ...Object.fromEntries(corsHeaders.entries()),
                            },
                        }),
                        customerId: auth?.customerId || null
                    };
                }
            }
            
            const { handleVerifyVersion } = await import('../handlers/versions/verify.js');
            const response = await handleVerifyVersion(request, env, modId, versionId, auth);
            return await wrapWithEncryption(response, auth || undefined);
        }

        // Route: GET /mods/:slug/versions/:versionId/badge or GET /:slug/versions/:versionId/badge - Get integrity badge
        // CRITICAL: URL contains slug, but we must resolve to modId before calling handler
        if (pathSegments.length === 4 && pathSegments[1] === 'versions' && pathSegments[3] === 'badge' && request.method === 'GET') {
            const slugOrModId = pathSegments[0];
            const versionId = pathSegments[2];
            
            // Resolve slug to modId
            const { resolveSlugToModId } = await import('../utils/slug-resolver.js');
            let modId = slugOrModId;
            const looksLikeSlug = !slugOrModId.startsWith('mod_') && slugOrModId.length < 30;
            if (looksLikeSlug) {
                const resolvedModId = await resolveSlugToModId(slugOrModId, env, auth);
                if (resolvedModId) {
                    modId = resolvedModId;
                } else {
                    return {
                        response: new Response('Mod not found', { status: 404 }),
                        customerId: auth?.customerId || null
                    };
                }
            }
            
            const { handleBadge } = await import('../handlers/versions/badge.js');
            const response = await handleBadge(request, env, modId, versionId, auth);
            // Badges are SVG images - DO NOT encrypt
            return { response, customerId: auth?.customerId || null };
        }

        // 404 for unknown mod routes
        const rfcError = createError(request, 404, 'Endpoint Not Found', 'The requested mod endpoint was not found');
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return {
            response: new Response(JSON.stringify(rfcError), {
                status: 404,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            }),
            customerId: auth?.customerId || null
        };
    } catch (error: any) {
        console.error('Mod route handler error:', error);
        const rfcError = createError(
            request,
            500,
            'Internal Server Error',
            env.ENVIRONMENT === 'development' ? error.message : 'An internal server error occurred'
        );
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return {
            response: new Response(JSON.stringify(rfcError), {
                status: 500,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            }),
            customerId: auth?.customerId || null
        };
    }
}

/**
 * Route result interface
 */
interface RouteResult {
    response: Response;
    customerId: string | null;
}

/**
 * Environment interface
 */
interface Env {
    MODS_KV: KVNamespace;
    MODS_R2: R2Bucket;
    JWT_SECRET?: string;
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

