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
    auth: { customerId: string; jwtToken?: string } | null
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
            // console.log('[Thumbnail] Searching all customer scopes by modId:', { normalizedModId });
            const customerModPrefix = 'customer_';
            let cursor: string | undefined;
            let found = false;
            
            do {
                const listResult = await env.MODS_KV.list({ prefix: customerModPrefix, cursor });
                for (const key of listResult.keys) {
                    // Look for keys matching pattern: customer_*_mod_{normalizedModId}
                    // CRITICAL: Customer IDs can contain underscores (e.g., cust_0ab4c4434c48)
                    if (key.name.endsWith(`_mod_${normalizedModId}`)) {
                        mod = await env.MODS_KV.get(key.name, { type: 'json' }) as ModMetadata | null;
                        if (mod) {
                            // console.log('[Thumbnail] Found mod by modId in customer scope:', { modId: mod.modId, key: key.name });
                            found = true;
                            break;
                        }
                    }
                }
                if (found) break;
                cursor = listResult.list_complete ? undefined : listResult.cursor;
            } while (cursor && !found);
        }
        
        // if (mod) console.log('[Thumbnail] Found mod by modId:', { modId: mod.modId, slug: mod.slug, hasThumbnailUrl: !!mod.thumbnailUrl });

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
        
        // Extract JWT token from auth object or from cookie (required for admin check)
        let jwtToken: string | null = null;
        if (auth && 'jwtToken' in auth && auth.jwtToken) {
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
        
        const { isAdmin: checkIsAdmin } = await import('../../utils/admin.js');
        const isAdmin = auth?.customerId && jwtToken ? await checkIsAdmin(auth.customerId, jwtToken, env) : false;
        const isAuthor = mod.authorId === auth?.customerId;
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
        // For pending/changes_requested: allow if public (images are part of public presentation)
        // Draft mods: only author/admin (draft means not ready for public viewing)
        // CRITICAL: Image requests from <img> tags don't include auth, so we can't check isAuthor
        // Solution: Allow public pending mods to be accessible (they're public, just pending review)
        // But block draft mods from public access (they're not ready)
        if (modStatus === 'draft' && !isAuthor && !isAdmin) {
            // Draft mods are not ready for public viewing
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
        } else if (modStatus !== 'published' && modStatus !== 'approved') {
            // For pending/changes_requested: allow if public (images are part of public presentation)
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

        // console.log('[Thumbnail] Mod has thumbnailUrl:', { thumbnailUrl: mod.thumbnailUrl, modId: mod.modId, slug: mod.slug });

        // Reconstruct R2 key from mod metadata
        // Thumbnails are stored as: customer_xxx/thumbnails/normalizedModId.ext
        // CRITICAL FIX: Use stored extension first, then fall back to trying all extensions
        // This improves performance by avoiding unnecessary R2 lookups
        const normalizedStoredModId = normalizeModId(mod.modId);
        // console.log('[Thumbnail] Looking up R2 file:', { 
        //     modCustomerId: mod.customerId, 
        //     normalizedStoredModId, 
        //     originalModId: mod.modId,
        //     storedExtension: mod.thumbnailExtension
        // });
        
        // CRITICAL FIX: Use stored extension first if available
        const extensions = mod.thumbnailExtension 
            ? [mod.thumbnailExtension, 'png', 'jpg', 'jpeg', 'webp', 'gif'] // Try stored extension first
            : ['png', 'jpg', 'jpeg', 'webp', 'gif']; // Fall back to all extensions if not stored
        let r2Key: string | null = null;
        let thumbnail: R2ObjectBody | null = null;
        
        // Strategy 1: Try mod's customer scope first (where thumbnail was uploaded)
        if (mod.customerId) {
            for (const ext of extensions) {
                const testKey = getCustomerR2Key(mod.customerId, `thumbnails/${normalizedStoredModId}.${ext}`);
                // console.log('[Thumbnail] Trying R2 key (mod customer scope):', { testKey, ext, customerId: mod.customerId });
                const testFile = await env.MODS_R2.get(testKey);
                if (testFile) {
                    r2Key = testKey;
                    thumbnail = testFile;
                    // console.log('[Thumbnail] Found thumbnail in R2 (mod customer scope):', { r2Key, size: thumbnail.size, contentType: thumbnail.httpMetadata?.contentType });
                    break;
                }
            }
        }
        
        // Strategy 2: If not found, try authenticated user's customer scope (for cross-customer access)
        if (!thumbnail && auth?.customerId && auth.customerId !== mod.customerId) {
            for (const ext of extensions) {
                const testKey = getCustomerR2Key(auth.customerId, `thumbnails/${normalizedStoredModId}.${ext}`);
                // console.log('[Thumbnail] Trying R2 key (auth customer scope):', { testKey, ext, customerId: auth.customerId });
                const testFile = await env.MODS_R2.get(testKey);
                if (testFile) {
                    r2Key = testKey;
                    thumbnail = testFile;
                    // console.log('[Thumbnail] Found thumbnail in R2 (auth customer scope):', { r2Key, size: thumbnail.size, contentType: thumbnail.httpMetadata?.contentType });
                    break;
                }
            }
        }
        
        // Strategy 3: If still not found, try global scope (no customer prefix)
        if (!thumbnail) {
            for (const ext of extensions) {
                const testKey = `thumbnails/${normalizedStoredModId}.${ext}`;
                // console.log('[Thumbnail] Trying R2 key (global scope):', { testKey, ext });
                const testFile = await env.MODS_R2.get(testKey);
                if (testFile) {
                    r2Key = testKey;
                    thumbnail = testFile;
                    // console.log('[Thumbnail] Found thumbnail in R2 (global scope):', { r2Key, size: thumbnail.size, contentType: thumbnail.httpMetadata?.contentType });
                    break;
                }
            }
        }
        
        // Strategy 4: If still not found, search R2 by customMetadata (modId) to find thumbnail
        // This is more reliable than guessing extensions - R2 stores modId in customMetadata
        // Also try searching with original modId (with mod_ prefix) in case it was stored differently
        if (!thumbnail) {
            // console.log('[Thumbnail] Searching R2 by customMetadata (modId):', { 
            //     modId: mod.modId, 
            //     normalizedStoredModId,
            //     originalModId: mod.modId 
            // });
            
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
                
                // console.log('[Thumbnail] Starting R2 list search with prefix:', { customerPrefix, modIdVariants });
                
                do {
                    const listResult = await env.MODS_R2.list({ 
                        prefix: customerPrefix, 
                        cursor, 
                        limit: 1000 
                    });
                    
                    // console.log('[Thumbnail] R2 list returned:', { 
                    //     objectsCount: listResult.objects.length, 
                    //     truncated: listResult.truncated,
                    //     hasCursor: !!cursor
                    // });
                    
                    for (const obj of listResult.objects) {
                        totalChecked++;
                        
                        // Only check thumbnail files
                        if (obj.key.includes('/thumbnails/')) {
                            thumbnailFilesChecked++;
                            // console.log('[Thumbnail] Checking thumbnail file:', { 
                            //     key: obj.key, 
                            //     size: obj.size,
                            //     checked: thumbnailFilesChecked
                            // });
                            
                            // Get the object to check customMetadata
                            const testFile = await env.MODS_R2.get(obj.key);
                            if (testFile && testFile.customMetadata) {
                                // Check if modId matches (handle both normalized and non-normalized)
                                const metadataModId = testFile.customMetadata.modId;
                                if (!metadataModId) {
                                    // console.log('[Thumbnail] File has no modId in customMetadata:', { key: obj.key });
                                    continue;
                                }
                                
                                const normalizedMetadataModId = normalizeModId(metadataModId);
                                
                                // console.log('[Thumbnail] Comparing modIds:', {
                                //     key: obj.key,
                                //     metadataModId,
                                //     normalizedMetadataModId,
                                //     searchingFor: modIdVariants
                                // });
                                
                                // Check against all modId variants
                                const matches = modIdVariants.some(variant => {
                                    const normalizedVariant = normalizeModId(variant);
                                    return normalizedMetadataModId === normalizedVariant || 
                                           metadataModId === variant;
                                });
                                
                                if (matches) {
                                    r2Key = obj.key;
                                    thumbnail = testFile;
                                    // console.log('[Thumbnail] Found thumbnail in R2 by customMetadata:', { 
                                    //     r2Key, 
                                    //     size: thumbnail.size, 
                                    //     contentType: thumbnail.httpMetadata?.contentType,
                                    //     metadataModId,
                                    //     matchedModId: mod.modId,
                                    //     normalizedMetadataModId,
                                    //     normalizedStoredModId
                                    // });
                                    found = true;
                                    break;
                                } else {
                                    // console.log('[Thumbnail] ModId mismatch:', {
                                    //     key: obj.key,
                                    //     metadataModId,
                                    //     normalizedMetadataModId,
                                    //     searchingFor: modIdVariants
                                    // });
                                }
                            } else {
                                // console.log('[Thumbnail] File has no customMetadata:', { key: obj.key, hasFile: !!testFile });
                            }
                        }
                    }
                    
                    // console.log('[Thumbnail] Search iteration complete:', {
                    //     totalChecked,
                    //     thumbnailFilesChecked,
                    //     found,
                    //     truncated: listResult.truncated
                    // });
                    
                    if (found) break;
                    cursor = listResult.truncated ? listResult.cursor : undefined;
                } while (cursor && !found);
                
                // console.log('[Thumbnail] R2 customMetadata search complete:', {
                //     found,
                //     totalChecked,
                //     thumbnailFilesChecked,
                //     finalCursor: cursor
                // });
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

        // EXCEPTION: Allow public browsing (no JWT required) for thumbnails
        // JWT token already extracted above for admin check - reuse it here for encryption detection
        
        // CRITICAL: Detect if request is from a browser (HttpOnly cookie) or service-to-service (Authorization header)
        // Browser requests should NOT be encrypted because JavaScript can't access HttpOnly cookies to decrypt
        const cookieHeader = request.headers.get('Cookie');
        const isHttpOnlyCookie = !!(cookieHeader && cookieHeader.includes('auth_token='));
        
        // Only encrypt for service-to-service calls (Authorization header), not for browser requests (HttpOnly cookie)
        const shouldEncrypt = jwtToken && !isHttpOnlyCookie;
        
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        const headers = new Headers(Object.fromEntries(corsHeaders.entries()));
        
        if (shouldEncrypt) {
            // Encrypt image binary with JWT for service-to-service calls only
            // CRITICAL: Only read the stream when we need to encrypt it
            const imageBytes = await thumbnail.arrayBuffer();
            const imageArray = new Uint8Array(imageBytes);
            const { encryptBinaryWithJWT } = await import('@strixun/api-framework');
            const encryptedImage = await encryptBinaryWithJWT(imageArray, jwtToken);
            // console.log('[Thumbnail] Encrypted image binary:', { originalSize: imageArray.length, encryptedSize: encryptedImage.length });
            
            headers.set('Content-Type', 'application/octet-stream'); // Binary encrypted data
            headers.set('X-Encrypted', 'true'); // Flag to indicate encrypted response
            headers.set('X-Original-Content-Type', thumbnail.httpMetadata?.contentType || 'image/png'); // Preserve original content type
            headers.set('Content-Length', encryptedImage.length.toString());
            
            return new Response(encryptedImage, {
                status: 200,
                headers,
            });
        } else {
            // Return unencrypted for browser requests (HttpOnly cookie) or public browsing
            // CRITICAL: Use thumbnail.body directly without reading it first (stream can only be read once)
            // console.log('[Thumbnail] Serving unencrypted thumbnail for browser/public browsing:', { r2Key, size: thumbnail.size, contentType: thumbnail.httpMetadata?.contentType, isHttpOnlyCookie });
            headers.set('Content-Type', thumbnail.httpMetadata?.contentType || 'image/png');
            headers.set('X-Encrypted', 'false'); // Flag to indicate unencrypted response
            headers.set('Content-Length', thumbnail.size.toString());
            
            return new Response(thumbnail.body, {
                status: 200,
                headers,
            });
        }
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

