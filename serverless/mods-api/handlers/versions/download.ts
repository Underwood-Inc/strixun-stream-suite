/**
 * Download version handler
 * GET /mods/:modId/versions/:versionId/download
 * Returns direct download link or redirects to R2
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { decryptWithJWT } from '@strixun/api-framework';
import { createError } from '../../utils/errors.js';
import { getCustomerKey } from '../../utils/customer.js';
import { formatStrixunHash } from '../../utils/hash.js';
import type { ModMetadata, ModVersion } from '../../types/mod.js';

/**
 * Handle download version request
 */
export async function handleDownloadVersion(
    request: Request,
    env: Env,
    modId: string,
    versionId: string,
    auth: { userId: string; customerId: string | null } | null
): Promise<Response> {
    try {
        // Get mod metadata
        const modKey = getCustomerKey(auth?.customerId || null, `mod_${modId}`);
        const mod = await env.MODS_KV.get(modKey, { type: 'json' }) as ModMetadata | null;

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
        if (mod.visibility === 'private' && mod.authorId !== auth?.userId) {
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

        // Get version metadata
        const versionKey = getCustomerKey(auth?.customerId || null, `version_${versionId}`);
        const version = await env.MODS_KV.get(versionKey, { type: 'json' }) as ModVersion | null;

        if (!version || version.modId !== modId) {
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

        // Increment download count
        version.downloads += 1;
        mod.downloadCount += 1;
        
        await env.MODS_KV.put(versionKey, JSON.stringify(version));
        await env.MODS_KV.put(modKey, JSON.stringify(mod));

        // Get encrypted file from R2
        // SECURITY: Files are stored encrypted in R2 (encryption at rest)
        // We decrypt on-the-fly during download to return usable files
        const encryptedFile = await env.MODS_R2.get(version.r2Key);
        
        if (!encryptedFile) {
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
        
        // Decrypt the file on-the-fly
        let decryptedFileBytes: Uint8Array;
        let originalContentType: string;
        
        if (isEncrypted) {
            // File is encrypted - decrypt it
            try {
                const encryptedData = await encryptedFile.text();
                const encryptedJson = JSON.parse(encryptedData);
                
                // Get JWT token for decryption
                const jwtToken = request.headers.get('Authorization')?.replace('Bearer ', '') || '';
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
                const decryptedBase64 = await decryptWithJWT(encryptedJson, jwtToken) as string;
                
                // Convert base64 back to binary
                const binaryString = atob(decryptedBase64);
                decryptedFileBytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    decryptedFileBytes[i] = binaryString.charCodeAt(i);
                }
                
                // Get original content type from metadata
                originalContentType = encryptedFile.customMetadata?.originalContentType || 'application/zip';
            } catch (error) {
                console.error('File decryption error during download:', error);
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
            // Legacy file (not encrypted) - return as-is
            // This handles files uploaded before encryption was enforced
            const arrayBuffer = await encryptedFile.arrayBuffer();
            decryptedFileBytes = new Uint8Array(arrayBuffer);
            originalContentType = encryptedFile.httpMetadata?.contentType || 'application/octet-stream';
        }

        // Return decrypted file with proper headers including integrity hash
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

