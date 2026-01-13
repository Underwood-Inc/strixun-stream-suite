/**
 * Mod review page handler
 * GET /mods/:slug/review
 * Returns mod detail with review information (only accessible to admins and uploader)
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, normalizeModId } from '../../utils/customer.js';
import { isAdmin as checkIsAdmin } from '../../utils/admin.js';
import type { ModMetadata, ModVersion, ModDetailResponse } from '../../types/mod.js';

/**
 * Handle get mod review request
 */
export async function handleGetModReview(
    request: Request,
    env: Env,
    modId: string,
    auth: { customerId: string; jwtToken?: string } | null
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

        // Get mod metadata by modId only (slug should be resolved to modId before calling this)
        let mod: ModMetadata | null = null;
        const normalizedModId = normalizeModId(modId);
        
        // Check customer scope first
        if (auth.customerId) {
            const customerModKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
            mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
        }
        
        // Fall back to global scope if not found
        if (!mod) {
            const globalModKey = `mod_${normalizedModId}`;
            mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
        }
        
        // If still not found, search all customer scopes
        if (!mod) {
            const customerListPrefix = 'customer_';
            let cursor: string | undefined;
            
            do {
                const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor });
                for (const key of listResult.keys) {
                    if (key.name.endsWith('_mods_list')) {
                        const match = key.name.match(/^customer_([^_/]+)[_/]mods_list$/);
                        const customerId = match ? match[1] : null;
                        if (customerId) {
                            const customerModKey = getCustomerKey(customerId, `mod_${normalizedModId}`);
                            mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                            if (mod) break;
                        }
                    }
                }
                if (mod) break;
                cursor = listResult.list_complete ? undefined : listResult.cursor;
            } while (cursor);
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
        // Extract JWT token from auth object or from cookie
        let jwtToken: string | null = null;
        if (auth.jwtToken) {
            jwtToken = auth.jwtToken;
        } else {
            // Fallback: extract from cookie if not in auth object
            const cookieHeader = request.headers.get('Cookie');
            if (cookieHeader) {
                const cookies = cookieHeader.split(';').map(c => c.trim());
                const authCookie = cookies.find(c => c.startsWith('auth_token='));
                if (authCookie) {
                    jwtToken = authCookie.substring('auth_token='.length).trim();
                }
            }
        }
        const isAdmin = auth.customerId && jwtToken ? await checkIsAdmin(auth.customerId, jwtToken, env) : false;
        const isUploader = mod.authorId === auth.customerId;

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
        
        // Normalize modId to ensure consistent key generation (strip mod_ prefix if present)
        const normalizedStoredModId = normalizeModId(mod.modId);

        // Get all versions - try global scope first, then mod's customer scope
        // CRITICAL: Use mod.customerId (where mod was uploaded), not auth.customerId
        let versionIds: string[] = [];
        
        // Check global scope first
        const globalVersionsKey = `mod_${normalizedStoredModId}_versions`;
        const globalVersionsData = await env.MODS_KV.get(globalVersionsKey, { type: 'json' }) as string[] | null;
        if (globalVersionsData) {
            versionIds = globalVersionsData;
        } else if (mod.customerId) {
            // Fall back to mod's customer scope (where it was uploaded)
            const customerVersionsKey = getCustomerKey(mod.customerId, `mod_${normalizedStoredModId}_versions`);
            const customerVersionsData = await env.MODS_KV.get(customerVersionsKey, { type: 'json' }) as string[] | null;
            versionIds = customerVersionsData || [];
        } else if (auth?.customerId) {
            // Last resort: try auth user's customer scope (for backward compatibility)
            const customerVersionsKey = getCustomerKey(auth.customerId, `mod_${normalizedStoredModId}_versions`);
            const customerVersionsData = await env.MODS_KV.get(customerVersionsKey, { type: 'json' }) as string[] | null;
            versionIds = customerVersionsData || [];
        }

        const versions: ModVersion[] = [];
        for (const versionId of versionIds) {
            // Try global scope first, then mod's customer scope
            let version: ModVersion | null = null;
            
            const globalVersionKey = `version_${versionId}`;
            version = await env.MODS_KV.get(globalVersionKey, { type: 'json' }) as ModVersion | null;
            
            if (!version && mod.customerId) {
                // Try mod's customer scope (where version was uploaded)
                const customerVersionKey = getCustomerKey(mod.customerId, `version_${versionId}`);
                version = await env.MODS_KV.get(customerVersionKey, { type: 'json' }) as ModVersion | null;
            }
            
            if (!version && auth?.customerId && auth.customerId !== mod.customerId) {
                // Last resort: try auth user's customer scope (for backward compatibility)
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

