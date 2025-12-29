/**
 * Thumbnail handler
 * GET /mods/:modId/thumbnail
 * Proxies thumbnail images from R2
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, getCustomerR2Key, normalizeModId } from '../../utils/customer.js';
import type { ModMetadata } from '../../types/mod.js';

/**
 * Handle thumbnail request
 */
export async function handleThumbnail(
    request: Request,
    env: Env,
    modId: string,
    auth: { userId: string; customerId: string | null } | null
): Promise<Response> {
    console.log('[Thumbnail] handleThumbnail called:', { modId, hasAuth: !!auth, customerId: auth?.customerId });
    try {
        // Get mod metadata by modId only (slug should be resolved to modId before calling this)
        let mod: ModMetadata | null = null;
        const normalizedModId = normalizeModId(modId);
        console.log('[Thumbnail] Looking up mod by modId:', { normalizedModId, original: modId });
        
        // Check authenticated user's customer scope first
        if (auth?.customerId) {
            const customerModKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
            console.log('[Thumbnail] Checking authenticated customer scope:', { customerModKey });
            mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
        }
        
        // Fall back to global scope if not found
        if (!mod) {
            const globalModKey = `mod_${normalizedModId}`;
            console.log('[Thumbnail] Checking global scope:', { globalModKey });
            mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
        }
        
        // If still not found, search all customer scopes by modId (for cross-customer access)
        // Use direct key pattern matching for efficiency (like admin list handler)
        if (!mod) {
            console.log('[Thumbnail] Searching all customer scopes by modId:', { normalizedModId });
            const customerModPrefix = 'customer_';
            let cursor: string | undefined;
            let found = false;
            
            do {
                const listResult = await env.MODS_KV.list({ prefix: customerModPrefix, cursor });
                for (const key of listResult.keys) {
                    // Look for keys matching pattern: customer_*_mod_{normalizedModId}
                    if (key.name.endsWith(`_mod_${normalizedModId}`)) {
                        mod = await env.MODS_KV.get(key.name, { type: 'json' }) as ModMetadata | null;
                        if (mod) {
                            // Extract customerId from key name
                            const match = key.name.match(/^customer_([^_/]+)_mod_/);
                            const customerId = match ? match[1] : null;
                            console.log('[Thumbnail] Found mod by modId in customer scope:', { customerId, modId: mod.modId, key: key.name });
                            found = true;
                            break;
                        }
                    }
                }
                if (found) break;
                cursor = listResult.listComplete ? undefined : listResult.cursor;
            } while (cursor && !found);
        }
        
        if (mod) console.log('[Thumbnail] Found mod by modId:', { modId: mod.modId, slug: mod.slug, hasThumbnailUrl: !!mod.thumbnailUrl });

        if (!mod) {
            console.error('[Thumbnail] Mod not found:', { modId });
            const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod was not found');
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

        // CRITICAL: Enforce visibility and status filtering
        // Thumbnails are often loaded as images without auth, so we need to be more permissive
        const { isSuperAdminEmail } = await import('../../utils/admin.js');
        const isAdmin = auth?.email ? await isSuperAdminEmail(auth.email, env) : false;
        const isAuthor = mod.authorId === auth?.userId;
        const modVisibility = mod.visibility || 'public';
        const modStatus = mod.status || 'published';
        
        // Visibility check: private mods only visible to author or admin
        if (modVisibility === 'private' && !isAuthor && !isAdmin) {
            const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod was not found');
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
        
        // Status check: allow thumbnails for published/approved mods to everyone
        // For pending/changes_requested/denied: allow if public (images are part of public presentation)
        // OR if user is author/admin (for private pending mods)
        // CRITICAL: Image requests from <img> tags don't include auth, so we can't check isAuthor
        // Solution: Allow public pending mods to be accessible (they're public, just pending review)
        if (modStatus !== 'published' && modStatus !== 'approved') {
            // Allow if mod is public (even if pending) - images are part of public presentation
            // OR if authenticated user is author/admin (for private pending mods)
            const isPublicPending = modVisibility === 'public';
            if (!isPublicPending && (!isAuthor && !isAdmin)) {
                const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod was not found');
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

        // If no thumbnail, return 404
        if (!mod.thumbnailUrl) {
            console.error('[Thumbnail] Mod has no thumbnailUrl:', { modId: mod.modId, slug: mod.slug });
            const rfcError = createError(request, 404, 'Thumbnail Not Found', 'This mod does not have a thumbnail');
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

        console.log('[Thumbnail] Mod has thumbnailUrl:', { thumbnailUrl: mod.thumbnailUrl, modId: mod.modId, slug: mod.slug });

        // Reconstruct R2 key from mod metadata
        // Thumbnails are stored as: customer_xxx/thumbnails/normalizedModId.ext
        // CRITICAL: Search mod's customer scope first, then all customer scopes if not found
        // This matches the pattern used by badge handler for version lookups
        const normalizedStoredModId = normalizeModId(mod.modId);
        console.log('[Thumbnail] Looking up R2 file:', { modCustomerId: mod.customerId, normalizedStoredModId, originalModId: mod.modId });
        
        // Try common image extensions to find the actual file
        // This handles cases where extension wasn't stored in metadata
        const extensions = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
        let r2Key: string | null = null;
        let thumbnail: R2ObjectBody | null = null;
        
        // Strategy 1: Try mod's customer scope first (where thumbnail was uploaded)
        if (mod.customerId) {
            for (const ext of extensions) {
                const testKey = getCustomerR2Key(mod.customerId, `thumbnails/${normalizedStoredModId}.${ext}`);
                console.log('[Thumbnail] Trying R2 key (mod customer scope):', { testKey, ext, customerId: mod.customerId });
                const testFile = await env.MODS_R2.get(testKey);
                if (testFile) {
                    r2Key = testKey;
                    thumbnail = testFile;
                    console.log('[Thumbnail] Found thumbnail in R2 (mod customer scope):', { r2Key, size: thumbnail.size, contentType: thumbnail.httpMetadata?.contentType });
                    break;
                }
            }
        }
        
        // Strategy 2: If not found, try authenticated user's customer scope (for cross-customer access)
        if (!thumbnail && auth?.customerId && auth.customerId !== mod.customerId) {
            for (const ext of extensions) {
                const testKey = getCustomerR2Key(auth.customerId, `thumbnails/${normalizedStoredModId}.${ext}`);
                console.log('[Thumbnail] Trying R2 key (auth customer scope):', { testKey, ext, customerId: auth.customerId });
                const testFile = await env.MODS_R2.get(testKey);
                if (testFile) {
                    r2Key = testKey;
                    thumbnail = testFile;
                    console.log('[Thumbnail] Found thumbnail in R2 (auth customer scope):', { r2Key, size: thumbnail.size, contentType: thumbnail.httpMetadata?.contentType });
                    break;
                }
            }
        }
        
        // Strategy 3: If still not found, try global scope (no customer prefix)
        if (!thumbnail) {
            for (const ext of extensions) {
                const testKey = `thumbnails/${normalizedStoredModId}.${ext}`;
                console.log('[Thumbnail] Trying R2 key (global scope):', { testKey, ext });
                const testFile = await env.MODS_R2.get(testKey);
                if (testFile) {
                    r2Key = testKey;
                    thumbnail = testFile;
                    console.log('[Thumbnail] Found thumbnail in R2 (global scope):', { r2Key, size: thumbnail.size, contentType: thumbnail.httpMetadata?.contentType });
                    break;
                }
            }
        }
        
        // Strategy 4: If still not found, search R2 by customMetadata (modId) to find thumbnail
        // This is more reliable than guessing extensions - R2 stores modId in customMetadata
        // Also try searching with original modId (with mod_ prefix) in case it was stored differently
        if (!thumbnail) {
            console.log('[Thumbnail] Searching R2 by customMetadata (modId):', { 
                modId: mod.modId, 
                normalizedStoredModId,
                originalModId: mod.modId 
            });
            
            try {
                // Search all customer scopes for thumbnails with matching modId in customMetadata
                const customerPrefix = 'customer_';
                let cursor: string | undefined;
                let found = false;
                let totalChecked = 0;
                let thumbnailFilesChecked = 0;
                
                // Try both normalized and original modId formats
                const modIdVariants = [
                    normalizedStoredModId,
                    mod.modId, // Original with mod_ prefix
                    normalizeModId(mod.modId), // Ensure normalized
                ];
                
                console.log('[Thumbnail] Starting R2 list search with prefix:', { customerPrefix, modIdVariants });
                
                do {
                    const listResult = await env.MODS_R2.list({ 
                        prefix: customerPrefix, 
                        cursor, 
                        limit: 1000 
                    });
                    
                    console.log('[Thumbnail] R2 list returned:', { 
                        objectsCount: listResult.objects.length, 
                        truncated: listResult.truncated,
                        hasCursor: !!cursor
                    });
                    
                    for (const obj of listResult.objects) {
                        totalChecked++;
                        
                        // Only check thumbnail files
                        if (obj.key.includes('/thumbnails/')) {
                            thumbnailFilesChecked++;
                            console.log('[Thumbnail] Checking thumbnail file:', { 
                                key: obj.key, 
                                size: obj.size,
                                checked: thumbnailFilesChecked
                            });
                            
                            // Get the object to check customMetadata
                            const testFile = await env.MODS_R2.get(obj.key);
                            if (testFile && testFile.customMetadata) {
                                // Check if modId matches (handle both normalized and non-normalized)
                                const metadataModId = testFile.customMetadata.modId;
                                if (!metadataModId) {
                                    console.log('[Thumbnail] File has no modId in customMetadata:', { key: obj.key });
                                    continue;
                                }
                                
                                const normalizedMetadataModId = normalizeModId(metadataModId);
                                
                                console.log('[Thumbnail] Comparing modIds:', {
                                    key: obj.key,
                                    metadataModId,
                                    normalizedMetadataModId,
                                    searchingFor: modIdVariants
                                });
                                
                                // Check against all modId variants
                                const matches = modIdVariants.some(variant => {
                                    const normalizedVariant = normalizeModId(variant);
                                    return normalizedMetadataModId === normalizedVariant || 
                                           metadataModId === variant;
                                });
                                
                                if (matches) {
                                    r2Key = obj.key;
                                    thumbnail = testFile;
                                    console.log('[Thumbnail] Found thumbnail in R2 by customMetadata:', { 
                                        r2Key, 
                                        size: thumbnail.size, 
                                        contentType: thumbnail.httpMetadata?.contentType,
                                        metadataModId,
                                        matchedModId: mod.modId,
                                        normalizedMetadataModId,
                                        normalizedStoredModId
                                    });
                                    found = true;
                                    break;
                                } else {
                                    console.log('[Thumbnail] ModId mismatch:', {
                                        key: obj.key,
                                        metadataModId,
                                        normalizedMetadataModId,
                                        searchingFor: modIdVariants
                                    });
                                }
                            } else {
                                console.log('[Thumbnail] File has no customMetadata:', { key: obj.key, hasFile: !!testFile });
                            }
                        }
                    }
                    
                    console.log('[Thumbnail] Search iteration complete:', {
                        totalChecked,
                        thumbnailFilesChecked,
                        found,
                        truncated: listResult.truncated
                    });
                    
                    if (found) break;
                    cursor = listResult.truncated ? listResult.cursor : undefined;
                } while (cursor && !found);
                
                console.log('[Thumbnail] R2 customMetadata search complete:', {
                    found,
                    totalChecked,
                    thumbnailFilesChecked,
                    finalCursor: cursor
                });
            } catch (error) {
                console.error('[Thumbnail] Error searching R2 by customMetadata:', { 
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    modId: mod.modId 
                });
            }
        }
        
        // If not found after all strategies, return 404
        if (!r2Key || !thumbnail) {
            console.error('[Thumbnail] Thumbnail file not found in R2 after exhaustive search:', { 
                modCustomerId: mod.customerId, 
                authCustomerId: auth?.customerId,
                normalizedStoredModId, 
                triedExtensions: extensions 
            });
            const rfcError = createError(request, 404, 'Thumbnail Not Found', 'Thumbnail file not found in storage');
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

        // Return thumbnail with proper headers
        console.log('[Thumbnail] Serving thumbnail:', { r2Key, size: thumbnail.size, contentType: thumbnail.httpMetadata?.contentType });
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        const headers = new Headers(Object.fromEntries(corsHeaders.entries()));
        headers.set('Content-Type', thumbnail.httpMetadata?.contentType || 'image/png');
        headers.set('Cache-Control', 'public, max-age=31536000');
        headers.set('Content-Length', thumbnail.size.toString());

        return new Response(thumbnail.body, {
            status: 200,
            headers,
        });
    } catch (error: any) {
        console.error('Thumbnail error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Load Thumbnail',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while loading the thumbnail'
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
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

