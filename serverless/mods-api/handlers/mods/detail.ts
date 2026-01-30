/**
 * Get mod detail handler
 * GET /mods/:slug
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import {
    getEntity,
    getExistingEntities,
    indexGet,
    canAccessVisible,
} from '@strixun/kv-entities';
import type { ModMetadata, ModVersion, ModDetailResponse, VariantVersion } from '../../types/mod.js';
import type { AuthResult } from '../../utils/auth.js';

function sortByCreatedAtDesc(a: { createdAt?: string }, b: { createdAt?: string }): number {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return (isNaN(bTime) ? 0 : bTime) - (isNaN(aTime) ? 0 : aTime);
}

export async function handleGetModDetail(
    request: Request,
    env: Env,
    modId: string,
    auth: AuthResult | null
): Promise<Response> {
    try {
        let isAdmin = false;
        if (auth?.customerId) {
            const { isSuperAdmin } = await import('../../utils/admin.js');
            isAdmin = await isSuperAdmin(auth.customerId, auth.jwtToken, env);
        }
        
        const mod = await getEntity<ModMetadata>(env.MODS_KV, 'mods', 'mod', modId);
        
        if (!mod) {
            return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
        }
        
        const accessContext = { customerId: auth?.customerId || null, isAdmin };
        const modForAccess = { ...mod, id: mod.modId, visibility: mod.visibility || 'public' as const };
        
        if (!canAccessVisible(modForAccess, accessContext)) {
            if (mod.authorId !== auth?.customerId) {
                return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
            }
        }
        
        if (!isAdmin && mod.authorId !== auth?.customerId) {
            const modStatus = mod.status || 'published';
            if (modStatus !== 'published' && modStatus !== 'approved') {
                return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
            }
        }
        
        const versionIds = await indexGet(env.MODS_KV, 'mods', 'versions-for', modId);
        const versions = await getExistingEntities<ModVersion>(env.MODS_KV, 'mods', 'version', versionIds);
        versions.sort(sortByCreatedAtDesc);
        
        if (mod.customerId) {
            try {
                const { fetchDisplayNameByCustomerId } = await import('@strixun/api-framework');
                const displayName = await fetchDisplayNameByCustomerId(mod.customerId, env);
                if (displayName) {
                    mod.authorDisplayName = displayName;
                }
            } catch {
                // Use stored displayName as fallback
            }
        }
        
        if (mod.variants?.length) {
            mod.variants.sort(sortByCreatedAtDesc);
            
            for (const variant of mod.variants) {
                if (variant.currentVersionId) {
                    const variantVersion = await getEntity<VariantVersion>(
                        env.MODS_KV, 'mods', 'version', variant.currentVersionId
                    );
                    if (variantVersion?.fileName) {
                        variant.fileName = variantVersion.fileName;
                    }
                }
            }
        }
        
        const response: ModDetailResponse = { mod, versions };
        
        return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...corsHeaders(request, env),
            },
        });
        
    } catch (error: any) {
        console.error('Get mod detail error:', error);
        return errorResponse(
            request, env, 500, 
            'Failed to Get Mod Detail',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred'
        );
    }
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
    const headers = createCORSHeaders(request, { 
        credentials: true, 
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map((o: string) => o.trim()) || ['*'],
    });
    return Object.fromEntries(headers.entries());
}

function errorResponse(request: Request, env: Env, status: number, title: string, detail: string): Response {
    const rfcError = createError(request, status, title, detail);
    return new Response(JSON.stringify(rfcError), {
        status,
        headers: { 'Content-Type': 'application/problem+json', ...corsHeaders(request, env) },
    });
}

interface Env {
    MODS_KV: KVNamespace;
    ENVIRONMENT?: string;
    ALLOWED_ORIGINS?: string;
    [key: string]: any;
}
