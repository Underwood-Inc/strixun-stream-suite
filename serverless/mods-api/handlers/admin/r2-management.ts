/**
 * Admin R2 Management Handler
 * Handles R2 file listing, duplicate detection, and cleanup
 * Admin-only endpoints for managing R2 storage
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { isSuperAdminEmail } from '../../utils/admin.js';
import { getCustomerR2Key } from '../../utils/customer.js';
import type { ModMetadata, ModVersion } from '../../types/mod.js';

/**
 * R2 file information
 */
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

/**
 * Duplicate file group
 */
interface DuplicateGroup {
    files: R2FileInfo[];
    count: number;
    totalSize: number;
    recommendedKeep?: string; // Key of file to keep
}

/**
 * List all R2 files
 * GET /admin/r2/files
 */
export async function handleListR2Files(
    request: Request,
    env: Env,
    auth: { userId: string; email?: string; customerId: string | null }
): Promise<Response> {
    try {
        // Verify admin access
        if (!auth.email || !(await isSuperAdminEmail(auth.email, env))) {
            const rfcError = createError(request, 403, 'Forbidden', 'Admin access required');
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

        const url = new URL(request.url);
        const prefix = url.searchParams.get('prefix') || '';
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '1000', 10), 10000);
        const cursor = url.searchParams.get('cursor') || undefined;

        const files: R2FileInfo[] = [];
        let currentCursor: string | undefined = cursor;
        let totalListed = 0;

        do {
            const listResult = await env.MODS_R2.list({
                prefix,
                limit: Math.min(limit - totalListed, 1000), // R2 list limit is 1000
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

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });

        return new Response(JSON.stringify({
            files,
            total: files.length,
            cursor: currentCursor,
            hasMore: !!currentCursor,
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('List R2 files error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to List R2 Files',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while listing R2 files'
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

/**
 * Detect duplicate and orphaned files
 * GET /admin/r2/duplicates
 */
export async function handleDetectDuplicates(
    request: Request,
    env: Env,
    auth: { userId: string; email?: string; customerId: string | null }
): Promise<Response> {
    try {
        // Verify admin access
        if (!auth.email || !(await isSuperAdminEmail(auth.email, env))) {
            const rfcError = createError(request, 403, 'Forbidden', 'Admin access required');
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

        console.log('[R2Duplicates] Starting duplicate detection scan...');

        // Step 1: List all R2 files
        const allFiles: R2FileInfo[] = [];
        let cursor: string | undefined;
        
        do {
            const listResult = await env.MODS_R2.list({
                limit: 1000,
                cursor,
            });

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

        console.log('[R2Duplicates] Found', allFiles.length, 'total R2 files');

        // Step 2: Get all mods and versions from KV to map files
        const modIdToR2Keys = new Map<string, Set<string>>(); // modId -> set of R2 keys
        const versionIdToR2Keys = new Map<string, Set<string>>(); // versionId -> set of R2 keys
        const allR2Keys = new Set<string>(); // All R2 keys referenced in KV
        const { normalizeModId } = await import('../../utils/customer.js');

        // Get all mods from global scope
        const globalListKey = 'mods_list_public';
        const globalListData = await env.MODS_KV.get(globalListKey, { type: 'json' }) as string[] | null;
        if (globalListData) {
            for (const modId of globalListData) {
                const normalizedModId = normalizeModId(modId);
                const modKey = `mod_${normalizedModId}`;
                const mod = await env.MODS_KV.get(modKey, { type: 'json' }) as ModMetadata | null;
                if (mod) {
                    // Reconstruct thumbnail R2 key: customer_xxx/thumbnails/{normalizedModId}.{ext}
                    // Try common image extensions - we'll check which one actually exists in R2
                    if (mod.customerId) {
                        const extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
                        for (const ext of extensions) {
                            const thumbnailKey = getCustomerR2Key(mod.customerId, `thumbnails/${normalizedModId}.${ext}`);
                            allR2Keys.add(thumbnailKey);
                            if (!modIdToR2Keys.has(modId)) {
                                modIdToR2Keys.set(modId, new Set());
                            }
                            modIdToR2Keys.get(modId)!.add(thumbnailKey);
                        }
                    }

                    // Get versions for this mod
                    const versionsListKey = `mod_${normalizedModId}_versions`;
                    const versionsList = await env.MODS_KV.get(versionsListKey, { type: 'json' }) as string[] | null;
                    if (versionsList) {
                        for (const versionId of versionsList) {
                            const versionKey = `version_${versionId}`;
                            const version = await env.MODS_KV.get(versionKey, { type: 'json' }) as ModVersion | null;
                            if (version && version.r2Key) {
                                if (!versionIdToR2Keys.has(versionId)) {
                                    versionIdToR2Keys.set(versionId, new Set());
                                }
                                versionIdToR2Keys.get(versionId)!.add(version.r2Key);
                                allR2Keys.add(version.r2Key);
                            }
                        }
                    }
                }
            }
        }

        // Get all mods from customer scopes
        const customerListPrefix = 'customer_';
        let customerCursor: string | undefined;
        
        do {
            const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor: customerCursor });
            for (const key of listResult.keys) {
                if (key.name.endsWith('_mods_list')) {
                    const match = key.name.match(/^customer_([^_/]+)[_/]mods_list$/);
                    const customerId = match ? match[1] : null;
                        if (customerId) {
                            const customerModsList = await env.MODS_KV.get(key.name, { type: 'json' }) as string[] | null;
                            if (customerModsList) {
                                for (const modId of customerModsList) {
                                    const normalizedModId = normalizeModId(modId);
                                    const { getCustomerKey } = await import('../../utils/customer.js');
                                    const customerModKey = getCustomerKey(customerId, `mod_${normalizedModId}`);
                                    const mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                                    
                                    if (mod) {
                                        // Reconstruct thumbnail R2 key: customer_xxx/thumbnails/{normalizedModId}.{ext}
                                        const extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
                                        for (const ext of extensions) {
                                            const thumbnailKey = getCustomerR2Key(customerId, `thumbnails/${normalizedModId}.${ext}`);
                                            allR2Keys.add(thumbnailKey);
                                            if (!modIdToR2Keys.has(modId)) {
                                                modIdToR2Keys.set(modId, new Set());
                                            }
                                            modIdToR2Keys.get(modId)!.add(thumbnailKey);
                                        }

                                        // Get versions
                                        const customerVersionsKey = getCustomerKey(customerId, `mod_${normalizedModId}_versions`);
                                        const versionsList = await env.MODS_KV.get(customerVersionsKey, { type: 'json' }) as string[] | null;
                                        if (versionsList) {
                                            for (const versionId of versionsList) {
                                                const customerVersionKey = getCustomerKey(customerId, `version_${versionId}`);
                                                const version = await env.MODS_KV.get(customerVersionKey, { type: 'json' }) as ModVersion | null;
                                                if (version && version.r2Key) {
                                                    if (!versionIdToR2Keys.has(versionId)) {
                                                        versionIdToR2Keys.set(versionId, new Set());
                                                    }
                                                    versionIdToR2Keys.get(versionId)!.add(version.r2Key);
                                                    allR2Keys.add(version.r2Key);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                }
            }
            customerCursor = listResult.listComplete ? undefined : listResult.cursor;
        } while (customerCursor);

        console.log('[R2Duplicates] Found', allR2Keys.size, 'R2 keys referenced in KV');

        // Step 3: Identify orphaned files (files in R2 but not referenced in KV)
        const orphanedFiles: R2FileInfo[] = [];
        for (const file of allFiles) {
            if (!allR2Keys.has(file.key)) {
                file.isOrphaned = true;
                orphanedFiles.push(file);
            } else {
                // Try to find associated mod/version
                for (const [modId, r2Keys] of modIdToR2Keys.entries()) {
                    if (r2Keys.has(file.key)) {
                        file.associatedModId = modId;
                        break;
                    }
                }
                for (const [versionId, r2Keys] of versionIdToR2Keys.entries()) {
                    if (r2Keys.has(file.key)) {
                        file.associatedVersionId = versionId;
                        break;
                    }
                }
            }
        }

        // Step 4: Detect duplicates by size and content hash (if available)
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
                // Group by size - files with same size might be duplicates
                // For more accurate detection, we'd need to compare content hashes
                duplicateGroups.push({
                    files,
                    count: files.length,
                    totalSize: size * files.length,
                    recommendedKeep: files[0].key, // Keep the first one by default
                });
            }
        }

        // Sort duplicate groups by total wasted space (descending)
        duplicateGroups.sort((a, b) => b.totalSize - a.totalSize);

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });

        return new Response(JSON.stringify({
            summary: {
                totalFiles: allFiles.length,
                referencedFiles: allR2Keys.size,
                orphanedFiles: orphanedFiles.length,
                orphanedSize: orphanedFiles.reduce((sum, f) => sum + f.size, 0),
                duplicateGroups: duplicateGroups.length,
                duplicateWastedSize: duplicateGroups.reduce((sum, g) => sum + (g.totalSize - (g.files[0]?.size || 0)), 0),
            },
            orphanedFiles: orphanedFiles.slice(0, 1000), // Limit to 1000 for response size
            duplicateGroups: duplicateGroups.slice(0, 100), // Limit to 100 groups
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Detect duplicates error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Detect Duplicates',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while detecting duplicates'
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

/**
 * Delete R2 file(s)
 * DELETE /admin/r2/files/:key or POST /admin/r2/files/delete (bulk)
 */
export async function handleDeleteR2File(
    request: Request,
    env: Env,
    auth: { userId: string; email?: string; customerId: string | null },
    key?: string
): Promise<Response> {
    try {
        // Verify admin access
        if (!auth.email || !(await isSuperAdminEmail(auth.email, env))) {
            const rfcError = createError(request, 403, 'Forbidden', 'Admin access required');
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

        // Handle bulk delete
        if (request.method === 'POST' && !key) {
            const body = await request.json() as { keys: string[] };
            if (!body.keys || !Array.isArray(body.keys)) {
                const rfcError = createError(request, 400, 'Invalid Request', 'keys array is required');
                const corsHeaders = createCORSHeaders(request, {
                    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                });
                return new Response(JSON.stringify(rfcError), {
                    status: 400,
                    headers: {
                        'Content-Type': 'application/problem+json',
                        ...Object.fromEntries(corsHeaders.entries()),
                    },
                });
            }

            const results: Array<{ key: string; deleted: boolean; error?: string }> = [];
            for (const fileKey of body.keys) {
                try {
                    await env.MODS_R2.delete(fileKey);
                    results.push({ key: fileKey, deleted: true });
                } catch (error: any) {
                    results.push({ key: fileKey, deleted: false, error: error.message });
                }
            }

            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });

            return new Response(JSON.stringify({
                deleted: results.filter(r => r.deleted).length,
                failed: results.filter(r => !r.deleted).length,
                results,
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        // Handle single delete
        if (!key) {
            const rfcError = createError(request, 400, 'Invalid Request', 'File key is required');
            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });
            return new Response(JSON.stringify(rfcError), {
                status: 400,
                headers: {
                    'Content-Type': 'application/problem+json',
                    ...Object.fromEntries(corsHeaders.entries()),
                },
            });
        }

        await env.MODS_R2.delete(key);

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });

        return new Response(JSON.stringify({
            deleted: true,
            key,
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Delete R2 file error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Delete R2 File',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while deleting the file'
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
    MODS_R2: R2Bucket;
    SUPER_ADMIN_EMAILS?: string;
    ENVIRONMENT?: string;
    ALLOWED_ORIGINS?: string;
    [key: string]: any;
}

