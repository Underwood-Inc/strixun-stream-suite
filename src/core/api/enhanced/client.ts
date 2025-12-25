/**
 * Enhanced API Framework - Enhanced API Client
 * 
 * Main client that ties together all enhanced features:
 * - E2E encryption
 * - Response filtering
 * - Type-based response building
 * - RFC 7807 error handling
 * - Cloudflare Worker compatibility
 */

import type {
  EnhancedAPIClientConfig,
  RootResponseConfig,
  APIResponse as EnhancedAPIResponse,
  RequestContext,
  TypeDefinition,
} from './types';
import type { APIRequest, APIResponse, APIClientConfig } from '../types';
import { EnhancedAPIClient } from '../enhanced-client';
import { createE2EEncryptionMiddleware } from './encryption';
import { createResponseFilterMiddleware } from './filtering';
import { createResponseBuilderMiddleware } from './building';
import { createErrorLegendMiddleware, createRFC7807Response } from './errors';
import { createWorkerAdapter, type WorkerAdapter } from './workers';
import { detectPlatform } from './workers/platform';

/**
 * Enhanced API Client
 * 
 * Extends the base EnhancedAPIClient with:
 * - E2E encryption
 * - Response filtering
 * - Type-based response building
 * - RFC 7807 error handling
 * - Cloudflare Worker support
 */
export class EnhancedAPIClientV2 extends EnhancedAPIClient {
  private enhancedConfig: EnhancedAPIClientConfig;
  private workerAdapter: WorkerAdapter | null = null;
  private requestContext: RequestContext;

  constructor(config: EnhancedAPIClientConfig = {}) {
    // Build base config from enhanced config
    const baseConfig: APIClientConfig = {
      baseURL: config.baseURL,
      defaultHeaders: config.defaultHeaders,
      timeout: config.timeout,
      retry: config.retry,
      cache: config.cache,
      ...config, // Spread any other base config
    };

    super(baseConfig);

    this.enhancedConfig = config;

    // Initialize Worker adapter if env provided
    if (config.worker?.env) {
      this.workerAdapter = createWorkerAdapter(config.worker);
    }

    // Initialize request context
    this.requestContext = {
      request: {} as APIRequest,
      env: config.worker?.env,
    };

    // Setup enhanced middlewares
    this.setupEnhancedMiddlewares();
  }

  /**
   * Setup enhanced middlewares
   */
  private setupEnhancedMiddlewares(): void {
    // Error handling with legend (must be first to catch all errors)
    if (this.enhancedConfig.errorHandling?.useErrorLegend) {
      this.use(
        createErrorLegendMiddleware(
          this.enhancedConfig.errorHandling.useErrorLegend
        )
      );
    }

    // E2E encryption (before response filtering)
    if (this.enhancedConfig.encryption?.enabled) {
      this.use(
        createE2EEncryptionMiddleware(this.enhancedConfig.encryption)
      );
    }

    // Response filtering
    if (this.enhancedConfig.filtering) {
      this.use(
        createResponseFilterMiddleware(this.enhancedConfig.filtering)
      );
    }

    // Response building (after filtering, before encryption)
    // Note: Response builder is applied server-side, not client-side
    // This is here for completeness but won't be used in client
  }

  /**
   * Make request with enhanced features
   */
  override async requestRaw<T = unknown>(request: APIRequest): Promise<APIResponse<T>> {
    // Update request context
    this.requestContext.request = request;
    
    // Enhance context with Worker adapter if available
    if (this.workerAdapter) {
      this.requestContext = this.workerAdapter.enhanceContext(this.requestContext);
    }

    // Execute through base client (which includes all base features)
    return super.requestRaw<T>(request);
  }

  /**
   * Make request with type definition
   */
  async requestTyped<T extends Record<string, any>>(
    request: APIRequest,
    typeDef?: TypeDefinition
  ): Promise<APIResponse<EnhancedAPIResponse<T>>> {
    // Update request context
    this.requestContext.request = request;
    
    // Enhance context with Worker adapter if available
    if (this.workerAdapter) {
      this.requestContext = this.workerAdapter.enhanceContext(this.requestContext);
    }

    // Execute request
    const response = await super.requestRaw<T>(request);

    // If successful, ensure root config is present
    if (response.ok && response.data) {
      const data = response.data as Partial<T>;
      const rootConfig: Partial<RootResponseConfig> = {
        id: data.id || this.requestContext.user?.id || generateId(),
        customerId: data.customerId || this.requestContext.user?.customerId || '',
      };

      // Ensure root fields are present
      const enhancedData: Partial<EnhancedAPIResponse<T>> = {
        ...rootConfig,
        ...data,
      };

      return {
        ...response,
        data: enhancedData as EnhancedAPIResponse<T>,
      };
    }

    return response as APIResponse<EnhancedAPIResponse<T>>;
  }

  /**
   * Set user context (for root config and encryption)
   */
  setUser(user: { id: string; customerId: string; email: string }): this {
    this.requestContext.user = user;
    return this;
  }

  /**
   * Get user context
   */
  getUser(): RequestContext['user'] {
    return this.requestContext.user;
  }

  /**
   * Get Worker adapter
   */
  getWorkerAdapter(): WorkerAdapter | null {
    return this.workerAdapter;
  }

  /**
   * Get request context
   */
  getRequestContext(): RequestContext {
    return { ...this.requestContext };
  }

  /**
   * Update configuration
   */
  configureEnhanced(config: Partial<EnhancedAPIClientConfig>): this {
    Object.assign(this.enhancedConfig, config);
    
    // Re-setup middlewares if config changed
    if (config.encryption || config.filtering || config.errorHandling) {
      // Remove old enhanced middlewares and re-add
      // Note: This is simplified - in practice, you'd track middleware instances
      this.setupEnhancedMiddlewares();
    }

    return this;
  }

  /**
   * Get enhanced configuration
   */
  getEnhancedConfig(): Readonly<EnhancedAPIClientConfig> {
    return { ...this.enhancedConfig };
  }
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create enhanced API client
 */
export function createEnhancedAPIClient(
  config: EnhancedAPIClientConfig = {}
): EnhancedAPIClientV2 {
  return new EnhancedAPIClientV2(config);
}

/**
 * Default enhanced client instance (singleton)
 */
let defaultEnhancedClient: EnhancedAPIClientV2 | null = null;

/**
 * Get or create default enhanced API client
 */
export function getEnhancedAPIClient(): EnhancedAPIClientV2 {
  if (!defaultEnhancedClient) {
    defaultEnhancedClient = createEnhancedAPIClient();
  }
  return defaultEnhancedClient;
}

/**
 * Set default enhanced API client
 */
export function setEnhancedAPIClient(client: EnhancedAPIClientV2): void {
  defaultEnhancedClient = client;
}

/**
 * Reset default enhanced API client
 */
export function resetEnhancedAPIClient(): void {
  defaultEnhancedClient = null;
}

