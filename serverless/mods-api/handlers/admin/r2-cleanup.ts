/**
 * R2 Cleanup Cron Handler
 * Scheduled job to permanently delete files marked for deletion after 5 days
 * 
 * Runs on a cron schedule (configured in wrangler.toml)
 * Deletes files that have:
 * - marked_for_deletion: true
 * - marked_for_deletion_on: timestamp (5+ days ago)
 */

import { getR2SourceInfo } from '../../utils/r2-source.js';
import { createCORSHeaders } from '@strixun/api-framework/enhanced';
import { createError } from '../../utils/errors.js';

/**
 * Number of days to wait before permanently deleting marked files
 */
const DELETION_GRACE_PERIOD_DAYS = 5;

/**
 * Milliseconds in a day
 */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Handle scheduled cleanup event
 * Called by Cloudflare Workers cron trigger
 */
export async function handleR2Cleanup(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
): Promise<void> {
    await executeR2Cleanup(env, ctx);
}

/**
 * Execute R2 cleanup logic
 * Can be called from cron job or manually via admin endpoint
 */
export async function executeR2Cleanup(
    env: Env,
    ctx?: ExecutionContext
): Promise<{ scanned: number; marked: number; deleted: number; errors: number }> {
    console.log('[R2Cleanup] Starting cleanup job...');
    const startTime = Date.now();
    
    try {
        const r2SourceInfo = getR2SourceInfo(env, new Request('https://internal'));
        console.log('[R2Cleanup] R2 storage source:', r2SourceInfo);
        
        let cursor: string | undefined;
        let totalScanned = 0;
        let totalMarked = 0;
        let totalDeleted = 0;
        let totalErrors = 0;
        const errors: Array<{ key: string; error: string }> = [];
        
        const cutoffTime = Date.now() - (DELETION_GRACE_PERIOD_DAYS * MS_PER_DAY);
        console.log('[R2Cleanup] Cutoff time:', new Date(cutoffTime).toISOString());
        
        do {
            // List R2 files in batches
            const listResult = await env.MODS_R2.list({
                limit: 1000,
                cursor,
            });
            
            for (const object of listResult.objects) {
                totalScanned++;
                
                // Check if file is marked for deletion
                const markedForDeletion = object.customMetadata?.marked_for_deletion === 'true';
                const markedForDeletionOn = object.customMetadata?.marked_for_deletion_on;
                
                if (markedForDeletion && markedForDeletionOn) {
                    totalMarked++;
                    
                    // Parse timestamp
                    const deletionTimestamp = parseInt(markedForDeletionOn, 10);
                    if (isNaN(deletionTimestamp)) {
                        console.warn('[R2Cleanup] Invalid timestamp for file:', object.key, markedForDeletionOn);
                        continue;
                    }
                    
                    // Check if grace period has passed
                    if (deletionTimestamp <= cutoffTime) {
                        try {
                            // Permanently delete the file
                            await env.MODS_R2.delete(object.key);
                            totalDeleted++;
                            console.log('[R2Cleanup] Deleted file:', object.key, 'marked on:', new Date(deletionTimestamp).toISOString());
                        } catch (error: any) {
                            totalErrors++;
                            const errorMsg = error.message || String(error);
                            errors.push({ key: object.key, error: errorMsg });
                            console.error('[R2Cleanup] Failed to delete file:', object.key, errorMsg);
                        }
                    } else {
                        const daysRemaining = Math.ceil((deletionTimestamp - Date.now()) / MS_PER_DAY);
                        console.log('[R2Cleanup] File still in grace period:', object.key, `${daysRemaining} days remaining`);
                    }
                }
            }
            
            cursor = listResult.truncated ? listResult.cursor : undefined;
            
            // Log progress every 1000 files
            if (totalScanned % 1000 === 0) {
                console.log('[R2Cleanup] Progress:', {
                    scanned: totalScanned,
                    marked: totalMarked,
                    deleted: totalDeleted,
                    errors: totalErrors,
                });
            }
        } while (cursor);
        
        const duration = Date.now() - startTime;
        console.log('[R2Cleanup] Cleanup job completed:', {
            duration: `${duration}ms`,
            scanned: totalScanned,
            marked: totalMarked,
            deleted: totalDeleted,
            errors: totalErrors,
            errorsList: errors.length > 0 ? errors.slice(0, 10) : undefined, // Log first 10 errors
        });
        
        // If there were errors, we could send them to a monitoring service
        // For now, just log them
        if (totalErrors > 0) {
            console.error('[R2Cleanup] Errors encountered:', errors);
        }
    } catch (error: any) {
        console.error('[R2Cleanup] Fatal error in cleanup job:', error);
        throw error; // Re-throw to mark cron job as failed
    }
}

interface Env {
    MODS_R2: R2Bucket;
    ENVIRONMENT?: string;
    [key: string]: any;
}

interface ScheduledEvent {
    scheduledTime: number;
    cron: string;
    noRetry: () => void;
}
