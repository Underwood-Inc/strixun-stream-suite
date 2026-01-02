/**
 * File verification handler
 * GET /mods/:modId/versions/:versionId/verify
 * Verifies file integrity using SHA-256 hash
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, normalizeModId } from '../../utils/customer.js';
import { calculateStrixunHash, verifyStrixunHash, formatStrixunHash, parseStrixunHash } from '../../utils/hash.js';
import type { ModMetadata, ModVersion } from '../../types/mod.js';

/**
 * Handle file verification request
 */
export async function handleVerifyVersion(
    request: Request,
    env: Env,
    modId: string,
    versionId: string,
    auth: { userId: string; customerId: string | null } | null
): Promise<Response> {
    try {
        // Get mod metadata by modId only (slug should be resolved to modId before calling this)
        let mod: ModMetadata | null = null;
        const normalizedModId = normalizeModId(modId);
        
        // Check customer scope first if authenticated
        if (auth?.customerId) {
            const customerModKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
            mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
        }
        
        // Fall back to global scope
        if (!mod) {
            const globalModKey = `mod_${normalizedModId}`;
            mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
        }
        
        // If still not found, search all customer scopes (for cross-customer access)
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

        // Get version metadata - use mod's customerId (not auth customerId)
        let version: ModVersion | null = null;
        
        // Check mod's customer scope first (where version was stored)
        if (mod.customerId) {
            const modCustomerVersionKey = getCustomerKey(mod.customerId, `version_${versionId}`);
            version = await env.MODS_KV.get(modCustomerVersionKey, { type: 'json' }) as ModVersion | null;
        }
        
        // Also check auth customer scope (in case they match)
        if (!version && auth?.customerId && auth.customerId !== mod.customerId) {
            const authCustomerVersionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
            version = await env.MODS_KV.get(authCustomerVersionKey, { type: 'json' }) as ModVersion | null;
        }
        
        // Fall back to global scope
        if (!version) {
            const globalVersionKey = `version_${versionId}`;
            version = await env.MODS_KV.get(globalVersionKey, { type: 'json' }) as ModVersion | null;
        }

        // Check version belongs to mod - use mod.modId (source of truth), not the input parameter
        // Normalize both modIds before comparison to handle cases where one has mod_ prefix and the other doesn't
        const normalizedVersionModId = version ? normalizeModId(version.modId) : null;
        const normalizedModModId = normalizeModId(mod.modId);
        if (!version || normalizedVersionModId !== normalizedModModId) {
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

        // Get file from R2 and verify hash
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

        // CRITICAL: Hash must be calculated on DECRYPTED content (same as upload)
        // During upload, hash is calculated on decrypted content, so we must decrypt here too
        let decryptedFileData: ArrayBuffer;
        
        const isEncrypted = encryptedFile.customMetadata?.encrypted === 'true';
        const encryptionFormat = encryptedFile.customMetadata?.encryptionFormat;
        
        if (isEncrypted) {
            // File is encrypted - decrypt it first (same process as download)
            try {
                // Get JWT token for decryption
                // CRITICAL: Trim token to ensure it matches the token used for encryption
                const jwtToken = request.headers.get('Authorization')?.replace('Bearer ', '').trim() || '';
                if (!jwtToken) {
                    const rfcError = createError(request, 401, 'Authentication Required', 'JWT token required to decrypt and verify files');
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
                
                // Decrypt based on format
                if (encryptionFormat === 'binary-v4') {
                    const { decryptBinaryWithJWT } = await import('@strixun/api-framework');
                    const encryptedBinary = await encryptedFile.arrayBuffer();
                    const decryptedBytes = await decryptBinaryWithJWT(new Uint8Array(encryptedBinary), jwtToken);
                    decryptedFileData = decryptedBytes.buffer;
                } else {
                    // Legacy JSON encrypted format
                    const { decryptWithJWT } = await import('@strixun/api-framework');
                    const encryptedData = await encryptedFile.text();
                    const encryptedJson = JSON.parse(encryptedData);
                    const decryptedBase64 = await decryptWithJWT(encryptedJson, jwtToken) as string;
                    
                    // Convert base64 back to binary
                    const binaryString = atob(decryptedBase64);
                    const fileBytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        fileBytes[i] = binaryString.charCodeAt(i);
                    }
                    decryptedFileData = fileBytes.buffer;
                }
            } catch (error) {
                console.error('[Verify] File decryption error:', error);
                const rfcError = createError(request, 500, 'Decryption Failed', 'Failed to decrypt file for verification. Please ensure you are authenticated.');
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
            // Legacy file (not encrypted) - use as-is
            decryptedFileData = await encryptedFile.arrayBuffer();
        }

        // Calculate current file hash using HMAC-SHA256 with secret keyphrase
        // CRITICAL: Hash is calculated on decrypted content (same as upload)
        const currentHash = await calculateStrixunHash(decryptedFileData, env);
        const isValid = await verifyStrixunHash(decryptedFileData, version.sha256, env);

        // Return verification result
        const verificationResult = {
            verified: isValid,
            modId: version.modId,
            versionId: version.versionId,
            version: version.version,
            fileName: version.fileName,
            fileSize: version.fileSize,
            expectedHash: formatStrixunHash(version.sha256),
            actualHash: formatStrixunHash(currentHash),
            verifiedAt: new Date().toISOString(),
            strixunVerified: isValid, // Strixun verification marker
        };

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify(verificationResult, null, 2), {
            status: isValid ? 200 : 400,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Verify version error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Verify Version',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while verifying the version'
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

