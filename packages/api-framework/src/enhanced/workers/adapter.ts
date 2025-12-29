/**
 * Enhanced API Framework - Cloudflare Worker Adapter
 * 
 * Worker compatibility layer for enhanced API framework
 */

// @ts-ignore - Conditional type reference
/// <reference types="@cloudflare/workers-types" />

import type { WorkerAdapterConfig, RequestContext } from '../types';
import type { APIRequest } from '../../types';
import { detectPlatform, isCloudflareWorker } from './platform';
import { createCORSMiddleware, type CORSOptions } from './cors';
import { createKVCache, type KVCache } from './kv-cache';

/**
 * Cloudflare Worker Adapter
 * 
 * Provides Worker-specific functionality:
 * - KV cache integration
 * - CORS handling
 * - Platform detection
 * - Environment access
 */
export class WorkerAdapter {
  private config: WorkerAdapterConfig;
  private kvCache: KVCache | null = null;

  constructor(config: WorkerAdapterConfig = {}) {
    this.config = config;

    // Initialize KV cache if available
    if (config.env?.CACHE_KV) {
      this.kvCache = createKVCache(
        { request: {} as APIRequest, env: config.env },
        { keyPrefix: 'enhanced-api:' }
      );
    }
  }

  /**
   * Get KV cache instance
   */
  getCache(): KVCache | null {
    return this.kvCache;
  }

  /**
   * Get environment
   */
  getEnv(): any {
    return this.config.env;
  }

  /**
   * Check if running in Worker
   */
  isWorker(): boolean {
    return isCloudflareWorker();
  }

  /**
   * Get platform
   */
  getPlatform(): 'cloudflare-worker' | 'browser' | 'node' {
    return detectPlatform();
  }

  /**
   * Create CORS middleware
   */
  createCORS(options?: CORSOptions) {
    return createCORSMiddleware(options || {});
  }

  /**
   * Enhance request context with Worker-specific data
   */
  enhanceContext(context: RequestContext): RequestContext {
    return {
      ...context,
      env: this.config.env,
    };
  }

  /**
   * Handle Worker fetch event
   */
  async handleFetch(
    event: { request: Request },
    handler: (request: Request, env: any) => Promise<Response>
  ): Promise<Response> {
    const request = event.request;
    const env = this.config.env || {};

    // Add CORS if enabled
    if (this.config.cors) {
      const corsMiddleware = this.createCORS();
      return corsMiddleware(request, async (req) => {
        return await handler(req, env);
      });
    }

    return await handler(request, env);
  }
}

/**
 * Create Worker adapter
 */
export function createWorkerAdapter(config: WorkerAdapterConfig = {}): WorkerAdapter {
  return new WorkerAdapter(config);
}

/**
 * Worker fetch handler wrapper
 */
export function createWorkerHandler(
  handler: (request: Request, env: any, ctx: ExecutionContext) => Promise<Response>,
  adapterConfig?: WorkerAdapterConfig
) {
  const adapter = createWorkerAdapter(adapterConfig);

  return async (event: { request: Request }): Promise<Response> => {
    return adapter.handleFetch(event, async (request, env) => {
      // Create a minimal ExecutionContext-like object
      const ctx: ExecutionContext = {
        waitUntil: () => {},
        passThroughOnException: () => {},
        props: {},
      } as ExecutionContext;
      return handler(request, env, ctx);
    });
  };
}

