/**
 * Mod snapshot types
 * Snapshots are SHA-verified copies of mod metadata at a specific point in time
 */

import type { ModMetadata } from './mod.js';

/**
 * Mod snapshot - immutable copy of mod metadata at a point in time
 */
export interface ModSnapshot {
    snapshotId: string;
    modId: string;
    snapshotHash: string; // SHA-256 hash of the snapshot data (Strixun verified)
    modData: ModMetadata; // Full mod metadata at time of snapshot
    createdAt: string; // When snapshot was created
    createdBy: string; // customer ID who created the snapshot
    createdByDisplayName?: string | null; // Display name (never use email)
    // CRITICAL: createdByEmail is NOT stored - email is ONLY for OTP authentication
}

/**
 * Snapshot list response
 */
export interface ModSnapshotListResponse {
    snapshots: ModSnapshot[];
    total: number;
}

/**
 * Create snapshot request
 */
export interface CreateSnapshotRequest {
    modId: string;
    reason?: string; // Optional reason for creating snapshot
}

