/**
 * Download version handler
 * GET /mods/:modId/versions/:versionId/download
 * Returns direct download link or redirects to R2
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { decryptWithJWT } from '@strixun/api-framework';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, normalizeModId } from '../../utils/customer.js';
import { formatStrixunHash } from '../../utils/hash.js';
import { findModBySlug } from '../../utils/slug.js';
import type { ModMetadata, ModVersion } from '../../types/mod.js';

/**
 * Handle download version request
 * Supports both modId (legacy) and slug (new) patterns
 */
export async function handleDownloadVersion(
    request: Request,
    env: Env,
    modIdOrSlug: string,
    versionId: string,
    auth: { userId: string; customerId: string | null; email?: string } | null
): Promise<Response> {
    console.log('[Download] handleDownloadVersion called:', { modIdOrSlug, versionId, hasAuth: !!auth, customerId: auth?.customerId });
    try {
        // Get mod metadata - try multiple lookup strategies for legacy compatibility
        let mod: ModMetadata | null = null;
        
        // Strategy 1: Try direct modId lookup (legacy pattern: mod_xxx or just xxx)
        // Normalize modId to ensure consistent key generation (strip mod_ prefix if present)
        const normalizedModId = normalizeModId(modIdOrSlug);
        console.log('[Download] Strategy 1: Trying modId lookup:', { normalizedModId, original: modIdOrSlug });
        
        // Check customer scope first if authenticated
        if (auth?.customerId) {
            const customerModKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
            console.log('[Download] Checking customer scope:', { customerModKey });
            mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
            if (mod) console.log('[Download] Found mod in customer scope:', { modId: mod.modId, slug: mod.slug });
        }
        
        // Fall back to global scope if not found
        if (!mod) {
            const globalModKey = `mod_${normalizedModId}`;
            console.log('[Download] Checking global scope:', { globalModKey });
            mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
            if (mod) console.log('[Download] Found mod in global scope:', { modId: mod.modId, slug: mod.slug });
        }
        
        // Strategy 2: If not found by modId, try slug lookup (new pattern)
        if (!mod) {
            console.log('[Download] Strategy 2: Trying slug lookup:', { modIdOrSlug });
            mod = await findModBySlug(modIdOrSlug, env, auth);
            if (mod) console.log('[Download] Found mod by slug:', { modId: mod.modId, slug: mod.slug });
        }
        
        // Strategy 3: Try treating the entire string as modId (for legacy mods with full mod_ prefix)
        // This is now redundant since normalizeModId handles it, but keeping for backward compatibility
        if (!mod && modIdOrSlug.startsWith('mod_')) {
            console.log('[Download] Strategy 3: Trying full modId (legacy):', { modIdOrSlug });
            // Use normalized version for consistency
            if (auth?.customerId) {
                const customerModKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
                mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
            }
            if (!mod) {
                const globalModKey = `mod_${normalizedModId}`;
                mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
            }
            if (mod) console.log('[Download] Found mod by full modId:', { modId: mod.modId, slug: mod.slug });
        }

        if (!mod) {
            console.error('[Download] Mod not found after all strategies:', { modIdOrSlug, versionId });
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

        // Check visibility - legacy mods without visibility field are treated as public
        const modVisibility = mod.visibility || 'public';
        if (modVisibility === 'private' && mod.authorId !== auth?.userId) {
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

        // Check status: only allow downloads of published/approved mods to public, admins and authors can download all statuses
        // Legacy mods without status field are treated as published
        const { isSuperAdminEmail } = await import('../../utils/admin.js');
        const isAdmin = auth?.email ? await isSuperAdminEmail(auth.email, env) : false;
        const isAuthor = mod.authorId === auth?.userId;
        
        // Legacy mods might not have status field - treat undefined/null as published
        const modStatus = mod.status || 'published';
        
        // Allow 'published' and 'approved' status for public downloads
        if (modStatus !== 'published' && modStatus !== 'approved') {
            // Only allow downloads of non-published/approved mods to admins or the author
            if (!isAuthor && !isAdmin) {
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

        // Get version metadata - check both customer scope and global scope
        // CRITICAL: Use mod's customerId (not auth customerId) to find version
        // Versions are stored with the mod's customerId, not the downloader's customerId
        let version: ModVersion | null = null;
        console.log('[Download] Looking up version:', { versionId, modId: mod.modId, modCustomerId: mod.customerId, authCustomerId: auth?.customerId });
        
        // Check mod's customer scope first (where version was stored)
        if (mod.customerId) {
            const modCustomerVersionKey = getCustomerKey(mod.customerId, `version_${versionId}`);
            console.log('[Download] Checking mod customer scope for version:', { modCustomerVersionKey });
            version = await env.MODS_KV.get(modCustomerVersionKey, { type: 'json' }) as ModVersion | null;
            if (version) console.log('[Download] Found version in mod customer scope:', { versionId: version.versionId, modId: version.modId });
        }
        
        // Also check auth customer scope (in case they match or for cross-customer access)
        if (!version && auth?.customerId && auth.customerId !== mod.customerId) {
            const authCustomerVersionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
            console.log('[Download] Checking auth customer scope for version:', { authCustomerVersionKey });
            version = await env.MODS_KV.get(authCustomerVersionKey, { type: 'json' }) as ModVersion | null;
            if (version) console.log('[Download] Found version in auth customer scope:', { versionId: version.versionId, modId: version.modId });
        }
        
        // Fall back to global scope if not found
        if (!version) {
            const globalVersionKey = `version_${versionId}`;
            console.log('[Download] Checking global scope for version:', { globalVersionKey });
            version = await env.MODS_KV.get(globalVersionKey, { type: 'json' }) as ModVersion | null;
            if (version) console.log('[Download] Found version in global scope:', { versionId: version.versionId, modId: version.modId });
        }

        // Check version belongs to mod - version.modId must match mod.modId (source of truth)
        if (!version || version.modId !== mod.modId) {
            console.error('[Download] Version not found or mismatch:', { 
                hasVersion: !!version, 
                versionModId: version?.modId, 
                expectedModId: mod.modId,
                versionId 
            });
            const rfcError = createError(request, 404, 'Version Not Found', 'The requested version was not found');
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

        console.log('[Download] Version found, preparing download:', { 
            versionId: version.versionId, 
            fileName: version.fileName, 
            r2Key: version.r2Key,
            fileSize: version.fileSize
        });

        // Increment download count
        version.downloads += 1;
        mod.downloadCount += 1;
        
        // Save version back to the appropriate scope
        // CRITICAL: Use mod's customerId (not auth customerId) to save version
        // Versions must be saved to the same scope where they were stored
        if (mod.customerId) {
            const modCustomerVersionKey = getCustomerKey(mod.customerId, `version_${versionId}`);
            await env.MODS_KV.put(modCustomerVersionKey, JSON.stringify(version));
        }
        if (mod.visibility === 'public') {
            const globalVersionKey = `version_${versionId}`;
            await env.MODS_KV.put(globalVersionKey, JSON.stringify(version));
        }
        
        // Save mod back to the appropriate scope
        // Normalize modId to ensure consistent key generation
        const normalizedModIdForKey = normalizeModId(mod.modId);
        if (mod.customerId) {
            const customerModKey = getCustomerKey(mod.customerId, `mod_${normalizedModIdForKey}`);
            await env.MODS_KV.put(customerModKey, JSON.stringify(mod));
        }
        if (mod.visibility === 'public') {
            const globalModKey = `mod_${normalizedModIdForKey}`;
            await env.MODS_KV.put(globalModKey, JSON.stringify(mod));
        }

        // Get encrypted file from R2
        // SECURITY: Files are stored encrypted in R2 (encryption at rest)
        // We decrypt on-the-fly during download to return usable files
        console.log('[Download] Fetching file from R2:', { r2Key: version.r2Key });
        const encryptedFile = await env.MODS_R2.get(version.r2Key);
        
        if (!encryptedFile) {
            console.error('[Download] File not found in R2:', { r2Key: version.r2Key });
            const rfcError = createError(request, 404, 'File Not Found', 'The requested file was not found in storage');
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

        // Check if file is encrypted (should always be true for new uploads)
        const isEncrypted = encryptedFile.customMetadata?.encrypted === 'true';
        console.log('[Download] File retrieved from R2:', { 
            size: encryptedFile.size, 
            isEncrypted, 
            contentType: encryptedFile.httpMetadata?.contentType,
            hasCustomMetadata: !!encryptedFile.customMetadata
        });
        
        // Decrypt the file on-the-fly
        let decryptedFileBytes: Uint8Array;
        let originalContentType: string;
        
        if (isEncrypted) {
            console.log('[Download] File is encrypted, decrypting...');
            // File is encrypted - decrypt it
            try {
                const encryptedData = await encryptedFile.text();
                const encryptedJson = JSON.parse(encryptedData);
                console.log('[Download] Encrypted data parsed, size:', encryptedData.length);
                
                // Get JWT token for decryption
                const jwtToken = request.headers.get('Authorization')?.replace('Bearer ', '') || '';
                console.log('[Download] JWT token check:', { hasToken: !!jwtToken, tokenLength: jwtToken.length });
                if (!jwtToken) {
                    const rfcError = createError(request, 401, 'Authentication Required', 'JWT token required to decrypt and download files');
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
                
                // Decrypt the file
                console.log('[Download] Decrypting with JWT...');
                const decryptedBase64 = await decryptWithJWT(encryptedJson, jwtToken) as string;
                console.log('[Download] Decryption successful, base64 length:', decryptedBase64.length);
                
                // Convert base64 back to binary
                const binaryString = atob(decryptedBase64);
                decryptedFileBytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    decryptedFileBytes[i] = binaryString.charCodeAt(i);
                }
                console.log('[Download] Converted to binary, size:', decryptedFileBytes.length);
                
                // Get original content type from metadata
                originalContentType = encryptedFile.customMetadata?.originalContentType || 'application/zip';
                console.log('[Download] Original content type:', originalContentType);
            } catch (error) {
                console.error('[Download] File decryption error:', error);
                const rfcError = createError(request, 500, 'Decryption Failed', 'Failed to decrypt file. Please ensure you are authenticated.');
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
        } else {
            console.log('[Download] File is not encrypted (legacy), returning as-is');
            // Legacy file (not encrypted) - return as-is
            // This handles files uploaded before encryption was enforced
            const arrayBuffer = await encryptedFile.arrayBuffer();
            decryptedFileBytes = new Uint8Array(arrayBuffer);
            originalContentType = encryptedFile.httpMetadata?.contentType || 'application/octet-stream';
            console.log('[Download] Legacy file prepared:', { size: decryptedFileBytes.length, contentType: originalContentType });
        }

        // Return decrypted file with proper headers including integrity hash
        console.log('[Download] Preparing response:', { 
            fileName: version.fileName, 
            contentType: originalContentType, 
            size: decryptedFileBytes.length,
            hasHash: !!version.sha256
        });
        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        const headers = new Headers(Object.fromEntries(corsHeaders.entries()));
        headers.set('Content-Type', originalContentType);
        headers.set('Content-Disposition', `attachment; filename="${version.fileName}"`);
        headers.set('Content-Length', decryptedFileBytes.length.toString());
        headers.set('Cache-Control', 'public, max-age=31536000');
        
        // Add Strixun file integrity hash headers
        if (version.sha256) {
            const strixunHash = formatStrixunHash(version.sha256);
            headers.set('X-Strixun-File-Hash', strixunHash);
            headers.set('X-Strixun-SHA256', version.sha256);
        }

        // Return decrypted file bytes
        return new Response(decryptedFileBytes, {
            status: 200,
            headers,
        });
    } catch (error: any) {
        console.error('Download version error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Download Version',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while downloading the version'
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
    ENVIRONMENT?: string;
    [key: string]: any;
}

