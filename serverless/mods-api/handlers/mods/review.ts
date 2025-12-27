/**
 * Mod review page handler
 * GET /mods/:slug/review
 * Returns mod detail with review information (only accessible to admins and uploader)
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey } from '../../utils/customer.js';
import { findModBySlug } from '../../utils/slug.js';
import { isSuperAdminEmail } from '../../utils/admin.js';
import type { ModMetadata, ModVersion, ModDetailResponse } from '../../types/mod.js';

/**
 * Handle get mod review request
 */
export async function handleGetModReview(
    request: Request,
    env: Env,
    slug: string,
    auth: { userId: string; customerId: string | null } | null
): Promise<Response> {
    try {
        // Must be authenticated
        if (!auth) {
            const rfcError = createError(request, 401, 'Unauthorized', 'Authentication required');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 401,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Find mod by slug
        const { mod: foundMod } = await findModBySlug(slug, env, auth?.customerId || null);
        let mod = foundMod;
        
        // Fallback: if slug lookup fails, try treating it as modId (backward compatibility)
        if (!mod) {
            // Check global/public scope (no customer prefix)
            const globalModKey = `mod_${slug}`;
            mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
            
            // If not found and authenticated, check customer scope
            if (!mod && auth?.customerId) {
                const customerModKey = getCustomerKey(auth.customerId, `mod_${slug}`);
                mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
            }
        }
        
        if (!mod) {
            const rfcError = createError(
                request,
                404,
                'Mod Not Found',
                'The requested mod was not found'
            );
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
        
        // Check access: only admin or uploader can access review page
        const isAdmin = auth.email && await isSuperAdminEmail(auth.email, env);
        const isUploader = mod.authorId === auth.userId;

        if (!isAdmin && !isUploader) {
            const rfcError = createError(
                request,
                403,
                'Forbidden',
                'Only admins and the mod author can access the review page'
            );
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
        
        const modId = mod.modId;

        // Get all versions - try global scope first, then customer scope
        let versionIds: string[] = [];
        
        // Check global scope first
        const globalVersionsKey = `mod_${modId}_versions`;
        const globalVersionsData = await env.MODS_KV.get(globalVersionsKey, { type: 'json' }) as string[] | null;
        if (globalVersionsData) {
            versionIds = globalVersionsData;
        } else if (auth?.customerId) {
            // Fall back to customer scope
            const customerVersionsKey = getCustomerKey(auth.customerId, `mod_${modId}_versions`);
            const customerVersionsData = await env.MODS_KV.get(customerVersionsKey, { type: 'json' }) as string[] | null;
            versionIds = customerVersionsData || [];
        }

        const versions: ModVersion[] = [];
        for (const versionId of versionIds) {
            // Try global scope first, then customer scope
            let version: ModVersion | null = null;
            
            const globalVersionKey = `version_${versionId}`;
            version = await env.MODS_KV.get(globalVersionKey, { type: 'json' }) as ModVersion | null;
            
            if (!version && auth?.customerId) {
                const customerVersionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
                version = await env.MODS_KV.get(customerVersionKey, { type: 'json' }) as ModVersion | null;
            }
            
            if (version) {
                versions.push(version);
            }
        }

        // Sort versions by semantic version (newest first)
        versions.sort((a, b) => {
            const aParts = a.version.split('.').map(Number);
            const bParts = b.version.split('.').map(Number);
            for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                const aPart = aParts[i] || 0;
                const bPart = bParts[i] || 0;
                if (aPart !== bPart) {
                    return bPart - aPart;
                }
            }
            return 0;
        });

        const response: ModDetailResponse = {
            mod,
            versions
        };

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Get mod review error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Get Mod Review',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while fetching mod review'
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
    ENVIRONMENT?: string;
    ALLOWED_ORIGINS?: string;
    SUPER_ADMIN_EMAILS?: string;
    [key: string]: any;
}

