/**
 * API Framework - Metrics Plugin
 * 
 * Performance metrics collection
 */

import type { Plugin, Middleware, APIRequest, APIResponse, NextFunction } from '../types';

export interface MetricsConfig {
  enabled?: boolean;
  onMetric?: (metric: Metric) => void;
}

export interface Metric {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: number;
}

export function createMetricsPlugin(config: MetricsConfig = {}): Plugin {
  const { enabled = true, onMetric } = config;

  const middleware: Middleware = async (request: APIRequest, next: NextFunction): Promise<APIResponse> => {
    if (!enabled) {
      return next(request);
    }

    const startTime = Date.now();
    const startMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;

    try {
      const response = await next(request);
      const duration = Date.now() - startTime;
      const endMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
      const memoryDelta = endMemory - startMemory;

      // Record metrics
      if (onMetric) {
        onMetric({
          name: 'api.request.duration',
          value: duration,
          tags: {
            method: request.method,
            path: request.path || request.url || '',
            status: String(response.status),
          },
          timestamp: Date.now(),
        });

        onMetric({
          name: 'api.request.memory',
          value: memoryDelta,
          tags: {
            method: request.method,
            path: request.path || request.url || '',
          },
          timestamp: Date.now(),
        });
      }

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      if (onMetric) {
        onMetric({
          name: 'api.request.error',
          value: duration,
          tags: {
            method: request.method,
            path: request.path || request.url || '',
            error: error instanceof Error ? error.message : 'Unknown',
          },
          timestamp: Date.now(),
        });
      }

      throw error;
    }
  };

  return {
    name: 'metrics',
    version: '1.0.0',
    middleware,
  };
}

