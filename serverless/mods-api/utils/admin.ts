/**
 * Admin utilities for mods API
 * Handles super-admin authentication and upload permissions
 * 
 * Three-tier permission system:
 * 1. Super Admins: From SUPER_ADMIN_EMAILS env var (full admin access + upload permission)
 * 2. Approved Uploaders (Env): From APPROVED_UPLOADER_EMAILS env var (upload permission ONLY, NO admin access)
 *    - This is a hardcoded backup list in case the admin dashboard UI is broken
 * 3. Approved Uploaders (KV): Stored in KV, managed via admin dashboard UI (upload permission ONLY, NO admin access)
 * 
 * IMPORTANT: Only SUPER_ADMIN_EMAILS grants admin dashboard access.
 * APPROVED_UPLOADER_EMAILS and KV approvals grant upload permission ONLY.
 */

/**
 * Get list of super admin emails from environment
 * Uses SUPER_ADMIN_EMAILS environment variable (comma-separated list)
 * 
 * NOTE: This serves as a hardcoded backup list in case the admin dashboard UI
 * is broken or inaccessible. Super admins have full access + automatic upload permission.
 */
export async function getSuperAdminEmails(env: Env): Promise<string[]> {
    // Check environment variable (comma-separated list)
    // This is the primary source and serves as a backup if UI is broken
    if (env.SUPER_ADMIN_EMAILS) {
        return env.SUPER_ADMIN_EMAILS.split(',').map(email => email.trim().toLowerCase());
    }
    
    // Fallback: Check KV for super admin list (secondary backup)
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
    
    // Normalize email (trim and lowercase) to match how super admin emails are stored
    const normalizedEmail = email.trim().toLowerCase();
    const adminEmails = await getSuperAdminEmails(env);
    return adminEmails.includes(normalizedEmail);
}

/**
 * Get list of approved uploader emails from environment
 * Uses APPROVED_UPLOADER_EMAILS environment variable (comma-separated list)
 * 
 * NOTE: This is a hardcoded backup list in case the admin dashboard UI is broken.
 * These users get upload permission ONLY - they do NOT get admin dashboard access.
 * This is separate from SUPER_ADMIN_EMAILS which grants both admin access and upload permission.
 */
export async function getApprovedUploaderEmails(env: Env): Promise<string[]> {
    // Check environment variable (comma-separated list)
    if (env.APPROVED_UPLOADER_EMAILS) {
        return env.APPROVED_UPLOADER_EMAILS.split(',').map(email => email.trim().toLowerCase());
    }
    
    return [];
}

/**
 * Check if an email is an approved uploader (from env var)
 * These users have upload permission ONLY - NO admin dashboard access
 */
export async function isApprovedUploaderEmail(email: string | undefined, env: Env): Promise<boolean> {
    if (!email) return false;
    
    const approvedEmails = await getApprovedUploaderEmails(env);
    return approvedEmails.includes(email.toLowerCase());
}

/**
 * Check if user has upload permission
 * 
 * Three sources checked in order:
 * 1. Super admins (SUPER_ADMIN_EMAILS) - always have permission + admin access
 * 2. Approved uploaders from env (APPROVED_UPLOADER_EMAILS) - upload permission ONLY, NO admin access
 * 3. Approved uploaders from KV (managed via admin dashboard) - upload permission ONLY, NO admin access
 */
export async function hasUploadPermission(userId: string, email: string | undefined, env: Env): Promise<boolean> {
    // Tier 1: Super admins always have permission (also have admin dashboard access)
    if (email && await isSuperAdminEmail(email, env)) {
        return true;
    }
    
    // Tier 2: Check approved uploaders from env var (upload permission ONLY, NO admin access)
    if (email && await isApprovedUploaderEmail(email, env)) {
        return true;
    }
    
    // Tier 3: Check if user has explicit approval stored in KV (upload permission ONLY, NO admin access)
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
 * Approve user for uploads (adds to approved uploaders list)
 * Only super admins can approve users (via admin dashboard or API)
 * 
 * This grants upload permission to regular users (not super admins).
 * Super admins don't need approval - they get permission automatically from SUPER_ADMIN_EMAILS.
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
 * Get list of approved uploaders (from KV only)
 * Note: This doesn't include users from APPROVED_UPLOADER_EMAILS env var
 * Use getUserUploadPermissionInfo() for complete permission checking
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

/**
 * Get comprehensive upload permission info for a user
 * Checks all three permission sources and returns detailed info
 * 
 * This is useful for admin dashboard UI to show accurate permission status
 */
export async function getUserUploadPermissionInfo(
    userId: string,
    email: string | undefined,
    env: Env
): Promise<{
    hasPermission: boolean;
    isSuperAdmin: boolean;
    isApprovedUploader: boolean;
    permissionSource: 'super-admin' | 'env-var' | 'kv' | 'none';
    email?: string; // Email from metadata if available
}> {
    // Try to get email from KV approval metadata if not provided
    let userEmail = email;
    if (!userEmail && env.MODS_KV) {
        try {
            const approvalKey = `upload_approval_${userId}`;
            const approvalData = await env.MODS_KV.get(approvalKey, { type: 'json' }) as { 
                metadata?: { email?: string } 
            } | null;
            if (approvalData?.metadata?.email) {
                userEmail = approvalData.metadata.email;
            }
        } catch (e) {
            // Continue without email
        }
    }
    
    // Check super admin (Tier 1)
    if (userEmail && await isSuperAdminEmail(userEmail, env)) {
        return {
            hasPermission: true,
            isSuperAdmin: true,
            isApprovedUploader: false,
            permissionSource: 'super-admin',
            email: userEmail,
        };
    }
    
    // Check approved uploader from env var (Tier 2)
    if (userEmail && await isApprovedUploaderEmail(userEmail, env)) {
        return {
            hasPermission: true,
            isSuperAdmin: false,
            isApprovedUploader: true,
            permissionSource: 'env-var',
            email: userEmail,
        };
    }
    
    // Check KV approval (Tier 3)
    if (env.MODS_KV) {
        try {
            const approvalKey = `upload_approval_${userId}`;
            const approval = await env.MODS_KV.get(approvalKey);
            if (approval === 'approved') {
                // Get email from metadata if available
                const approvalData = await env.MODS_KV.get(approvalKey, { type: 'json' }) as { 
                    metadata?: { email?: string } 
                } | null;
                const emailFromMetadata = approvalData?.metadata?.email;
                
                return {
                    hasPermission: true,
                    isSuperAdmin: false,
                    isApprovedUploader: true,
                    permissionSource: 'kv',
                    email: emailFromMetadata || userEmail,
                };
            }
        } catch (e) {
            // Continue
        }
    }
    
    return {
        hasPermission: false,
        isSuperAdmin: false,
        isApprovedUploader: false,
        permissionSource: 'none',
        email: userEmail,
    };
}

interface Env {
    SUPER_ADMIN_EMAILS?: string;
    APPROVED_UPLOADER_EMAILS?: string;
    MODS_KV?: KVNamespace;
    [key: string]: any;
}

