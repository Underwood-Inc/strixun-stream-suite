/**
 * Upload version handler
 * POST /mods/:modId/versions
 * Adds a new version to an existing mod
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { decryptWithJWT } from '@strixun/api-framework';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, getCustomerR2Key } from '../../utils/customer.js';
import { isEmailAllowed } from '../../utils/auth.js';
import { calculateFileHash, formatStrixunHash } from '../../utils/hash.js';
import type { ModMetadata, ModVersion, VersionUploadRequest } from '../../types/mod.js';

/**
 * Generate unique version ID
 */
function generateVersionId(): string {
    return `ver_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Handle upload version request
 */
export async function handleUploadVersion(
    request: Request,
    env: Env,
    modId: string,
    auth: { userId: string; email?: string; customerId: string | null }
): Promise<Response> {
    try {
        // Check email whitelist
        if (!isEmailAllowed(auth.email, env)) {
            const rfcError = createError(request, 403, 'Forbidden', 'Your email address is not authorized to upload mod versions');
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

        // Get mod metadata
        const modKey = getCustomerKey(auth.customerId, `mod_${modId}`);
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

        // Check authorization
        if (mod.authorId !== auth.userId) {
            const rfcError = createError(request, 403, 'Forbidden', 'You do not have permission to upload versions for this mod');
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

        // Parse multipart form data
        const formData = await request.formData();
        let file = formData.get('file') as File | null;
        
        if (!file) {
            const rfcError = createError(request, 400, 'File Required', 'File is required for version upload');
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

        // Check if file is encrypted (has .encrypted suffix or is JSON)
        const isEncrypted = file.name.endsWith('.encrypted') || file.type === 'application/json';
        let originalFileName = file.name;
        
        if (isEncrypted) {
            // Remove .encrypted suffix if present
            if (originalFileName.endsWith('.encrypted')) {
                originalFileName = originalFileName.slice(0, -10); // Remove '.encrypted'
            }
            
            // Decrypt the file
            try {
                const encryptedData = await file.text();
                const encryptedJson = JSON.parse(encryptedData);
                const jwtToken = request.headers.get('Authorization')?.replace('Bearer ', '') || '';
                
                if (!jwtToken) {
                    throw new Error('JWT token required for file decryption');
                }
                
                // Decrypt the base64 file data
                const decryptedBase64 = await decryptWithJWT(encryptedJson, jwtToken) as string;
                
                // Convert base64 back to binary (exact reverse of client's btoa conversion)
                // This ensures the file is fully intact - no data loss or corruption
                const binaryString = atob(decryptedBase64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                
                // Create new File object with decrypted data and original filename
                // The file is now identical to the original uploaded file
                file = new File([bytes], originalFileName, { type: 'application/zip' });
            } catch (error) {
                console.error('File decryption error:', error);
                const rfcError = createError(request, 400, 'Decryption Failed', 'Failed to decrypt uploaded file. Please ensure you are authenticated.');
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
        }

        // Parse metadata from form data
        const metadataJson = formData.get('metadata') as string | null;
        if (!metadataJson) {
            const rfcError = createError(request, 400, 'Metadata Required', 'Metadata is required for version upload');
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

        const metadata = JSON.parse(metadataJson) as VersionUploadRequest;

        // Validate required fields
        if (!metadata.version) {
            const rfcError = createError(request, 400, 'Validation Error', 'Version is required');
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

        // Generate version ID
        const versionId = generateVersionId();
        const now = new Date().toISOString();

        // Calculate file integrity hash (SHA-256) before upload
        const fileHash = await calculateFileHash(file);
        const strixunHash = formatStrixunHash(fileHash);

        // Upload file to R2
        const fileExtension = file.name.split('.').pop() || 'zip';
        const r2Key = getCustomerR2Key(auth.customerId, `mods/${modId}/${versionId}.${fileExtension}`);
        
        await env.MODS_R2.put(r2Key, file.stream(), {
            httpMetadata: {
                contentType: file.type || 'application/zip',
                cacheControl: 'public, max-age=31536000',
            },
            customMetadata: {
                modId,
                versionId,
                uploadedBy: auth.userId,
                uploadedAt: now,
                sha256: fileHash, // Store hash in R2 metadata for verification
            },
        });

        // Generate download URL
        const downloadUrl = env.MODS_PUBLIC_URL 
            ? `${env.MODS_PUBLIC_URL}/${r2Key}`
            : `https://pub-${(env.MODS_R2 as any).id}.r2.dev/${r2Key}`;

        // Create version metadata
        const version: ModVersion = {
            versionId,
            modId,
            version: metadata.version,
            changelog: metadata.changelog || '',
            fileSize: file.size,
            fileName: file.name,
            r2Key,
            downloadUrl,
            sha256: fileHash, // Store hash for verification
            createdAt: now,
            downloads: 0,
            gameVersions: metadata.gameVersions || [],
            dependencies: metadata.dependencies || [],
        };

        // Store version in KV (customer scope)
        const versionKey = getCustomerKey(auth.customerId, `version_${versionId}`);
        await env.MODS_KV.put(versionKey, JSON.stringify(version));

        // Add version to mod's version list (customer scope)
        const versionsListKey = getCustomerKey(auth.customerId, `mod_${modId}_versions`);
        const versionsList = await env.MODS_KV.get(versionsListKey, { type: 'json' }) as string[] | null;
        const updatedVersionsList = [...(versionsList || []), versionId];
        await env.MODS_KV.put(versionsListKey, JSON.stringify(updatedVersionsList));

        // Update mod's latest version and updatedAt (customer scope)
        mod.latestVersion = metadata.version;
        mod.updatedAt = now;
        await env.MODS_KV.put(modKey, JSON.stringify(mod));

        // Also update in global scope if mod is public
        if (mod.visibility === 'public') {
            const globalModKey = `mod_${modId}`;
            const globalVersionKey = `version_${versionId}`;
            const globalVersionsListKey = `mod_${modId}_versions`;
            
            await env.MODS_KV.put(globalVersionKey, JSON.stringify(version));
            
            const globalVersionsList = await env.MODS_KV.get(globalVersionsListKey, { type: 'json' }) as string[] | null;
            const updatedGlobalVersionsList = [...(globalVersionsList || []), versionId];
            await env.MODS_KV.put(globalVersionsListKey, JSON.stringify(updatedGlobalVersionsList));
            
            // Update global mod metadata
            await env.MODS_KV.put(globalModKey, JSON.stringify(mod));
        }

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify({ version }), {
            status: 201,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Upload version error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Upload Version',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while uploading the version'
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
    ALLOWED_EMAILS?: string;
    ALLOWED_ORIGINS?: string;
    ENVIRONMENT?: string;
    [key: string]: any;
}

