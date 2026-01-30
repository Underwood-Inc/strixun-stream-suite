/**
 * Admin R2 Management Handler
 * Handles R2 file listing, duplicate detection, and cleanup
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { fetchDisplayNamesByCustomerIds } from '@strixun/api-framework';
import { getR2SourceInfo } from '../../utils/r2-source.js';
import {
    getEntity,
    getExistingEntities,
    indexGet,
} from '@strixun/kv-entities';
import type { ModMetadata, ModVersion } from '../../types/mod.js';

interface R2FileInfo {
    key: string;
    size: number;
    uploaded: Date;
    contentType?: string;
    customMetadata?: Record<string, string>;
    isOrphaned?: boolean;
    associatedModId?: string;
    associatedVersionId?: string;
}

interface DuplicateGroup {
    files: R2FileInfo[];
    count: number;
    totalSize: number;
    recommendedKeep?: string;
}

export async function handleListR2Files(
    request: Request,
    env: Env,
    _auth: { customerId: string }
): Promise<Response> {
    try {
        const url = new URL(request.url);
        const prefix = url.searchParams.get('prefix') || '';
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '1000', 10), 10000);
        const cursorParam = url.searchParams.get('cursor') || undefined;

        const files: R2FileInfo[] = [];
        let currentCursor: string | undefined = cursorParam;
        let totalListed = 0;

        do {
            const listResult = await env.MODS_R2.list({
                prefix,
                limit: Math.min(limit - totalListed, 1000),
                cursor: currentCursor,
            });

            for (const object of listResult.objects) {
                files.push({
                    key: object.key,
                    size: object.size,
                    uploaded: object.uploaded,
                    contentType: object.httpMetadata?.contentType,
                    customMetadata: object.customMetadata,
                });
                totalListed++;
            }

            currentCursor = listResult.truncated ? listResult.cursor : undefined;
        } while (currentCursor && totalListed < limit);

        return new Response(JSON.stringify({
            files,
            total: files.length,
            cursor: currentCursor,
            hasMore: !!currentCursor,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        });
    } catch (error: any) {
        console.error('List R2 files error:', error);
        return errorResponse(
            request, env, 500, 'Failed to List R2 Files',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred'
        );
    }
}

export async function handleDetectDuplicates(
    request: Request,
    env: Env,
    _auth: { customerId: string }
): Promise<Response> {
    try {
        const r2SourceInfo = getR2SourceInfo(env, request);
        console.log('[R2Duplicates] Starting duplicate detection scan...');
        console.log('[R2Duplicates] R2 storage source:', r2SourceInfo);

        // List all R2 files
        const allFiles: R2FileInfo[] = [];
        let cursor: string | undefined;

        do {
            const listResult = await env.MODS_R2.list({ limit: 1000, cursor });
            for (const object of listResult.objects) {
                allFiles.push({
                    key: object.key,
                    size: object.size,
                    uploaded: object.uploaded,
                    contentType: object.httpMetadata?.contentType,
                    customMetadata: object.customMetadata,
                });
            }
            cursor = listResult.truncated ? listResult.cursor : undefined;
        } while (cursor);

        // Get all referenced R2 keys from mods and versions
        const allR2Keys = new Set<string>();

        // Get all public mod IDs
        const publicModIds = await indexGet(env.MODS_KV, 'mods', 'by-visibility', 'public');

        // Scan customer indexes for all mods
        const customerPrefix = 'idx:mods:by-customer:';
        let customerCursor: string | undefined;
        const allModIds = new Set<string>(publicModIds);

        do {
            const listResult = await env.MODS_KV.list({ prefix: customerPrefix, cursor: customerCursor });
            for (const key of listResult.keys) {
                const ids = await env.MODS_KV.get(key.name, { type: 'json' }) as string[] | null;
                if (ids) {
                    ids.forEach(id => allModIds.add(id));
                }
            }
            customerCursor = listResult.list_complete ? undefined : listResult.cursor;
        } while (customerCursor);

        // Fetch all mods and collect R2 keys
        const mods = await getExistingEntities<ModMetadata>(env.MODS_KV, 'mods', 'mod', [...allModIds]);

        for (const mod of mods) {
            const versionIds = await indexGet(env.MODS_KV, 'mods', 'versions-for', mod.modId);
            const versions = await getExistingEntities<ModVersion>(env.MODS_KV, 'mods', 'version', versionIds);

            for (const version of versions) {
                if (version.r2Key) {
                    allR2Keys.add(version.r2Key);
                }
            }

            // Add thumbnail keys
            const extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
            for (const ext of extensions) {
                allR2Keys.add(`thumbnails/${mod.modId}.${ext}`);
            }
        }

        // Identify orphaned files
        const orphanedFiles: R2FileInfo[] = [];
        for (const file of allFiles) {
            if (!allR2Keys.has(file.key)) {
                file.isOrphaned = true;
                orphanedFiles.push(file);
            }
        }

        // Detect duplicates by size
        const duplicatesBySize = new Map<number, R2FileInfo[]>();
        for (const file of allFiles) {
            if (!duplicatesBySize.has(file.size)) {
                duplicatesBySize.set(file.size, []);
            }
            duplicatesBySize.get(file.size)!.push(file);
        }

        const duplicateGroups: DuplicateGroup[] = [];
        for (const [size, files] of duplicatesBySize.entries()) {
            if (files.length > 1 && size > 0) {
                let recommendedKeep = files[0].key;
                let bestScore = -1;

                for (const file of files) {
                    let score = file.isOrphaned ? 0 : 1000;
                    const daysSinceUpload = (Date.now() - file.uploaded.getTime()) / (1000 * 60 * 60 * 24);
                    score += Math.max(0, 100 - daysSinceUpload);

                    if (score > bestScore) {
                        bestScore = score;
                        recommendedKeep = file.key;
                    }
                }

                duplicateGroups.push({
                    files,
                    count: files.length,
                    totalSize: size * files.length,
                    recommendedKeep,
                });
            }
        }

        duplicateGroups.sort((a, b) => b.totalSize - a.totalSize);

        return new Response(JSON.stringify({
            summary: {
                totalFiles: allFiles.length,
                referencedFiles: allR2Keys.size,
                orphanedFiles: orphanedFiles.length,
                orphanedSize: orphanedFiles.reduce((sum, f) => sum + f.size, 0),
                duplicateGroups: duplicateGroups.length,
                duplicateWastedSize: duplicateGroups.reduce((sum, g) => sum + (g.totalSize - (g.files[0]?.size || 0)), 0),
            },
            orphanedFiles: orphanedFiles.slice(0, 1000),
            duplicateGroups: duplicateGroups.slice(0, 100),
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        });
    } catch (error: any) {
        console.error('[R2Duplicates] Detect duplicates error:', error);
        const isTimeout = error.message?.includes('timeout');
        return errorResponse(
            request, env, isTimeout ? 504 : 500,
            isTimeout ? 'Request Timeout' : 'Failed to Detect Duplicates',
            isTimeout ? 'The duplicate detection scan timed out' : 'An error occurred'
        );
    }
}

export async function handleDeleteR2File(
    request: Request,
    env: Env,
    _auth: { customerId: string },
    key?: string
): Promise<Response> {
    try {
        if (request.method === 'POST' && !key) {
            const body = await request.json() as { keys: string[]; force?: boolean };
            if (!body.keys || !Array.isArray(body.keys)) {
                return errorResponse(request, env, 400, 'Invalid Request', 'keys array is required');
            }

            const results: Array<{ key: string; deleted: boolean; error?: string }> = [];
            for (const fileKey of body.keys) {
                try {
                    const file = await env.MODS_R2.get(fileKey);
                    if (!file) {
                        results.push({ key: fileKey, deleted: false, error: 'File not found' });
                        continue;
                    }

                    const existingMetadata = file.customMetadata || {};
                    const fileBody = await file.arrayBuffer();

                    await env.MODS_R2.put(fileKey, fileBody, {
                        httpMetadata: file.httpMetadata,
                        customMetadata: {
                            ...existingMetadata,
                            marked_for_deletion: 'true',
                            marked_for_deletion_on: Date.now().toString(),
                        },
                    });

                    results.push({ key: fileKey, deleted: true });
                } catch (error: any) {
                    results.push({ key: fileKey, deleted: false, error: error.message });
                }
            }

            return new Response(JSON.stringify({
                deleted: results.filter(r => r.deleted).length,
                failed: results.filter(r => !r.deleted).length,
                results,
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
            });
        }

        if (!key) {
            return errorResponse(request, env, 400, 'Invalid Request', 'File key is required');
        }

        const file = await env.MODS_R2.get(key);
        if (!file) {
            return errorResponse(request, env, 404, 'File Not Found', 'The requested file was not found');
        }

        const existingMetadata = file.customMetadata || {};
        const fileBody = await file.arrayBuffer();

        await env.MODS_R2.put(key, fileBody, {
            httpMetadata: file.httpMetadata,
            customMetadata: {
                ...existingMetadata,
                marked_for_deletion: 'true',
                marked_for_deletion_on: Date.now().toString(),
            },
        });

        return new Response(JSON.stringify({
            deleted: true,
            marked: true,
            key,
            message: 'File marked for deletion. It will be permanently deleted after 5 days.',
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        });
    } catch (error: any) {
        console.error('Delete R2 file error:', error);
        return errorResponse(
            request, env, 500, 'Failed to Delete R2 File',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred'
        );
    }
}

export async function handleSetDeletionTimestamp(
    request: Request,
    env: Env,
    _auth: { customerId: string },
    key: string
): Promise<Response> {
    try {
        const body = await request.json() as { timestamp?: number };

        if (!body.timestamp || typeof body.timestamp !== 'number') {
            return errorResponse(request, env, 400, 'Invalid Request', 'timestamp (number) is required');
        }

        const file = await env.MODS_R2.get(key);
        if (!file) {
            return errorResponse(request, env, 404, 'File Not Found', 'The requested file was not found');
        }

        const existingMetadata = file.customMetadata || {};
        const fileBody = await file.arrayBuffer();

        await env.MODS_R2.put(key, fileBody, {
            httpMetadata: file.httpMetadata,
            customMetadata: {
                ...existingMetadata,
                marked_for_deletion: 'true',
                marked_for_deletion_on: body.timestamp.toString(),
            },
        });

        return new Response(JSON.stringify({
            success: true,
            key,
            timestamp: body.timestamp,
            message: 'Deletion timestamp updated',
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request, env) },
        });
    } catch (error: any) {
        console.error('Set deletion timestamp error:', error);
        return errorResponse(
            request, env, 500, 'Failed to Set Deletion Timestamp',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred'
        );
    }
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
    const headers = createCORSHeaders(request, {
        credentials: true,
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
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
    MODS_R2: R2Bucket;
    SUPER_ADMIN_EMAILS?: string;
    ENVIRONMENT?: string;
    ALLOWED_ORIGINS?: string;
    AUTH_API_URL?: string;
    [key: string]: any;
}
