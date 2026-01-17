/**
 * Integrity Badge Component
 * 
 * Displays blockchain integrity status with peer count and score.
 */

import type { IntegrityInfo, IntegrityStatus, GapRange } from '../core/types.js';
import { getGapReasonDescription } from '../core/integrity.js';

export interface IntegrityBadgeProps {
  /** Integrity information */
  info: IntegrityInfo;
  /** Additional CSS class */
  className?: string;
  /** Show detailed tooltip on hover */
  showTooltip?: boolean;
  /** Compact mode (icon only) */
  compact?: boolean;
}

/**
 * Get status icon (ASCII-safe)
 */
function getStatusIcon(status: IntegrityStatus): string {
  switch (status) {
    case 'verified': return '✓';
    case 'partial': return '~';
    case 'degraded': return '!';
    case 'unverified': return '?';
  }
}

/**
 * Integrity badge component
 */
export function IntegrityBadge({
  info,
  className = '',
  showTooltip = true,
  compact = false,
}: IntegrityBadgeProps) {
  const statusClass = `p2p-integrity-badge--${info.status}`;
  
  return (
    <div 
      className={`p2p-integrity-badge ${statusClass} ${className}`}
      title={showTooltip ? info.description : undefined}
    >
      <span className="p2p-integrity-badge__icon">
        {getStatusIcon(info.status)}
      </span>
      
      {!compact && (
        <>
          <span className="p2p-integrity-badge__score">
            {info.score}%
          </span>
          <span className="p2p-integrity-badge__peers">
            {info.peerCount} {info.peerCount === 1 ? 'peer' : 'peers'}
          </span>
        </>
      )}
    </div>
  );
}

// ============ Gap Warning Component ============

export interface GapWarningProps {
  /** Gap ranges to display */
  gaps: GapRange[];
  /** Additional CSS class */
  className?: string;
  /** Called when user dismisses */
  onDismiss?: () => void;
}

/**
 * Gap warning component
 */
export function GapWarning({
  gaps,
  className = '',
  onDismiss,
}: GapWarningProps) {
  if (gaps.length === 0) return null;
  
  const totalMissing = gaps.reduce((sum, g) => sum + (g.end - g.start + 1), 0);
  
  return (
    <div className={`p2p-gap-warning ${className}`}>
      <div className="p2p-gap-warning__header">
        <span className="p2p-gap-warning__icon">!</span>
        <span className="p2p-gap-warning__title">
          {totalMissing} entries may be missing
        </span>
        {onDismiss && (
          <button 
            className="p2p-gap-warning__dismiss"
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            X
          </button>
        )}
      </div>
      
      <ul className="p2p-gap-warning__list">
        {gaps.map((gap, i) => (
          <li key={i} className="p2p-gap-warning__item">
            <span className="p2p-gap-warning__range">
              Entries {gap.start} - {gap.end}
            </span>
            <span className="p2p-gap-warning__reason">
              {getGapReasonDescription(gap.reasons[0])}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============ Peer Count Component ============

export interface PeerCountProps {
  /** Number of online peers */
  count: number;
  /** Additional CSS class */
  className?: string;
}

/**
 * Peer count indicator
 */
export function PeerCount({ count, className = '' }: PeerCountProps) {
  const statusClass = count === 0 
    ? 'p2p-peer-count--offline'
    : count < 3 
      ? 'p2p-peer-count--low'
      : 'p2p-peer-count--healthy';
  
  return (
    <div className={`p2p-peer-count ${statusClass} ${className}`}>
      <span className="p2p-peer-count__icon">*</span>
      <span className="p2p-peer-count__value">{count}</span>
      <span className="p2p-peer-count__label">
        {count === 1 ? 'peer' : 'peers'}
      </span>
    </div>
  );
}
