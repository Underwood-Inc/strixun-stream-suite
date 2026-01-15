/**
 * R2 Deletion Utilities
 * Helper functions for marking R2 files for deletion
 * Files are marked with metadata and cleaned up by scheduled cron job after 5 days
 */

/**
 * Mark an R2 file for deletion
 * File will be permanently deleted by cron job after 5 days
 * 
 * @param r2Bucket - R2 bucket instance
 * @param fileKey - Key of file to mark for deletion
 * @param timestamp - Optional timestamp (defaults to now)
 * @returns true if marked successfully, false if file doesn't exist
 */
export async function markR2FileForDeletion(
    r2Bucket: R2Bucket,
    fileKey: string,
    timestamp?: number
): Promise<boolean> {
    try {
        // Get current file and metadata
        const file = await r2Bucket.get(fileKey);
        if (!file) {
            console.warn('[R2Deletion] File not found, cannot mark for deletion:', fileKey);
            return false;
        }
        
        const existingMetadata = file.customMetadata || {};
        const fileBody = await file.arrayBuffer();
        
        // Mark for deletion with timestamp
        await r2Bucket.put(fileKey, fileBody, {
            httpMetadata: file.httpMetadata,
            customMetadata: {
                ...existingMetadata,
                marked_for_deletion: 'true',
                marked_for_deletion_on: (timestamp || Date.now()).toString(),
            },
        });
        
        console.log('[R2Deletion] Marked file for deletion:', {
            key: fileKey,
            markedOn: new Date(timestamp || Date.now()).toISOString(),
            willDeleteAfter: new Date((timestamp || Date.now()) + (5 * 24 * 60 * 60 * 1000)).toISOString()
        });
        
        return true;
    } catch (error: any) {
        console.error('[R2Deletion] Failed to mark file for deletion:', {
            key: fileKey,
            error: error.message
        });
        return false;
    }
}

/**
 * Mark multiple R2 files for deletion
 * 
 * @param r2Bucket - R2 bucket instance
 * @param fileKeys - Array of file keys to mark for deletion
 * @param timestamp - Optional timestamp (defaults to now)
 * @returns Object with success/failure counts
 */
export async function markR2FilesForDeletion(
    r2Bucket: R2Bucket,
    fileKeys: string[],
    timestamp?: number
): Promise<{ marked: number; failed: number; notFound: number }> {
    let marked = 0;
    let failed = 0;
    let notFound = 0;
    
    for (const fileKey of fileKeys) {
        const result = await markR2FileForDeletion(r2Bucket, fileKey, timestamp);
        if (result) {
            marked++;
        } else {
            notFound++;
        }
    }
    
    console.log('[R2Deletion] Bulk mark operation complete:', {
        total: fileKeys.length,
        marked,
        failed,
        notFound
    });
    
    return { marked, failed, notFound };
}

/**
 * Unmark an R2 file for deletion (recovery)
 * Removes deletion markers from file metadata
 * 
 * @param r2Bucket - R2 bucket instance
 * @param fileKey - Key of file to unmark
 * @returns true if unmarked successfully, false if file doesn't exist
 */
export async function unmarkR2FileForDeletion(
    r2Bucket: R2Bucket,
    fileKey: string
): Promise<boolean> {
    try {
        // Get current file and metadata
        const file = await r2Bucket.get(fileKey);
        if (!file) {
            console.warn('[R2Deletion] File not found, cannot unmark:', fileKey);
            return false;
        }
        
        const existingMetadata = file.customMetadata || {};
        const fileBody = await file.arrayBuffer();
        
        // Remove deletion markers
        const { marked_for_deletion, marked_for_deletion_on, ...cleanMetadata } = existingMetadata;
        
        await r2Bucket.put(fileKey, fileBody, {
            httpMetadata: file.httpMetadata,
            customMetadata: cleanMetadata,
        });
        
        console.log('[R2Deletion] Unmarked file for deletion (recovered):', fileKey);
        
        return true;
    } catch (error: any) {
        console.error('[R2Deletion] Failed to unmark file:', {
            key: fileKey,
            error: error.message
        });
        return false;
    }
}
