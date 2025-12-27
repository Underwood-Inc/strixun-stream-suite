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
 */
export async function handleModRoutes(request: Request, path: string, env: Env): Promise<RouteResult | null> {
    // Only handle /mods/* routes
    if (!path.startsWith('/mods')) {
        return null;
    }

    // Authenticate request (optional for public endpoints)
    const auth = await authenticateRequest(request, env);

    try {
        // Parse path segments
        const pathSegments = path.split('/').filter(Boolean);
        
        // Route: GET /mods - List mods
        if (pathSegments.length === 1 && pathSegments[0] === 'mods' && request.method === 'GET') {
            const response = await handleListMods(request, env, auth);
            return await wrapWithEncryption(response, auth || undefined);
        }

        // Route: POST /mods - Upload new mod
        if (pathSegments.length === 1 && pathSegments[0] === 'mods' && request.method === 'POST') {
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

        // Route: GET /mods/permissions/me - Get current user's upload permissions
        if (pathSegments.length === 3 && pathSegments[0] === 'mods' && pathSegments[1] === 'permissions' && pathSegments[2] === 'me' && request.method === 'GET') {
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

        // Route: GET /mods/:slug/review - Get mod review page (admin/uploader only)
        if (pathSegments.length === 3 && pathSegments[0] === 'mods' && pathSegments[2] === 'review' && request.method === 'GET') {
            const slug = pathSegments[1];
            const { handleGetModReview } = await import('../handlers/mods/review.js');
            const response = await handleGetModReview(request, env, slug, auth);
            return await wrapWithEncryption(response, auth || undefined);
        }

        // Route: GET /mods/:slug - Get mod detail (by slug)
        if (pathSegments.length === 2 && pathSegments[0] === 'mods' && request.method === 'GET') {
            const slug = pathSegments[1];
            const response = await handleGetModDetail(request, env, slug, auth);
            return await wrapWithEncryption(response, auth || undefined);
        }

        // Route: PATCH /mods/:slug - Update mod (by slug)
        if (pathSegments.length === 2 && pathSegments[0] === 'mods' && request.method === 'PATCH') {
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
            const slug = pathSegments[1];
            const response = await handleUpdateMod(request, env, slug, auth);
            return await wrapWithEncryption(response, auth);
        }

        // Route: DELETE /mods/:slug - Delete mod (by slug)
        if (pathSegments.length === 2 && pathSegments[0] === 'mods' && request.method === 'DELETE') {
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
            const slug = pathSegments[1];
            const response = await handleDeleteMod(request, env, slug, auth);
            return await wrapWithEncryption(response, auth);
        }

        // Route: GET /mods/:modId/ratings - Get ratings for a mod
        if (pathSegments.length === 3 && pathSegments[0] === 'mods' && pathSegments[2] === 'ratings' && request.method === 'GET') {
            const modId = pathSegments[1];
            const { handleGetModRatings } = await import('../handlers/mods/ratings.js');
            const response = await handleGetModRatings(request, env, modId, auth);
            return await wrapWithEncryption(response, auth || undefined);
        }

        // Route: POST /mods/:modId/ratings - Submit a rating for a mod
        if (pathSegments.length === 3 && pathSegments[0] === 'mods' && pathSegments[2] === 'ratings' && request.method === 'POST') {
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
            const modId = pathSegments[1];
            const { handleSubmitModRating } = await import('../handlers/mods/ratings.js');
            const response = await handleSubmitModRating(request, env, modId, auth);
            return await wrapWithEncryption(response, auth);
        }

        // Route: POST /mods/:modId/versions - Upload new version
        if (pathSegments.length === 3 && pathSegments[0] === 'mods' && pathSegments[2] === 'versions' && request.method === 'POST') {
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
            const modId = pathSegments[1];
            const response = await handleUploadVersion(request, env, modId, auth);
            return await wrapWithEncryption(response, auth);
        }

        // Route: GET /mods/:modId/thumbnail - Get thumbnail
        if (pathSegments.length === 3 && pathSegments[0] === 'mods' && pathSegments[2] === 'thumbnail' && request.method === 'GET') {
            const modId = pathSegments[1];
            const response = await handleThumbnail(request, env, modId, auth);
            // Don't encrypt binary image data
            return { response, customerId: auth?.customerId || null };
        }

        // Route: GET /mods/:slug/og-image - Get Open Graph preview image
        if (pathSegments.length === 3 && pathSegments[0] === 'mods' && pathSegments[2] === 'og-image' && request.method === 'GET') {
            const slug = pathSegments[1];
            const response = await handleOGImage(request, env, slug, auth);
            // Don't encrypt image data
            return { response, customerId: auth?.customerId || null };
        }

        // Route: GET /mods/:modId/versions/:versionId/download - Download version
        // Path: /mods/:modId/versions/:versionId/download
        // pathSegments = ['mods', modId, 'versions', versionId, 'download']
        if (pathSegments.length === 5 && pathSegments[0] === 'mods' && pathSegments[2] === 'versions' && pathSegments[4] === 'download' && request.method === 'GET') {
            const modId = pathSegments[1];
            const versionId = pathSegments[3];
            const response = await handleDownloadVersion(request, env, modId, versionId, auth);
            // Downloads are binary files - DO NOT encrypt, return as-is
            return { response, customerId: auth?.customerId || null };
        }

        // Route: GET /mods/:modId/versions/:versionId/verify - Verify file integrity
        // Path: /mods/:modId/versions/:versionId/verify
        if (pathSegments.length === 5 && pathSegments[0] === 'mods' && pathSegments[2] === 'versions' && pathSegments[4] === 'verify' && request.method === 'GET') {
            const modId = pathSegments[1];
            const versionId = pathSegments[3];
            const { handleVerifyVersion } = await import('../handlers/versions/verify.js');
            const response = await handleVerifyVersion(request, env, modId, versionId, auth);
            return await wrapWithEncryption(response, auth || undefined);
        }

        // Route: GET /mods/:modId/versions/:versionId/badge - Get integrity badge
        // Path: /mods/:modId/versions/:versionId/badge
        if (pathSegments.length === 5 && pathSegments[0] === 'mods' && pathSegments[2] === 'versions' && pathSegments[4] === 'badge' && request.method === 'GET') {
            const modId = pathSegments[1];
            const versionId = pathSegments[3];
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

