/**
 * File validation handler
 * POST /mods/:modId/versions/:versionId/validate
 * 
 * Allows clients to validate a file they have against the uploaded version.
 * Client sends the DECRYPTED file content, server validates it against stored signature.
 * 
 * IMPORTANT: Client must send the DECRYPTED file content (the actual file, not encrypted).
 * The hash is calculated on decrypted content (same as during upload).
 * 
 * SECURITY: This endpoint does NOT expose the keyphrase - it only validates files.
 * The keyphrase is used server-side only via HMAC-SHA256.
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, normalizeModId } from '../../utils/customer.js';
import { calculateStrixunHash, verifyStrixunHash, formatStrixunHash } from '../../utils/hash.js';
import type { ModMetadata, ModVersion } from '../../types/mod.js';

/**
 * Handle file validation request
 * Client uploads a file, server validates it against stored signature
 */
export async function handleValidateVersion(
    request: Request,
    env: Env,
    modId: string,
    versionId: string,
    auth: { customerId: string } | null
): Promise<Response> {
    try {
        // Get mod metadata
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

        // Check visibility
        if (mod.visibility === 'private' && mod.authorId !== auth?.customerId) {
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
        let version: ModVersion | null = null;
        
        // Check mod's customer scope first
        if (mod.customerId) {
            const modCustomerVersionKey = getCustomerKey(mod.customerId, `version_${versionId}`);
            version = await env.MODS_KV.get(modCustomerVersionKey, { type: 'json' }) as ModVersion | null;
        }
        
        // Also check auth customer scope
        if (!version && auth?.customerId && auth.customerId !== mod.customerId) {
            const authCustomerVersionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
            version = await env.MODS_KV.get(authCustomerVersionKey, { type: 'json' }) as ModVersion | null;
        }
        
        // Fall back to global scope
        if (!version) {
            const globalVersionKey = `version_${versionId}`;
            version = await env.MODS_KV.get(globalVersionKey, { type: 'json' }) as ModVersion | null;
        }

        // Check version belongs to mod
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

        if (!version.sha256) {
            const rfcError = createError(request, 400, 'No Signature Available', 'This version does not have an integrity signature');
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

        // Get file from request body
        const contentType = request.headers.get('content-type') || '';
        let fileData: ArrayBuffer;
        
        if (contentType.includes('multipart/form-data')) {
            // Handle multipart form data
            const formData = await request.formData();
            const file = formData.get('file') as File | null;
            
            if (!file) {
                const rfcError = createError(request, 400, 'Invalid Request', 'File is required in form data');
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
            
            fileData = await file.arrayBuffer();
        } else {
            // Handle raw binary data
            fileData = await request.arrayBuffer();
        }

        // Calculate signature of uploaded file using HMAC-SHA256
        // SECURITY: Keyphrase is used server-side only, never exposed
        const uploadedFileSignature = await calculateStrixunHash(fileData, env);
        
        // Verify against stored signature
        // SECURITY: verifyStrixunHash uses keyphrase server-side only
        const isValid = await verifyStrixunHash(fileData, version.sha256, env);

        // Return validation result
        // SECURITY: Only returns signature (safe to expose), never keyphrase
        const validationResult = {
            validated: isValid,
            modId: version.modId,
            versionId: version.versionId,
            version: version.version,
            fileName: version.fileName,
            uploadedFileSignature: formatStrixunHash(uploadedFileSignature),
            expectedSignature: formatStrixunHash(version.sha256),
            signaturesMatch: isValid,
            validatedAt: new Date().toISOString(),
            strixunVerified: isValid,
        };

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        
        return new Response(JSON.stringify(validationResult, null, 2), {
            status: isValid ? 200 : 400,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Validate version error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Validate Version',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while validating the version'
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
    FILE_INTEGRITY_KEYPHRASE?: string;
    ENVIRONMENT?: string;
    ALLOWED_ORIGINS?: string;
    [key: string]: any;
}

