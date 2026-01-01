/**
 * Enhanced API Framework - Cloudflare Workers
 */

export * from './platform';
export * from './kv-cache';
export * from './cors';
// Export cors-with-localhost functions with explicit names to avoid conflicts
export {
  createCORSHeaders as createCORSHeadersWithLocalhost,
  handleCORSPreflight as handleCORSPreflightWithLocalhost,
} from './cors-with-localhost';
export * from './adapter';
export type { CORSOptions } from './cors';
export type { CORSWithLocalhostOptions } from './cors-with-localhost';
export type { KVCacheOptions } from './kv-cache';
export type { WorkerAdapterConfig } from '../types';

