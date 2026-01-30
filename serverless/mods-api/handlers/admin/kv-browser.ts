/**
 * KV Browser Handler
 * Admin endpoints for browsing and inspecting KV storage
 * 
 * Endpoints:
 * - GET /admin/kv/keys - List KV keys with optional prefix filter
 * - GET /admin/kv/keys/:encodedKey - Get single key value
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';

interface KVKeyInfo {
    name: string;
    expiration?: number;
    metadata?: Record<string, unknown>;
}

interface KVKeyListResponse {
    keys: Array<{
        key: string;
        expiration?: number;
        metadata?: Record<string, unknown>;
        valuePreview?: string;
        valueSize?: number;
        entityType?: string;
    }>;
    cursor?: string;
    hasMore: boolean;
    total: number;
    prefix?: string;
}

interface KVKeyValueResponse {
    key: string;
    value: unknown;
    valueType: 'json' | 'string' | 'binary';
    valueSize: number;
    expiration?: number;
    metadata?: Record<string, unknown>;
    entityType?: string;
    relatedEntities?: Array<{
        type: string;
        id: string;
        key: string;
    }>;
}

/**
 * Detect entity type from KV key
 */
function detectEntityType(key: string): string | undefined {
    if (key.startsWith('mods:mod:')) return 'mod';
    if (key.startsWith('mods:version:')) return 'version';
    if (key.startsWith('mods:variant:')) return 'variant';
    if (key.startsWith('idx:mods:slug-to-mod:')) return 'index:slug';
    if (key.startsWith('idx:mods:versions-for:')) return 'index:versions';
    if (key.startsWith('idx:mods:variants-for:')) return 'index:variants';
    if (key.startsWith('idx:mods:author:')) return 'index:author';
    if (key.startsWith('admin:')) return 'admin';
    if (key.startsWith('migration_')) return 'migration';
    return undefined;
}

/**
 * Extract related entities from value
 */
function extractRelatedEntities(key: string, value: unknown): Array<{ type: string; id: string; key: string }> {
    const related: Array<{ type: string; id: string; key: string }> = [];
    
    if (!value || typeof value !== 'object') return related;
    
    const obj = value as Record<string, unknown>;
    
    // Extract modId
    if (obj.modId && typeof obj.modId === 'string') {
        related.push({
            type: 'mod',
            id: obj.modId,
            key: `mods:mod:${obj.modId}`
        });
    }
    
    // Extract versionId
    if (obj.versionId && typeof obj.versionId === 'string') {
        related.push({
            type: 'version',
            id: obj.versionId,
            key: `mods:version:${obj.versionId}`
        });
    }
    
    // Extract variantId
    if (obj.variantId && typeof obj.variantId === 'string') {
        related.push({
            type: 'variant',
            id: obj.variantId,
            key: `mods:variant:${obj.variantId}`
        });
    }
    
    // Extract authorId
    if (obj.authorId && typeof obj.authorId === 'string') {
        related.push({
            type: 'author',
            id: obj.authorId,
            key: `idx:mods:author:${obj.authorId}`
        });
    }
    
    return related.filter(r => r.key !== key); // Don't include self
}

/**
 * Get value preview (truncated for list view)
 */
function getValuePreview(value: unknown, maxLength: number = 100): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    
    if (typeof value === 'string') {
        return value.length > maxLength ? value.substring(0, maxLength) + '...' : value;
    }
    
    const json = JSON.stringify(value);
    return json.length > maxLength ? json.substring(0, maxLength) + '...' : json;
}

/**
 * List KV keys with optional prefix filter
 * GET /admin/kv/keys?prefix=mods:mod:&limit=100&cursor=xxx&includePreview=true
 */
export async function handleListKVKeys(
    request: Request,
    env: Env,
    _auth: { customerId: string }
): Promise<Response> {
    try {
        const url = new URL(request.url);
        const prefix = url.searchParams.get('prefix') || '';
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 1000);
        const cursor = url.searchParams.get('cursor') || undefined;
        const includePreview = url.searchParams.get('includePreview') === 'true';
        
        console.log('[KVBrowser] Listing keys', { prefix, limit, cursor, includePreview });
        
        const listResult = await env.MODS_KV.list({
            prefix: prefix || undefined,
            limit,
            cursor,
        });
        
        const keys: KVKeyListResponse['keys'] = [];
        
        for (const key of listResult.keys) {
            const keyInfo: KVKeyListResponse['keys'][0] = {
                key: key.name,
                expiration: key.expiration,
                metadata: key.metadata as Record<string, unknown> | undefined,
                entityType: detectEntityType(key.name),
            };
            
            // Include value preview if requested (more expensive - requires fetching each value)
            if (includePreview) {
                try {
                    const value = await env.MODS_KV.get(key.name, { type: 'text' });
                    if (value !== null) {
                        keyInfo.valueSize = value.length;
                        try {
                            const parsed = JSON.parse(value);
                            keyInfo.valuePreview = getValuePreview(parsed);
                        } catch {
                            keyInfo.valuePreview = getValuePreview(value);
                        }
                    }
                } catch (e) {
                    keyInfo.valuePreview = '[Error reading value]';
                }
            }
            
            keys.push(keyInfo);
        }
        
        const response: KVKeyListResponse = {
            keys,
            cursor: listResult.list_complete ? undefined : listResult.cursor,
            hasMore: !listResult.list_complete,
            total: keys.length,
            prefix: prefix || undefined,
        };
        
        return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders(request, env).entries()),
            },
        });
    } catch (error: unknown) {
        console.error('[KVBrowser] List keys error:', error);
        return errorResponse(
            request, env, 500, 'Failed to List KV Keys',
            env.ENVIRONMENT === 'development' ? (error as Error).message : 'An error occurred'
        );
    }
}

/**
 * Get single KV key value
 * GET /admin/kv/keys/:encodedKey
 */
export async function handleGetKVValue(
    request: Request,
    env: Env,
    encodedKey: string,
    _auth: { customerId: string }
): Promise<Response> {
    try {
        const key = decodeURIComponent(encodedKey);
        
        console.log('[KVBrowser] Getting key value', { key });
        
        // Get value as text first
        const textValue = await env.MODS_KV.get(key, { type: 'text' });
        
        if (textValue === null) {
            return errorResponse(request, env, 404, 'Key Not Found', `KV key "${key}" does not exist`);
        }
        
        // Try to parse as JSON
        let value: unknown;
        let valueType: 'json' | 'string' = 'string';
        
        try {
            value = JSON.parse(textValue);
            valueType = 'json';
        } catch {
            value = textValue;
        }
        
        // Get metadata via list (only way to get expiration)
        const listResult = await env.MODS_KV.list({ prefix: key, limit: 1 });
        const keyMeta = listResult.keys.find(k => k.name === key);
        
        const response: KVKeyValueResponse = {
            key,
            value,
            valueType,
            valueSize: textValue.length,
            expiration: keyMeta?.expiration,
            metadata: keyMeta?.metadata as Record<string, unknown> | undefined,
            entityType: detectEntityType(key),
            relatedEntities: extractRelatedEntities(key, value),
        };
        
        return new Response(JSON.stringify(response), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders(request, env).entries()),
            },
        });
    } catch (error: unknown) {
        console.error('[KVBrowser] Get key value error:', error);
        return errorResponse(
            request, env, 500, 'Failed to Get KV Value',
            env.ENVIRONMENT === 'development' ? (error as Error).message : 'An error occurred'
        );
    }
}

/**
 * Get KV key prefixes for quick navigation
 * GET /admin/kv/prefixes
 */
export async function handleGetKVPrefixes(
    request: Request,
    env: Env,
    _auth: { customerId: string }
): Promise<Response> {
    try {
        // Define known prefixes in the mods-api KV namespace
        const prefixes = [
            { prefix: 'mods:mod:', label: 'Mods', description: 'Mod entity records' },
            { prefix: 'mods:version:', label: 'Versions', description: 'Mod version records' },
            { prefix: 'mods:variant:', label: 'Variants', description: 'Mod variant records' },
            { prefix: 'idx:mods:slug-to-mod:', label: 'Slug Index', description: 'Slug to modId mapping' },
            { prefix: 'idx:mods:versions-for:', label: 'Versions Index', description: 'ModId to version IDs' },
            { prefix: 'idx:mods:variants-for:', label: 'Variants Index', description: 'VersionId to variant IDs' },
            { prefix: 'idx:mods:author:', label: 'Author Index', description: 'AuthorId to mod IDs' },
            { prefix: 'admin:', label: 'Admin Settings', description: 'Admin configuration' },
            { prefix: 'migration_', label: 'Migrations', description: 'Migration tracking keys' },
        ];
        
        // Get counts for each prefix
        const prefixesWithCounts = await Promise.all(
            prefixes.map(async (p) => {
                try {
                    // Do a small list to get approximate count (limit to 1000 for performance)
                    const result = await env.MODS_KV.list({ prefix: p.prefix, limit: 1000 });
                    return {
                        ...p,
                        count: result.keys.length,
                        hasMore: !result.list_complete,
                    };
                } catch {
                    return { ...p, count: 0, hasMore: false };
                }
            })
        );
        
        return new Response(JSON.stringify({ prefixes: prefixesWithCounts }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders(request, env).entries()),
            },
        });
    } catch (error: unknown) {
        console.error('[KVBrowser] Get prefixes error:', error);
        return errorResponse(
            request, env, 500, 'Failed to Get KV Prefixes',
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
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: unknown;
}
