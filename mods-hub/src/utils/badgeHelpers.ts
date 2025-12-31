/**
 * Helper utilities for badge styling
 * Maps status types to badge style types
 */

import type { ModStatus } from '../types/mod';
import type { BadgeType } from './sharedStyles';

/**
 * Map ModStatus to BadgeType for consistent styling
 */
export function getStatusBadgeType(status: ModStatus): BadgeType {
  switch (status) {
    case 'published':
    case 'approved':
      return 'success';
    case 'pending':
    case 'changes_requested':
      return 'warning';
    case 'denied':
      return 'danger';
    case 'draft':
      return 'info';
    case 'archived':
      return 'default';
    default:
      return 'default';
  }
}
