/**
 * Enhanced API Framework - Platform Detection
 * 
 * Auto-detect if running in Cloudflare Worker, browser, or Node.js
 */

export type Platform = 'cloudflare-worker' | 'browser' | 'node';

/**
 * Detect current platform
 */
export function detectPlatform(): Platform {
  // Check for Cloudflare Worker environment
  if (typeof caches !== 'undefined' && typeof WebSocketPair !== 'undefined') {
    return 'cloudflare-worker';
  }

  // Check for browser environment
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return 'browser';
  }

  // Check for Node.js environment
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    return 'node';
  }

  // Default to browser if we can't determine
  return 'browser';
}

/**
 * Check if running in Cloudflare Worker
 */
export function isCloudflareWorker(): boolean {
  return detectPlatform() === 'cloudflare-worker';
}

/**
 * Check if running in browser
 */
export function isBrowser(): boolean {
  return detectPlatform() === 'browser';
}

/**
 * Check if running in Node.js
 */
export function isNode(): boolean {
  return detectPlatform() === 'node';
}

/**
 * Get platform-specific storage adapter
 */
export function getStorageAdapter(env?: any): 'kv' | 'indexeddb' | 'memory' {
  if (isCloudflareWorker() && env?.CACHE_KV) {
    return 'kv';
  }
  
  if (isBrowser()) {
    return 'indexeddb';
  }

  // Fallback to memory for Node.js or unknown
  return 'memory';
}

