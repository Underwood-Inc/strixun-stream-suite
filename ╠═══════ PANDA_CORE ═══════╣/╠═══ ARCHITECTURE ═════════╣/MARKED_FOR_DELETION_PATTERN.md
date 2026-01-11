# Marked-for-Deletion Pattern for Cloudflare Workers

**Status:** Production Architecture Pattern  
**Scope:** All Cloudflare Workers Services  
**Purpose:** Transaction-like behavior for R2/KV operations without native ACID support  

---

## Executive Summary

Cloudflare Workers do not support traditional ACID transactions. This document describes the **Marked-for-Deletion Pattern** - a battle-tested approach for implementing transaction-like behavior in serverless edge environments where immediate deletion is risky and rollbacks are complex.

**Key Benefits:**
- ✅ Grace period for accidental deletions (default: 5 days)
- ✅ Atomic-like operations via two-phase commit
- ✅ Automatic cleanup via scheduled workers
- ✅ Audit trail for compliance
- ✅ Cost-effective (mark operations are free, deletes are batched)
- ✅ No blocking operations (eventual consistency)

---

## The Problem: No Native Transactions

### Cloudflare Workers Limitations

```typescript
// ❌ THIS DOESN'T EXIST IN CLOUDFLARE WORKERS:
await env.KV.transaction(async (tx) => {
    await tx.put('key1', 'value1');
    await tx.put('key2', 'value2');
    await tx.delete('key3');
}); // Rollback on error
```

**Reality:**
- Each KV/R2 operation is atomic individually
- No multi-operation transactions
- No rollback support
- Partial failures leave inconsistent state
- Immediate deletions are permanent

### Real-World Failure Scenario

```typescript
// ❌ BROKEN - Partial state on failure:
async function updateResource(id: string) {
    // Step 1: Upload new file
    await env.R2.put(newFileKey, fileData); // ✅ SUCCESS
    
    // Step 2: Delete old file
    await env.R2.delete(oldFileKey); // ✅ SUCCESS
    
    // Step 3: Update KV metadata
    await env.KV.put(metadataKey, metadata); // ❌ FAILS
    
    // PROBLEM: New file exists, old file deleted, but KV not updated
    // SYSTEM IS NOW IN INCONSISTENT STATE!
}
```

---

## The Solution: Marked-for-Deletion Pattern

### Core Concept

Instead of immediately deleting resources, **mark them for deletion** and clean them up later via scheduled worker.

```typescript
// ✅ CORRECT - Safe, recoverable, transaction-like:
async function updateResource(id: string) {
    // Step 1: Upload new file
    await env.R2.put(newFileKey, fileData);
    
    // Step 2: MARK old file for deletion (don't delete)
    await markR2FileForDeletion(env.R2, oldFileKey);
    
    // Step 3: Update KV metadata
    await env.KV.put(metadataKey, metadata);
    
    // If Step 3 fails:
    // - New file exists (can be cleaned up)
    // - Old file still exists (marked, recoverable)
    // - System remains consistent
}
```

### Two-Phase Commit Pattern

```typescript
// PHASE 1: Perform operations, track results
interface OperationResult {
    id: string;
    success: boolean;
    resourceKey?: string;
    error?: string;
}

const results: OperationResult[] = [];

for (const item of items) {
    try {
        const key = await performOperation(item);
        results.push({ id: item.id, success: true, resourceKey: key });
    } catch (error) {
        results.push({ id: item.id, success: false, error: error.message });
        
        // ROLLBACK: Mark successful operations for deletion
        for (const successfulResult of results.filter(r => r.success)) {
            await markR2FileForDeletion(env.R2, successfulResult.resourceKey);
            await env.KV.delete(successfulResult.id);
        }
        
        throw error; // Abort transaction
    }
}

// PHASE 2: All operations succeeded - commit metadata
await commitMetadata(results);
```

---

## Implementation

### 1. Mark File for Deletion

```typescript
/**
 * Mark an R2 file for deletion
 * File will be permanently deleted by cron job after grace period
 */
export async function markR2FileForDeletion(
    r2Bucket: R2Bucket,
    fileKey: string,
    timestamp?: number
): Promise<boolean> {
    try {
        // Get current file and metadata
        const file = await r2Bucket.get(fileKey);
        if (!file) return false;
        
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
        
        console.log('[Deletion] Marked file:', {
            key: fileKey,
            willDeleteAfter: new Date((timestamp || Date.now()) + GRACE_PERIOD_MS).toISOString()
        });
        
        return true;
    } catch (error) {
        console.error('[Deletion] Failed to mark file:', error);
        return false;
    }
}
```

### 2. Scheduled Cleanup Worker

```typescript
/**
 * R2 Cleanup Cron Handler
 * Runs on schedule to permanently delete marked files
 */
const GRACE_PERIOD_DAYS = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function handleScheduledCleanup(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
): Promise<void> {
    const cutoffTime = Date.now() - (GRACE_PERIOD_DAYS * MS_PER_DAY);
    
    let cursor: string | undefined;
    let totalDeleted = 0;
    
    do {
        const listResult = await env.R2.list({ cursor });
        
        for (const object of listResult.objects) {
            const markedForDeletion = object.customMetadata?.marked_for_deletion === 'true';
            const markedOn = parseInt(object.customMetadata?.marked_for_deletion_on || '0', 10);
            
            if (markedForDeletion && markedOn <= cutoffTime) {
                await env.R2.delete(object.key);
                totalDeleted++;
                console.log('[Cleanup] Deleted:', object.key);
            }
        }
        
        cursor = listResult.truncated ? listResult.cursor : undefined;
    } while (cursor);
    
    console.log('[Cleanup] Complete. Deleted:', totalDeleted);
}
```

### 3. Wrangler Configuration

```toml
# wrangler.toml
name = "my-worker"
main = "worker.ts"
compatibility_date = "2024-01-01"

# Scheduled cleanup - runs daily at 2 AM UTC
[triggers]
crons = ["0 2 * * *"]
```

### 4. Worker Export

```typescript
// worker.ts
export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        return handleRequest(request, env, ctx);
    },
    
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        await handleScheduledCleanup(event, env, ctx);
    },
};
```

---

## Best Practices

### ✅ DO

1. **Always Mark Before Deleting**
   ```typescript
   // ✅ GOOD
   await markR2FileForDeletion(env.R2, oldFileKey);
   await env.KV.put(newKey, newData);
   ```

2. **Use Grace Periods**
   - Minimum: 1 day (for accidental deletions)
   - Recommended: 5-7 days (standard practice)
   - Maximum: 30 days (compliance/audit requirements)

3. **Log All Marking Operations**
   ```typescript
   console.log('[Deletion] Marked:', {
       key: fileKey,
       reason: 'rollback',
       markedOn: new Date().toISOString(),
       willDeleteAfter: new Date(Date.now() + GRACE_PERIOD_MS).toISOString()
   });
   ```

4. **Implement Recovery Mechanism**
   ```typescript
   async function unmarkFile(fileKey: string): Promise<boolean> {
       const file = await env.R2.get(fileKey);
       if (!file) return false;
       
       const { marked_for_deletion, marked_for_deletion_on, ...cleanMetadata } = 
           file.customMetadata || {};
       
       await env.R2.put(fileKey, await file.arrayBuffer(), {
           httpMetadata: file.httpMetadata,
           customMetadata: cleanMetadata,
       });
       
       return true;
   }
   ```

5. **Batch Operations in Cleanup**
   ```typescript
   // Process files in batches to avoid timeouts
   const BATCH_SIZE = 100;
   let processed = 0;
   
   for (const object of objects) {
       if (shouldDelete(object)) {
           await env.R2.delete(object.key);
           processed++;
           
           if (processed % BATCH_SIZE === 0) {
               // Log progress every batch
               console.log(`[Cleanup] Progress: ${processed}/${total}`);
           }
       }
   }
   ```

### ❌ DON'T

1. **Don't Delete Immediately in User Operations**
   ```typescript
   // ❌ BAD - Permanent, no recovery
   await env.R2.delete(oldFileKey);
   ```

2. **Don't Skip Logging**
   ```typescript
   // ❌ BAD - No audit trail
   await markR2FileForDeletion(env.R2, fileKey);
   // No log!
   ```

3. **Don't Use Arbitrary Grace Periods**
   ```typescript
   // ❌ BAD - Too short for recovery
   const GRACE_PERIOD_MS = 60 * 1000; // 1 minute
   ```

4. **Don't Forget Error Handling**
   ```typescript
   // ❌ BAD - Silent failures
   await markR2FileForDeletion(env.R2, fileKey);
   // No try/catch!
   ```

---

## Advanced Patterns

### Pattern 1: Rollback with Marking

```typescript
async function transactionalUpdate(items: Item[]): Promise<void> {
    const uploadedFiles: string[] = [];
    
    try {
        // Phase 1: Upload new files
        for (const item of items) {
            const key = await uploadFile(item);
            uploadedFiles.push(key);
        }
        
        // Phase 2: Update metadata (might fail)
        await updateMetadata(items);
        
        // Success - mark old files for deletion
        for (const item of items) {
            if (item.oldFileKey) {
                await markR2FileForDeletion(env.R2, item.oldFileKey);
            }
        }
        
    } catch (error) {
        // Rollback: Mark newly uploaded files for deletion
        for (const fileKey of uploadedFiles) {
            await markR2FileForDeletion(env.R2, fileKey);
        }
        throw error;
    }
}
```

### Pattern 2: Soft Delete with TTL

```typescript
// Mark files with custom TTL
async function markWithCustomTTL(
    fileKey: string,
    ttlDays: number,
    reason: string
): Promise<void> {
    const file = await env.R2.get(fileKey);
    if (!file) return;
    
    const deleteAfter = Date.now() + (ttlDays * 24 * 60 * 60 * 1000);
    
    await env.R2.put(fileKey, await file.arrayBuffer(), {
        httpMetadata: file.httpMetadata,
        customMetadata: {
            ...file.customMetadata,
            marked_for_deletion: 'true',
            marked_for_deletion_on: Date.now().toString(),
            delete_after: deleteAfter.toString(),
            deletion_reason: reason,
        },
    });
}
```

### Pattern 3: Conditional Deletion

```typescript
// Only delete if not referenced
async function safeDelete(fileKey: string): Promise<boolean> {
    // Check if file is still referenced
    const references = await findReferences(fileKey);
    
    if (references.length > 0) {
        console.log('[Deletion] File still referenced, skipping:', {
            key: fileKey,
            references: references.length
        });
        return false;
    }
    
    // Safe to mark for deletion
    await markR2FileForDeletion(env.R2, fileKey);
    return true;
}
```

---

## Monitoring & Observability

### Key Metrics

```typescript
// Track in your cleanup job
interface CleanupMetrics {
    totalScanned: number;
    totalMarked: number;
    totalDeleted: number;
    totalErrors: number;
    avgAgeInDays: number;
    oldestMarkedFile: string;
    largestFile: number;
}

// Log metrics for monitoring
console.log('[Cleanup] Metrics:', metrics);
```

### Alerting Thresholds

```typescript
// Alert if cleanup is falling behind
if (metrics.totalMarked > 10000) {
    await sendAlert('High marked file count', metrics);
}

// Alert if oldest marked file exceeds grace period + buffer
const maxAge = GRACE_PERIOD_DAYS + 2;
if (metrics.avgAgeInDays > maxAge) {
    await sendAlert('Cleanup falling behind', metrics);
}
```

---

## Testing

### Unit Tests

```typescript
describe('Marked-for-Deletion Pattern', () => {
    test('should mark file for deletion', async () => {
        const result = await markR2FileForDeletion(mockR2, 'test-file.txt');
        expect(result).toBe(true);
        
        const file = await mockR2.get('test-file.txt');
        expect(file.customMetadata.marked_for_deletion).toBe('true');
        expect(file.customMetadata.marked_for_deletion_on).toBeTruthy();
    });
    
    test('should rollback on failure', async () => {
        const uploadedFiles: string[] = [];
        
        try {
            uploadedFiles.push(await uploadFile('file1'));
            uploadedFiles.push(await uploadFile('file2'));
            throw new Error('Simulated failure');
        } catch {
            for (const key of uploadedFiles) {
                await markR2FileForDeletion(mockR2, key);
            }
        }
        
        // Verify files are marked
        for (const key of uploadedFiles) {
            const file = await mockR2.get(key);
            expect(file.customMetadata.marked_for_deletion).toBe('true');
        }
    });
});
```

### Integration Tests

```typescript
test('should cleanup files after grace period', async () => {
    // Mark file with old timestamp
    const oldTimestamp = Date.now() - (6 * 24 * 60 * 60 * 1000); // 6 days ago
    await markR2FileForDeletion(mockR2, 'old-file.txt', oldTimestamp);
    
    // Run cleanup
    await handleScheduledCleanup(mockEvent, mockEnv, mockCtx);
    
    // Verify file is deleted
    const file = await mockR2.get('old-file.txt');
    expect(file).toBeNull();
});
```

---

## Migration Guide

### From Immediate Deletion

**Before:**
```typescript
// Old code with immediate deletion
await env.R2.delete(oldFileKey);
await env.KV.put(newKey, newData);
```

**After:**
```typescript
// New code with marked-for-deletion
await markR2FileForDeletion(env.R2, oldFileKey);
await env.KV.put(newKey, newData);
```

### Adding Cleanup Worker

1. Create cleanup handler: `handlers/scheduled/cleanup.ts`
2. Add cron configuration to `wrangler.toml`
3. Export scheduled handler in `worker.ts`
4. Deploy: `wrangler deploy`
5. Verify: Check Cloudflare dashboard for cron executions

---

## Real-World Examples

### Example 1: Mods API Variant Upload with Rollback

**File:** `serverless/mods-api/handlers/mods/update.ts`

```typescript
// Two-phase commit with rollback
const uploadResults: UploadResult[] = [];

for (const variant of variants) {
    try {
        const versionId = await uploadVariantFile(variant);
        uploadResults.push({ variantId: variant.id, versionId, success: true });
    } catch (error) {
        // ROLLBACK: Mark successful uploads for deletion
        for (const result of uploadResults.filter(r => r.success)) {
            const version = await env.KV.get(`version_${result.versionId}`);
            if (version?.r2Key) {
                await markR2FileForDeletion(env.R2, version.r2Key);
            }
            await env.KV.delete(`version_${result.versionId}`);
        }
        throw error;
    }
}

// All succeeded - update metadata
await updateModMetadata(uploadResults);
```

**File:** `serverless/mods-api/handlers/admin/r2-cleanup.ts`

Full working implementation with:
- 5-day grace period
- Comprehensive logging
- Error handling
- Progress tracking
- Metrics collection

---

## FAQ

### Q: Why not delete immediately?

**A:** Immediate deletion is permanent. Marking provides:
- Recovery window for accidents
- Time to verify references
- Audit trail for compliance
- Batched deletion (cost-effective)

### Q: What if cleanup job fails?

**A:** Files remain marked until next run. Cron retries automatically. Manual trigger available via admin API.

### Q: How to recover marked files?

**A:** Use `unmarkR2FileForDeletion()` within grace period. File remains intact until permanent deletion.

### Q: Performance impact?

**A:** Minimal. Marking is metadata update (fast). Cleanup runs off-hours. No user-facing latency.

### Q: Storage costs?

**A:** Negligible. Files stored max 5-7 days extra. Batch deletion reduces API costs.

---

## Conclusion

The **Marked-for-Deletion Pattern** is production-ready architecture for Cloudflare Workers that provides transaction-like behavior without native ACID support. It's battle-tested, cost-effective, and recoverable.

**Key Takeaways:**
- ✅ Mark files, don't delete immediately
- ✅ Implement scheduled cleanup with grace period
- ✅ Use two-phase commit for atomic-like operations
- ✅ Always log operations for audit trail
- ✅ Provide recovery mechanism
- ✅ Monitor cleanup metrics

**Adoption Status:**
- Mods API: ✅ Production
- OTP Auth Service: ⏳ Planned
- Customer API: ⏳ Planned

---

**Last Updated:** 2026-01-11  
**Version:** 1.0.0  
**Maintainer:** Strixun Platform Team  
**Status:** Production-Ready Architecture Pattern
