/**
 * Download version handler
 * GET /mods/:modId/versions/:versionId/download
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { decryptBinaryWithSharedKey } from '@strixun/api-framework';
import { createError } from '../../utils/errors.js';
import {
    getEntity,
    putEntity,
} from '@strixun/kv-entities';
import type { ModMetadata, ModVersion } from '../../types/mod.js';

interface Env {
    MODS_KV: KVNamespace;
    MODS_R2: R2Bucket;
    MODS_ENCRYPTION_KEY?: string;
    ENVIRONMENT?: string;
    ALLOWED_ORIGINS?: string;
    [key: string]: any;
}

export async function handleDownloadVersion(
    request: Request,
    env: Env,
    modId: string,
    versionId: string,
    auth: { customerId: string } | null
): Promise<Response> {
    try {
        const mod = await getEntity<ModMetadata>(env.MODS_KV, 'mods', 'mod', modId);

        if (!mod) {
            return errorResponse(request, env, 404, 'Mod Not Found', 'The requested mod was not found');
        }

        const version = await getEntity<ModVersion>(env.MODS_KV, 'mods', 'version', versionId);
        
        if (!version) {
            return errorResponse(request, env, 404, 'Version Not Found', 'The requested version was not found');
        }

        const r2Key = version.r2Key;
        const encryptedFile = await env.MODS_R2.get(r2Key);
        
        if (!encryptedFile) {
            return errorResponse(request, env, 404, 'File Not Found', 'The requested file was not found in storage');
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

        const originalFileName = customMetadata.originalFileName || version.fileName;
        const originalContentType = customMetadata.originalContentType || 'application/octet-stream';
        
        if (!originalFileName) {
            return errorResponse(request, env, 500, 'Internal Server Error', 'File name not found');
        }

        // Increment download counters (fire and forget)
        incrementDownloads(env, mod, modId, version).catch(console.error);

        // Build exposed headers list - include hash headers if available
        const exposedHeaders = ['Content-Disposition', 'Content-Type', 'Content-Length'];
        if (version.sha256) {
            exposedHeaders.push('X-Strixun-File-Hash', 'X-Strixun-SHA256');
        }
        
        const corsHeaders = createCORSHeaders(request, { 
            credentials: true, 
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
            exposedHeaders,
        });

        // Build response headers
        const responseHeaders: Record<string, string> = {
            'Content-Type': originalContentType,
            'Content-Disposition': `attachment; filename="${originalFileName}"`,
            'Content-Length': fileData.length.toString(),
            ...Object.fromEntries(corsHeaders.entries()),
        };
        
        // Add hash headers for file integrity verification if available
        if (version.sha256) {
            responseHeaders['X-Strixun-File-Hash'] = `strixun:sha256:${version.sha256}`;
            responseHeaders['X-Strixun-SHA256'] = version.sha256;
        }

        return new Response(fileData, {
            status: 200,
            headers: responseHeaders,
        });
    } catch (error: any) {
        console.error('[VersionDownload] Error:', error);
        return errorResponse(
            request, env, 500, 'Internal Server Error',
            env.ENVIRONMENT === 'development' ? error.message : 'Failed to download file'
        );
    }
}

async function incrementDownloads(
    env: Env,
    mod: ModMetadata,
    modId: string,
    version: ModVersion
): Promise<void> {
    version.downloads = (version.downloads || 0) + 1;
    await putEntity(env.MODS_KV, 'mods', 'version', version.versionId, version);
    
    mod.downloadCount = (mod.downloadCount || 0) + 1;
    await putEntity(env.MODS_KV, 'mods', 'mod', modId, mod);
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
