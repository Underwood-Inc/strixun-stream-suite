/**
 * API Framework - Logging Plugin
 * 
 * Request/response logging
 */

import type { Plugin, Middleware, APIRequest, APIResponse, NextFunction } from '../types';
import type { APIClient } from '../types';

export interface LoggingConfig {
  enabled?: boolean;
  logRequests?: boolean;
  logResponses?: boolean;
  logErrors?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

export function createLoggingPlugin(config: LoggingConfig = {}): Plugin {
  const {
    enabled = true,
    logRequests = true,
    logResponses = true,
    logErrors = true,
    logLevel = 'debug',
  } = config;

  const middleware: Middleware = async (request: APIRequest, next: NextFunction): Promise<APIResponse> => {
    if (!enabled) {
      return next(request);
    }

    const startTime = Date.now();

    // Log request
    if (logRequests) {
      console.log(`[API] ${request.method} ${request.path || request.url}`, {
        params: request.params,
        body: request.body,
        headers: request.headers,
      });
    }

    try {
      const response = await next(request);
      const duration = Date.now() - startTime;

      // Log response
      if (logResponses) {
        console.log(`[API] ${request.method} ${request.path || request.url} ${response.status} (${duration}ms)`, {
          data: response.data,
          cached: response.cached,
        });
      }

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log error
      if (logErrors) {
        console.error(`[API] ${request.method} ${request.path || request.url} ERROR (${duration}ms)`, error);
      }

      throw error;
    }
  };

  return {
    name: 'logging',
    version: '1.0.0',
    middleware,
  };
}

