/**
 * Admin R2 Management Handler
 * Handles R2 file listing, duplicate detection, and cleanup
 * Admin-only endpoints for managing R2 storage
 * 
 * Enhanced to retrieve all human-readable associated data for smart decision-making and debugging
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { isSuperAdminEmail } from '../../utils/admin.js';
import { getCustomerR2Key, getCustomerKey, normalizeModId } from '../../utils/customer.js';
import { fetchDisplayNameByUserId, fetchDisplayNamesByUserIds } from '../../utils/displayName.js';
import { getR2SourceInfo } from '../../utils/r2-source.js';
import type { ModMetadata, ModVersion } from '../../types/mod.js';

/**
 * Associated mod information (human-readable)
 */
interface AssociatedModInfo {
    modId: string;
    title: string;
    slug: string;
    authorId: string;
    authorDisplayName?: string | null;
    description: string;
    category: string;
    status: string;
    customerId: string | null;
    createdAt: string;
    updatedAt: string;
    latestVersion: string;
    downloadCount: number;
    visibility: string;
    featured: boolean;
}

/**
 * Associated version information (human-readable)
 */
interface AssociatedVersionInfo {
    versionId: string;
    modId: string;
    version: string;
    changelog: string;
    fileSize: number;
    fileName: string;
    sha256: string;
    createdAt: string;
    downloads: number;
    gameVersions: string[];
    dependencies?: Array<{ modId: string; version?: string; required: boolean }>;
}

/**
 * Associated user information (human-readable)
 */
interface AssociatedUserInfo {
    userId: string;
    displayName?: string | null;
}

/**
 * Full associated data for an R2 file
 */
interface R2FileAssociatedData {
    mod?: AssociatedModInfo;
    version?: AssociatedVersionInfo;
    uploadedBy?: AssociatedUserInfo;
    isThumbnail?: boolean;
    isModFile?: boolean;
}

/**
 * R2 file information with full associated data
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
    associatedData?: R2FileAssociatedData; // Human-readable associated data
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
 * Fetch mod metadata from KV (checks both global and customer scopes)
 */
async function fetchModMetadata(
    modId: string,
    customerId: string | null | undefined,
    env: Env
): Promise<ModMetadata | null> {
    const normalizedModId = normalizeModId(modId);
    
    // Try customer scope first if customerId is available
    if (customerId) {
        const customerModKey = getCustomerKey(customerId, `mod_${normalizedModId}`);
        const mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
        if (mod) {
            return mod;
        }
    }
    
    // Try global scope
    const globalModKey = `mod_${normalizedModId}`;
    const mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
    if (mod) {
        return mod;
    }
    
    // If still not found, try searching all customer scopes
    // This is expensive but necessary for orphaned files
    if (!customerId) {
        const customerListPrefix = 'customer_';
        let customerCursor: string | undefined;
        
        do {
            const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor: customerCursor });
            for (const key of listResult.keys) {
                // Match both customer_{id}_mods_list and customer_{id}/mods_list patterns
                if (key.name.endsWith('_mods_list') || key.name.endsWith('/mods_list')) {
                    // CRITICAL: Customer IDs can contain underscores (e.g., cust_2233896f662d)
                    // Extract everything between "customer_" and the final "_mods_list" or "/mods_list"
                    let foundCustomerId: string | null = null;
                    if (key.name.endsWith('_mods_list')) {
                        const match = key.name.match(/^customer_(.+)_mods_list$/);
                        foundCustomerId = match ? match[1] : null;
                    } else if (key.name.endsWith('/mods_list')) {
                        const match = key.name.match(/^customer_(.+)\/mods_list$/);
                        foundCustomerId = match ? match[1] : null;
                    }
                    
                    if (foundCustomerId) {
                        const customerModKey = getCustomerKey(foundCustomerId, `mod_${normalizedModId}`);
                        const mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                        if (mod) {
                            return mod;
                        }
                    }
                }
            }
            customerCursor = listResult.listComplete ? undefined : listResult.cursor;
        } while (customerCursor);
    }
    
    return null;
}

/**
 * Fetch version metadata from KV (checks both global and customer scopes)
 */
async function fetchVersionMetadata(
    versionId: string,
    modId: string,
    customerId: string | null | undefined,
    env: Env
): Promise<ModVersion | null> {
    // Try customer scope first if customerId is available
    if (customerId) {
        const customerVersionKey = getCustomerKey(customerId, `version_${versionId}`);
        const version = await env.MODS_KV.get(customerVersionKey, { type: 'json' }) as ModVersion | null;
        if (version) {
            return version;
        }
    }
    
    // Try global scope
    const globalVersionKey = `version_${versionId}`;
    const version = await env.MODS_KV.get(globalVersionKey, { type: 'json' }) as ModVersion | null;
    if (version) {
        return version;
    }
    
    // If still not found, try searching all customer scopes
    if (!customerId) {
        const customerListPrefix = 'customer_';
        let customerCursor: string | undefined;
        
        do {
            const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor: customerCursor });
            for (const key of listResult.keys) {
                if (key.name.endsWith('_mods_list')) {
                    const match = key.name.match(/^customer_([^_/]+)[_/]mods_list$/);
                    const foundCustomerId = match ? match[1] : null;
                    if (foundCustomerId) {
                        const customerVersionKey = getCustomerKey(foundCustomerId, `version_${versionId}`);
                        const version = await env.MODS_KV.get(customerVersionKey, { type: 'json' }) as ModVersion | null;
                        if (version) {
                            return version;
                        }
                    }
                }
            }
            customerCursor = listResult.listComplete ? undefined : listResult.cursor;
        } while (customerCursor);
    }
    
    return null;
}

/**
 * Extract customer ID from R2 key
 * Format: customer_{id}/mods/... or customer_{id}/thumbnails/...
 */
function extractCustomerIdFromR2Key(r2Key: string): string | null {
    const match = r2Key.match(/^customer_([^/]+)\//);
    return match ? match[1] : null;
}

/**
 * Fetch all associated data for an R2 file
 * Returns human-readable mod, version, and user information
 */
async function fetchAssociatedData(
    file: R2FileInfo,
    env: Env
): Promise<R2FileAssociatedData> {
    const associatedData: R2FileAssociatedData = {};
    
    if (!file.customMetadata) {
        return associatedData;
    }
    
    const modId = file.customMetadata.modId;
    const versionId = file.customMetadata.versionId;
    const uploadedBy = file.customMetadata.uploadedBy;
    const customerId = extractCustomerIdFromR2Key(file.key);
    
    // Determine file type
    const isThumbnail = file.key.includes('/thumbnails/');
    const isModFile = file.key.includes('/mods/');
    associatedData.isThumbnail = isThumbnail;
    associatedData.isModFile = isModFile;
    
    // Fetch mod metadata if modId is available
    if (modId) {
        const mod = await fetchModMetadata(modId, customerId, env);
        if (mod) {
            associatedData.mod = {
                modId: mod.modId,
                title: mod.title,
                slug: mod.slug,
                authorId: mod.authorId,
                authorDisplayName: mod.authorDisplayName || null,
                description: mod.description,
                category: mod.category,
                status: mod.status,
                customerId: mod.customerId,
                createdAt: mod.createdAt,
                updatedAt: mod.updatedAt,
                latestVersion: mod.latestVersion,
                downloadCount: mod.downloadCount,
                visibility: mod.visibility,
                featured: mod.featured,
            };
        }
    }
    
    // Fetch version metadata if versionId is available
    if (versionId && modId) {
        const version = await fetchVersionMetadata(versionId, modId, customerId, env);
        if (version) {
            associatedData.version = {
                versionId: version.versionId,
                modId: version.modId,
                version: version.version,
                changelog: version.changelog,
                fileSize: version.fileSize,
                fileName: version.fileName,
                sha256: version.sha256,
                createdAt: version.createdAt,
                downloads: version.downloads,
                gameVersions: version.gameVersions,
                dependencies: version.dependencies,
            };
        }
    }
    
    // Fetch user display name if uploadedBy is available
    if (uploadedBy) {
        const displayName = await fetchDisplayNameByUserId(uploadedBy, env);
        associatedData.uploadedBy = {
            userId: uploadedBy,
            displayName: displayName || null,
        };
    }
    
    return associatedData;
}

/**
 * Fetch associated data for multiple files in batch
 * Optimized to fetch user display names in parallel
 */
async function fetchAssociatedDataBatch(
    files: R2FileInfo[],
    env: Env
): Promise<Map<string, R2FileAssociatedData>> {
    const results = new Map<string, R2FileAssociatedData>();
    
    // Collect all unique user IDs for batch fetching
    const userIds = new Set<string>();
    for (const file of files) {
        if (file.customMetadata?.uploadedBy) {
            userIds.add(file.customMetadata.uploadedBy);
        }
    }
    
    // Fetch all display names in parallel
    const displayNames = await fetchDisplayNamesByUserIds(Array.from(userIds), env);
    
    // Process each file
    const promises = files.map(async (file) => {
        const associatedData: R2FileAssociatedData = {};
        
        if (!file.customMetadata) {
            return { key: file.key, data: associatedData };
        }
        
        const modId = file.customMetadata.modId;
        const versionId = file.customMetadata.versionId;
        const uploadedBy = file.customMetadata.uploadedBy;
        const customerId = extractCustomerIdFromR2Key(file.key);
        
        // Determine file type
        const isThumbnail = file.key.includes('/thumbnails/');
        const isModFile = file.key.includes('/mods/');
        associatedData.isThumbnail = isThumbnail;
        associatedData.isModFile = isModFile;
        
        // Fetch mod metadata
        if (modId) {
            const mod = await fetchModMetadata(modId, customerId, env);
            if (mod) {
                associatedData.mod = {
                    modId: mod.modId,
                    title: mod.title,
                    slug: mod.slug,
                    authorId: mod.authorId,
                    authorDisplayName: mod.authorDisplayName || null,
                    description: mod.description,
                    category: mod.category,
                    status: mod.status,
                    customerId: mod.customerId,
                    createdAt: mod.createdAt,
                    updatedAt: mod.updatedAt,
                    latestVersion: mod.latestVersion,
                    downloadCount: mod.downloadCount,
                    visibility: mod.visibility,
                    featured: mod.featured,
                };
            }
        }
        
        // Fetch version metadata
        if (versionId && modId) {
            const version = await fetchVersionMetadata(versionId, modId, customerId, env);
            if (version) {
                associatedData.version = {
                    versionId: version.versionId,
                    modId: version.modId,
                    version: version.version,
                    changelog: version.changelog,
                    fileSize: version.fileSize,
                    fileName: version.fileName,
                    sha256: version.sha256,
                    createdAt: version.createdAt,
                    downloads: version.downloads,
                    gameVersions: version.gameVersions,
                    dependencies: version.dependencies,
                };
            }
        }
        
        // Use batch-fetched display name
        if (uploadedBy) {
            const displayName = displayNames.get(uploadedBy) || null;
            associatedData.uploadedBy = {
                userId: uploadedBy,
                displayName: displayName || null,
            };
        }
        
        return { key: file.key, data: associatedData };
    });
    
    const allResults = await Promise.all(promises);
    for (const { key, data } of allResults) {
        results.set(key, data);
    }
    
    return results;
}

/**
 * List all R2 files with associated human-readable data
 * GET /admin/r2/files
 * 
 * Query parameters:
 * - prefix: Filter by R2 key prefix
 * - limit: Maximum number of files to return (default: 1000, max: 10000)
 * - cursor: Pagination cursor
 * - includeAssociatedData: Include full mod/version/user data (default: true)
 */
export async function handleListR2Files(
    request: Request,
    env: Env,
    auth: { userId: string; email?: string; customerId: string | null }
): Promise<Response> {
    try {
        // Route-level protection ensures user is super admin
        const url = new URL(request.url);
        const prefix = url.searchParams.get('prefix') || '';
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '1000', 10), 10000);
        const cursor = url.searchParams.get('cursor') || undefined;
        const includeAssociatedData = url.searchParams.get('includeAssociatedData') !== 'false'; // Default: true

        const files: R2FileInfo[] = [];
        let currentCursor: string | undefined = cursor;
        let totalListed = 0;

        console.log('[R2List] Starting file listing:', { prefix, limit, includeAssociatedData });

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

        console.log('[R2List] Found', files.length, 'files, fetching associated data:', includeAssociatedData);

        // Fetch associated data for all files if requested
        if (includeAssociatedData && files.length > 0) {
            const associatedDataMap = await fetchAssociatedDataBatch(files, env);
            for (const file of files) {
                file.associatedData = associatedDataMap.get(file.key);
                
                // Set associated IDs from metadata if available
                if (file.customMetadata?.modId) {
                    file.associatedModId = file.customMetadata.modId;
                }
                if (file.customMetadata?.versionId) {
                    file.associatedVersionId = file.customMetadata.versionId;
                }
            }
        }

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });

        return new Response(JSON.stringify({
            files,
            total: files.length,
            cursor: currentCursor,
            hasMore: !!currentCursor,
            includeAssociatedData,
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
        // Route-level protection ensures user is super admin
        const r2SourceInfo = getR2SourceInfo(env, request);
        console.log('[R2Duplicates] Starting duplicate detection scan...');
        console.log('[R2Duplicates] R2 storage source:', r2SourceInfo);

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

        console.log('[R2Duplicates] Fetching associated data for all files...');
        
        // Fetch associated data for all files (for smart decision-making)
        const associatedDataMap = await fetchAssociatedDataBatch(allFiles, env);
        for (const file of allFiles) {
            file.associatedData = associatedDataMap.get(file.key);
            
            // Set associated IDs from metadata if available
            if (file.customMetadata?.modId) {
                file.associatedModId = file.customMetadata.modId;
            }
            if (file.customMetadata?.versionId) {
                file.associatedVersionId = file.customMetadata.versionId;
            }
        }
        
        console.log('[R2Duplicates] Associated data fetched for', associatedDataMap.size, 'files');

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
                
                // Smart recommendation: choose best file to keep based on associated data
                let recommendedKeep = files[0].key;
                let bestScore = -1;
                
                for (const file of files) {
                    let score = 0;
                    const data = file.associatedData;
                    
                    // Prefer files that are NOT orphaned
                    if (!file.isOrphaned) {
                        score += 1000;
                    }
                    
                    // Prefer files associated with published/approved mods
                    if (data?.mod) {
                        if (data.mod.status === 'published') {
                            score += 500;
                        } else if (data.mod.status === 'approved') {
                            score += 300;
                        } else if (data.mod.status === 'pending') {
                            score += 100;
                        }
                        
                        // Prefer mods with more downloads
                        score += Math.min(data.mod.downloadCount * 10, 200);
                    }
                    
                    // Prefer files associated with versions
                    if (data?.version) {
                        score += 200;
                        
                        // Prefer versions with more downloads
                        score += Math.min(data.version.downloads * 5, 100);
                    }
                    
                    // Prefer more recently uploaded files
                    const daysSinceUpload = (Date.now() - file.uploaded.getTime()) / (1000 * 60 * 60 * 24);
                    score += Math.max(0, 100 - daysSinceUpload); // Newer files get higher score
                    
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
        console.error('[R2Duplicates] Detect duplicates error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('Timeout') || errorMessage.includes('aborted');
        
        const rfcError = createError(
            request,
            isTimeout ? 504 : 500,
            isTimeout ? 'Request Timeout' : 'Failed to Detect Duplicates',
            env.ENVIRONMENT === 'development' || env.ENVIRONMENT === 'test' 
                ? errorMessage 
                : (isTimeout ? 'The duplicate detection scan timed out. Try again or contact support.' : 'An error occurred while detecting duplicates')
        );
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify(rfcError), {
            status: isTimeout ? 504 : 500,
            headers: {
                'Content-Type': 'application/problem+json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    }
}

/**
 * Check if a thumbnail is associated with an existing mod
 * Returns true if the mod exists and the thumbnail should be protected
 */
async function isThumbnailProtected(
    r2Key: string,
    env: Env
): Promise<{ protected: boolean; modId?: string; reason?: string }> {
    // Check if this is a thumbnail file
    if (!r2Key.includes('/thumbnails/')) {
        return { protected: false };
    }

    // Extract modId from R2 key
    // Format: customer_xxx/thumbnails/modId.ext or thumbnails/modId.ext
    const thumbnailMatch = r2Key.match(/thumbnails\/([^/]+)\.(png|jpg|jpeg|webp|gif)$/i);
    if (!thumbnailMatch) {
        return { protected: false };
    }

    const thumbnailModId = thumbnailMatch[1];
    const normalizedModId = normalizeModId(thumbnailModId);
    
    // Extract customer ID from key if present
    const customerId = extractCustomerIdFromR2Key(r2Key);
    
    // Check if mod exists in KV
    const mod = await fetchModMetadata(normalizedModId, customerId, env);
    
    if (mod) {
        return {
            protected: true,
            modId: mod.modId,
            reason: `Thumbnail is associated with mod "${mod.title}" (${mod.modId})`
        };
    }
    
    return { protected: false };
}

/**
 * Delete R2 file(s)
 * DELETE /admin/r2/files/:key or POST /admin/r2/files/delete (bulk)
 * 
 * CRITICAL: Prevents deletion of thumbnails that are associated with existing mods
 */
export async function handleDeleteR2File(
    request: Request,
    env: Env,
    auth: { userId: string; email?: string; customerId: string | null },
    key?: string
): Promise<Response> {
    try {
        // Route-level protection ensures user is super admin
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

            const results: Array<{ key: string; deleted: boolean; error?: string; protected?: boolean; marked?: boolean }> = [];
            for (const fileKey of body.keys) {
                try {
                    // Check if thumbnail is protected (associated with existing mod)
                    const protectionCheck = await isThumbnailProtected(fileKey, env);
                    if (protectionCheck.protected) {
                        results.push({
                            key: fileKey,
                            deleted: false,
                            protected: true,
                            error: protectionCheck.reason || 'Thumbnail is associated with an existing mod'
                        });
                        continue;
                    }

                    // Mark file for deletion instead of deleting immediately
                    // Get current file and metadata to preserve it
                    const file = await env.MODS_R2.get(fileKey);
                    if (!file) {
                        results.push({ key: fileKey, deleted: false, error: 'File not found' });
                        continue;
                    }
                    
                    const existingMetadata = file.customMetadata || {};
                    const fileBody = await file.arrayBuffer();
                    
                    // Mark for deletion with timestamp
                    await env.MODS_R2.put(fileKey, fileBody, {
                        httpMetadata: file.httpMetadata,
                        customMetadata: {
                            ...existingMetadata,
                            marked_for_deletion: 'true',
                            marked_for_deletion_on: Date.now().toString(),
                        },
                    });
                    
                    results.push({ key: fileKey, deleted: true, marked: true });
                } catch (error: any) {
                    results.push({ key: fileKey, deleted: false, error: error.message });
                }
            }

            const corsHeaders = createCORSHeaders(request, {
                allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            });

            const protectedCount = results.filter(r => r.protected).length;
            const deletedCount = results.filter(r => r.deleted).length;
            const failedCount = results.filter(r => !r.deleted && !r.protected).length;

            return new Response(JSON.stringify({
                deleted: deletedCount,
                failed: failedCount,
                protected: protectedCount,
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

        // Check if thumbnail is protected (associated with existing mod)
        const protectionCheck = await isThumbnailProtected(key, env);
        if (protectionCheck.protected) {
            const rfcError = createError(
                request,
                403,
                'Protected File',
                protectionCheck.reason || 'This thumbnail is associated with an existing mod and cannot be deleted'
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

        // Mark file for deletion instead of deleting immediately
        // Get current file and metadata to preserve it
        const file = await env.MODS_R2.get(key);
        if (!file) {
            const rfcError = createError(request, 404, 'File Not Found', 'The requested file was not found');
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
        
        const existingMetadata = file.customMetadata || {};
        const fileBody = await file.arrayBuffer();
        
        // Mark for deletion with timestamp
        await env.MODS_R2.put(key, fileBody, {
            httpMetadata: file.httpMetadata,
            customMetadata: {
                ...existingMetadata,
                marked_for_deletion: 'true',
                marked_for_deletion_on: Date.now().toString(),
            },
        });

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });

        return new Response(JSON.stringify({
            deleted: true,
            marked: true,
            key,
            message: 'File marked for deletion. It will be permanently deleted after 5 days.',
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


/**
 * Set deletion timestamp for a file (for testing only)
 * PUT /admin/r2/files/:key/timestamp
 * Body: { timestamp: number } - Unix timestamp in milliseconds
 */
export async function handleSetDeletionTimestamp(
    request: Request,
    env: Env,
    auth: { userId: string; email?: string; customerId: string | null },
    key: string
): Promise<Response> {
    try {
        // Route-level protection ensures user is super admin
        const body = await request.json() as { timestamp?: number };
        
        if (!body.timestamp || typeof body.timestamp !== 'number') {
            const rfcError = createError(request, 400, 'Invalid Request', 'timestamp (number) is required');
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
        
        // Get current file
        const file = await env.MODS_R2.get(key);
        if (!file) {
            const rfcError = createError(request, 404, 'File Not Found', 'The requested file was not found');
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
        
        const existingMetadata = file.customMetadata || {};
        const fileBody = await file.arrayBuffer();
        
        // Update metadata with new timestamp
        await env.MODS_R2.put(key, fileBody, {
            httpMetadata: file.httpMetadata,
            customMetadata: {
                ...existingMetadata,
                marked_for_deletion: 'true',
                marked_for_deletion_on: body.timestamp.toString(),
            },
        });
        
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        
        return new Response(JSON.stringify({
            success: true,
            key,
            timestamp: body.timestamp,
            message: 'Deletion timestamp updated',
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Set deletion timestamp error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Set Deletion Timestamp',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while setting the timestamp'
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
    AUTH_API_URL?: string; // For fetching user display names
    [key: string]: any;
}

