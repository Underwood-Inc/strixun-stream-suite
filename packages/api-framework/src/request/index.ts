/**
 * API Framework - Request Management
 * 
 * Unified request management with deduplication, queuing, and cancellation
 */

export { RequestDeduplicator } from './deduplicator';
export { RequestQueue } from './queue';
export { ConcurrencyPool } from './concurrency-pool';
export { CancellationManager } from './cancellation';
export { comparePriority, getDefaultPriority, isHigherPriority, PRIORITY_ORDER } from './priority';

export type { QueuedRequest } from '../types';
export type { QueueConfig } from './queue';


