/**
 * Download variant handler
 * GET /mods/:modId/variants/:variantId/download
 * Returns decrypted variant file for download
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { decryptWithJWT, decryptBinaryWithJWT } from '@strixun/api-framework';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, normalizeModId, getCustomerR2Key } from '../../utils/customer.js';
import type { ModMetadata, ModVariant } from '../../types/mod.js';

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

        // Extract R2 key from fileUrl if available, otherwise construct from metadata
        // fileUrl format: https://pub-xxx.r2.dev/mods/modId/variants/variantId.ext
        // or: ${MODS_PUBLIC_URL}/mods/modId/variants/variantId.ext
        let r2Key: string | null = null;
        
        if (variant.fileUrl) {
            try {
                const url = new URL(variant.fileUrl);
                // Remove leading slash if present
                r2Key = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
            } catch {
                // If fileUrl is not a valid URL, try to extract from the path
                // Assume it's already an R2 key or path
                r2Key = variant.fileUrl.includes('mods/') ? variant.fileUrl.split('mods/')[1] : null;
                if (r2Key && !r2Key.startsWith('mods/')) {
                    r2Key = `mods/${normalizedModId}/variants/${variantId}${r2Key}`;
                }
            }
        }

        // Fallback: construct R2 key from variant metadata if fileUrl extraction failed
        if (!r2Key) {
            const fileExtension = variant.fileName?.includes('.') 
                ? variant.fileName.substring(variant.fileName.lastIndexOf('.'))
                : '.zip';
            r2Key = getCustomerR2Key(mod.customerId, `mods/${normalizedModId}/variants/${variantId}${fileExtension}`);
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
            // Decrypt the file
            const encryptedBytes = await encryptedFile.arrayBuffer();
            const encryptedArray = new Uint8Array(encryptedBytes);

            if (encryptionFormat === 'binary-v4' || encryptionFormat === 'binary-v5') {
                // Binary encrypted format - decrypt with JWT ONLY
                // CRITICAL SECURITY: JWT is MANDATORY - no service key fallback
                // CRITICAL: Trim token to ensure it matches the token used for encryption
                const jwtToken = request.headers.get('Authorization')?.replace('Bearer ', '').trim() || '';
                if (!jwtToken) {
                    const rfcError = createError(request, 401, 'Unauthorized', 'JWT token is required for encryption/decryption. Please provide a valid JWT token in the Authorization header.');
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
                
                // Decrypt with JWT (mandatory)
                decryptedData = await decryptBinaryWithJWT(encryptedArray, jwtToken);
                console.log('[VariantDownload] Decrypted using JWT');
            } else {
                // Legacy JSON encrypted format - decrypt with JWT ONLY
                // CRITICAL SECURITY: JWT is MANDATORY - no service key fallback
                // CRITICAL: Trim token to ensure it matches the token used for encryption
                const jwtToken = request.headers.get('Authorization')?.replace('Bearer ', '').trim() || '';
                if (!jwtToken) {
                    const rfcError = createError(request, 401, 'Unauthorized', 'JWT token is required for encryption/decryption. Please provide a valid JWT token in the Authorization header.');
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
                
                const encryptedText = new TextDecoder().decode(encryptedArray);
                const encryptedJson = JSON.parse(encryptedText);
                
                // Decrypt with JWT (mandatory)
                const decryptedJson = await decryptWithJWT(encryptedJson, jwtToken);
                decryptedData = new TextEncoder().encode(JSON.stringify(decryptedJson));
                console.log('[VariantDownload] Decrypted JSON using JWT');
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
    ENVIRONMENT?: string;
    MODS_PUBLIC_URL?: string;
    ALLOWED_ORIGINS?: string;
    [key: string]: any;
}
