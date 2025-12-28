/**
 * Admin triage handler
 * Handles mod status changes and review management
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey, normalizeModId } from '../../utils/customer.js';
import { isSuperAdminEmail } from '../../utils/admin.js';
import type { ModMetadata, ModStatus, ModStatusHistory, ModReviewComment, ModVersion } from '../../types/mod.js';

/**
 * Update mod status
 * POST /admin/mods/:modId/status
 */
export async function handleUpdateModStatus(
    request: Request,
    env: Env,
    modId: string,
    auth: { userId: string; email?: string; customerId: string | null }
): Promise<Response> {
    try {
        // Route-level protection ensures user is super admin
        // Get mod metadata
        // CRITICAL: Admin can approve mods from ANY customer, so we must search all scopes
        // Do NOT use auth.customerId - use mod.customerId (where the mod was uploaded)
        const normalizedModId = normalizeModId(modId);
        let mod: ModMetadata | null = null;
        let modCustomerId: string | null = null;
        
        // Try global scope first (for already-approved mods)
        const globalModKey = `mod_${normalizedModId}`;
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
                            const customerModKey = getCustomerKey(customerId, `mod_${normalizedModId}`);
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

        // Parse status update request
        const updateData = await request.json() as { status: ModStatus; reason?: string };
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
        // Fetch displayName from auth API if available
        let changedByDisplayName: string | null = null;
        try {
            const authApiUrl = env.AUTH_API_URL || 'https://auth.idling.app';
            const authHeader = request.headers.get('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                const response = await fetch(`${authApiUrl}/auth/me`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    // CRITICAL: Prevent caching of service-to-service API calls
                    // Even server-side calls should not be cached to ensure fresh data
                    cache: 'no-store',
                });
                if (response.ok) {
                    const responseData = await response.json();
                    const isEncrypted = response.headers.get('X-Encrypted') === 'true' || 
                                       (typeof responseData === 'object' && responseData && 'encrypted' in responseData);
                    let userData: { displayName?: string | null; [key: string]: any };
                    if (isEncrypted) {
                        const { decryptWithJWT } = await import('@strixun/api-framework');
                        userData = await decryptWithJWT(responseData, token) as { displayName?: string | null; [key: string]: any };
                    } else {
                        userData = responseData;
                    }
                    changedByDisplayName = userData?.displayName || null;
                }
            }
        } catch (error) {
            console.warn('[Triage] Failed to fetch displayName for status history:', error);
        }
        
        if (!mod.statusHistory) {
            mod.statusHistory = [];
        }
        const statusEntry: ModStatusHistory = {
            status: newStatus,
            changedBy: auth.userId, // userId from OTP auth service
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
                if (!globalModsList || !globalModsList.includes(normalizedModId)) {
                    const updatedGlobalList = [...(globalModsList || []), normalizedModId];
                    await env.MODS_KV.put(globalListKey, JSON.stringify(updatedGlobalList));
                }
            }
            
            // Store in global scope for approved/published public mods
            await env.MODS_KV.put(globalModKey, JSON.stringify(mod));
            
            // CRITICAL: Copy all versions to global scope when mod is approved/published and public
            // This ensures badges and downloads work without auth for public mods
            if (mod.customerId) {
                const versionsListKey = getCustomerKey(mod.customerId, `mod_${normalizedModId}_versions`);
                const versionsList = await env.MODS_KV.get(versionsListKey, { type: 'json' }) as string[] | null;
                
                if (versionsList) {
                    const globalVersionsListKey = `mod_${normalizedModId}_versions`;
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
            if (globalModsList && globalModsList.includes(normalizedModId)) {
                const updatedGlobalList = globalModsList.filter(id => id !== normalizedModId);
                await env.MODS_KV.put(globalListKey, JSON.stringify(updatedGlobalList));
                
                // Delete global mod metadata (it will still exist in customer scope)
                await env.MODS_KV.delete(globalModKey);
            }
        }

        // Save updated mod to customer scope
        // CRITICAL: Always save to mod's original customer scope, NOT admin's customer scope
        // This ensures the mod remains accessible in its original location
        // The mod will also exist in global scope if approved/published and public
        if (modCustomerId) {
            const modCustomerKey = getCustomerKey(modCustomerId, `mod_${normalizedModId}`);
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
    auth: { userId: string; email?: string; customerId: string | null }
): Promise<Response> {
    try {
        // Get mod metadata
        // CRITICAL: Admin can comment on mods from ANY customer, so we must search all scopes
        // Do NOT use auth.customerId - use mod.customerId (where the mod was uploaded)
        const normalizedModId = normalizeModId(modId);
        let mod: ModMetadata | null = null;
        let modCustomerId: string | null = null;
        
        // Try global scope first (for already-approved mods)
        const globalModKey = `mod_${normalizedModId}`;
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
                            const customerModKey = getCustomerKey(customerId, `mod_${normalizedModId}`);
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
        const isUploader = mod.authorId === auth.userId;

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
            const authApiUrl = env.AUTH_API_URL || 'https://auth.idling.app';
            const authHeader = request.headers.get('Authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                const response = await fetch(`${authApiUrl}/auth/me`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    // CRITICAL: Prevent caching of service-to-service API calls
                    // Even server-side calls should not be cached to ensure fresh data
                    cache: 'no-store',
                });
                if (response.ok) {
                    const responseData = await response.json();
                    const isEncrypted = response.headers.get('X-Encrypted') === 'true' || 
                                       (typeof responseData === 'object' && responseData && 'encrypted' in responseData);
                    let userData: { displayName?: string | null; [key: string]: any };
                    if (isEncrypted) {
                        const { decryptWithJWT } = await import('@strixun/api-framework');
                        userData = await decryptWithJWT(responseData, token) as { displayName?: string | null; [key: string]: any };
                    } else {
                        userData = responseData;
                    }
                    authorDisplayName = userData?.displayName || null;
                }
            }
        } catch (error) {
            console.warn('[Triage] Failed to fetch displayName for comment:', error);
        }
        
        const comment: ModReviewComment = {
            commentId: `comment_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
            authorId: auth.userId, // userId from OTP auth service
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
            const modCustomerKey = getCustomerKey(modCustomerId, `mod_${normalizedModId}`);
            await env.MODS_KV.put(modCustomerKey, JSON.stringify(mod));
        }
        
        // Also update global scope if public (for public browsing)
        if (mod.visibility === 'public') {
            const globalModKey = `mod_${normalizedModId}`;
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

