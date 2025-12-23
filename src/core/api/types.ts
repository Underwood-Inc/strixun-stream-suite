/**
 * API Framework - Type Definitions
 * 
 * Core type system for the API framework
 */

// ============ Request Types ============

export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface APIRequest {
  id: string;
  method: HTTPMethod;
  url: string;
  path: string;
  params?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  priority?: RequestPriority;
  cache?: CacheConfig;
  retry?: RetryConfig;
  timeout?: number;
  metadata?: Record<string, unknown>;
}

export type RequestPriority = 'low' | 'normal' | 'high' | 'critical';

// ============ Response Types ============

export interface APIResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  request: APIRequest;
  cached?: boolean;
  timestamp: number;
}

export interface APIError extends Error {
  status?: number;
  statusText?: string;
  data?: unknown;
  request?: APIRequest;
  retryable?: boolean;
  retryAfter?: number;
}

// ============ Cache Types ============

export interface CacheConfig {
  strategy?: 'network-first' | 'cache-first' | 'stale-while-revalidate' | 'network-only' | 'cache-only';
  ttl?: number; // Time to live in milliseconds
  maxAge?: number; // Maximum age in milliseconds
  invalidateOn?: string[]; // Invalidate on these mutations
  tags?: string[]; // Cache tags for bulk invalidation
  key?: string; // Custom cache key
}

export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
  maxAge: number;
  tags?: string[];
  etag?: string;
}

// ============ Retry Types ============

export interface RetryConfig {
  maxAttempts?: number;
  backoff?: 'exponential' | 'linear' | 'fixed';
  initialDelay?: number;
  maxDelay?: number;
  retryableErrors?: number[];
  retryable?: (error: APIError) => boolean;
}

export interface RetryState {
  attempt: number;
  lastError?: APIError;
  nextRetryAt?: number;
}

// ============ Middleware Types ============

export type NextFunction = (request: APIRequest) => Promise<APIResponse>;

export interface Middleware {
  (request: APIRequest, next: NextFunction): Promise<APIResponse>;
}

export interface MiddlewareContext {
  request: APIRequest;
  response?: APIResponse;
  error?: APIError;
}

// ============ Queue Types ============

export interface QueuedRequest {
  request: APIRequest;
  resolve: (response: APIResponse) => void;
  reject: (error: APIError) => void;
  priority: RequestPriority;
  timestamp: number;
}

// ============ Batch Types ============

export interface BatchRequest {
  requests: APIRequest[];
  resolve: (responses: APIResponse[]) => void;
  reject: (error: APIError) => void;
}

// ============ Circuit Breaker Types ============

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  failureThreshold?: number;
  resetTimeout?: number;
  monitoringPeriod?: number;
}

export interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureTime?: number;
  nextAttemptTime?: number;
}

// ============ Offline Types ============

export interface OfflineQueueEntry {
  request: APIRequest;
  timestamp: number;
  retries: number;
}

export interface OfflineConfig {
  enabled: boolean;
  queueSize?: number;
  syncOnReconnect?: boolean;
  retryOnReconnect?: boolean;
}

// ============ Optimistic Update Types ============

export interface OptimisticConfig {
  data: unknown;
  rollback?: (error: APIError) => void | Promise<void>;
  onSuccess?: (response: APIResponse) => void | Promise<void>;
}

// ============ WebSocket Types ============

export interface WebSocketRequest {
  type: string;
  data?: Record<string, unknown>;
  requestId?: string;
}

export interface WebSocketResponse {
  requestId?: string;
  type?: string;
  data?: unknown;
  error?: string;
}

// ============ API Schema Types ============

export interface ParamDefinition {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  default?: unknown;
  validator?: (value: unknown) => boolean;
}

export interface EndpointDefinition {
  method: HTTPMethod;
  path: string;
  params?: Record<string, ParamDefinition>;
  body?: string; // Type name
  response: string; // Type name
  auth?: 'required' | 'optional' | 'none';
  cache?: CacheConfig;
  retry?: RetryConfig;
  timeout?: number;
}

export interface APISchema {
  [namespace: string]: {
    [endpoint: string]: EndpointDefinition;
  };
}

// ============ Client Configuration ============

export interface APIClientConfig {
  baseURL?: string;
  defaultHeaders?: Record<string, string>;
  timeout?: number;
  retry?: RetryConfig;
  cache?: {
    enabled: boolean;
    defaultStrategy?: CacheConfig['strategy'];
    defaultTTL?: number;
  };
  offline?: OfflineConfig;
  auth?: {
    tokenGetter?: () => string | null | Promise<string | null>;
    csrfTokenGetter?: () => string | null | Promise<string | null>;
    onTokenExpired?: () => void | Promise<void>;
  };
  errorHandler?: (error: APIError, request: APIRequest) => Promise<APIResponse | void>;
  plugins?: Plugin[];
}

// ============ Plugin Types ============

export interface Plugin {
  name: string;
  version?: string;
  setup?: (client: APIClient) => void | Promise<void>;
  teardown?: () => void | Promise<void>;
  middleware?: Middleware;
}

// ============ Utility Types ============

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;


