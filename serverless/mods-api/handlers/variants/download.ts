/**
 * Download variant handler
 * GET /mods/:modId/variants/:variantId/download
 * Returns decrypted variant file for download
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { decryptBinaryWithSharedKey } from '@strixun/api-framework';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, normalizeModId } from '../../utils/customer.js';
import type { ModMetadata, ModVersion } from '../../types/mod.js';

/**
 * Handle download variant request
 * CRITICAL: modId parameter must be the actual modId, not a slug
 * Slug-to-modId resolution should happen in the router before calling this handler
 */
export async function handleDownloadVariant(
    request: Request,
    env: Env,
    modId: string,
    variantId: string,
    auth: { customerId: string } | null
): Promise<Response> {
    console.log('[VariantDownload] handleDownloadVariant called:', { modId, variantId, hasAuth: !!auth, customerId: auth?.customerId });
    try {
        // Get mod metadata by modId only (slug should be resolved to modId before calling this)
        let mod: ModMetadata | null = null;
        
        // Normalize modId to ensure consistent key generation
        const normalizedModId = normalizeModId(modId);
        
        // Check customer scope first if authenticated
        if (auth?.customerId) {
            const customerModKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
            mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
        }
        
        // Fall back to global scope if not found
        if (!mod) {
            const globalModKey = `mod_${normalizedModId}`;
            mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
        }
        
        // If still not found, search all customer scopes
        if (!mod) {
            const customerListPrefix = 'customer_';
            let cursor: string | undefined;
            
            do {
                const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor });
                for (const key of listResult.keys) {
                    if (key.name.endsWith('_mods_list')) {
                        const match = key.name.match(/^customer_([^_/]+)[_/]mods_list$/);
                        const customerId = match ? match[1] : null;
                        if (customerId) {
                            const customerModKey = getCustomerKey(customerId, `mod_${normalizedModId}`);
                            mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                            if (mod) break;
                        }
                    }
                }
                if (mod) break;
                cursor = listResult.list_complete ? undefined : listResult.cursor;
            } while (cursor);
        }

        if (!mod) {
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

        // Find the variant
        const variant = mod.variants?.find(v => v.variantId === variantId);
        if (!variant) {
            const rfcError = createError(request, 404, 'Variant Not Found', 'The requested variant was not found');
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

        // ARCHITECTURAL IMPROVEMENT: Variants now use version control
        // Get the current (latest) version of the variant
        if (!variant.currentVersionId) {
            const rfcError = createError(request, 404, 'No Version Available', 'This variant has no versions available');
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

        console.log('[VariantDownload] Fetching current version:', { variantId, currentVersionId: variant.currentVersionId });
        
        // UNIFIED SYSTEM: Variant versions are stored as ModVersion with variantId field
        const versionKey = getCustomerKey(mod.customerId, `version_${variant.currentVersionId}`);
        const variantVersion = await env.MODS_KV.get(versionKey, { type: 'json' }) as ModVersion | null;
        
        if (!variantVersion) {
            const rfcError = createError(request, 404, 'Version Not Found', 'The current version of this variant was not found');
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

        // Get r2Key from the current variant version
        const r2Key = variantVersion.r2Key;
        console.log('[VariantDownload] Using r2Key from current variant version:', { 
            variantVersionId: variantVersion.variantVersionId,
            version: variantVersion.version,
            r2Key 
        });

        // Get encrypted file from R2
        const { getR2SourceInfo } = await import('../../utils/r2-source.js');
        const r2SourceInfo = getR2SourceInfo(env, request);
        console.log('[VariantDownload] Fetching file from R2:', { 
            r2Key,
            r2Source: r2SourceInfo.source,
            isLocal: r2SourceInfo.isLocal,
            storageLocation: r2SourceInfo.storageLocation
        });
        
        const encryptedFile = await env.MODS_R2.get(r2Key);
        
        if (!encryptedFile) {
            console.error('[VariantDownload] File not found in R2:', { r2Key });
            const rfcError = createError(request, 404, 'File Not Found', 'The requested variant file was not found in storage');
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

        // Check if file is encrypted
        const customMetadata = encryptedFile.customMetadata || {};
        console.log('[VariantDownload] R2 customMetadata:', {
            allMetadata: customMetadata,
            originalFileName: customMetadata.originalFileName,
            originalContentType: customMetadata.originalContentType,
            r2Key
        });
        const isEncrypted = customMetadata.encrypted === 'true';
        const encryptionFormat = customMetadata.encryptionFormat || 'binary-v4';

        let decryptedData: Uint8Array;
        
        if (isEncrypted) {
            // Decrypt the file with shared key
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
            
            const encryptedBytes = await encryptedFile.arrayBuffer();
            const encryptedArray = new Uint8Array(encryptedBytes);

            // Check file format from bytes if metadata is missing or incorrect
            // First byte indicates encryption version: 4 or 5 = shared key, anything else = invalid
            const fileVersion = encryptedArray.length > 0 ? encryptedArray[0] : null;
            const isBinaryEncrypted = fileVersion === 4 || fileVersion === 5;
            
            // If metadata says binary but file doesn't match, or if metadata is missing, detect from bytes
            if ((encryptionFormat === 'binary-v4' || encryptionFormat === 'binary-v5') || isBinaryEncrypted) {
                // Binary encrypted format - decrypt with shared key (ONLY method supported)
                try {
                    decryptedData = await decryptBinaryWithSharedKey(encryptedArray, sharedKey);
                    console.log('[VariantDownload] Decrypted using shared key');
                } catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    // Check if error is about unsupported version (might be JWT-encrypted or unencrypted)
                    if (errorMsg.includes('Unsupported binary encryption version')) {
                        const rfcError = createError(request, 400, 'Invalid Encryption Format', `Variant file is not encrypted with shared key encryption. The file appears to be encrypted with a different method (JWT encryption is no longer supported) or is not encrypted at all. Please re-upload the variant file with shared key encryption. Error: ${errorMsg}`);
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
                    // Other decryption errors (wrong key, corrupted data, etc.)
                    const rfcError = createError(request, 500, 'Decryption Failed', `Failed to decrypt variant file with shared key: ${errorMsg}`);
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
                // Legacy JSON encrypted format or unencrypted - not supported
                const rfcError = createError(request, 400, 'Unsupported Format', 'Legacy JSON encryption format is not supported. Variant file must be re-uploaded with shared key encryption (binary format v4 or v5). JWT encryption is no longer supported.');
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
        } else {
            // File is not encrypted, return as-is
            decryptedData = new Uint8Array(await encryptedFile.arrayBuffer());
            console.log('[VariantDownload] File is not encrypted, returning as-is');
        }

        // Determine content type and filename - use EXACTLY what was uploaded
        const originalContentType = customMetadata.originalContentType;
        const originalFileName = customMetadata.originalFileName;
        
        console.log('[VariantDownload] File metadata:', {
            fromCustomMetadata: {
                originalFileName: customMetadata.originalFileName,
                originalContentType: customMetadata.originalContentType
            },
            fromVersion: {
                fileName: variantVersion.fileName
            },
            allCustomMetadata: customMetadata
        });
        
        if (!originalFileName || !originalContentType) {
            console.error('[VariantDownload] Missing file metadata:', {
                hasOriginalFileName: !!originalFileName,
                hasOriginalContentType: !!originalContentType,
                customMetadata
            });
            const rfcError = createError(request, 500, 'Internal Server Error', 'File metadata (originalFileName or originalContentType) not found in R2 customMetadata');
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

        // UNIFIED SYSTEM: Increment download counters
        // Increment version download count (async, don't wait)
        Promise.resolve().then(async () => {
            const versionKey = getCustomerKey(mod.customerId, `version_${variantVersion.versionId}`);
            const version = await env.MODS_KV.get(versionKey, { type: 'json' }) as ModVersion | null;
            if (version) {
                version.downloads += 1;
                await env.MODS_KV.put(versionKey, JSON.stringify(version));
            }
        }).catch(error => {
            console.error('[VariantDownload] Error incrementing download counter:', error);
        });

        // Increment mod download count
        mod.downloadCount = (mod.downloadCount || 0) + 1;
        
        // Save mod back to the appropriate scope
        if (mod.customerId) {
            const customerModKey = getCustomerKey(mod.customerId, `mod_${normalizedModId}`);
            await env.MODS_KV.put(customerModKey, JSON.stringify(mod));
        }
        if (mod.visibility === 'public') {
            const globalModKey = `mod_${normalizedModId}`;
            await env.MODS_KV.put(globalModKey, JSON.stringify(mod));
        }
        
        console.log('[VariantDownload] Successfully incremented download counters:', {
            variantVersionId: variantVersion.variantVersionId,
            variantId,
            modDownloadCount: mod.downloadCount
        });

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            exposedHeaders: ['Content-Disposition', 'Content-Type', 'Content-Length'],
        });

        console.log('[VariantDownload] Returning file with headers:', {
            'Content-Type': originalContentType,
            'Content-Disposition': `attachment; filename="${originalFileName}"`,
            'Content-Length': decryptedData.length,
            originalFileName,
            originalContentType
        });

        // Return decrypted file - use EXACTLY what was uploaded
        return new Response(decryptedData, {
            status: 200,
            headers: {
                'Content-Type': originalContentType,
                'Content-Disposition': `attachment; filename="${originalFileName}"`,
                'Content-Length': decryptedData.length.toString(),
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('[VariantDownload] Error:', error);
        const rfcError = createError(
            request,
            500,
            'Internal Server Error',
            env.ENVIRONMENT === 'development' ? error.message : 'Failed to download variant file'
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
    MODS_PUBLIC_URL?: string;
    ALLOWED_ORIGINS?: string;
    [key: string]: any;
}
