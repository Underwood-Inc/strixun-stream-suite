/**
 * Auth middleware tests: 401 handling, onTokenExpired, and retry (cookie vs tokenGetter).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuthMiddleware } from './auth';
import type { APIRequest, APIResponse } from '../types';

function mockRequest(overrides: Partial<APIRequest> = {}): APIRequest {
  return {
    id: 'req-1',
    method: 'GET',
    url: 'https://api.test/me',
    path: '/me',
    headers: {},
    ...overrides,
  };
}

function mockResponse(status: number, data: unknown = {}): APIResponse {
  return {
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Unauthorized',
    headers: new Headers(),
    request: mockRequest(),
    timestamp: Date.now(),
  };
}

describe('createAuthMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('401 + onTokenExpired (cookie auth, no tokenGetter)', () => {
    it('should call onTokenExpired and retry request when 401 returned', async () => {
      const onTokenExpired = vi.fn().mockResolvedValue(undefined);
      const next = vi
        .fn()
        .mockResolvedValueOnce(mockResponse(401))
        .mockResolvedValueOnce(mockResponse(200, { id: 'user-1' }));

      const middleware = createAuthMiddleware({
        onTokenExpired,
        baseURL: 'https://api.test',
      });

      const request = mockRequest();
      const response = await middleware(request, next);

      expect(response.status).toBe(200);
      expect(response.data).toEqual({ id: 'user-1' });
      expect(onTokenExpired).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledTimes(2);
      expect(next).toHaveBeenNthCalledWith(1, request);
      expect(next).toHaveBeenNthCalledWith(2, request);
    });

    it('should return 401 when onTokenExpired runs but retry still returns 401', async () => {
      const onTokenExpired = vi.fn().mockResolvedValue(undefined);
      const next = vi
        .fn()
        .mockResolvedValueOnce(mockResponse(401))
        .mockResolvedValueOnce(mockResponse(401));

      const middleware = createAuthMiddleware({
        onTokenExpired,
      });

      const request = mockRequest();
      const response = await middleware(request, next);

      expect(response.status).toBe(401);
      expect(onTokenExpired).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledTimes(2);
    });
  });

  describe('401 + onTokenExpired + tokenGetter', () => {
    it('should retry with new token from tokenGetter when 401 then 200', async () => {
      const onTokenExpired = vi.fn().mockResolvedValue(undefined);
      const tokenGetter = vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('new_access_token');
      const next = vi
        .fn()
        .mockResolvedValueOnce(mockResponse(401))
        .mockResolvedValueOnce(mockResponse(200, { id: 'user-1' }));

      const middleware = createAuthMiddleware({
        onTokenExpired,
        tokenGetter,
      });

      const request = mockRequest();
      const response = await middleware(request, next);

      expect(response.status).toBe(200);
      expect(onTokenExpired).toHaveBeenCalledTimes(1);
      expect(tokenGetter).toHaveBeenCalledTimes(2);
      expect(next).toHaveBeenCalledTimes(2);
      expect(request.headers!['Authorization']).toBe('Bearer new_access_token');
    });
  });

  describe('skip when metadata.auth === false', () => {
    it('should not run 401 retry logic when request has auth: false', async () => {
      const onTokenExpired = vi.fn();
      const next = vi.fn().mockResolvedValue(mockResponse(401));

      const middleware = createAuthMiddleware({
        onTokenExpired,
      });

      const request = mockRequest({ metadata: { auth: false } });
      const response = await middleware(request, next);

      expect(response.status).toBe(401);
      expect(onTokenExpired).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
