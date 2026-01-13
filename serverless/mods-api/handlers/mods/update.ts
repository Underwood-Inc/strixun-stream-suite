/**
 * Update mod handler
 * PATCH /mods/:modId
 * Updates mod metadata (not versions)
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, getCustomerR2Key, normalizeModId } from '../../utils/customer.js';
import { generateSlug, slugExists } from './upload.js';
import { MAX_THUMBNAIL_SIZE, validateFileSize } from '../../utils/upload-limits.js';
import { createModSnapshot } from '../../utils/snapshot.js';
import { addR2SourceMetadata, getR2SourceInfo } from '../../utils/r2-source.js';
// handleThumbnailUpload is defined locally in this file
import type { ModMetadata, ModUpdateRequest } from '../../types/mod.js';
import type { Env } from '../../worker.js';

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
        
        // CRITICAL: Merge variants intelligently - preserve currentVersionId and other system fields
        // Frontend only sends name and description, not currentVersionId (it doesn't know it)
        // We must preserve currentVersionId from existing variants to avoid breaking downloads
        if (updateData.variants !== undefined) {
            const existingVariants = mod.variants || [];
            const updatedVariants = updateData.variants.map(updatedVariant => {
                // Find existing variant by variantId
                const existing = existingVariants.find(v => v.variantId === updatedVariant.variantId);
                
                if (existing) {
                    // Merge: keep system fields (currentVersionId, createdAt) from existing,
                    // update user-editable fields (name, description) from update
                    return {
                        ...existing,
                        name: updatedVariant.name,
                        description: updatedVariant.description,
                        updatedAt: new Date().toISOString(),
                        // Preserve currentVersionId, versionCount, totalDownloads from existing
                    };
                } else {
                    // New variant: use all fields from update (currentVersionId will be null until file uploaded)
                    return {
                        ...updatedVariant,
                        createdAt: updatedVariant.createdAt || new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        currentVersionId: null, // Will be set when file is uploaded
                        versionCount: 0, // Initialize to 0 for new variants
                        totalDownloads: 0, // Initialize to 0 for new variants
                    };
                }
            });
            
            mod.variants = updatedVariants;
            // console.log('[UpdateMod] Merged variants:', {
            //     existingCount: existingVariants.length,
            //     updatedCount: updatedVariants.length,
            //     preserved: updatedVariants.filter(v => v.currentVersionId).length
            // });
        }
        
        if (updateData.gameId !== undefined) mod.gameId = updateData.gameId;
        mod.updatedAt = new Date().toISOString();

        // Handle thumbnail update - support both binary file upload and legacy base64
        // Reuse formData already read above (or null if JSON request)
        if (formData) {
            // Check for binary thumbnail file upload
            const thumbnailFile = formData.get('thumbnail') as File | null;
            console.log('[UpdateMod] Checking for thumbnail in formData:', {
                hasThumbnailFile: !!thumbnailFile,
                thumbnailFileName: thumbnailFile?.name,
                thumbnailSize: thumbnailFile?.size,
                thumbnailType: thumbnailFile?.type
            });
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
                    console.log('[UpdateMod] Processing thumbnail upload:', {
                        fileName: thumbnailFile.name,
                        size: thumbnailFile.size,
                        type: thumbnailFile.type,
                        modId,
                        slug: mod.slug
                    });
                    mod.thumbnailUrl = await handleThumbnailBinaryUpload(thumbnailFile, modId, mod.slug, request, env, auth.customerId);
                    console.log('[UpdateMod] Thumbnail uploaded successfully:', { thumbnailUrl: mod.thumbnailUrl });
                    
                    // Extract extension from file type for faster lookup
                    const imageType = thumbnailFile.type.split('/')[1]?.toLowerCase();
                    mod.thumbnailExtension = imageType === 'jpeg' ? 'jpg' : imageType;
                    console.log('[UpdateMod] Thumbnail extension stored:', { extension: mod.thumbnailExtension });
                } catch (error) {
                    console.error('[UpdateMod] Thumbnail upload FAILED:', {
                        error: error instanceof Error ? error.message : String(error),
                        stack: error instanceof Error ? error.stack : undefined,
                        modId,
                        slug: mod.slug
                    });
                    // FAIL THE REQUEST - do not allow silent errors
                    const rfcError = createError(
                        request, 
                        500, 
                        'Thumbnail Upload Failed', 
                        `Failed to upload thumbnail: ${error instanceof Error ? error.message : String(error)}`
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
        }
        
        // Validate variant metadata before processing
        if (updateData.variants) {
            for (const variant of updateData.variants) {
                // Validate variant name is present and not empty
                if (!variant.name || variant.name.trim().length === 0) {
                    const rfcError = createError(request, 400, 'Invalid Variant Data', 'Variant name is required and cannot be empty');
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
        
        // Handle variant file uploads with TWO-PHASE COMMIT pattern
        // PHASE 1: Upload all files, collect results
        // PHASE 2: Update mod metadata only if ALL uploads succeeded
        // This prevents partial state where some variants are updated and others aren't
        if (formData && mod.variants && mod.variants.length > 0) {
            const { handleUploadVersion } = await import('../versions/upload.js');
            
            // Track upload results for rollback on error
            interface UploadResult {
                variantId: string;
                versionId: string;
                success: boolean;
                error?: string;
            }
            const uploadResults: UploadResult[] = [];
            
            // PHASE 1: Process all variant file uploads
            for (const variant of mod.variants) {
                const variantFile = formData.get(`variant_${variant.variantId}`) as File | null;
                if (!variantFile) continue; // No file for this variant, skip
                
                console.log('[UpdateMod] Processing variant file upload:', {
                    variantId: variant.variantId,
                    fileName: variantFile.name,
                    size: variantFile.size
                });
                
                try {
                    // Create FormData for version upload
                    const variantFormData = new FormData();
                    variantFormData.append('file', variantFile);
                    
                    // Generate version number
                    const variantVersionsListKey = getCustomerKey(auth.customerId, `variant_${variant.variantId}_versions`);
                    const existingVersions = await env.MODS_KV.get(variantVersionsListKey, { type: 'json' }) as string[] | null;
                    const versionCount = existingVersions ? existingVersions.length : 0;
                    const newVersionNumber = versionCount > 0 ? `1.0.${versionCount}` : '1.0.0';
                    
                    const variantMetadata = {
                        version: newVersionNumber,
                        changelog: 'Uploaded via mod update',
                        gameVersions: [],
                        dependencies: []
                    };
                    variantFormData.append('metadata', JSON.stringify(variantMetadata));
                    
                    // Create request - forward HttpOnly cookie for authentication
                    const headers = new Headers();
                    const cookieHeader = request.headers.get('Cookie');
                    if (cookieHeader) headers.set('Cookie', cookieHeader);
                    
                    const variantUploadRequest = new Request(request.url, {
                        method: 'POST',
                        headers: headers,
                        body: variantFormData
                    });
                    
                    // Upload file
                    const uploadResponse = await handleUploadVersion(
                        variantUploadRequest,
                        env,
                        modId,
                        auth,
                        variant.variantId
                    );
                    
                    // Check if upload succeeded
                    if (uploadResponse.status !== 201) {
                        const errorText = await uploadResponse.text();
                        throw new Error(`Upload failed with status ${uploadResponse.status}: ${errorText}`);
                    }
                    
                    // Parse response to get versionId
                    const uploadResult = await uploadResponse.json() as { version?: { versionId?: string } };
                    if (!uploadResult.version?.versionId) {
                        throw new Error('Upload response missing versionId');
                    }
                    
                    // Record successful upload
                    uploadResults.push({
                        variantId: variant.variantId,
                        versionId: uploadResult.version.versionId,
                        success: true
                    });
                    
                    console.log('[UpdateMod] Variant file uploaded successfully:', {
                        variantId: variant.variantId,
                        versionId: uploadResult.version.versionId
                    });
                    
                } catch (uploadError: any) {
                    // Record failed upload
                    uploadResults.push({
                        variantId: variant.variantId,
                        versionId: '',
                        success: false,
                        error: uploadError.message
                    });
                    
                    console.error('[UpdateMod] Variant file upload failed:', {
                        variantId: variant.variantId,
                        error: uploadError.message
                    });
                    
                    // ROLLBACK: Mark R2 files for deletion and clean up KV records
                    console.warn('[UpdateMod] Rolling back previously successful uploads...');
                    const rollbackErrors: string[] = [];
                    const { markR2FileForDeletion } = await import('../../utils/r2-deletion.js');
                    
                    for (const successfulUpload of uploadResults.filter(r => r.success)) {
                        try {
                            // Get the version to find its R2 key
                            const versionKey = getCustomerKey(auth.customerId, `version_${successfulUpload.versionId}`);
                            const version = await env.MODS_KV.get(versionKey, { type: 'json' }) as { r2Key?: string } | null;
                            
                            // Mark R2 file for deletion (will be cleaned up by cron after 5 days)
                            if (version?.r2Key) {
                                const marked = await markR2FileForDeletion(env.MODS_R2, version.r2Key);
                                if (!marked) {
                                    console.warn('[UpdateMod] Failed to mark R2 file for deletion:', version.r2Key);
                                }
                            }
                            
                            // Delete the version from KV
                            await env.MODS_KV.delete(versionKey);
                            
                            // Remove from variant's version list
                            const variantVersionsListKey = getCustomerKey(auth.customerId, `variant_${successfulUpload.variantId}_versions`);
                            const versionsList = await env.MODS_KV.get(variantVersionsListKey, { type: 'json' }) as string[] | null;
                            if (versionsList) {
                                const updatedList = versionsList.filter(id => id !== successfulUpload.versionId);
                                await env.MODS_KV.put(variantVersionsListKey, JSON.stringify(updatedList));
                            }
                            
                            console.log('[UpdateMod] Rolled back upload:', {
                                variantId: successfulUpload.variantId,
                                versionId: successfulUpload.versionId,
                                r2FileMarked: !!version?.r2Key
                            });
                        } catch (rollbackError: any) {
                            rollbackErrors.push(`Failed to rollback ${successfulUpload.variantId}: ${rollbackError.message}`);
                            console.error('[UpdateMod] Rollback error:', rollbackError);
                        }
                    }
                    
                    // Return error with rollback status
                    const errorMessage = rollbackErrors.length > 0
                        ? `Failed to upload variant ${variant.variantId}: ${uploadError.message}. Rollback partially failed: ${rollbackErrors.join(', ')}`
                        : `Failed to upload variant ${variant.variantId}: ${uploadError.message}. All previous uploads rolled back successfully.`;
                    
                    const rfcError = createError(
                        request,
                        500,
                        'Variant Upload Failed',
                        errorMessage
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
            
            // PHASE 2: All uploads succeeded - update mod metadata
            if (uploadResults.length > 0) {
                for (const result of uploadResults) {
                    if (result.success) {
                        const variant = mod.variants.find(v => v.variantId === result.variantId);
                        if (variant) {
                            variant.currentVersionId = result.versionId;
                            variant.updatedAt = new Date().toISOString();
                        }
                    }
                }
                
                console.log('[UpdateMod] All variant uploads succeeded, metadata updated:', {
                    uploadCount: uploadResults.length,
                    successCount: uploadResults.filter(r => r.success).length
                });
            }
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
        // In dev, use localhost:8788 (mods-api worker port)
        // In production, use MODS_PUBLIC_URL if set, otherwise derive from request
        const requestUrl = new URL(request.url);
        let API_BASE_URL: string;
        if (env.ENVIRONMENT === 'development') {
            // Force localhost in dev - request.url has proxy target hostname
            API_BASE_URL = 'http://localhost:8788';
        } else {
            API_BASE_URL = env.MODS_PUBLIC_URL || `${requestUrl.protocol}//${requestUrl.host}`;
        }
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
        // In dev, use localhost:8788 (mods-api worker port)
        // In production, use MODS_PUBLIC_URL if set, otherwise derive from request
        const requestUrl = new URL(request.url);
        let API_BASE_URL: string;
        if (env.ENVIRONMENT === 'development') {
            // Force localhost in dev - request.url has proxy target hostname
            API_BASE_URL = 'http://localhost:8788';
        } else {
            API_BASE_URL = env.MODS_PUBLIC_URL || `${requestUrl.protocol}//${requestUrl.host}`;
        }
        return `${API_BASE_URL}/mods/${slug}/thumbnail`;
    } catch (error) {
        console.error('Thumbnail upload error:', error);
        throw error;
    }
}

