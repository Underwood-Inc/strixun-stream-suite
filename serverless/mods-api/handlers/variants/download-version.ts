/**
 * Download variant version handler
 * GET /mods/:modId/variants/:variantId/versions/:variantVersionId/download
 * Returns decrypted variant version file for download
 * ARCHITECTURAL IMPROVEMENT: Download specific variant versions
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { decryptBinaryWithSharedKey } from '@strixun/api-framework';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, normalizeModId } from '../../utils/customer.js';
import {
    getVariantVersion,
    incrementVariantVersionDownloads,
    incrementVariantTotalDownloads
} from '../../utils/variant-versions.js';
import type { ModMetadata } from '../../types/mod.js';

/**
 * Handle download variant version request
 */
export async function handleDownloadVariantVersion(
    request: Request,
    env: Env,
    modId: string,
    variantId: string,
    variantVersionId: string,
    auth: { customerId: string } | null
): Promise<Response> {
    try {
        // Get mod metadata
        const normalizedModId = normalizeModId(modId);
        let mod: ModMetadata | null = null;
        
        // Try auth customer scope first
        if (auth?.customerId) {
            const modKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
            mod = await env.MODS_KV.get(modKey, { type: 'json' }) as ModMetadata | null;
        }
        
        // Try global scope if not found
        if (!mod) {
            const globalModKey = `mod_${normalizedModId}`;
            mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
        }
        
        // Search all customer scopes as fallback
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

        // Check visibility
        if (mod.visibility === 'private' && (!auth || mod.authorId !== auth.customerId)) {
            const rfcError = createError(request, 403, 'Forbidden', 'This mod is private');
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

        // Get variant version metadata
        const variantVersion = await getVariantVersion(variantVersionId, mod.customerId, env);
        
        if (!variantVersion) {
            const rfcError = createError(request, 404, 'Variant Version Not Found', 'The requested variant version was not found');
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

        // Verify variant version belongs to this variant and mod
        if (variantVersion.variantId !== variantId) {
            const rfcError = createError(request, 400, 'Invalid Variant Version', 'Variant version does not belong to this variant');
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

        // Get encrypted file from R2
        const r2Key = variantVersion.r2Key;
        console.log('[DownloadVariantVersion] Fetching file from R2:', { r2Key });
        
        const file = await env.MODS_R2.get(r2Key);
        
        if (!file) {
            console.error('[DownloadVariantVersion] File not found in R2:', { r2Key });
            const rfcError = createError(request, 404, 'File Not Found', 'The variant version file was not found in storage');
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

        // Read encrypted file
        const encryptedBytes = new Uint8Array(await file.arrayBuffer());
        
        // Get decryption key
        const sharedKey = env.MODS_ENCRYPTION_KEY;
        
        if (!sharedKey || sharedKey.length < 32) {
            const rfcError = createError(request, 500, 'Server Configuration Error', 'MODS_ENCRYPTION_KEY is not configured.');
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

        // Decrypt file
        let decryptedData: Uint8Array;
        
        try {
            decryptedData = await decryptBinaryWithSharedKey(encryptedBytes, sharedKey);
            console.log('[DownloadVariantVersion] File decrypted successfully');
        } catch (decryptError) {
            console.error('[DownloadVariantVersion] Decryption error:', decryptError);
            const rfcError = createError(request, 500, 'Decryption Failed', 'Failed to decrypt file');
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

        // Get original filename and content type from metadata - NO FALLBACKS
        const originalFileName = file.customMetadata?.originalFileName || variantVersion.fileName;
        const originalContentType = file.customMetadata?.originalContentType;
        
        if (!originalFileName || !originalContentType) {
            const rfcError = createError(request, 500, 'Internal Server Error', 'File metadata not found');
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

        // Increment download counters (async, don't wait)
        Promise.all([
            incrementVariantVersionDownloads(variantVersionId, mod.customerId, env),
            incrementVariantTotalDownloads(variantId, mod.customerId, env)
        ]).catch(error => {
            console.error('[DownloadVariantVersion] Error incrementing download counters:', error);
        });

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
        console.error('[DownloadVariantVersion] Error:', error);
        const rfcError = createError(
            request,
            500,
            'Internal Server Error',
            env.ENVIRONMENT === 'development' ? error.message : 'Failed to download variant version file'
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
    MODS_PUBLIC_URL?: string;
    MODS_ENCRYPTION_KEY?: string;
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}
