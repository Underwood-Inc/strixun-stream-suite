/**
 * Upload quota tracking and enforcement
 * 
 * NEW: Now uses Authorization Service for quota management.
 * Quotas are role-based and configured in the Authorization Service.
 * 
 * @module upload-quota
 */

import { createAccessClient } from '../../shared/access-client.js';

interface Env {
    ACCESS_SERVICE_URL?: string;
    SERVICE_API_KEY?: string;
    [key: string]: any;
}

interface QuotaCheckResult {
    allowed: boolean;
    reason?: string;
    remaining: number;
    limit: number;
    resetAt: string;
}

/**
 * Check if customer has exceeded upload quota
 * Uses Authorization Service for quota enforcement
 * 
 * @param customerId - Customer ID
 * @param env - Environment
 * @param jwtToken - Optional JWT token for authentication
 * @returns Quota check result
 */
export async function checkUploadQuota(
    customerId: string,
    env: Env,
    jwtToken?: string
): Promise<QuotaCheckResult> {
    try {
        const access = createAccessClient(env, { jwtToken: jwtToken || undefined });
        const quotaResult = await access.checkQuota(customerId, 'upload:mod', 'mod');
        
        return {
            allowed: quotaResult.allowed,
            reason: quotaResult.reason,
            remaining: quotaResult.remaining,
            limit: quotaResult.limit,
            resetAt: quotaResult.resetAt,
        };
    } catch (error) {
        console.error('[UploadQuota] Failed to check quota:', error);
        // On error, deny (quota exceeded)
        return {
            allowed: false,
            reason: 'service_error',
            remaining: 0,
            limit: 0,
            resetAt: new Date().toISOString(),
        };
    }
}

/**
 * Track an upload (increment counters)
 * Should be called after a successful upload
 * 
 * @param customerId - Customer ID
 * @param env - Environment
 * @param jwtToken - Optional JWT token for authentication
 */
export async function trackUpload(customerId: string, env: Env, jwtToken?: string): Promise<void> {
    try {
        const access = createAccessClient(env, { jwtToken: jwtToken || undefined });
        await access.incrementQuota(customerId, 'upload:mod', 'mod');
        console.log('[UploadQuota] Tracked upload for customer:', customerId);
    } catch (error) {
        console.error('[UploadQuota] Failed to track upload:', error);
        // Don't throw - tracking failure shouldn't break the upload
    }
}
