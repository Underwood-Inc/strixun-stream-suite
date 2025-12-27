/**
 * Admin triage handler
 * Handles mod status changes and review management
 */

import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';
import { getCustomerKey } from '../../utils/customer.js';
import { isSuperAdminEmail } from '../../utils/admin.js';
import type { ModMetadata, ModStatus, ModStatusHistory, ModReviewComment } from '../../types/mod.js';

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
        let mod: ModMetadata | null = null;
        const customerModKey = getCustomerKey(auth.customerId, `mod_${modId}`);
        mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;

        if (!mod) {
            const globalModKey = `mod_${modId}`;
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
        const globalListKey = 'mods_list_public';
        const globalModsList = await env.MODS_KV.get(globalListKey, { type: 'json' }) as string[] | null;
        
        if (newStatus === 'published' && oldStatus !== 'published') {
            // Add to global list when publishing
            if (!globalModsList || !globalModsList.includes(modId)) {
                const updatedGlobalList = [...(globalModsList || []), modId];
                await env.MODS_KV.put(globalListKey, JSON.stringify(updatedGlobalList));
            }
            
            // Also store in global scope
            const globalModKey = `mod_${modId}`;
            await env.MODS_KV.put(globalModKey, JSON.stringify(mod));
        } else if (oldStatus === 'published' && newStatus !== 'published') {
            // Remove from global list when unpublishing/delisting
            if (globalModsList && globalModsList.includes(modId)) {
                const updatedGlobalList = globalModsList.filter(id => id !== modId);
                await env.MODS_KV.put(globalListKey, JSON.stringify(updatedGlobalList));
                
                // Delete global mod metadata (it will still exist in customer scope)
                const globalModKey = `mod_${modId}`;
                await env.MODS_KV.delete(globalModKey);
            }
        }

        // Save updated mod
        await env.MODS_KV.put(customerModKey, JSON.stringify(mod));
        if (mod.visibility === 'public') {
            const globalModKey = `mod_${modId}`;
            await env.MODS_KV.put(globalModKey, JSON.stringify(mod));
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
        let mod: ModMetadata | null = null;
        const customerModKey = getCustomerKey(auth.customerId, `mod_${modId}`);
        mod = await env.MODS_KV.get(customerModKey, { type: 'json' }) as ModMetadata | null;

        if (!mod) {
            const globalModKey = `mod_${modId}`;
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
            const globalModKey = `mod_${modId}`;
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

