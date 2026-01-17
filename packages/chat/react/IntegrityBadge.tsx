/**
 * Chat Integrity Badge Component
 * 
 * Displays the integrity status of the P2P message chain.
 * Uses @strixun/p2p-storage for integrity types.
 */

import { useState } from 'react';
import type { IntegrityInfo, IntegrityStatus, GapRange, GapReason } from '@strixun/p2p-storage';

// Re-export for convenience
export type { IntegrityInfo, IntegrityStatus, GapRange, GapReason };

/**
 * Get human-readable gap reason
 */
function getGapReasonDescription(reason: GapReason): string {
  switch (reason) {
    case 'peer_offline':
      return 'Some peers were offline during this period';
    case 'network_partition':
      return 'Network connectivity issues prevented sync';
    case 'late_join':
      return 'You joined after these messages were sent';
    case 'storage_corruption':
      return 'Local storage may have been corrupted';
    case 'sync_timeout':
      return 'Sync request timed out before completion';
    case 'unknown':
    default:
      return 'Unable to determine the cause';
  }
}

export interface IntegrityBadgeProps {
  integrityInfo: IntegrityInfo;
  peerCount?: number;
  showDetails?: boolean;
  className?: string;
}

const statusConfig: Record<IntegrityStatus, { 
  color: string; 
  bgColor: string; 
  icon: string;
  label: string;
}> = {
  verified: {
    color: 'var(--chat-success, #4caf50)',
    bgColor: 'rgba(76, 175, 80, 0.1)',
    icon: '✓',
    label: 'Verified',
  },
  partial: {
    color: 'var(--chat-warning, #ff9800)',
    bgColor: 'rgba(255, 152, 0, 0.1)',
    icon: '~',
    label: 'Partial',
  },
  degraded: {
    color: 'var(--chat-danger, #f44336)',
    bgColor: 'rgba(244, 67, 54, 0.1)',
    icon: '!',
    label: 'Degraded',
  },
  unverified: {
    color: 'var(--chat-text-muted, #808080)',
    bgColor: 'rgba(128, 128, 128, 0.1)',
    icon: '?',
    label: 'Unverified',
  },
};

export function IntegrityBadge({ 
  integrityInfo, 
  peerCount,
  showDetails = false,
  className = '' 
}: IntegrityBadgeProps) {
  const [expanded, setExpanded] = useState(false);
  const config = statusConfig[integrityInfo.status];
  
  // Use provided peerCount or fall back to integrityInfo.peerCount
  const displayPeerCount = peerCount ?? integrityInfo.peerCount;
  
  return (
    <div className={`chat-integrity ${className}`}>
      {/* Compact Badge */}
      <button
        className="chat-integrity__badge"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-label={`Integrity: ${config.label}`}
        style={{
          background: config.bgColor,
          borderColor: config.color,
        }}
      >
        <span 
          className="chat-integrity__icon"
          style={{ color: config.color }}
        >
          {config.icon}
        </span>
        <span className="chat-integrity__score">
          {integrityInfo.score}%
        </span>
        <span className="chat-integrity__peers">
          {displayPeerCount} peer{displayPeerCount !== 1 ? 's' : ''}
        </span>
      </button>
      
      {/* Expanded Details */}
      {(expanded || showDetails) && (
        <div className="chat-integrity__details">
          {/* Status */}
          <div className="chat-integrity__status">
            <span 
              className="chat-integrity__status-dot"
              style={{ background: config.color }}
            />
            <span className="chat-integrity__status-label">
              {config.label}
            </span>
          </div>
          
          <p className="chat-integrity__description">
            {integrityInfo.description}
          </p>
          
          {/* Stats */}
          <div className="chat-integrity__stats">
            <div className="chat-integrity__stat">
              <span className="chat-integrity__stat-value">
                {integrityInfo.totalBlocks}
              </span>
              <span className="chat-integrity__stat-label">
                Messages
              </span>
            </div>
            <div className="chat-integrity__stat">
              <span className="chat-integrity__stat-value">
                {displayPeerCount}
              </span>
              <span className="chat-integrity__stat-label">
                Backup Peers
              </span>
            </div>
            <div className="chat-integrity__stat">
              <span className="chat-integrity__stat-value">
                {integrityInfo.chunks?.length || 0}
              </span>
              <span className="chat-integrity__stat-label">
                Chunks
              </span>
            </div>
          </div>
          
          {/* Gaps */}
          {integrityInfo.gaps.length > 0 && (
            <div className="chat-integrity__gaps">
              <h4 className="chat-integrity__gaps-title">
                Missing History ({integrityInfo.gaps.length} gap{integrityInfo.gaps.length !== 1 ? 's' : ''})
              </h4>
              <ul className="chat-integrity__gaps-list">
                {integrityInfo.gaps.slice(0, 5).map((gap, index) => (
                  <li key={index} className="chat-integrity__gap">
                    <span className="chat-integrity__gap-range">
                      Messages {gap.start + 1} - {gap.end + 1}
                    </span>
                    <span className="chat-integrity__gap-reason">
                      {getGapReasonDescription(gap.reasons[0])}
                    </span>
                  </li>
                ))}
                {integrityInfo.gaps.length > 5 && (
                  <li className="chat-integrity__gap chat-integrity__gap--more">
                    + {integrityInfo.gaps.length - 5} more gaps
                  </li>
                )}
              </ul>
            </div>
          )}
          
          {/* Verification Info */}
          <div className="chat-integrity__info">
            <p>
              Messages are cryptographically signed and verified using 
              HMAC-SHA256. The history is replicated across {displayPeerCount} peer
              {displayPeerCount !== 1 ? 's' : ''} for redundancy.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Peer Count Indicator
 * Simpler component that just shows peer count
 */
export interface PeerCountProps {
  peerCount: number;
  className?: string;
}

export function PeerCount({ peerCount, className = '' }: PeerCountProps) {
  return (
    <div className={`chat-peer-count ${className}`}>
      <span className="chat-peer-count__icon">*</span>
      <span className="chat-peer-count__value">{peerCount}</span>
      <span className="chat-peer-count__label">
        peer{peerCount !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

/**
 * Gap Warning Component
 * Shows a warning when there are missing messages
 */
export interface GapWarningProps {
  gaps: GapRange[];
  onRequestSync?: () => void;
  className?: string;
}

export function GapWarning({ gaps, onRequestSync, className = '' }: GapWarningProps) {
  if (gaps.length === 0) return null;
  
  const totalMissing = gaps.reduce((sum, gap) => sum + (gap.end - gap.start + 1), 0);
  
  return (
    <div className={`chat-gap-warning ${className}`}>
      <div className="chat-gap-warning__icon">!</div>
      <div className="chat-gap-warning__content">
        <p className="chat-gap-warning__title">
          {totalMissing} message{totalMissing !== 1 ? 's' : ''} missing from history
        </p>
        <p className="chat-gap-warning__description">
          Some messages could not be retrieved from peers. 
          {gaps[0] && ` Reason: ${getGapReasonDescription(gaps[0].reasons[0])}`}
        </p>
      </div>
      {onRequestSync && (
        <button 
          className="chat-gap-warning__retry"
          onClick={onRequestSync}
        >
          Retry Sync
        </button>
      )}
    </div>
  );
}
