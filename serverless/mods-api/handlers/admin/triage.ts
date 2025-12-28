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
        // Verify admin access
        if (!auth.email || !(await isSuperAdminEmail(auth.email, env))) {
            const rfcError = createError(request, 403, 'Forbidden', 'Admin access required');
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
        // Normalize modId to ensure consistent key generation (strip mod_ prefix if present)
        const normalizedModId = normalizeModId(modId);
        let mod: ModMetadata | null = null;
        const customerModKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
        mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;

        if (!mod) {
            const globalModKey = `mod_${normalizedModId}`;
            mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
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
        if (!mod.statusHistory) {
            mod.statusHistory = [];
        }
        const statusEntry: ModStatusHistory = {
            status: newStatus,
            changedBy: auth.userId,
            changedByEmail: auth.email,
            changedAt: new Date().toISOString(),
            reason: reason,
        };
        mod.statusHistory.push(statusEntry);

        // Update global public list based on status change
        // CRITICAL: Approved mods should be public! Add them to the public list.
        const globalListKey = 'mods_list_public';
        const globalModsList = await env.MODS_KV.get(globalListKey, { type: 'json' }) as string[] | null;
        
        // Add to public list when approved or published (if public visibility)
        if (mod.visibility === 'public' && (newStatus === 'approved' || newStatus === 'published')) {
            if (oldStatus !== 'approved' && oldStatus !== 'published') {
                // Add to global list when first approved/published
                if (!globalModsList || !globalModsList.includes(normalizedModId)) {
                    const updatedGlobalList = [...(globalModsList || []), normalizedModId];
                    await env.MODS_KV.put(globalListKey, JSON.stringify(updatedGlobalList));
                }
            }
            
            // Always store in global scope for approved/published public mods
            const globalModKey = `mod_${normalizedModId}`;
            await env.MODS_KV.put(globalModKey, JSON.stringify(mod));
        } else if ((oldStatus === 'approved' || oldStatus === 'published') && 
                   (newStatus !== 'approved' && newStatus !== 'published')) {
            // Remove from global list when unapproved/unpublished/delisted
            if (globalModsList && globalModsList.includes(normalizedModId)) {
                const updatedGlobalList = globalModsList.filter(id => id !== normalizedModId);
                await env.MODS_KV.put(globalListKey, JSON.stringify(updatedGlobalList));
                
                // Delete global mod metadata (it will still exist in customer scope)
                const globalModKey = `mod_${normalizedModId}`;
                await env.MODS_KV.delete(globalModKey);
            }
        }

        // Save updated mod
        await env.MODS_KV.put(customerModKey, JSON.stringify(mod));
        if (mod.visibility === 'public') {
            const globalModKey = `mod_${normalizedModId}`;
            await env.MODS_KV.put(globalModKey, JSON.stringify(mod));
            
            // CRITICAL: Copy all versions to global scope when mod is approved/published and public
            // This ensures badges and downloads work without auth for public mods
            if ((newStatus === 'approved' || newStatus === 'published') && mod.customerId) {
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
        // Normalize modId to ensure consistent key generation (strip mod_ prefix if present)
        const normalizedModId = normalizeModId(modId);
        let mod: ModMetadata | null = null;
        const customerModKey = getCustomerKey(auth.customerId, `mod_${normalizedModId}`);
        mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;

        if (!mod) {
            const globalModKey = `mod_${normalizedModId}`;
            mod = await env.MODS_KV.get(globalModKey, { type: 'json' }) as ModMetadata | null;
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
        const comment: ModReviewComment = {
            commentId: `comment_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
            authorId: auth.userId,
            authorEmail: auth.email || '',
            content: commentData.content.trim(),
            createdAt: new Date().toISOString(),
            isAdmin: isAdmin || false,
        };
        mod.reviewComments.push(comment);
        mod.updatedAt = new Date().toISOString();

        // Save updated mod
        await env.MODS_KV.put(customerModKey, JSON.stringify(mod));
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

