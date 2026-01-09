/**
 * Admin triage handler
 * Handles mod status changes and review management
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey } from '../../utils/customer.js';
import { isSuperAdminEmail } from '../../utils/admin.js';
import { createCORSHeadersWithLocalhost } from '../../utils/cors.js';
import type { ModMetadata, ModStatus, ModStatusHistory, ModReviewComment, ModVersion } from '../../types/mod.js';

/**
 * Update mod status
 * POST /admin/mods/:modId/status
 */
export async function handleUpdateModStatus(
    request: Request,
    env: Env,
    modId: string,
    auth: { customerId: string; email?: string; customerId: string | null }
): Promise<Response> {
    try {
        // Route-level protection ensures customer is super admin
        // Get mod metadata
        // CRITICAL: Admin can approve mods from ANY customer, so we must search all scopes
        // Do NOT use auth.customerId - use mod.customerId (where the mod was uploaded)
        // Use modId directly - it already includes 'mod_' prefix
        console.log('[UpdateModStatus] Looking up mod:', { modId });
        let mod: ModMetadata | null = null;
        let modCustomerId: string | null = null;
        
        // Try global scope first (for already-approved mods)
        const globalModKey = modId;
        console.log('[UpdateModStatus] Checking global scope:', { globalModKey });
        mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
        if (mod) {
            modCustomerId = mod.customerId || null;
            console.log('[UpdateModStatus] Found mod in global scope:', { modId: mod.modId, customerId: modCustomerId });
        } else {
            console.log('[UpdateModStatus] Mod not found in global scope, searching customer scopes');
        }
        
        // If not found, search all customer scopes to find where the mod was uploaded
        if (!mod) {
            const customerListPrefix = 'customer_';
            let cursor: string | undefined;
            let customerScopesSearched = 0;
            let modsListsFound = 0;
            
            do {
                const listResult = await env.MODS_KV.list({ prefix: customerListPrefix, cursor });
                console.log('[UpdateModStatus] Listing customer keys:', { keysFound: listResult.keys.length, cursor: !!cursor });
                
                for (const key of listResult.keys) {
                    // Match both customer_{id}_mods_list and customer_{id}/mods_list patterns
                    if (key.name.endsWith('_mods_list') || key.name.endsWith('/mods_list')) {
                        modsListsFound++;
                        // CRITICAL: Customer IDs can contain underscores (e.g., cust_2233896f662d)
                        // Extract everything between "customer_" and the final "_mods_list" or "/mods_list"
                        let customerId: string | null = null;
                        if (key.name.endsWith('_mods_list')) {
                            const match = key.name.match(/^customer_(.+)_mods_list$/);
                            customerId = match ? match[1] : null;
                        } else if (key.name.endsWith('/mods_list')) {
                            const match = key.name.match(/^customer_(.+)\/mods_list$/);
                            customerId = match ? match[1] : null;
                        }
                        
                        if (customerId) {
                            customerScopesSearched++;
                            const customerModKey = getCustomerKey(customerId, modId);
                            console.log('[UpdateModStatus] Checking customer scope:', { customerId, customerModKey, keyName: key.name });
                            const candidateMod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                            if (candidateMod) {
                                mod = candidateMod;
                                modCustomerId = customerId;
                                console.log('[UpdateModStatus] Found mod in customer scope:', { customerId, modId: mod.modId });
                                break;
                            }
                        } else {
                            console.log('[UpdateModStatus] Failed to extract customerId from key:', { keyName: key.name });
                        }
                    }
                }
                if (mod) break;
                cursor = listResult.listComplete ? undefined : listResult.cursor;
            } while (cursor);
            
            console.log('[UpdateModStatus] Customer scope search complete:', { 
                customerScopesSearched, 
                modsListsFound, 
                modFound: !!mod 
            });
        }

        if (!mod) {
            console.error('[UpdateModStatus] Mod not found after searching all scopes:', { 
                modId,
                globalModKey: modId
            });
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

        // Parse status update request
        // CRITICAL: Handle encrypted request bodies (if API client encrypts them)
        // Check both X-Encrypted header and encrypted field in body for consistency
        let updateData: { status: ModStatus; reason?: string };
        try {
            const body = await request.json();
            
            // Check if body is encrypted (check both header and data structure for consistency)
            const requestIsEncrypted = request.headers.get('X-Encrypted') === 'true' ||
                                      (body && typeof body === 'object' && 'encrypted' in body && (body as any).encrypted === true);
            
            if (requestIsEncrypted) {
                // Body is encrypted - decrypt using JWT token
                const authHeader = request.headers.get('Authorization');
                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    const rfcError = createError(request, 401, 'Unauthorized', 'JWT token required to decrypt request body');
                    const corsHeaders = createCORSHeadersWithLocalhost(request, env);
                    return new Response(JSON.stringify(rfcError), {
                        status: 401,
                        headers: {
                            'Content-Type': 'application/problem+json',
                            ...Object.fromEntries(corsHeaders.entries()),
                        },
                    });
                }
                
                // CRITICAL: Trim token to ensure it matches the token used for encryption
                const token = authHeader.substring(7).trim();
                
                // Validate token before decryption
                if (!token || token.length < 10) {
                    const rfcError = createError(request, 401, 'Unauthorized', 'Invalid JWT token provided');
                    const corsHeaders = createCORSHeadersWithLocalhost(request, env);
                    return new Response(JSON.stringify(rfcError), {
                        status: 401,
                        headers: {
                            'Content-Type': 'application/problem+json',
                            ...Object.fromEntries(corsHeaders.entries()),
                        },
                    });
                }
                
                // Validate encrypted data structure before decryption
                if (!body || typeof body !== 'object' || !('encrypted' in body) || !('data' in body)) {
                    const rfcError = createError(request, 400, 'Invalid Request', 'Encrypted request body has invalid structure');
                    const corsHeaders = createCORSHeadersWithLocalhost(request, env);
                    return new Response(JSON.stringify(rfcError), {
                        status: 400,
                        headers: {
                            'Content-Type': 'application/problem+json',
                            ...Object.fromEntries(corsHeaders.entries()),
                        },
                    });
                }
                
                const { decryptWithJWT } = await import('@strixun/api-framework');
                updateData = await decryptWithJWT(body, token) as { status: ModStatus; reason?: string };
            } else {
                // Body is not encrypted (current behavior)
                updateData = body as { status: ModStatus; reason?: string };
            }
        } catch (error: any) {
            console.error('[UpdateModStatus] Failed to parse request body:', error);
            const rfcError = createError(request, 400, 'Invalid Request', 'Failed to parse request body. ' + (error.message || ''));
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
        
        const newStatus = updateData.status;
        const reason = updateData.reason;

        // Validate status
        const validStatuses: ModStatus[] = ['pending', 'approved', 'changes_requested', 'denied', 'draft', 'published', 'archived'];
        if (!validStatuses.includes(newStatus)) {
            const rfcError = createError(request, 400, 'Invalid Status', `Status must be one of: ${validStatuses.join(', ')}`);
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

        // Update status
        const oldStatus = mod.status;
        mod.status = newStatus;
        mod.updatedAt = new Date().toISOString();

        // Add to status history
        // CRITICAL: Never store email - email is ONLY for OTP authentication
        // Fetch displayName from customer data - customer is the source of truth
        let changedByDisplayName: string | null = null;
        try {
            if (auth.customerId) {
                const { fetchDisplayNameByCustomerId } = await import('@strixun/api-framework');
                changedByDisplayName = await fetchDisplayNameByCustomerId(auth.customerId, env);
            } else {
                console.warn('[Triage] Missing customerId, cannot fetch displayName for status history:', { customerId: auth.customerId
                });
            }
        } catch (error) {
            console.warn('[Triage] Failed to fetch displayName for status history:', error);
        }
        
        if (!mod.statusHistory) {
            mod.statusHistory = [];
        }
        const statusEntry: ModStatusHistory = {
            status: newStatus,
            changedBy: auth.customerId, // userId from OTP auth service
            changedByDisplayName, // Display name (never use email)
            changedAt: new Date().toISOString(),
            reason: reason,
        };
        mod.statusHistory.push(statusEntry);

        // Update global public list based on status change
        // CRITICAL: Approved mods should be public! Add them to the public list.
        // Reuse globalModKey declared earlier at line 46
        const globalListKey = 'mods_list_public';
        const globalModsList = await env.MODS_KV.get(globalListKey, { type: 'json' }) as string[] | null;
        
        // Determine if mod should be in global scope (approved/published and public)
        const shouldBeInGlobalScope = mod.visibility === 'public' && (newStatus === 'approved' || newStatus === 'published');
        const wasInGlobalScope = mod.visibility === 'public' && (oldStatus === 'approved' || oldStatus === 'published');
        
        // Add to public list when approved or published (if public visibility)
        if (shouldBeInGlobalScope) {
            if (!wasInGlobalScope) {
                // Add to global list when first approved/published
                // Use mod.modId directly - no normalization needed
                const isInList = globalModsList?.includes(mod.modId) || false;
                if (!isInList) {
                    const updatedGlobalList = [...(globalModsList || []), mod.modId];
                    await env.MODS_KV.put(globalListKey, JSON.stringify(updatedGlobalList));
                }
            }
            
            // Store in global scope for approved/published public mods
            await env.MODS_KV.put(globalModKey, JSON.stringify(mod));
            
            // CRITICAL: Create global slug index for public/approved mods
            const globalSlugKey = `slug_${mod.slug}`;
            await env.MODS_KV.put(globalSlugKey, mod.modId);
            console.log('[Triage] Created global slug index:', { slug: mod.slug, modId: mod.modId });
            
            // CRITICAL: Copy all versions to global scope when mod is approved/published and public
            // This ensures badges and downloads work without auth for public mods
            if (mod.customerId) {
                const versionsListKey = getCustomerKey(mod.customerId, `${mod.modId}_versions`);
                const versionsList = await env.MODS_KV.get(versionsListKey, { type: 'json' }) as string[] | null;
                
                if (versionsList) {
                    const globalVersionsListKey = `${mod.modId}_versions`;
                    await env.MODS_KV.put(globalVersionsListKey, JSON.stringify(versionsList));
                    
                    // Copy each version to global scope
                    for (const versionId of versionsList) {
                        const customerVersionKey = getCustomerKey(mod.customerId, `version_${versionId}`);
                        const version = await env.MODS_KV.get(customerVersionKey, { type: 'json' }) as ModVersion | null;
                        
                        if (version) {
                            const globalVersionKey = `version_${versionId}`;
                            await env.MODS_KV.put(globalVersionKey, JSON.stringify(version));
                        }
                    }
                }
            }
        } else if (wasInGlobalScope && !shouldBeInGlobalScope) {
            // Remove from global list when unapproved/unpublished/delisted
            // Use mod.modId directly - no normalization needed
            const isInList = globalModsList?.includes(mod.modId) || false;
            if (isInList) {
                const updatedGlobalList = (globalModsList || []).filter(id => id !== mod.modId);
                await env.MODS_KV.put(globalListKey, JSON.stringify(updatedGlobalList));
                
                // Delete global mod metadata (it will still exist in customer scope)
                await env.MODS_KV.delete(globalModKey);
                
                // CRITICAL: Delete global slug index when mod is no longer public/approved
                const globalSlugKey = `slug_${mod.slug}`;
                await env.MODS_KV.delete(globalSlugKey);
                console.log('[Triage] Deleted global slug index:', { slug: mod.slug, modId: mod.modId });
            }
        }

        // Save updated mod to customer scope
        // CRITICAL: Always save to mod's original customer scope, NOT admin's customer scope
        // This ensures the mod remains accessible in its original location
        // The mod will also exist in global scope if approved/published and public
        if (modCustomerId) {
            const modCustomerKey = getCustomerKey(modCustomerId, mod.modId);
            await env.MODS_KV.put(modCustomerKey, JSON.stringify(mod));
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
        console.error('Update mod status error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Update Status',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while updating mod status'
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
 * Add review comment
 * POST /admin/mods/:modId/comments
 */
export async function handleAddReviewComment(
    request: Request,
    env: Env,
    modId: string,
    auth: { customerId: string; email?: string; customerId: string | null }
): Promise<Response> {
    try {
        // Get mod metadata
        // CRITICAL: Admin can comment on mods from ANY customer, so we must search all scopes
        // Do NOT use auth.customerId - use mod.customerId (where the mod was uploaded)
        // Use modId directly - it already includes 'mod_' prefix
        let mod: ModMetadata | null = null;
        let modCustomerId: string | null = null;
        
        // Try global scope first (for already-approved mods)
        const globalModKey = modId;
        mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
        if (mod) {
            modCustomerId = mod.customerId || null;
        }
        
        // If not found, search all customer scopes to find where the mod was uploaded
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
                            const candidateMod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;
                            if (candidateMod) {
                                mod = candidateMod;
                                modCustomerId = customerId;
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

        // Check access: only admin or uploader can comment
        const isAdmin = auth.email && await isSuperAdminEmail(auth.email, env);
        const isUploader = mod.authorId === auth.customerId;

        if (!isAdmin && !isUploader) {
            const rfcError = createError(request, 403, 'Forbidden', 'Only admins and the mod author can add comments');
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

        // CRITICAL: For non-admin users (uploaders), customerId is required for display name lookup
        if (!isAdmin && !auth.customerId) {
            console.error('[Triage] CRITICAL: customerId is null for non-admin customer:', { customerId: auth.customerId,
                email: auth.email,
                isUploader,
                note: 'Rejecting comment - customerId is required for display name lookups'
            });
            const rfcError = createError(request, 400, 'Missing Customer ID', 'Customer ID is required for adding review comments. Please ensure your account has a valid customer association.');
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

        // Parse comment request
        const commentData = await request.json() as { content: string };
        if (!commentData.content || commentData.content.trim().length === 0) {
            const rfcError = createError(request, 400, 'Invalid Comment', 'Comment content is required');
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

        // Add comment
        if (!mod.reviewComments) {
            mod.reviewComments = [];
        }
        // CRITICAL: Never store email - email is ONLY for OTP authentication
        // Fetch displayName from auth API if available
        let authorDisplayName: string | null = null;
        try {
            // CRITICAL: Fetch displayName from customer data - customer is the source of truth
            if (auth.customerId) {
                const { fetchDisplayNameByCustomerId } = await import('@strixun/api-framework');
                authorDisplayName = await fetchDisplayNameByCustomerId(auth.customerId, env);
            } else {
                console.warn('[Triage] Missing customerId, cannot fetch displayName for comment:', { customerId: auth.customerId
                });
            }
        } catch (error) {
            console.warn('[Triage] Failed to fetch displayName for comment:', error);
        }
        
        const comment: ModReviewComment = {
            commentId: `comment_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
            authorId: auth.customerId, // userId from OTP auth service
            authorDisplayName, // Display name (never use email)
            content: commentData.content.trim(),
            createdAt: new Date().toISOString(),
            isAdmin: isAdmin || false,
        };
        mod.reviewComments.push(comment);
        mod.updatedAt = new Date().toISOString();

        // Save updated mod
        // CRITICAL: Save to mod's original customer scope, NOT admin's customer scope
        // This prevents duplication - mod stays in uploader's customer scope
        if (modCustomerId) {
            const modCustomerKey = getCustomerKey(modCustomerId, mod.modId);
            await env.MODS_KV.put(modCustomerKey, JSON.stringify(mod));
        }
        
        // Also update global scope if public (for public browsing)
        if (mod.visibility === 'public') {
            const globalModKey = mod.modId;
            await env.MODS_KV.put(globalModKey, JSON.stringify(mod));
        }

        const corsHeaders = createCORSHeaders(request, {
            allowedOrigins: env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['*'],
        });
        return new Response(JSON.stringify({ comment }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...Object.fromEntries(corsHeaders.entries()),
            },
        });
    } catch (error: any) {
        console.error('Add review comment error:', error);
        const rfcError = createError(
            request,
            500,
            'Failed to Add Comment',
            env.ENVIRONMENT === 'development' ? error.message : 'An error occurred while adding comment'
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
    SUPER_ADMIN_EMAILS?: string;
    ENVIRONMENT?: string;
    ALLOWED_ORIGINS?: string;
    [key: string]: any;
}

