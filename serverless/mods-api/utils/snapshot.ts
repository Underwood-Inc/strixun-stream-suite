/**
 * Snapshot utilities
 * Creates SHA-verified snapshots of mod metadata
 */

import { calculateStrixunHash } from './hash.js';
import type { ModMetadata, ModSnapshot } from '../types/mod.js';
import type { ModSnapshot as SnapshotType } from '../types/snapshot.js';

/**
 * Generate a unique snapshot ID
 */
export function generateSnapshotId(): string {
    return `snapshot_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Create a snapshot of mod metadata with SHA verification
 * 
 * @param mod - Mod metadata to snapshot
 * @param createdBy - customer ID who created the snapshot
 * @param createdByDisplayName - Display name of user (never use email)
 * @param env - Environment with FILE_INTEGRITY_KEYPHRASE
 * @returns ModSnapshot with SHA-verified hash
 */
export async function createModSnapshot(
    mod: ModMetadata,
    createdBy: string,
    createdByDisplayName: string | null | undefined,
    env?: { FILE_INTEGRITY_KEYPHRASE?: string }
): Promise<SnapshotType> {
    const snapshotId = generateSnapshotId();
    const createdAt = new Date().toISOString();
    
    // Create snapshot data (exclude snapshot-specific fields from mod data)
    const snapshotData: ModMetadata = {
        ...mod,
        // Ensure we're snapshotting the current state
        updatedAt: createdAt, // Use snapshot creation time as updatedAt for the snapshot
    };
    
    // Calculate SHA-256 hash of the snapshot data
    // Serialize mod data to JSON for hashing
    const snapshotJson = JSON.stringify(snapshotData, null, 0); // Compact JSON for consistent hashing
    const snapshotBytes = new TextEncoder().encode(snapshotJson);
    const snapshotHash = await calculateStrixunHash(snapshotBytes, env);
    
    // Create snapshot
    const snapshot: SnapshotType = {
        snapshotId,
        modId: mod.modId,
        snapshotHash,
        modData: snapshotData,
        createdAt,
        createdBy,
        createdByDisplayName: createdByDisplayName || null,
    };
    
    return snapshot;
}

/**
 * Verify a snapshot's integrity
 * 
 * @param snapshot - Snapshot to verify
 * @param env - Environment with FILE_INTEGRITY_KEYPHRASE
 * @returns True if snapshot is valid, false otherwise
 */
export async function verifySnapshot(
    snapshot: SnapshotType,
    env?: { FILE_INTEGRITY_KEYPHRASE?: string }
): Promise<boolean> {
    try {
        // Recalculate hash from snapshot data
        const snapshotJson = JSON.stringify(snapshot.modData, null, 0);
        const snapshotBytes = new TextEncoder().encode(snapshotJson);
        const calculatedHash = await calculateStrixunHash(snapshotBytes, env);
        
        // Compare hashes (case-insensitive)
        return calculatedHash.toLowerCase() === snapshot.snapshotHash.toLowerCase();
    } catch (error) {
        console.error('Snapshot verification error:', error);
        return false;
    }
}

