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
        if (pathSegments.length === 0 && request.method === 'GET') {
            const response = await handleListMods(request, env, auth);
            return await wrapWithEncryption(response, auth || undefined);
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
        if (pathSegments.length === 2 && pathSegments[1] === 'review' && request.method === 'GET') {
            const slug = pathSegments[0];
            const { handleGetModReview } = await import('../handlers/mods/review.js');
            const response = await handleGetModReview(request, env, slug, auth);
            return await wrapWithEncryption(response, auth || undefined);
        }

        // Route: GET /mods/:slug or GET /:slug - Get mod detail (by slug)
        if (pathSegments.length === 1 && request.method === 'GET') {
            const slug = pathSegments[0];
            const response = await handleGetModDetail(request, env, slug, auth);
            return await wrapWithEncryption(response, auth || undefined);
        }

        // Route: PATCH /mods/:slug or PATCH /:slug - Update mod (by slug)
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
            const slug = pathSegments[0];
            const response = await handleUpdateMod(request, env, slug, auth);
            return await wrapWithEncryption(response, auth);
        }

        // Route: DELETE /mods/:slug or DELETE /:slug - Delete mod (by slug)
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
            const slug = pathSegments[0];
            const response = await handleDeleteMod(request, env, slug, auth);
            return await wrapWithEncryption(response, auth);
        }

        // Route: GET /mods/:modId/ratings or GET /:modId/ratings - Get ratings for a mod
        if (pathSegments.length === 2 && pathSegments[1] === 'ratings' && request.method === 'GET') {
            const modId = pathSegments[0];
            const { handleGetModRatings } = await import('../handlers/mods/ratings.js');
            const response = await handleGetModRatings(request, env, modId, auth);
            return await wrapWithEncryption(response, auth || undefined);
        }

        // Route: POST /mods/:modId/ratings or POST /:modId/ratings - Submit a rating for a mod
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
            const modId = pathSegments[0];
            const { handleSubmitModRating } = await import('../handlers/mods/ratings.js');
            const response = await handleSubmitModRating(request, env, modId, auth);
            return await wrapWithEncryption(response, auth);
        }

        // Route: POST /mods/:modId/versions or POST /:modId/versions - Upload new version
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
            const modId = pathSegments[0];
            const response = await handleUploadVersion(request, env, modId, auth);
            return await wrapWithEncryption(response, auth);
        }

        // Route: GET /mods/:modId/thumbnail or GET /:modId/thumbnail - Get thumbnail
        if (pathSegments.length === 2 && pathSegments[1] === 'thumbnail' && request.method === 'GET') {
            const modId = pathSegments[0];
            const response = await handleThumbnail(request, env, modId, auth);
            // Don't encrypt binary image data
            return { response, customerId: auth?.customerId || null };
        }

        // Route: GET /mods/:slug/og-image or GET /:slug/og-image - Get Open Graph preview image
        if (pathSegments.length === 2 && pathSegments[1] === 'og-image' && request.method === 'GET') {
            const slug = pathSegments[0];
            const response = await handleOGImage(request, env, slug, auth);
            // Don't encrypt image data
            return { response, customerId: auth?.customerId || null };
        }

        // Route: GET /mods/:modId/versions/:versionId/download or GET /:modId/versions/:versionId/download - Download version
        // Normalized pathSegments = [modId, 'versions', versionId, 'download']
        if (pathSegments.length === 4 && pathSegments[1] === 'versions' && pathSegments[3] === 'download' && request.method === 'GET') {
            const modId = pathSegments[0];
            const versionId = pathSegments[2];
            const response = await handleDownloadVersion(request, env, modId, versionId, auth);
            // Downloads are binary files - DO NOT encrypt, return as-is
            return { response, customerId: auth?.customerId || null };
        }

        // Route: GET /mods/:modId/versions/:versionId/verify or GET /:modId/versions/:versionId/verify - Verify file integrity
        // Normalized pathSegments = [modId, 'versions', versionId, 'verify']
        if (pathSegments.length === 4 && pathSegments[1] === 'versions' && pathSegments[3] === 'verify' && request.method === 'GET') {
            const modId = pathSegments[0];
            const versionId = pathSegments[2];
            const { handleVerifyVersion } = await import('../handlers/versions/verify.js');
            const response = await handleVerifyVersion(request, env, modId, versionId, auth);
            return await wrapWithEncryption(response, auth || undefined);
        }

        // Route: GET /mods/:modId/versions/:versionId/badge or GET /:modId/versions/:versionId/badge - Get integrity badge
        // Normalized pathSegments = [modId, 'versions', versionId, 'badge']
        if (pathSegments.length === 4 && pathSegments[1] === 'versions' && pathSegments[3] === 'badge' && request.method === 'GET') {
            const modId = pathSegments[0];
            const versionId = pathSegments[2];
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

