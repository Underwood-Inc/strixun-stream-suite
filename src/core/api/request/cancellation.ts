/**
 * API Framework - Request Cancellation
 * 
 * Manages request cancellation and AbortSignal handling
 */

import type { APIRequest } from '../types';

export class CancellationManager {
  private controllers = new Map<string, AbortController>();

  /**
   * Create or get AbortController for request
   */
  getController(requestId: string): AbortController {
    let controller = this.controllers.get(requestId);
    if (!controller) {
      controller = new AbortController();
      this.controllers.set(requestId, controller);
    }
    return controller;
  }

  /**
   * Cancel request
   */
  cancel(requestId: string): boolean {
    const controller = this.controllers.get(requestId);
    if (controller) {
      controller.abort();
      this.controllers.delete(requestId);
      return true;
    }
    return false;
  }

  /**
   * Cancel all requests
   */
  cancelAll(): void {
    for (const [requestId, controller] of this.controllers) {
      controller.abort();
    }
    this.controllers.clear();
  }

  /**
   * Clean up controller (called when request completes)
   */
  cleanup(requestId: string): void {
    this.controllers.delete(requestId);
  }

  /**
   * Check if request is cancelled
   */
  isCancelled(requestId: string): boolean {
    const controller = this.controllers.get(requestId);
    return controller?.signal.aborted ?? false;
  }

  /**
   * Get signal for request
   */
  getSignal(requestId: string): AbortSignal | undefined {
    return this.controllers.get(requestId)?.signal;
  }
}


