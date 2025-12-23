/**
 * API Framework - Request Priority Management
 * 
 * Priority-based request ordering
 */

import type { RequestPriority } from '../types';

export const PRIORITY_ORDER: Record<RequestPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

/**
 * Compare request priorities
 */
export function comparePriority(a: RequestPriority, b: RequestPriority): number {
  return PRIORITY_ORDER[a] - PRIORITY_ORDER[b];
}

/**
 * Get default priority
 */
export function getDefaultPriority(): RequestPriority {
  return 'normal';
}

/**
 * Check if priority is higher than another
 */
export function isHigherPriority(a: RequestPriority, b: RequestPriority): boolean {
  return PRIORITY_ORDER[a] < PRIORITY_ORDER[b];
}


