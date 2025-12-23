/**
 * API Framework - Middleware System
 * 
 * Middleware pipeline for request/response transformation
 */

import type { APIRequest, APIResponse, Middleware, NextFunction } from '../types';

export class MiddlewarePipeline {
  private middlewares: Middleware[] = [];

  /**
   * Add middleware to the pipeline
   */
  use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Remove middleware from the pipeline
   */
  remove(middleware: Middleware): this {
    const index = this.middlewares.indexOf(middleware);
    if (index > -1) {
      this.middlewares.splice(index, 1);
    }
    return this;
  }

  /**
   * Clear all middlewares
   */
  clear(): this {
    this.middlewares = [];
    return this;
  }

  /**
   * Execute middleware pipeline
   */
  async execute(request: APIRequest, finalHandler: NextFunction): Promise<APIResponse> {
    let index = 0;

    const next: NextFunction = async (req: APIRequest): Promise<APIResponse> => {
      if (index >= this.middlewares.length) {
        return finalHandler(req);
      }

      const middleware = this.middlewares[index++];
      return middleware(req, next);
    };

    return next(request);
  }

  /**
   * Get all middlewares
   */
  getMiddlewares(): readonly Middleware[] {
    return [...this.middlewares];
  }
}

