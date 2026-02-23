/**
 * Download variant handler
 * GET /mods/:modId/variants/:variantId/download
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { decryptBinaryWithSharedKey } from '@strixun/api-framework';
import { createError } from '../../utils/errors.js';
import {
    getEntity,
} from '@strixun/kv-entities';
import type { ModMetadata, ModVersion } from '../../types/mod.js';

interface Env {
    MODS_KV: KVNamespace;
    MODS_R2: R2Bucket;
    MODS_ENCRYPTION_KEY?: string;
    ENVIRONMENT?: string;
    ALLOWED_ORIGINS?: string;
    DOWNLOAD_COUNTER: DurableObjectNamespace;
    [key: string]: any;
}

export async function handleDownloadVariant(
    request: Request,
    env: Env,
    modId: string,
    variantId: string,
    auth: { customerId: string } | null
): Promise<Response> {
    try {
        const mod = await getEntity<ModMetadata>(env.MODS_KV, 'mods', 'mod', modId);

        if (!mod) {
            return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
        }

        const variant = mod.variants?.find(v => v.variantId === variantId);
        if (!variant) {
            return errorResponse(request, env, 404, 'Variant Not Found', 'The requested variant was not found');
        }

        if (!variant.currentVersionId) {
            return errorResponse(request, env, 404, 'No Version Available', 'This variant has no versions available');
        }

        const variantVersion = await getEntity<ModVersion>(env.MODS_KV, 'mods', 'version', variant.currentVersionId);
        
        if (!variantVersion) {
            return errorResponse(request, env, 404, 'Version Not Found', 'The current version of this variant was not found');
        }

        const r2Key = variantVersion.r2Key;
        const encryptedFile = await env.MODS_R2.get(r2Key);
        
        if (!encryptedFile) {
            return errorResponse(request, env, 404, 'File Not Found', 'The requested variant file was not found in storage');
        }

        const customMetadata = encryptedFile.customMetadata || {};
        const isEncrypted = customMetadata.encrypted === 'true';

        let fileData: Uint8Array;
        
        if (isEncrypted) {
            const sharedKey = env.MODS_ENCRYPTION_KEY;
            
            if (!sharedKey || sharedKey.length < 32) {
                return errorResponse(request, env, 500, 'Server Configuration Error', 'Encryption key not configured');
            }
            
            const encryptedBytes = new Uint8Array(await encryptedFile.arrayBuffer());
            
            try {
                fileData = await decryptBinaryWithSharedKey(encryptedBytes, sharedKey);
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                return errorResponse(request, env, 500, 'Decryption Failed', `Failed to decrypt: ${errorMsg}`);
            }
        } else {
            fileData = new Uint8Array(await encryptedFile.arrayBuffer());
        }

        const originalFileName = customMetadata.originalFileName;
        const originalContentType = customMetadata.originalContentType;
        
        if (!originalFileName || !originalContentType) {
            return errorResponse(request, env, 500, 'Internal Server Error', 'File metadata not found');
        }

        // Increment download counters via Durable Object (race-condition-free)
        try {
            const counterId = env.DOWNLOAD_COUNTER.idFromName(modId);
            const counter = env.DOWNLOAD_COUNTER.get(counterId);
            await (counter as any).increment(modId, variantVersion.versionId, variantId);
        } catch (counterErr) {
            console.error('[VariantDownload] Counter increment failed:', counterErr);
        }

        const corsHeaders = createCORSHeaders(request, { 
            credentials: true, 
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            exposedHeaders: ['Content-Disposition', 'Content-Type', 'Content-Length'],
        });

        return new Response(fileData, {
            status: 200,
            headers: {
                'Content-Type': originalContentType,
                'Content-Disposition': `attachment; filename="${originalFileName}"`,
                'Content-Length': fileData.length.toString(),
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('[VariantDownload] Error:', error);
        return errorResponse(
            request, env, 500, 'Internal Server Error',
            env.ENVIRONMENT === 'development' ? error.message : 'Failed to download variant file'
        );
    }
}

function errorResponse(request: Request, env: Env, status: number, title: string, detail: string): Response {
    const rfcError = createError(request, status, title, detail);
    const corsHeaders = createCORSHeaders(request, { 
        credentials: true, 
        allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
    });
    return new Response(JSON.stringify(rfcError), {
        status,
        headers: {
            'Content-Type': 'application/problem+json',
            ...Object.fromEntries(corsHeaders.entries()),
        },
    });
}
