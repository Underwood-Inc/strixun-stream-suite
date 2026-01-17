/**
 * Integrity Verification
 * 
 * Cryptographic integrity utilities for P2P storage:
 * - SHA-256 hashing
 * - HMAC-SHA256 signatures
 * - Merkle tree roots
 * - Gap detection
 * - Integrity scoring
 */

import type { 
  Block, 
  GapRange, 
  GapReason, 
  ChainState, 
  IntegrityStatus,
  IntegrityInfo,
  Chunk,
} from './types.js';

// ============ Constants ============

export const CHUNK_SIZE = 100;

// ============ Hash Utilities ============

/**
 * Generate SHA-256 hash of data
 */
export async function generateHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate HMAC-SHA256 signature
 */
export async function generateSignature(
  data: string,
  secretKey: string
): Promise<string> {
  const encoder = new TextEncoder();
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(data)
  );
  
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify HMAC-SHA256 signature
 */
export async function verifySignature(
  data: string,
  signature: string,
  secretKey: string
): Promise<boolean> {
  const expected = await generateSignature(data, secretKey);
  return expected === signature;
}

/**
 * Generate block hash from data and chain metadata
 */
export async function generateBlockHash<T>(
  data: T,
  previousHash: string | null,
  blockNumber: number
): Promise<string> {
  const canonical = JSON.stringify({
    data,
    previousHash,
    blockNumber,
  });
  return generateHash(canonical);
}

// ============ Merkle Tree ============

/**
 * Calculate Merkle root from block hashes
 */
export async function calculateMerkleRoot(hashes: string[]): Promise<string> {
  if (hashes.length === 0) return '';
  if (hashes.length === 1) return hashes[0];
  
  let level = [...hashes];
  
  while (level.length > 1) {
    const nextLevel: string[] = [];
    
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] || left;
      const combined = left + right;
      nextLevel.push(await generateHash(combined));
    }
    
    level = nextLevel;
  }
  
  return level[0];
}

/**
 * Verify a batch of blocks against a Merkle root
 */
export async function verifyMerkleRoot(
  blocks: Block[],
  expectedRoot: string
): Promise<boolean> {
  const hashes = blocks.map(b => b.blockHash);
  const actualRoot = await calculateMerkleRoot(hashes);
  return actualRoot === expectedRoot;
}

// ============ Gap Detection ============

/**
 * Detect gaps in block sequence
 */
export function detectGaps(
  blocks: Block[],
  expectedEnd: number
): GapRange[] {
  if (blocks.length === 0) {
    if (expectedEnd > 0) {
      return [{
        start: 0,
        end: expectedEnd,
        reasons: ['late_join'],
        detectedAt: Date.now(),
      }];
    }
    return [];
  }
  
  const sorted = [...blocks].sort((a, b) => a.blockNumber - b.blockNumber);
  const gaps: GapRange[] = [];
  
  // Check for gap at start
  if (sorted[0].blockNumber > 0) {
    gaps.push({
      start: 0,
      end: sorted[0].blockNumber - 1,
      reasons: ['late_join'],
      detectedAt: Date.now(),
    });
  }
  
  // Check for gaps between blocks
  for (let i = 1; i < sorted.length; i++) {
    const expected = sorted[i - 1].blockNumber + 1;
    const actual = sorted[i].blockNumber;
    
    if (actual > expected) {
      gaps.push({
        start: expected,
        end: actual - 1,
        reasons: determineGapReasons(expected, actual),
        detectedAt: Date.now(),
      });
    }
  }
  
  // Check for gap at end
  const lastBlock = sorted[sorted.length - 1].blockNumber;
  if (lastBlock < expectedEnd) {
    gaps.push({
      start: lastBlock + 1,
      end: expectedEnd,
      reasons: ['peer_offline', 'network_partition'],
      detectedAt: Date.now(),
    });
  }
  
  return gaps;
}

function determineGapReasons(start: number, end: number): GapReason[] {
  const size = end - start;
  const reasons: GapReason[] = [];
  
  if (size > CHUNK_SIZE) {
    reasons.push('network_partition');
  }
  if (size < 10) {
    reasons.push('peer_offline');
  }
  if (reasons.length === 0) {
    reasons.push('unknown');
  }
  
  return reasons;
}

/**
 * Get human-readable gap reason
 */
export function getGapReasonDescription(reason: GapReason): string {
  switch (reason) {
    case 'peer_offline':
      return 'Some peers were offline during this period';
    case 'network_partition':
      return 'Network connectivity issues prevented sync';
    case 'late_join':
      return 'You joined after these entries were created';
    case 'storage_corruption':
      return 'Local storage may have been corrupted';
    case 'sync_timeout':
      return 'Sync request timed out before completion';
    case 'unknown':
    default:
      return 'Unable to determine the cause';
  }
}

// ============ Integrity Scoring ============

/**
 * Calculate integrity score based on confirmations and gaps
 */
export function calculateIntegrityScore(
  chainState: ChainState,
  totalPeers: number
): { score: number; status: IntegrityStatus; description: string } {
  const peerCoverage = totalPeers > 0 ? chainState.peerCount / totalPeers : 0;
  
  const totalBlocks = chainState.latestBlock + 1;
  const gapBlocks = chainState.gaps.reduce((sum, gap) => sum + (gap.end - gap.start + 1), 0);
  const gapRatio = totalBlocks > 0 ? gapBlocks / totalBlocks : 0;
  const completeness = 1 - gapRatio;
  
  const score = Math.round((peerCoverage * 0.4 + completeness * 0.6) * 100);
  
  let status: IntegrityStatus;
  let description: string;
  
  if (score >= 90 && chainState.gaps.length === 0) {
    status = 'verified';
    description = 'Complete history verified across multiple peers';
  } else if (score >= 70) {
    status = 'partial';
    description = 'Most entries verified, some gaps may exist';
  } else if (score >= 40) {
    status = 'degraded';
    description = 'Significant gaps or limited peer coverage';
  } else {
    status = 'unverified';
    description = 'Unable to verify integrity';
  }
  
  return { score, status, description };
}

/**
 * Create integrity info for UI display
 */
export function createIntegrityInfo(
  chainState: ChainState,
  chunks: Chunk[],
  totalPeers: number
): IntegrityInfo {
  const { score, status, description } = calculateIntegrityScore(chainState, totalPeers);
  
  return {
    score,
    status,
    description,
    peerCount: chainState.peerCount,
    totalBlocks: chainState.latestBlock + 1,
    gaps: chainState.gaps,
    chunks,
  };
}
