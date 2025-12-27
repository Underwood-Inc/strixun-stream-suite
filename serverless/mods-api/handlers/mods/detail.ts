/**
 * Get mod detail handler
 * GET /mods/:slug
 * Accepts slug (URL-friendly identifier) and looks up mod by slug
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey } from '../../utils/customer.js';
import { findModBySlug } from '../../utils/slug.js';
import type { ModMetadata, ModVersion, ModDetailResponse } from '../../types/mod.js';

/**
 * Handle get mod detail request
 */
export async function handleGetModDetail(
    request: Request,
    env: Env,
    slug: string,
    auth: { userId: string; customerId: string | null } | null
): Promise<Response> {
    try {
        // Find mod by slug
        let mod = await findModBySlug(slug, env, auth);
        
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
        
        const modId = mod.modId;

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

        // Check visibility
        if (mod.visibility === 'private' && mod.authorId !== auth?.userId) {
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

        // Check status: only show published mods to public, admins and authors can see all statuses
        const { isSuperAdminEmail } = await import('../../utils/admin.js');
        const isAdmin = auth?.email ? await isSuperAdminEmail(auth.email, env) : false;
        const isAuthor = mod.authorId === auth?.userId;
        
        if (mod.status && mod.status !== 'published') {
            // Only show non-published mods to admins or the author
            if (!isAuthor && !isAdmin) {
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
        }

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
        console.error('Get mod detail error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Get Mod Detail',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while fetching mod details'
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
    [key: string]: any;
}

