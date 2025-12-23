/**
 * API Framework - Optimistic Updates
 * 
 * Optimistic UI updates with rollback on error
 */

import type { APIRequest, APIResponse, APIError, OptimisticConfig } from '../types';

export class OptimisticUpdateManager {
  /**
   * Execute request with optimistic update
   */
  async execute<T = unknown>(
    request: APIRequest,
    executor: () => Promise<APIResponse<T>>,
    config: OptimisticConfig
  ): Promise<APIResponse<T>> {
    // Store original data for rollback
    const originalData = config.data;

    try {
      // Execute request
      const response = await executor();

      // Call success handler
      if (config.onSuccess) {
        await config.onSuccess(response);
      }

      return response;
    } catch (error) {
      // Rollback on error
      if (config.rollback) {
        await config.rollback(error as APIError);
      }

      throw error;
    }
  }

  /**
   * Create optimistic update config
   */
  createConfig(
    data: unknown,
    options?: {
      rollback?: (error: APIError) => void | Promise<void>;
      onSuccess?: (response: APIResponse) => void | Promise<void>;
    }
  ): OptimisticConfig {
    return {
      data,
      rollback: options?.rollback,
      onSuccess: options?.onSuccess,
    };
  }
}


