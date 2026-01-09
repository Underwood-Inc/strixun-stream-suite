/**
 * Update mod handler
 * PATCH /mods/:modId
 * Updates mod metadata (not versions)
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { decryptBinaryWithSharedKey } from '@strixun/api-framework';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, getCustomerR2Key, normalizeModId } from '../../utils/customer.js';
import { generateSlug, slugExists } from './upload.js';
import { MAX_THUMBNAIL_SIZE, validateFileSize } from '../../utils/upload-limits.js';
import { createModSnapshot } from '../../utils/snapshot.js';
import { addR2SourceMetadata, getR2SourceInfo } from '../../utils/r2-source.js';
import { calculateStrixunHash } from '../../utils/hash.js';
import { migrateModVariantsIfNeeded } from '../../utils/lazy-variant-migration.js';
// handleThumbnailUpload is defined locally in this file
import type { ModMetadata, ModUpdateRequest } from '../../types/mod.js';

/**
 * Handle update mod request
 */
export async function handleUpdateMod(
    request: Request,
    env: Env,
    modId: string,
    auth: { customerId: string }
): Promise<Response> {
    try {
        // All authenticated users can update their own mods (authorization check happens below)

        // Get mod metadata by modId only (slug should be resolved to modId before calling this)
        // Use modId directly - it already includes 'mod_' prefix
        let mod: ModMetadata | null = null;
        let modKey: string;
        
        // Try customer scope first
        modKey = getCustomerKey(auth.customerId, modId);
        mod = await env.MODS_KV.get(modKey, { type: 'json' }) as ModMetadata | null;
        
        // If not found in customer scope, try global scope (for public mods)
        if (!mod) {
            const globalModKey = modId;
            mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
            if (mod) {
                modKey = getCustomerKey(auth.customerId, modId); // Use customer key for storage
            }
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
                            const customerModKey = getCustomerKey(customerId, modId);
                            mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                            if (mod) {
                                modKey = customerModKey;
                                break;
                            }
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

        // Check authorization
        if (mod.authorId !== auth.customerId) {
            const rfcError = createError(request, 403, 'Forbidden', 'You do not have permission to update this mod');
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

        // CRITICAL: Validate customerId is present - required for data scoping and display name lookups
        if (!auth.customerId) {
            console.error('[Update] CRITICAL: customerId is null for authenticated customer:', { customerId: auth.customerId,
                note: 'Rejecting mod update - customerId is required for data scoping and display name lookups'
            });
            const rfcError = createError(request, 400, 'Missing Customer ID', 'Customer ID is required for mod updates. Please ensure your account has a valid customer association.');
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

        // Parse update request - support both JSON and multipart/form-data
        let updateData: ModUpdateRequest;
        const contentType = request.headers.get('content-type') || '';
        
        // Read formData once if it's multipart, store it for later use
        let formData: FormData | null = null;
        if (contentType.includes('multipart/form-data')) {
            // Handle multipart form data (for binary thumbnail uploads)
            formData = await request.formData();
            const metadataJson = formData.get('metadata') as string | null;
            if (metadataJson) {
                updateData = JSON.parse(metadataJson) as ModUpdateRequest;
            } else {
                // If no metadata, create empty update (thumbnail only)
                updateData = {} as ModUpdateRequest;
            }
        } else {
            // Handle JSON body (legacy support)
            updateData = await request.json() as ModUpdateRequest;
        }

        // Track visibility change for global list management
        const wasPublic = mod.visibility === 'public';
        const visibilityChanged = updateData.visibility !== undefined && updateData.visibility !== mod.visibility;
        
        // Use the stored modId from the mod object directly
        const storedModId = mod.modId;

        // Track slug change for index update
        const oldSlug = mod.slug;
        let slugChanged = false;
        
        // Update mod metadata
        if (updateData.title !== undefined) {
            mod.title = updateData.title;
            // Regenerate slug if title changed - reject if duplicate (except for same mod)
            const baseSlug = generateSlug(updateData.title);
            if (!baseSlug) {
                const rfcError = createError(request, 400, 'Invalid Title', 'Title must contain valid characters for slug generation');
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
            
            // Check if slug already exists (excluding this mod)
            if (baseSlug !== oldSlug && await slugExists(baseSlug, env, storedModId)) {
                const rfcError = createError(request, 409, 'Slug Already Exists', `A mod with the title "${updateData.title}" (slug: "${baseSlug}") already exists. Please choose a different title.`);
                const corsHeaders = createCORSHeaders(request, {
                    allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
                });
                return new Response(JSON.stringify(rfcError), {
                    status: 409,
                    headers: {
                        'Content-Type': 'application/problem+json',
                        ...Object.fromEntries(corsHeaders.entries()),
                    },
                });
            }
            
            if (baseSlug !== oldSlug) {
                mod.slug = baseSlug;
                slugChanged = true;
            }
        }
        if (updateData.description !== undefined) mod.description = updateData.description;
        if (updateData.category !== undefined) mod.category = updateData.category;
        if (updateData.tags !== undefined) mod.tags = updateData.tags;
        if (updateData.visibility !== undefined) mod.visibility = updateData.visibility;
        if (updateData.variants !== undefined) mod.variants = updateData.variants;
        if (updateData.gameId !== undefined) mod.gameId = updateData.gameId;
        mod.updatedAt = new Date().toISOString();

        // Handle thumbnail update - support both binary file upload and legacy base64
        // Reuse formData already read above (or null if JSON request)
        if (formData) {
            // Check for binary thumbnail file upload
            const thumbnailFile = formData.get('thumbnail') as File | null;
            if (thumbnailFile) {
                try {
                    // CRITICAL: Verify thumbnail is NOT encrypted before processing
                    // Thumbnails are public images and must be unencrypted
                    const thumbnailBuffer = new Uint8Array(await thumbnailFile.arrayBuffer());
                    if (thumbnailBuffer.length >= 4 && (thumbnailBuffer[0] === 4 || thumbnailBuffer[0] === 5)) {
                        const rfcError = createError(request, 400, 'Invalid Thumbnail', 'Thumbnail file appears to be encrypted. Thumbnails must be unencrypted image files (PNG, JPEG, GIF, or WebP). Please upload the original image file without encryption.');
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
                    
                    // Use current slug (may have been updated if title changed)
                    mod.thumbnailUrl = await handleThumbnailBinaryUpload(thumbnailFile, modId, mod.slug, request, env, auth.customerId);
                } catch (error) {
                    console.error('Thumbnail binary update error:', error);
                    // Continue without thumbnail update
                }
            }
        }
        
        // Handle variant file uploads
        if (formData && updateData.variants) {
            const normalizedModId = normalizeModId(modId);
            const now = new Date().toISOString();
            
            // Process each variant file from FormData
            // CRITICAL: Variant files must use the same encryption system as main mod uploads (shared key, not JWT)
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
            
            for (const variant of updateData.variants) {
                const variantFile = formData.get(`variant_${variant.variantId}`) as File | null;
                if (variantFile) {
                    try {
                        // Variant files should already be encrypted by the client with shared key
                        // Validate and process them the same way as main mod uploads
                        const fileBuffer = await variantFile.arrayBuffer();
                        const fileBytes = new Uint8Array(fileBuffer);
                        
                        // Get original file name (remove .encrypted extension if present)
                        let originalFileName = variantFile.name;
                        if (originalFileName.endsWith('.encrypted')) {
                            originalFileName = originalFileName.slice(0, -10); // Remove '.encrypted'
                        }
                        
                        // Get file extension
                        const fileExtension = originalFileName.includes('.') 
                            ? originalFileName.substring(originalFileName.lastIndexOf('.')) 
                            : '.zip';
                        const extensionForR2 = fileExtension.substring(1); // Remove dot
                        
                        // Validate encryption format - must be binary encrypted with shared key (version 4 or 5)
                        // CRITICAL: Same validation as main mod upload - reject files that aren't encrypted with shared key
                        const isBinaryEncrypted = fileBytes.length >= 4 && (fileBytes[0] === 4 || fileBytes[0] === 5);
                        const isLegacyEncrypted = fileBytes.length > 0 && fileBytes[0] === 0x7B; // '{' for JSON
                        
                        if (!isBinaryEncrypted && !isLegacyEncrypted) {
                            const rfcError = createError(request, 400, 'File Must Be Encrypted', 'Variant files must be encrypted with shared key encryption (binary format v4 or v5) before upload. Please ensure the file is encrypted.');
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
                        
                        // Temporarily decrypt to calculate file hash (for integrity verification)
                        // This validates the file is encrypted with the correct shared key
                        let fileHash: string;
                        let fileSize: number;
                        let encryptionFormat: string;
                        
                        try {
                            if (isBinaryEncrypted) {
                                // Binary encrypted format - Shared key encryption is MANDATORY
                                // CRITICAL: Reject JWT-encrypted files (they would have version 4/5 but wrong key)
                                let decryptedBytes: Uint8Array;
                                try {
                                    decryptedBytes = await decryptBinaryWithSharedKey(fileBytes, sharedKey);
                                    console.log('[UpdateMod] Variant file decryption successful with shared key');
                                } catch (decryptError) {
                                    const errorMsg = decryptError instanceof Error ? decryptError.message : String(decryptError);
                                    // If decryption fails, the file might be JWT-encrypted or encrypted with wrong key
                                    const rfcError = createError(request, 400, 'Invalid Encryption', `Variant file must be encrypted with shared key encryption. Failed to decrypt with shared key: ${errorMsg}. Please ensure the file is encrypted with MODS_ENCRYPTION_KEY (not JWT encryption).`);
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
                                
                                fileSize = decryptedBytes.length;
                                fileHash = await calculateStrixunHash(decryptedBytes, env);
                                // Determine version from first byte (4 or 5)
                                encryptionFormat = fileBytes[0] === 5 ? 'binary-v5' : 'binary-v4';
                            } else {
                                // Legacy JSON encrypted format - not supported
                                const rfcError = createError(request, 400, 'Unsupported Format', 'Legacy JSON encryption format is not supported for variant files. Please re-upload the file using shared key encryption (binary format v4 or v5).');
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
                        } catch (error) {
                            const errorMsg = error instanceof Error ? error.message : String(error);
                            const rfcError = createError(request, 400, 'Encryption Validation Failed', `Failed to validate variant file encryption: ${errorMsg}`);
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
                        
                        // CRITICAL: Delete any existing variant files for this variantId before storing the new one
                        // This ensures we don't leave orphaned files when the extension changes
                        const commonExtensions = ['zip', 'jar', 'mod', 'dat', 'json'];
                        for (const ext of commonExtensions) {
                            try {
                                const oldVariantKey = getCustomerR2Key(auth.customerId, `mods/${normalizedModId}/variants/${variant.variantId}.${ext}`);
                                const oldFile = await env.MODS_R2.get(oldVariantKey);
                                if (oldFile) {
                                    // Check if this file belongs to this variant by checking metadata
                                    const oldMetadata = oldFile.customMetadata;
                                    if (oldMetadata?.variantId === variant.variantId) {
                                        console.log('[UpdateMod] Deleting old variant file:', oldVariantKey);
                                        await env.MODS_R2.delete(oldVariantKey);
                                    }
                                }
                            } catch (error) {
                                // Ignore errors when deleting old files (file might not exist)
                                console.log('[UpdateMod] Could not delete old variant file (may not exist):', error);
                            }
                        }
                        
                        // Also try to delete using the variant's existing fileUrl if available
                        if (variant.fileUrl) {
                            try {
                                const url = new URL(variant.fileUrl);
                                const oldKey = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
                                const oldFile = await env.MODS_R2.get(oldKey);
                                if (oldFile) {
                                    const oldMetadata = oldFile.customMetadata;
                                    if (oldMetadata?.variantId === variant.variantId) {
                                        console.log('[UpdateMod] Deleting old variant file from fileUrl:', oldKey);
                                        await env.MODS_R2.delete(oldKey);
                                    }
                                }
                            } catch (error) {
                                // Ignore errors - fileUrl might be invalid or file might not exist
                                console.log('[UpdateMod] Could not delete variant file from fileUrl:', error);
                            }
                        }
                        
                        // ARCHITECTURAL IMPROVEMENT: Create a VariantVersion for proper version control
                        const { 
                            generateVariantVersionId,
                            saveVariantVersion,
                            addVariantVersionToList,
                            saveVariant,
                            getVariantVersionR2Key
                        } = await import('../../utils/variant-versions.js');
                        
                        const variantVersionId = generateVariantVersionId();
                        
                        // Use proper hierarchical R2 key for variant versions
                        const variantR2Key = getVariantVersionR2Key(normalizedModId, variant.variantId, variantVersionId, extensionForR2, auth.customerId);
                        
                        // Add R2 source metadata
                        const r2SourceInfo = getR2SourceInfo(env, request);
                        console.log('[UpdateMod] Variant file R2 storage source:', r2SourceInfo);
                        
                        await env.MODS_R2.put(variantR2Key, fileBytes, {
                            httpMetadata: {
                                contentType: 'application/octet-stream', // Binary encrypted format
                                cacheControl: 'private, no-cache',
                            },
                            customMetadata: addR2SourceMetadata({
                                modId,
                                variantId: variant.variantId,
                                variantVersionId: variantVersionId,
                                uploadedBy: auth.customerId,
                                uploadedAt: now,
                                encrypted: 'true',
                                encryptionFormat: encryptionFormat, // 'binary-v4' or 'binary-v5' - CRITICAL for download handler
                                originalFileName: originalFileName, // Original filename without .encrypted
                                originalContentType: 'application/zip', // Original file type
                                sha256: fileHash, // Hash of decrypted file for verification
                            }, env, request),
                        });
                        
                        // Generate download URL
                        const downloadUrl = env.MODS_PUBLIC_URL 
                            ? `${env.MODS_PUBLIC_URL}/${variantR2Key}`
                            : `https://pub-${(env.MODS_R2 as any).id}.r2.dev/${variantR2Key}`;
                        
                        // Create VariantVersion with version 1.0.0 (auto-increment for subsequent uploads)
                        // Get the current version count to generate the next version number
                        const newVersionNumber = variant.versionCount > 0 ? `1.0.${variant.versionCount}` : '1.0.0';
                        
                        const variantVersion: import('../../types/mod.js').VariantVersion = {
                            variantVersionId,
                            variantId: variant.variantId,
                            modId: normalizedModId,
                            version: newVersionNumber,
                            changelog: 'Uploaded via mod update',
                            fileSize: fileSize,
                            fileName: originalFileName,
                            r2Key: variantR2Key,
                            downloadUrl: downloadUrl,
                            sha256: fileHash,
                            createdAt: now,
                            downloads: 0,
                            gameVersions: [],
                            dependencies: []
                        };
                        
                        // Save VariantVersion
                        await saveVariantVersion(variantVersion, auth.customerId, env);
                        await addVariantVersionToList(variant.variantId, variantVersionId, auth.customerId, env);
                        
                        // Update local variant object with new version
                        variant.currentVersionId = variantVersionId;
                        variant.versionCount = (variant.versionCount || 0) + 1;
                        variant.updatedAt = now;
                        
                        // Save updated variant to KV (works for both new and existing variants)
                        await saveVariant(variant, auth.customerId, env);
                        
                        console.log('[UpdateMod] Variant version created:', {
                            variantId: variant.variantId,
                            variantVersionId,
                            version: newVersionNumber,
                            fileName: originalFileName,
                            fileSize: fileSize,
                            encryptedSize: fileBytes.length,
                            encryptionFormat,
                            r2Key: variantR2Key,
                        });
                    } catch (error) {
                        console.error(`[UpdateMod] Variant file upload error for ${variant.variantId}:`, error);
                        // If error is already a Response (from validation), return it
                        if (error instanceof Response) {
                            return error;
                        }
                        // Otherwise, return error response
                        const errorMsg = error instanceof Error ? error.message : String(error);
                        const rfcError = createError(request, 400, 'Variant Upload Failed', `Failed to upload variant file for ${variant.variantId}: ${errorMsg}`);
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
            }
            
            // Update mod.variants with the updated variant metadata
            // Variants were already updated in-place during file upload processing
            mod.variants = updateData.variants;
        }
        
        // Legacy base64 thumbnail support
        if (updateData.thumbnail) {
            try {
                // Use current slug (may have been updated if title changed)
                mod.thumbnailUrl = await handleThumbnailUpload(updateData.thumbnail, storedModId, mod.slug, request, env, auth.customerId);
            } catch (error) {
                console.error('Thumbnail update error:', error);
                // Continue without thumbnail update
            }
        }

        // CRITICAL: Ensure customerId is present (for data scoping and display name lookups)
        // If mod doesn't have customerId, set it from auth context
        // This ensures all mods have proper data scoping
        if (!mod.customerId && auth.customerId) {
            console.log('[Update] Setting missing customerId on mod:', {
                modId: mod.modId,
                oldCustomerId: mod.customerId,
                newCustomerId: auth.customerId, customerId: auth.customerId
            });
            mod.customerId = auth.customerId;
        } else if (!mod.customerId && !auth.customerId) {
            console.warn('[Update] WARNING: Mod and auth both missing customerId:', {
                modId: mod.modId, customerId: auth.customerId,
                note: 'This may cause data scoping issues'
            });
        }

        // CRITICAL: Fetch and update author display name from customer data
        // Customer is the primary data source for all customizable customer info
        // Look up customer by mod.customerId to get displayName
        const storedDisplayName = mod.authorDisplayName; // Preserve as fallback only
        let fetchedDisplayName: string | null = null;
        
        if (mod.customerId) {
            const { fetchDisplayNameByCustomerId } = await import('@strixun/api-framework');
            fetchedDisplayName = await fetchDisplayNameByCustomerId(mod.customerId, env);
            
            if (fetchedDisplayName) {
                console.log('[Update] Fetched authorDisplayName from customer data:', { 
                    authorDisplayName: fetchedDisplayName, 
                    customerId: mod.customerId,
                    modId: mod.modId
                });
            } else {
                console.warn('[Update] Could not fetch displayName from customer data:', {
                    customerId: mod.customerId,
                    modId: mod.modId
                });
            }
        } else {
            console.warn('[Update] Mod missing customerId, cannot fetch displayName from customer data:', {
                modId: mod.modId,
                authorId: mod.authorId
            });
        }
        
        // Always use fetched value from customer data - it's the source of truth
        // Fall back to stored value only if fetch fails (for backward compatibility)
        mod.authorDisplayName = fetchedDisplayName || storedDisplayName || null;
        
        if (fetchedDisplayName && fetchedDisplayName !== storedDisplayName) {
            console.log('[Update] Updated authorDisplayName from customer data:', { 
                customerId: mod.customerId, 
                oldDisplayName: storedDisplayName, 
                newDisplayName: fetchedDisplayName 
            });
        } else if (!fetchedDisplayName) {
            console.warn('[Update] authorDisplayName is null after customer lookup:', {
                customerId: mod.customerId,
                modId: mod.modId,
                storedDisplayName: storedDisplayName,
                note: 'Using stored value or null - UI will show "Unknown Author" if null'
            });
        }

        // Save updated mod (customer scope)
        await env.MODS_KV.put(modKey, JSON.stringify(mod));

        // CRITICAL: Update slug indexes - OLD SLUGS MUST BE RELEASED IMMEDIATELY BEFORE NEW ONES ARE CREATED
        // This ensures old slugs are immediately available for reuse by anyone
        if (slugChanged) {
            // STEP 1: DELETE old slug indexes FIRST (releases old slug immediately)
            // Delete old customer slug index
            const oldCustomerSlugKey = getCustomerKey(auth.customerId, `slug_${oldSlug}`);
            await env.MODS_KV.delete(oldCustomerSlugKey);
            console.log('[Update] Released old customer slug index:', { oldSlug, oldCustomerSlugKey });
            
            // Delete old global slug index (if it exists - mod might have been public)
            const oldGlobalSlugKey = `slug_${oldSlug}`;
            await env.MODS_KV.delete(oldGlobalSlugKey);
            console.log('[Update] Released old global slug index:', { oldSlug, oldGlobalSlugKey });
            
            // STEP 2: CREATE new slug indexes (only after old ones are deleted)
            // Create new customer slug index
            const newCustomerSlugKey = getCustomerKey(auth.customerId, `slug_${mod.slug}`);
            await env.MODS_KV.put(newCustomerSlugKey, storedModId);
            console.log('[Update] Created new customer slug index:', { newSlug: mod.slug, newCustomerSlugKey, modId: storedModId });
            
            // Create new global slug index ONLY if mod is public
            // (If mod is not public, global index will be created when visibility changes to public)
            if (mod.visibility === 'public') {
                const newGlobalSlugKey = `slug_${mod.slug}`;
                await env.MODS_KV.put(newGlobalSlugKey, storedModId);
                console.log('[Update] Created new global slug index:', { newSlug: mod.slug, newGlobalSlugKey, modId: storedModId });
            }
        } else {
            // Slug didn't change, but visibility might have - update global slug index accordingly
            if (mod.visibility === 'public') {
                // Ensure global slug index exists for public mods
                const globalSlugKey = `slug_${mod.slug}`;
                await env.MODS_KV.put(globalSlugKey, storedModId);
            } else {
                // Remove global slug index if mod is no longer public
                const globalSlugKey = `slug_${mod.slug}`;
                await env.MODS_KV.delete(globalSlugKey);
                console.log('[Update] Removed global slug index (mod no longer public):', { slug: mod.slug, globalSlugKey });
            }
        }

        // Create snapshot after saving (captures state after update)
        // Use the updated authorDisplayName from the mod (already fetched and saved above)
        const displayName = mod.authorDisplayName || null;
        
        // Create snapshot of the mod after update
        const snapshot = await createModSnapshot(mod, auth.customerId, displayName, env);
        
        // Store snapshot (customer scope)
        const snapshotKey = getCustomerKey(auth.customerId, `snapshot_${snapshot.snapshotId}`);
        await env.MODS_KV.put(snapshotKey, JSON.stringify(snapshot));
        
        // Add snapshot to mod's snapshot list
        const snapshotsListKey = getCustomerKey(auth.customerId, `${storedModId}_snapshots`);
        const snapshotsList = await env.MODS_KV.get(snapshotsListKey, { type: 'json' }) as string[] | null;
        const updatedSnapshotsList = [...(snapshotsList || []), snapshot.snapshotId];
        await env.MODS_KV.put(snapshotsListKey, JSON.stringify(updatedSnapshotsList));

        // Update global scope if mod is public
        if (mod.visibility === 'public') {
            const globalModKey = storedModId;
            await env.MODS_KV.put(globalModKey, JSON.stringify(mod));
            
            // Note: Global slug index is already handled above in the slug change logic
            // This ensures consistency whether slug changed or not
        }

        // Update global public list if visibility changed
        if (visibilityChanged) {
            const globalListKey = 'mods_list_public';
            const globalModsList = await env.MODS_KV.get(globalListKey, { type: 'json' }) as string[] | null;
            
            if (mod.visibility === 'public' && !wasPublic) {
                // Add to global list (only if not already in list)
                // CRITICAL: Normalize IDs for comparison since list may contain modIds with or without 'mod_' prefix
                const isInList = globalModsList?.some(id => normalizeModId(id) === storedModId) || false;
                if (!isInList) {
                    const updatedGlobalList = [...(globalModsList || []), storedModId];
                    await env.MODS_KV.put(globalListKey, JSON.stringify(updatedGlobalList));
                }
            } else if (mod.visibility !== 'public' && wasPublic) {
                // Remove from global list and delete global mod metadata
                // CRITICAL: Normalize IDs for comparison since list may contain modIds with or without 'mod_' prefix
                const updatedGlobalList = (globalModsList || []).filter(id => {
                    const normalizedListId = normalizeModId(id);
                    return normalizedListId !== storedModId;
                });
                await env.MODS_KV.put(globalListKey, JSON.stringify(updatedGlobalList));
                
                // Delete global mod metadata
                const globalModKey = `mod_${storedModId}`;
                await env.MODS_KV.delete(globalModKey);
            }
        } else if (mod.visibility === 'public') {
            // If visibility didn't change but mod is public, ensure it's in global list
            const globalListKey = 'mods_list_public';
            const globalModsList = await env.MODS_KV.get(globalListKey, { type: 'json' }) as string[] | null;
            // CRITICAL: Normalize IDs for comparison since list may contain modIds with or without 'mod_' prefix
            const isInList = globalModsList?.some(id => normalizeModId(id) === storedModId) || false;
            if (!isInList) {
                const updatedGlobalList = [...(globalModsList || []), storedModId];
                await env.MODS_KV.put(globalListKey, JSON.stringify(updatedGlobalList));
            }
        }

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify({ mod }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Update mod error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Update Mod',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while updating the mod'
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

/**
 * Get image extension from MIME type
 */
function getImageExtension(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
    };
    return mimeToExt[mimeType.toLowerCase()] || 'png';
}

/**
 * Handle thumbnail upload (binary file to R2)
 * Validates image format and ensures it's renderable
 * Optimized version - no base64 overhead
 */
async function handleThumbnailBinaryUpload(
    thumbnailFile: File,
    modId: string,
    slug: string,
    request: Request,
    env: Env,
    customerId: string | null
): Promise<string> {
    try {
        // Validate file type
        if (!thumbnailFile.type.startsWith('image/')) {
            throw new Error('File must be an image');
        }
        
        // Check file size
        const thumbnailSizeValidation = validateFileSize(thumbnailFile.size, MAX_THUMBNAIL_SIZE);
        if (!thumbnailSizeValidation.valid) {
            throw new Error(thumbnailSizeValidation.error || `Thumbnail file size must be less than ${MAX_THUMBNAIL_SIZE / (1024 * 1024)}MB`);
        }
        
        // Validate image type (only allow common web-safe formats)
        const allowedTypes = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
        const imageType = thumbnailFile.type.split('/')[1]?.toLowerCase();
        if (!imageType || !allowedTypes.includes(imageType)) {
            throw new Error(`Unsupported image type: ${imageType}. Allowed types: ${allowedTypes.join(', ')}`);
        }
        
        // Read file as binary
        const imageBuffer = new Uint8Array(await thumbnailFile.arrayBuffer());
        
        // Basic validation: Check minimum file size (at least 100 bytes)
        if (imageBuffer.length < 100) {
            throw new Error('Image file is too small or corrupted');
        }
        
        // Validate image headers for common formats
        // JPEG: FF D8 FF
        // PNG: 89 50 4E 47
        // GIF: 47 49 46 38
        // WebP: 52 49 46 46 (RIFF) followed by WEBP
        const isValidImage = 
            (imageType === 'jpeg' || imageType === 'jpg') && imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8 && imageBuffer[2] === 0xFF ||
            imageType === 'png' && imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4E && imageBuffer[3] === 0x47 ||
            imageType === 'gif' && imageBuffer[0] === 0x47 && imageBuffer[1] === 0x49 && imageBuffer[2] === 0x46 && imageBuffer[3] === 0x38 ||
            imageType === 'webp' && imageBuffer[0] === 0x52 && imageBuffer[1] === 0x49 && imageBuffer[2] === 0x46 && imageBuffer[3] === 0x46;
        
        if (!isValidImage) {
            // Log diagnostic information to help debug
            console.error('[Thumbnail] Invalid image format detected:', {
                imageType,
                fileName: thumbnailFile.name,
                fileType: thumbnailFile.type,
                fileSize: thumbnailFile.size,
                bufferLength: imageBuffer.length,
                firstBytes: Array.from(imageBuffer.slice(0, 8)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' '),
                expectedPNG: '0x89 0x50 0x4e 0x47',
                expectedJPEG: '0xff 0xd8 0xff',
                expectedGIF: '0x47 0x49 0x46 0x38',
                expectedWebP: '0x52 0x49 0x46 0x46',
            });
            throw new Error(`Invalid ${imageType} image format - file may be corrupted or not a valid image. First bytes: ${Array.from(imageBuffer.slice(0, 4)).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ')}`);
        }
        
        // Upload to R2
        const normalizedModId = normalizeModId(modId);
        const extension = getImageExtension(thumbnailFile.type);
        const r2Key = getCustomerR2Key(customerId, `thumbnails/${normalizedModId}.${extension}`);
        
        // Add R2 source metadata
        const r2SourceInfo = getR2SourceInfo(env, request);
        console.log('[UpdateMod] Thumbnail R2 storage source:', r2SourceInfo);
        
        await env.MODS_R2.put(r2Key, imageBuffer, {
            httpMetadata: {
                contentType: thumbnailFile.type,
                cacheControl: 'public, max-age=31536000',
            },
            customMetadata: addR2SourceMetadata({
                modId,
                extension: extension,
                validated: 'true', // Mark as validated for rendering
            }, env, request),
        });
        
        // Return API proxy URL using slug for consistency
        const requestUrl = new URL(request.url);
        const API_BASE_URL = requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1'
            ? `${requestUrl.protocol}//${requestUrl.hostname}:${requestUrl.port || '8788'}`  // Local dev (mods-api runs on 8788)
            : `https://mods-api.idling.app`;  // Production
        return `${API_BASE_URL}/mods/${slug}/thumbnail`;
    } catch (error) {
        console.error('Thumbnail binary upload error:', error);
        throw error;
    }
}

/**
 * Handle thumbnail upload (base64 to R2) - Legacy support
 * Validates image format and ensures it's renderable
 */
async function handleThumbnailUpload(
    base64Data: string,
    modId: string,
    slug: string,
    request: Request,
    env: Env,
    customerId: string | null
): Promise<string> {
    try {
        // Parse base64 data URL
        const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) {
            throw new Error('Invalid base64 image data');
        }

        const [, imageType, base64Content] = matches;
        
        // Validate image type (only allow common web-safe formats)
        const allowedTypes = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
        const normalizedType = imageType.toLowerCase();
        if (!allowedTypes.includes(normalizedType)) {
            throw new Error(`Unsupported image type: ${imageType}. Allowed types: ${allowedTypes.join(', ')}`);
        }

        // Decode base64 to binary
        const imageBuffer = Uint8Array.from(atob(base64Content), c => c.charCodeAt(0));
        
        // Basic validation: Check minimum file size (at least 100 bytes)
        if (imageBuffer.length < 100) {
            throw new Error('Image file is too small or corrupted');
        }

        // Validate image headers for common formats
        // JPEG: FF D8 FF
        // PNG: 89 50 4E 47
        // GIF: 47 49 46 38
        // WebP: 52 49 46 46 (RIFF) followed by WEBP
        const isValidImage = 
            (normalizedType === 'jpeg' || normalizedType === 'jpg') && imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8 && imageBuffer[2] === 0xFF ||
            normalizedType === 'png' && imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4E && imageBuffer[3] === 0x47 ||
            normalizedType === 'gif' && imageBuffer[0] === 0x47 && imageBuffer[1] === 0x49 && imageBuffer[2] === 0x46 && imageBuffer[3] === 0x38 ||
            normalizedType === 'webp' && imageBuffer[0] === 0x52 && imageBuffer[1] === 0x49 && imageBuffer[2] === 0x46 && imageBuffer[3] === 0x46;

        if (!isValidImage) {
            throw new Error(`Invalid ${imageType} image format - file may be corrupted or not a valid image`);
        }

        // Upload to R2
        // Normalize modId to ensure consistent storage (strip mod_ prefix if present)
        const normalizedModId = normalizeModId(modId);
        const r2Key = getCustomerR2Key(customerId, `thumbnails/${normalizedModId}.${normalizedType}`);
        
        // Add R2 source metadata
        const r2SourceInfo = getR2SourceInfo(env, request);
        console.log('[UpdateMod] Thumbnail (base64) R2 storage source:', r2SourceInfo);
        
        await env.MODS_R2.put(r2Key, imageBuffer, {
            httpMetadata: {
                contentType: `image/${normalizedType}`,
                cacheControl: 'public, max-age=31536000',
            },
            customMetadata: addR2SourceMetadata({
                modId,
                extension: normalizedType, // Store extension for easy retrieval
                validated: 'true', // Mark as validated for rendering
            }, env, request),
        });

        // Return API proxy URL using slug (thumbnails should be served through API, not direct R2)
        // Slug is passed as parameter to avoid race condition
        // Use request URL to determine base URL dynamically
        const requestUrl = new URL(request.url);
        const API_BASE_URL = requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1'
            ? `${requestUrl.protocol}//${requestUrl.hostname}:${requestUrl.port || '8788'}`  // Local dev (mods-api runs on 8788)
            : `https://mods-api.idling.app`;  // Production
        return `${API_BASE_URL}/mods/${slug}/thumbnail`;
    } catch (error) {
        console.error('Thumbnail upload error:', error);
        throw error;
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

