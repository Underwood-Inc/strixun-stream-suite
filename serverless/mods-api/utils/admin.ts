/**
 * Admin utilities for mods API
 * Handles super-admin authentication and upload permissions
 */

/**
 * Get list of super admin emails from environment
 * Uses SUPER_ADMIN_EMAILS environment variable (comma-separated list)
 */
export async function getSuperAdminEmails(env: Env): Promise<string[]> {
    // Check environment variable (comma-separated list)
    if (env.SUPER_ADMIN_EMAILS) {
        return env.SUPER_ADMIN_EMAILS.split(',').map(email => email.trim().toLowerCase());
    }
    
    // Fallback: Check KV for super admin list
    if (env.MODS_KV) {
        try {
            const kvEmails = await env.MODS_KV.get('super_admin_emails');
            if (kvEmails) {
                return kvEmails.split(',').map(email => email.trim().toLowerCase());
            }
        } catch (e) {
            // If KV read fails, continue
        }
    }
    
    return [];
}

/**
 * Check if an email is a super admin
 */
export async function isSuperAdminEmail(email: string | undefined, env: Env): Promise<boolean> {
    if (!email) return false;
    
    const adminEmails = await getSuperAdminEmails(env);
    return adminEmails.includes(email.toLowerCase());
}

/**
 * Check if user has upload permission
 * - Super admins always have permission
 * - Other users need explicit approval stored in KV
 */
export async function hasUploadPermission(userId: string, email: string | undefined, env: Env): Promise<boolean> {
    // Super admins always have permission
    if (email && await isSuperAdminEmail(email, env)) {
        return true;
    }
    
    // Check if user has explicit approval
    if (env.MODS_KV) {
        try {
            const approvalKey = `upload_approval_${userId}`;
            const approval = await env.MODS_KV.get(approvalKey);
            return approval === 'approved';
        } catch (e) {
            // If KV read fails, deny permission
            return false;
        }
    }
    
    return false;
}

/**
 * Approve user for uploads
 * Only super admins can approve users
 */
export async function approveUserUpload(userId: string, email: string, env: Env): Promise<void> {
    if (!env.MODS_KV) {
        throw new Error('MODS_KV not available');
    }
    
    const approvalKey = `upload_approval_${userId}`;
    await env.MODS_KV.put(approvalKey, 'approved', {
        metadata: {
            approvedAt: new Date().toISOString(),
            email: email.toLowerCase(),
        }
    });
    
    // Also add to approved users list for easy lookup
    const approvedListKey = 'approved_uploaders';
    const existingList = await env.MODS_KV.get(approvedListKey, { type: 'json' }) as string[] | null;
    const updatedList = [...(existingList || []), userId].filter((id, index, arr) => arr.indexOf(id) === index);
    await env.MODS_KV.put(approvedListKey, JSON.stringify(updatedList));
}

/**
 * Revoke user upload permission
 * Only super admins can revoke permissions
 */
export async function revokeUserUpload(userId: string, env: Env): Promise<void> {
    if (!env.MODS_KV) {
        throw new Error('MODS_KV not available');
    }
    
    const approvalKey = `upload_approval_${userId}`;
    await env.MODS_KV.delete(approvalKey);
    
    // Remove from approved users list
    const approvedListKey = 'approved_uploaders';
    const existingList = await env.MODS_KV.get(approvedListKey, { type: 'json' }) as string[] | null;
    if (existingList) {
        const updatedList = existingList.filter(id => id !== userId);
        await env.MODS_KV.put(approvedListKey, JSON.stringify(updatedList));
    }
}

/**
 * Get list of approved uploaders
 */
export async function getApprovedUploaders(env: Env): Promise<string[]> {
    if (!env.MODS_KV) {
        return [];
    }
    
    try {
        const approvedListKey = 'approved_uploaders';
        const list = await env.MODS_KV.get(approvedListKey, { type: 'json' }) as string[] | null;
        return list || [];
    } catch (e) {
        return [];
    }
}

interface Env {
    SUPER_ADMIN_EMAILS?: string;
    MODS_KV?: KVNamespace;
    [key: string]: any;
}

