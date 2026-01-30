/**
 * Entities Handler
 * Admin endpoints for viewing mod entity hierarchies with relationships
 * 
 * Endpoints:
 * - GET /admin/entities/mods - List all mods with version/variant counts
 * - GET /admin/entities/mods/:modId - Full mod detail with versions and variants
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getEntity, indexGet, getExistingEntities } from '@strixun/kv-entities';
import type { ModMetadata, ModVersion, ModVariant } from '../../types/mod.js';

interface ModEntitySummary {
    modId: string;
    title: string;
    slug: string;
    authorId: string;
    authorDisplayName?: string;
    status: string;
    visibility: string;
    category: string;
    downloadCount: number;
    createdAt: string;
    updatedAt: string;
    versionCount: number;
    variantCount: number;
    hasR2Thumbnail: boolean;
    thumbnailExtension?: string;
}

interface ModEntityListResponse {
    mods: ModEntitySummary[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

interface VersionEntityDetail {
    versionId: string;
    version: string;
    modId: string;
    fileName?: string;
    fileSize?: number;
    downloadCount: number;
    createdAt: string;
    updatedAt: string;
    r2FileKey?: string;
    r2FileExists?: boolean;
    variants: VariantEntityDetail[];
}

interface VariantEntityDetail {
    variantId: string;
    name: string;
    versionId: string;
    modId: string;
    fileName?: string;
    fileSize?: number;
    downloadCount: number;
    createdAt: string;
    r2FileKey?: string;
    r2FileExists?: boolean;
}

interface ModEntityDetailResponse {
    mod: ModMetadata & {
        r2ThumbnailKey?: string;
        r2ThumbnailExists?: boolean;
    };
    versions: VersionEntityDetail[];
    kvKeys: Array<{
        key: string;
        type: string;
        description: string;
    }>;
}

/**
 * List all mods with version/variant counts
 * GET /admin/entities/mods?page=1&pageSize=50&search=xxx
 */
export async function handleListModEntities(
    request: Request,
    env: Env,
    _auth: { customerId: string }
): Promise<Response> {
    try {
        const url = new URL(request.url);
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
        const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '50', 10)));
        const search = url.searchParams.get('search')?.toLowerCase() || '';
        
        console.log('[Entities] Listing mod entities', { page, pageSize, search });
        
        // Get all mods by listing keys
        const allMods: ModEntitySummary[] = [];
        let cursor: string | undefined;
        
        do {
            const listResult = await env.MODS_KV.list({
                prefix: 'mods:mod:',
                limit: 1000,
                cursor,
            });
            
            for (const key of listResult.keys) {
                const modId = key.name.replace('mods:mod:', '');
                const mod = await getEntity<ModMetadata>(env.MODS_KV, 'mods', 'mod', modId);
                
                if (!mod) continue;
                
                // Apply search filter
                if (search) {
                    const searchable = [
                        mod.title,
                        mod.slug,
                        mod.authorId,
                        mod.authorDisplayName,
                        mod.category,
                    ].filter(Boolean).join(' ').toLowerCase();
                    
                    if (!searchable.includes(search)) continue;
                }
                
                // Get version count
                const versionIds = await indexGet<string[]>(env.MODS_KV, 'mods', 'versions-for', modId) || [];
                
                // Get variant count across all versions
                let variantCount = 0;
                for (const versionId of versionIds) {
                    const variantIds = await indexGet<string[]>(env.MODS_KV, 'mods', 'variants-for', versionId) || [];
                    variantCount += variantIds.length;
                }
                
                // Check R2 thumbnail exists
                let hasR2Thumbnail = false;
                const extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
                for (const ext of extensions) {
                    const r2Key = `thumbnails/${modId}.${ext}`;
                    const file = await env.MODS_R2.head(r2Key);
                    if (file) {
                        hasR2Thumbnail = true;
                        break;
                    }
                }
                
                allMods.push({
                    modId: mod.modId,
                    title: mod.title,
                    slug: mod.slug,
                    authorId: mod.authorId,
                    authorDisplayName: mod.authorDisplayName,
                    status: mod.status || 'published',
                    visibility: mod.visibility || 'public',
                    category: mod.category,
                    downloadCount: mod.downloadCount || 0,
                    createdAt: mod.createdAt,
                    updatedAt: mod.updatedAt,
                    versionCount: versionIds.length,
                    variantCount,
                    hasR2Thumbnail,
                    thumbnailExtension: mod.thumbnailExtension,
                });
            }
            
            cursor = listResult.list_complete ? undefined : listResult.cursor;
        } while (cursor);
        
        // Sort by createdAt descending (newest first)
        allMods.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        // Paginate
        const start = (page - 1) * pageSize;
        const paginatedMods = allMods.slice(start, start + pageSize);
        
        const response: ModEntityListResponse = {
            mods: paginatedMods,
            total: allMods.length,
            page,
            pageSize,
            hasMore: start + pageSize < allMods.length,
        };
        
        return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders(request, env).entries()),
            },
        });
    } catch (error: unknown) {
        console.error('[Entities] List mod entities error:', error);
        return errorResponse(
            request, env, 500, 'Failed to List Mod Entities',
            env.ENVIRONMENT === 'development' ? (error as Error).message : 'An error occurred'
        );
    }
}

/**
 * Get full mod entity detail with versions and variants
 * GET /admin/entities/mods/:modId
 */
export async function handleGetModEntityDetail(
    request: Request,
    env: Env,
    modId: string,
    _auth: { customerId: string }
): Promise<Response> {
    try {
        console.log('[Entities] Getting mod entity detail', { modId });
        
        // Get mod
        const mod = await getEntity<ModMetadata>(env.MODS_KV, 'mods', 'mod', modId);
        
        if (!mod) {
            return errorResponse(request, env, 404, 'Mod Not Found', `Mod with ID "${modId}" does not exist`);
        }
        
        // Check R2 thumbnail
        let r2ThumbnailExists = false;
        let r2ThumbnailKey: string | undefined;
        const extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
        for (const ext of extensions) {
            const key = `thumbnails/${modId}.${ext}`;
            const file = await env.MODS_R2.head(key);
            if (file) {
                r2ThumbnailExists = true;
                r2ThumbnailKey = key;
                break;
            }
        }
        
        // Get version IDs
        const versionIds = await indexGet<string[]>(env.MODS_KV, 'mods', 'versions-for', modId) || [];
        
        // Get versions with their variants
        const versions: VersionEntityDetail[] = [];
        
        for (const versionId of versionIds) {
            const version = await getEntity<ModVersion>(env.MODS_KV, 'mods', 'version', versionId);
            if (!version) continue;
            
            // Check R2 file exists for version
            let versionR2Exists = false;
            let versionR2Key: string | undefined;
            if (version.fileName) {
                versionR2Key = `mods/${modId}/${versionId}/${version.fileName}`;
                const file = await env.MODS_R2.head(versionR2Key);
                versionR2Exists = !!file;
            }
            
            // Get variant IDs
            const variantIds = await indexGet<string[]>(env.MODS_KV, 'mods', 'variants-for', versionId) || [];
            
            // Get variants
            const variants: VariantEntityDetail[] = [];
            for (const variantId of variantIds) {
                const variant = await getEntity<ModVariant>(env.MODS_KV, 'mods', 'variant', variantId);
                if (!variant) continue;
                
                // Check R2 file exists for variant
                let variantR2Exists = false;
                let variantR2Key: string | undefined;
                if (variant.fileName) {
                    variantR2Key = `mods/${modId}/${versionId}/variants/${variantId}/${variant.fileName}`;
                    const file = await env.MODS_R2.head(variantR2Key);
                    variantR2Exists = !!file;
                }
                
                variants.push({
                    variantId: variant.variantId,
                    name: variant.name,
                    versionId: variant.versionId,
                    modId: variant.modId,
                    fileName: variant.fileName,
                    fileSize: variant.fileSize,
                    downloadCount: variant.downloadCount || 0,
                    createdAt: variant.createdAt,
                    r2FileKey: variantR2Key,
                    r2FileExists: variantR2Exists,
                });
            }
            
            versions.push({
                versionId: version.versionId,
                version: version.version,
                modId: version.modId,
                fileName: version.fileName,
                fileSize: version.fileSize,
                downloadCount: version.downloadCount || 0,
                createdAt: version.createdAt,
                updatedAt: version.updatedAt,
                r2FileKey: versionR2Key,
                r2FileExists: versionR2Exists,
                variants,
            });
        }
        
        // Sort versions by createdAt descending
        versions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        // Build list of related KV keys
        const kvKeys: ModEntityDetailResponse['kvKeys'] = [
            { key: `mods:mod:${modId}`, type: 'entity', description: 'Mod metadata' },
            { key: `idx:mods:slug-to-mod:${mod.slug}`, type: 'index', description: 'Slug to modId mapping' },
            { key: `idx:mods:versions-for:${modId}`, type: 'index', description: 'Version IDs list' },
            { key: `idx:mods:author:${mod.authorId}`, type: 'index', description: 'Author mod list' },
        ];
        
        for (const version of versions) {
            kvKeys.push({ key: `mods:version:${version.versionId}`, type: 'entity', description: `Version ${version.version}` });
            kvKeys.push({ key: `idx:mods:variants-for:${version.versionId}`, type: 'index', description: `Variants for v${version.version}` });
            
            for (const variant of version.variants) {
                kvKeys.push({ key: `mods:variant:${variant.variantId}`, type: 'entity', description: `Variant: ${variant.name}` });
            }
        }
        
        const response: ModEntityDetailResponse = {
            mod: {
                ...mod,
                r2ThumbnailKey,
                r2ThumbnailExists,
            },
            versions,
            kvKeys,
        };
        
        return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders(request, env).entries()),
            },
        });
    } catch (error: unknown) {
        console.error('[Entities] Get mod entity detail error:', error);
        return errorResponse(
            request, env, 500, 'Failed to Get Mod Entity Detail',
            env.ENVIRONMENT === 'development' ? (error as Error).message : 'An error occurred'
        );
    }
}

function corsHeaders(request: Request, env: Env): Headers {
    return createCORSHeaders(request, {
        credentials: true,
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
    });
}

function errorResponse(request: Request, env: Env, status: number, title: string, detail: string): Response {
    const rfcError = createError(request, status, title, detail);
    return new Response(JSON.stringify(rfcError), {
        status,
        headers: {
            'Content-Type': 'application/problem+json',
            ...Object.fromEntries(corsHeaders(request, env).entries()),
        },
    });
}

interface Env {
    MODS_KV: KVNamespace;
    MODS_R2: R2Bucket;
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: unknown;
}
