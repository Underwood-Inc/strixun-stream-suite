/**
 * Download variant handler
 * GET /mods/:modId/variants/:variantId/download
 * Returns decrypted variant file for download
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { decryptBinaryWithSharedKey } from '@strixun/api-framework';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, normalizeModId, getCustomerR2Key } from '../../utils/customer.js';
import { migrateModVariantsIfNeeded } from '../../utils/lazy-variant-migration.js';
import type { ModMetadata, ModVariant, ModVersion } from '../../types/mod.js';

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
    auth: { userId: string; customerId: string | null; email?: string } | null
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
                cursor = listResult.listComplete ? undefined : listResult.cursor;
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

        // ✨ LAZY MIGRATION: Automatically migrate variants if needed
        mod = await migrateModVariantsIfNeeded(mod, env);

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

        // Extract R2 key - prioritize stored r2Key, then fileUrl, then construct from metadata
        // fileUrl format: https://pub-xxx.r2.dev/mods/modId/variants/variantId.ext
        // or: ${MODS_PUBLIC_URL}/mods/modId/variants/variantId.ext
        let r2Key: string | null = null;
        
        // First priority: use stored r2Key if available (most reliable)
        if (variant.r2Key) {
            r2Key = variant.r2Key;
            console.log('[VariantDownload] Using stored r2Key from variant metadata:', r2Key);
        } else if (variant.fileUrl) {
            // Second priority: extract from fileUrl
            try {
                const url = new URL(variant.fileUrl);
                // Remove leading slash if present
                r2Key = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
                console.log('[VariantDownload] Extracted r2Key from fileUrl:', r2Key);
            } catch {
                // If fileUrl is not a valid URL, try to extract from the path
                // Assume it's already an R2 key or path
                r2Key = variant.fileUrl.includes('mods/') ? variant.fileUrl.split('mods/')[1] : null;
                if (r2Key && !r2Key.startsWith('mods/')) {
                    r2Key = `mods/${normalizedModId}/variants/${variantId}${r2Key}`;
                }
                console.log('[VariantDownload] Extracted r2Key from fileUrl path:', r2Key);
            }
        }

        // Fallback: construct R2 key from variant metadata if extraction failed
        if (!r2Key) {
            const fileExtension = variant.fileName?.includes('.') 
                ? variant.fileName.substring(variant.fileName.lastIndexOf('.'))
                : '.zip';
            r2Key = getCustomerR2Key(mod.customerId, `mods/${normalizedModId}/variants/${variantId}${fileExtension}`);
            console.log('[VariantDownload] Constructed r2Key from metadata fallback:', r2Key);
        }

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

        // Determine content type and filename
        const originalContentType = customMetadata.originalContentType || 'application/zip';
        const originalFileName = customMetadata.originalFileName || variant.fileName || `variant-${variantId}.zip`;

        // Increment download count for mod
        mod.downloadCount = (mod.downloadCount || 0) + 1;
        
        // Increment variant-specific download count
        // CRITICAL: variant is a reference to mod.variants array element, so updating it updates the mod
        if (variant) {
            variant.downloads = (variant.downloads || 0) + 1;
            // Ensure the updated variant is in mod.variants (it should be since variant is a reference)
            if (mod.variants) {
                const variantIndex = mod.variants.findIndex(v => v.variantId === variantId);
                if (variantIndex >= 0) {
                    mod.variants[variantIndex] = variant; // Explicitly update in array (though reference should work)
                }
            }
            console.log('[VariantDownload] Incremented download count for variant:', {
                variantId: variant.variantId,
                variantName: variant.name,
                downloads: variant.downloads
            });
        }
        
        // Also increment download count for the latest version (same as version downloads)
        let latestVersion: ModVersion | null = null;
        if (mod.latestVersion) {
            // Get version list to find the latest version
            const versionsListKey = mod.customerId 
                ? getCustomerKey(mod.customerId, `mod_${normalizedModId}_versions`)
                : `mod_${normalizedModId}_versions`;
            const versionIds = await env.MODS_KV.get(versionsListKey, { type: 'json' }) as string[] | null;
            
            if (versionIds && versionIds.length > 0) {
                // Load all versions and find the one matching latestVersion semantic version
                const versions: ModVersion[] = [];
                for (const versionId of versionIds) {
                    let version: ModVersion | null = null;
                    
                    // Try customer scope first
                    if (mod.customerId) {
                        const customerVersionKey = getCustomerKey(mod.customerId, `version_${versionId}`);
                        version = await env.MODS_KV.get(customerVersionKey, { type: 'json' }) as ModVersion | null;
                    }
                    
                    // Try global scope if not found
                    if (!version) {
                        const globalVersionKey = `version_${versionId}`;
                        version = await env.MODS_KV.get(globalVersionKey, { type: 'json' }) as ModVersion | null;
                    }
                    
                    if (version) {
                        versions.push(version);
                        // If this matches the latestVersion semantic version, use it
                        if (version.version === mod.latestVersion) {
                            latestVersion = version;
                        }
                    }
                }
                
                // If no exact match found, use the newest version (sorted by semantic version)
                if (!latestVersion && versions.length > 0) {
                    versions.sort((a, b) => {
                        const aParts = a.version.split('.').map(Number);
                        const bParts = b.version.split('.').map(Number);
                        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                            const aPart = aParts[i] || 0;
                            const bPart = bParts[i] || 0;
                            if (aPart !== bPart) {
                                return bPart - aPart; // Newest first
                            }
                        }
                        return 0;
                    });
                    latestVersion = versions[0]; // Use newest version
                }
            }
        }
        
        // Increment version download count if latest version was found
        if (latestVersion) {
            latestVersion.downloads = (latestVersion.downloads || 0) + 1;
            
            // Save version back to the appropriate scope (same logic as version downloads)
            if (mod.customerId) {
                const modCustomerVersionKey = getCustomerKey(mod.customerId, `version_${latestVersion.versionId}`);
                await env.MODS_KV.put(modCustomerVersionKey, JSON.stringify(latestVersion));
            }
            if (mod.visibility === 'public') {
                const globalVersionKey = `version_${latestVersion.versionId}`;
                await env.MODS_KV.put(globalVersionKey, JSON.stringify(latestVersion));
            }
            
            console.log('[VariantDownload] Incremented download count for latest version:', {
                versionId: latestVersion.versionId,
                version: latestVersion.version,
                downloads: latestVersion.downloads
            });
        } else {
            console.log('[VariantDownload] Could not find latest version to increment download count');
        }
        
        // Save mod back to the appropriate scope
        if (mod.customerId) {
            const customerModKey = getCustomerKey(mod.customerId, `mod_${normalizedModId}`);
            await env.MODS_KV.put(customerModKey, JSON.stringify(mod));
        }
        if (mod.visibility === 'public') {
            const globalModKey = `mod_${normalizedModId}`;
            await env.MODS_KV.put(globalModKey, JSON.stringify(mod));
        }

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });

        // Return decrypted file
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
