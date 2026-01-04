/**
 * Type definitions for cloudflare:test module
 * Used with @cloudflare/vitest-pool-workers
 */

declare module 'cloudflare:test' {
  import type { ExecutionContext } from '@strixun/types';
  
  interface ProvidedEnv {
    OTP_AUTH_KV: KVNamespace;
    ENVIRONMENT?: string;
    JWT_SECRET?: string;
    NETWORK_INTEGRITY_KEYPHRASE?: string;
    RESEND_API_KEY?: string;
    RESEND_FROM_EMAIL?: string;
    E2E_TEST_OTP_CODE?: string;
    CUSTOMER_API_URL?: string;
    [key: string]: unknown;
  }
  
  /**
   * Fetcher for making requests to the worker being tested
   */
  export const SELF: {
    fetch(input: RequestInfo | URL, init?: RequestInit, env?: ProvidedEnv, ctx?: ExecutionContext): Promise<Response>;
  };
  
  /**
   * Environment bindings for the worker
   */
  export const env: ProvidedEnv;
  
  /**
   * Create an execution context for the worker
   */
  export function createExecutionContext(): ExecutionContext;
  
  /**
   * Wait for all tasks in an execution context to complete
   */
  export function waitOnExecutionContext(ctx: ExecutionContext): Promise<void>;
}
