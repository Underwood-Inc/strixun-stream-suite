/**
 * API Framework - Analytics Plugin
 * 
 * Analytics tracking for API usage
 */

import type { Plugin, Middleware, APIRequest, APIResponse, NextFunction } from '../types';

export interface AnalyticsConfig {
  enabled?: boolean;
  trackEvent?: (event: string, properties?: Record<string, unknown>) => void;
}

export function createAnalyticsPlugin(config: AnalyticsConfig = {}): Plugin {
  const { enabled = true, trackEvent } = config;

  const middleware: Middleware = async (request: APIRequest, next: NextFunction): Promise<APIResponse> => {
    if (!enabled || !trackEvent) {
      return next(request);
    }

    const startTime = Date.now();

    try {
      const response = await next(request);
      const duration = Date.now() - startTime;

      // Track successful request
      trackEvent('api_request', {
        method: request.method,
        path: request.path || request.url,
        status: response.status,
        duration,
        cached: response.cached,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Track failed request
      trackEvent('api_request_error', {
        method: request.method,
        path: request.path || request.url,
        error: error instanceof Error ? error.message : 'Unknown',
        duration,
      });

      throw error;
    }
  };

  return {
    name: 'analytics',
    version: '1.0.0',
    middleware,
  };
}


