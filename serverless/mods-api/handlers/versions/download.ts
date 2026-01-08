/**
 * Download version handler
 * GET /mods/:modId/versions/:versionId/download
 * Returns direct download link or redirects to R2
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { decryptBinaryWithSharedKey } from '@strixun/api-framework';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, normalizeModId } from '../../utils/customer.js';
import { formatStrixunHash } from '../../utils/hash.js';
import type { ModMetadata, ModVersion } from '../../types/mod.js';

/**
 * Handle download version request
 * CRITICAL: modId parameter must be the actual modId, not a slug
 * Slug-to-modId resolution should happen in the router before calling this handler
 */
export async function handleDownloadVersion(
    request: Request,
    env: Env,
    modId: string,
    versionId: string,
    auth: { customerId: string; email?: string } | null
): Promise<Response> {
    console.log('[Download] handleDownloadVersion called:', { modId, versionId, hasAuth: !!auth, customerId: auth?.customerId });
    try {
        // Get mod metadata by modId only (slug should be resolved to modId before calling this)
        let mod: ModMetadata | null = null;
        
        // Normalize modId to ensure consistent key generation (strip mod_ prefix if present)
        const normalizedModId = normalizeModId(modId);
        console.log('[Download] Looking up mod by modId:', { normalizedModId, original: modId });
        
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
        
        // If still not found, search all customer scopes (for cross-customer access to public mods)
        if (!mod) {
            console.log('[Download] Mod not found in expected scopes, searching all customer scopes');
            const customerListPrefix = 'customer_';
            let cursor: string | undefined;
            
            do {
                const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor });
                
                for (const key of listResult.keys) {
                    if (key.name.endsWith('_mods_list')) {
                        const match = key.name.match(/^customer_([^_/]+)[_/]mods_list$/);
                        const customerId = match ? match[1] : null;
                        
                        if (customerId) {
                            const customerModsList = await env.MODS_KV.get(key.name, { type: 'json' }) as string[] | null;
                            
                            if (customerModsList) {
                                for (const listModId of customerModsList) {
                                    const normalizedListModId = normalizeModId(listModId);
                                    if (normalizedListModId === normalizedModId) {
                                        const customerModKey = getCustomerKey(customerId, `mod_${normalizedModId}`);
                                        mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                                        if (mod) {
                                            console.log('[Download] Found mod in customer scope:', { customerId, modId: mod.modId });
                                            break;
                                        }
                                    }
                                }
                                if (mod) break;
                            }
                        }
                    }
                }
                
                if (mod) break;
                cursor = listResult.listComplete ? undefined : listResult.cursor;
            } while (cursor);
        }

        if (!mod) {
            console.error('[Download] Mod not found:', { modId, versionId });
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

        // CRITICAL: Download access is controlled ONLY by visibility, NOT by status
        // Visibility = user's choice of who can access (public/unlisted/private)
        // Status = admin review workflow (pending/approved/published/etc.) - affects listings, NOT downloads
        const modVisibility = mod.visibility || 'public';
        
        // Check if user is admin (for admin access to private mods)
        const { isSuperAdminEmail } = await import('../../utils/admin.js');
        const isAdmin = auth?.email ? await isSuperAdminEmail(auth.email, env) : false;
        const isAuthor = mod.authorId === auth?.customerId;
        
        // Private mods: only author or admin can download
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
        
        // Draft status mods: only author or admin can download (regardless of visibility)
        // This prevents public draft mods from being downloaded before they're ready
        const modStatus = mod.status || 'published';
        if (modStatus === 'draft' && !isAuthor && !isAdmin) {
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
        
        // CRITICAL SECURITY: All files must be encrypted with JWT
        // JWT encryption is MANDATORY for all downloads - no service key fallback
        // Legacy files encrypted with service key must be re-uploaded with JWT encryption

        // Get version metadata - check mod's customer scope first (most reliable), then global, then search all
        // CRITICAL: Use mod's customerId (not auth customerId) to find version
        // Versions are stored with the mod's customerId, not the downloader's customerId
        let version: ModVersion | null = null;
        console.log('[Download] Looking up version:', { versionId, modId: mod.modId, modCustomerId: mod.customerId, authCustomerId: auth?.customerId });
        
        // Strategy 1: Check mod's customer scope first (where version was uploaded)
        // This is the most reliable location for the version
        if (mod.customerId) {
            const modCustomerVersionKey = getCustomerKey(mod.customerId, `version_${versionId}`);
            console.log('[Download] Checking mod customer scope for version:', { modCustomerVersionKey });
            version = await env.MODS_KV.get(modCustomerVersionKey, { type: 'json' }) as ModVersion | null;
            if (version) {
                console.log('[Download] Found version in mod customer scope:', { versionId: version.versionId, modId: version.modId });
            }
        }
        
        // Strategy 2: Check global scope (for published public mods)
        if (!version) {
            const globalVersionKey = `version_${versionId}`;
            console.log('[Download] Checking global scope for version:', { globalVersionKey });
            version = await env.MODS_KV.get(globalVersionKey, { type: 'json' }) as ModVersion | null;
            if (version) {
                console.log('[Download] Found version in global scope:', { versionId: version.versionId, modId: version.modId });
            }
        }
        
        // Strategy 3: Check auth customer scope (for backward compatibility)
        if (!version && auth?.customerId && auth.customerId !== mod.customerId) {
            const authCustomerVersionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
            console.log('[Download] Checking auth customer scope for version:', { authCustomerVersionKey });
            version = await env.MODS_KV.get(authCustomerVersionKey, { type: 'json' }) as ModVersion | null;
            if (version) {
                console.log('[Download] Found version in auth customer scope:', { versionId: version.versionId, modId: version.modId });
            }
        }
        
        // Strategy 4: Last resort - search all customer scopes (for cross-customer access to public mods)
        if (!version) {
            console.log('[Download] Version not found in expected scopes, searching all customer scopes');
            const customerListPrefix = 'customer_';
            let cursor: string | undefined;
            
            do {
                const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor });
                
                for (const key of listResult.keys) {
                    if (key.name.endsWith('_mods_list')) {
                        const match = key.name.match(/^customer_([^_/]+)[_/]mods_list$/);
                        const customerId = match ? match[1] : null;
                        
                        if (customerId) {
                            const customerVersionKey = getCustomerKey(customerId, `version_${versionId}`);
                            version = await env.MODS_KV.get(customerVersionKey, { type: 'json' }) as ModVersion | null;
                            if (version) {
                                console.log('[Download] Found version in customer scope:', { customerId, versionId: version.versionId });
                                break;
                            }
                        }
                    }
                }
                
                if (version) break;
                cursor = listResult.listComplete ? undefined : listResult.cursor;
            } while (cursor);
        }

        // Check version belongs to mod - version.modId must match mod.modId (source of truth)
        // Normalize both modIds before comparison to handle cases where one has mod_ prefix and the other doesn't
        const normalizedVersionModId = version ? normalizeModId(version.modId) : null;
        const normalizedModModId = normalizeModId(mod.modId);
        if (!version || normalizedVersionModId !== normalizedModModId) {
            console.error('[Download] Version not found or mismatch:', { 
                hasVersion: !!version, 
                versionModId: version?.modId,
                normalizedVersionModId,
                expectedModId: mod.modId,
                normalizedModModId,
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
        const { getR2SourceInfo } = await import('../../utils/r2-source.js');
        const r2SourceInfo = getR2SourceInfo(env, request);
        console.log('[Download] Fetching file from R2:', { 
            r2Key: version.r2Key,
            r2Source: r2SourceInfo.source,
            isLocal: r2SourceInfo.isLocal,
            storageLocation: r2SourceInfo.storageLocation
        });
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
        let encryptionFormat = encryptedFile.customMetadata?.encryptionFormat;
        const r2Source = encryptedFile.customMetadata?.['r2-source'] || 'unknown';
        const r2IsLocal = encryptedFile.customMetadata?.['r2-is-local'] === 'true';
        console.log('[Download] File retrieved from R2:', { 
            size: encryptedFile.size, 
            isEncrypted,
            r2Source,
            r2IsLocal,
            encryptionFormat,
            contentType: encryptedFile.httpMetadata?.contentType,
            hasCustomMetadata: !!encryptedFile.customMetadata
        });
        
        // Decrypt the file on-the-fly
        let decryptedFileBytes: Uint8Array;
        let originalContentType: string;
        
        if (isEncrypted) {
            console.log('[Download] File is encrypted, decrypting...');
            // File is encrypted - decrypt it with shared key
            // Get shared encryption key for decryption
            const sharedKey = env.MODS_ENCRYPTION_KEY;
            
            if (!sharedKey || sharedKey.length < 32) {
                const rfcError = createError(request, 500, 'Server Configuration Error', 'MODS_ENCRYPTION_KEY is not configured. Please ensure the encryption key is set in the environment.');
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
            
            try {
                // Normalize encryption format (trim whitespace, handle undefined)
                encryptionFormat = encryptionFormat?.trim();
                console.log('[Download] Encryption format from metadata:', { encryptionFormat, type: typeof encryptionFormat });
                
                // Read encrypted file once
                const encryptedBinary = await encryptedFile.arrayBuffer();
                const fileBytes = new Uint8Array(encryptedBinary);
                
                // Always detect format from file header as fallback/verification
                // Check for binary format: first byte should be 4 or 5
                let detectedFormat: string | null = null;
                if (fileBytes.length >= 4 && (fileBytes[0] === 4 || fileBytes[0] === 5)) {
                    detectedFormat = fileBytes[0] === 5 ? 'binary-v5' : 'binary-v4';
                    console.log('[Download] Detected encryption format from file header:', detectedFormat);
                }
                
                // Use detected format if metadata format is missing or doesn't match
                if (!encryptionFormat && detectedFormat) {
                    encryptionFormat = detectedFormat;
                    console.log('[Download] Using detected format from file header:', encryptionFormat);
                } else if (encryptionFormat && detectedFormat && encryptionFormat !== detectedFormat) {
                    console.warn('[Download] Format mismatch - metadata:', encryptionFormat, 'detected:', detectedFormat, 'using detected format');
                    encryptionFormat = detectedFormat;
                } else if (!encryptionFormat && !detectedFormat) {
                    // No format detected - assume legacy JSON (not supported with shared key)
                    throw new Error('Legacy JSON encryption format is not supported. File must be re-uploaded with shared key encryption.');
                }
                
                console.log('[Download] Final encryption format:', encryptionFormat);
                
                // Check encryption format and decrypt accordingly
                if (encryptionFormat === 'binary-v4' || encryptionFormat === 'binary-v5') {
                    // Binary encrypted format (v4 or v5) - decrypt with shared key
                    const version = encryptionFormat === 'binary-v5' ? 'v5' : 'v4';
                    console.log(`[Download] Using binary decryption (${version}) with shared key...`);
                    
                    // Decrypt with shared key (any authenticated user can decrypt)
                    decryptedFileBytes = await decryptBinaryWithSharedKey(encryptedBinary, sharedKey);
                    console.log('[Download] Binary decryption successful with shared key, size:', decryptedFileBytes.length);
                } else {
                    // Legacy JSON encrypted format - not supported with shared key encryption
                    throw new Error('Legacy JSON encryption format is not supported. File must be re-uploaded with shared key encryption.');
                }
                
                // Get original content type from metadata
                originalContentType = encryptedFile.customMetadata?.originalContentType || 'application/zip';
                console.log('[Download] Original content type:', originalContentType);
            } catch (error) {
                console.error('[Download] File decryption error:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                const isKeyMismatch = errorMessage.includes('does not match') || errorMessage.includes('key does not match');
                
                let detail = 'Failed to decrypt file.';
                if (isKeyMismatch) {
                    detail = 'Decryption key does not match. The file may have been encrypted with a different key. Legacy files encrypted with JWT may need to be re-uploaded with shared key encryption.';
                } else {
                    detail = `Failed to decrypt file: ${errorMessage}. Please ensure the file was encrypted with the shared encryption key.`;
                }
                
                const rfcError = createError(request, 500, 'Decryption Failed', detail);
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
        
        // If mod or version not found, return 404 instead of 500
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('not found') || errorMessage.includes('Not Found')) {
            const rfcError = createError(request, 404, 'Mod Not Found', 'The requested mod or version was not found');
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
    MODS_ENCRYPTION_KEY?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

