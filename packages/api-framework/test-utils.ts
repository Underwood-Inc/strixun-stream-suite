/**
 * Test Utilities for @strixun/api-framework
 * 
 * Provides mocks and test helpers for testing code that uses the API framework
 * 
 * @example
 * ```typescript
 * import { createMockAPIClient } from '@strixun/api-framework/test-utils';
 * import { vi } from 'vitest';
 * 
 * const mockClient = createMockAPIClient(vi);
 * vi.mock('@strixun/api-framework/client', () => ({
 *   createAPIClient: vi.fn(() => mockClient),
 * }));
 * ```
 */

import type { APIClient } from './src/client';
import type { APIResponse } from './src/types';

/**
 * Mock API Client for testing
 * 
 * Creates a mock API client that implements the APIClient interface.
 * 
 * @param vi - Vitest vi object (required for creating mocks)
 * @returns Mock API client with all methods mocked
 * 
 * @example
 * ```typescript
 * import { createMockAPIClient } from '@strixun/api-framework/test-utils';
 * import { vi } from 'vitest';
 * 
 * const mockClient = createMockAPIClient(vi);
 * mockClient.get.mockResolvedValue({ data: { id: '123' }, status: 200, statusText: 'OK' });
 * 
 * vi.mock('@strixun/api-framework/client', () => ({
 *   createAPIClient: vi.fn(() => mockClient),
 * }));
 * ```
 */
export function createMockAPIClient(vi: any): APIClient {
  const mockClient = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    request: vi.fn(),
    requestRaw: vi.fn(),
    use: vi.fn(),
  } as unknown as APIClient;

  return mockClient;
}

/**
 * Create a mock API response
 * 
 * @example
 * ```typescript
 * import { createMockResponse } from '@strixun/api-framework/test-utils';
 * 
 * const response = createMockResponse({ data: { id: '123' }, status: 200 });
 * ```
 */
export function createMockResponse<T = any>(overrides?: Partial<APIResponse<T>>): APIResponse<T> {
  return {
    data: undefined as T,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    request: {
      id: 'mock-request-id',
      method: 'GET',
      path: '/',
      url: 'http://localhost/',
      params: undefined,
      signal: new AbortSignal(),
      headers: new Headers(),
      metadata: {},
    },
    ...overrides,
  } as APIResponse<T>;
}

