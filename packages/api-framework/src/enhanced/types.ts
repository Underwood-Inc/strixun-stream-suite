/**
 * Enhanced API Framework - Type Definitions
 * 
 * Type system for enhanced API framework with:
 * - Root config type enforcement
 * - E2E encryption
 * - Response filtering
 * - Type-based response building
 */

// Cloudflare Workers types - only reference when actually in a worker context
// @ts-ignore - Conditional type reference
/// <reference types="@cloudflare/workers-types" />

import type { APIRequest, APIResponse as BaseAPIResponse } from '../types';

// ============ Root Response Config (Type-Based Enforcement) ============

/**
 * Root Response Config
 * 
 * All API responses MUST include these fields.
 * Enforced at compile-time via TypeScript type system.
 * 
 * Define this ONCE - applies to ALL responses automatically.
 */
export interface RootResponseConfig {
  id: string;              // Always included in ALL responses
  customerId: string;      // Always included in ALL responses
  // Add more root fields as needed
}

/**
 * Type utility to automatically merge root config with any response type
 * 
 * Usage: APIResponse<YourResponseType>
 * Result: RootResponseConfig & YourResponseType
 * 
 * TypeScript automatically enforces that all responses include root fields.
 */
export type APIResponse<T> = RootResponseConfig & T;

/**
 * Extract optional fields from a type (for filtering logic)
 */
export type OptionalFields<T> = {
  [K in keyof T as T[K] extends Required<T>[K] ? never : K]: T[K];
};

/**
 * Extract required fields from a type (for filtering logic)
 */
export type RequiredFields<T> = {
  [K in keyof T as T[K] extends Required<T>[K] ? K : never]: T[K];
};

// ============ E2E Encryption Types ============

export interface E2EEncryptionConfig {
  enabled: boolean;
  tokenGetter: () => string | null | Promise<string | null>;
  algorithm?: 'AES-GCM-256';
  encryptCondition?: (request: APIRequest, response: BaseAPIResponse) => boolean;
}

export interface EncryptedData {
  version: number;
  encrypted: boolean;
  algorithm: string;
  iv: string;
  salt: string;
  tokenHash: string;
  data: string;
  timestamp: string;
}

// ============ Response Filtering Types ============

export interface ResponseFilterConfig {
  // Root config type (compile-time enforcement)
  rootConfigType: new () => RootResponseConfig;
  
  // Root config runtime (for filtering logic)
  rootConfig: {
    alwaysInclude: (keyof RootResponseConfig)[]; // Type-safe root fields
    defaultInclude?: string[]; // Default optional fields
  };
  
  // Type definitions (automatically inherit root config via types)
  typeDefinitions: Map<string, TypeDefinition>;
  tags: Record<string, string[]>; // Tag -> field paths
}

export interface TypeDefinition {
  // TypeScript type name (must extend RootResponseConfig via APIResponse<T>)
  typeName: string;
  
  // Required fields (extracted from TypeScript type - no ?)
  required: string[]; // From type signature
  
  // Optional fields (extracted from TypeScript type - has ?)
  optional: string[]; // From type signature
  
  // Metrics (computed fields)
  metrics: Record<string, MetricDefinition>;
  
  // Inherit root config (default: true, enforced by type system)
  inherit?: boolean; // Default: true
}

export interface MetricDefinition {
  name: string;
  required: boolean; // If true, always computed
  compute: (data: any, context: RequestContext) => any | Promise<any>;
  cache?: {
    ttl: number;
    key: (data: any) => string;
  };
}

// ============ Error Handling Types ============

export interface RFC7807Error {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  [key: string]: any; // Additional fields (rate_limit_details, etc.)
}

export interface ErrorHandlingConfig {
  // Use error legend system
  useErrorLegend: boolean;
  errorLegendPath?: string; // Path to error-legend.ts
  
  // RFC 7807 format
  rfc7807: boolean;
  
  // Automatic error mapping
  errorMappers?: {
    [errorCode: string]: (error: any) => RFC7807Error;
  };
}

// ============ Request Context ============

export interface RequestContext {
  request: APIRequest;
  response?: BaseAPIResponse;
  customer?: {
    id: string;
    customerId: string;
    email: string;
  };
  env?: any; // Cloudflare Worker environment
}

// ============ Cloudflare Worker Types ============

export interface WorkerAdapterConfig {
  env?: {
    CACHE_KV?: KVNamespace;
    SESSION_KV?: KVNamespace;
    SESSION_DO?: DurableObjectNamespace;
    [key: string]: any;
  };
  cors?: boolean;
  platform?: 'cloudflare-worker' | 'browser' | 'node';
}

// ============ Enhanced API Client Config ============

export interface EnhancedAPIClientConfig {
  baseURL?: string;
  encryption?: E2EEncryptionConfig;
  filtering?: ResponseFilterConfig;
  errorHandling?: ErrorHandlingConfig;
  worker?: WorkerAdapterConfig;
  
  // Inherit from base config
  defaultHeaders?: Record<string, string>;
  timeout?: number;
  retry?: {
    maxAttempts?: number;
    backoff?: 'exponential' | 'linear' | 'fixed';
    initialDelay?: number;
    maxDelay?: number;
    retryableErrors?: number[];
  };
  cache?: {
    enabled: boolean;
    defaultStrategy?: 'network-first' | 'cache-first' | 'stale-while-revalidate';
    defaultTTL?: number;
  };
}

// ============ Filtering Query Parameters ============

export interface FilteringParams {
  include?: string[]; // Fields to include (comma-separated or array)
  exclude?: string[]; // Fields to exclude (comma-separated or array)
  tags?: string[]; // Tags to include (comma-separated or array)
}

// ============ Response Builder Types ============

export interface ResponseBuilderOptions {
  include?: string[];
  exclude?: string[];
  tags?: string[];
  computeMetrics?: string[];
}

export interface BuiltResponse<T> {
  data: Partial<T>; // Filtered data
  included: string[]; // Fields that were included
  excluded: string[]; // Fields that were excluded
  computed: string[]; // Metrics that were computed
}

