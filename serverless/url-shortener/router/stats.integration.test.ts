/**
 * URL Shortener Stats Endpoint Integration Tests
 * 
 * Tests the full request/response cycle for the /api/stats endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRouter } from './routes.js';
import { handleGetStats } from '../handlers/url.js';

// Mock handlers
vi.mock('../handlers/url.js', () => ({
  handleCreateShortUrl: vi.fn(),
  handleRedirect: vi.fn(),
  handleGetUrlInfo: vi.fn(),
  handleListUrls: vi.fn(),
  handleDeleteUrl: vi.fn(),
  handleGetStats: vi.fn(),
}));

vi.mock('../handlers/health.js', () => ({
  handleHealth: vi.fn(),
}));

vi.mock('../handlers/decrypt-script.js', () => ({
  handleDecryptScript: vi.fn(),
}));

vi.mock('../handlers/otp-core-script.js', () => ({
  handleOtpCoreScript: vi.fn(),
}));

vi.mock('../handlers/app-assets.js', () => ({
  handleAppAssets: vi.fn(),
}));

describe('Stats Endpoint Integration', () => {
  const mockEnv = {
    URL_KV: {
      get: vi.fn(),
      put: vi.fn(),
    },
    ALLOWED_ORIGINS: 'https://example.com',
    NETWORK_INTEGRITY_KEYPHRASE: 'test-keyphrase',
  } as any;

  let router: (request: Request, env: any) => Promise<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    router = createRouter();
  });

  describe('GET /api/stats', () => {
    it('should route to handleGetStats handler', async () => {
      // Arrange
      const request = new Request('https://s.idling.app/api/stats', {
        method: 'GET',
      });

      const mockResponse = new Response(
        JSON.stringify({ success: true, totalUrls: 42 }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        }
      );

      vi.mocked(handleGetStats).mockResolvedValue(mockResponse);

      // Act
      const response = await router(request, mockEnv);

      // Assert
      expect(handleGetStats).toHaveBeenCalledWith(request, mockEnv);
      expect(response.status).toBe(200);
    });

    it('should return stats data with proper structure', async () => {
      // Arrange
      const request = new Request('https://s.idling.app/api/stats', {
        method: 'GET',
      });

      const mockResponse = new Response(
        JSON.stringify({ success: true, totalUrls: 100 }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      vi.mocked(handleGetStats).mockResolvedValue(mockResponse);

      // Act
      const response = await router(request, mockEnv);
      const data = await response.json();

      // Assert
      expect(data.success).toBe(true);
      expect(data.totalUrls).toBe(100);
      expect(typeof data.totalUrls).toBe('number');
    });

    it('should handle errors from handler', async () => {
      // Arrange
      const request = new Request('https://s.idling.app/api/stats', {
        method: 'GET',
      });

      const mockErrorResponse = new Response(
        JSON.stringify({ error: 'Failed to get stats', message: 'KV error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      vi.mocked(handleGetStats).mockResolvedValue(mockErrorResponse);

      // Act
      const response = await router(request, mockEnv);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get stats');
    });

    it('should work without authentication (public endpoint)', async () => {
      // Arrange
      const request = new Request('https://s.idling.app/api/stats', {
        method: 'GET',
        // No Authorization header
      });

      const mockResponse = new Response(
        JSON.stringify({ success: true, totalUrls: 0 }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      vi.mocked(handleGetStats).mockResolvedValue(mockResponse);

      // Act
      const response = await router(request, mockEnv);

      // Assert
      expect(response.status).toBe(200);
      expect(handleGetStats).toHaveBeenCalled();
    });

    it('should include no-cache headers in response', async () => {
      // Arrange
      const request = new Request('https://s.idling.app/api/stats', {
        method: 'GET',
      });

      const mockResponse = new Response(
        JSON.stringify({ success: true, totalUrls: 50 }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        }
      );

      vi.mocked(handleGetStats).mockResolvedValue(mockResponse);

      // Act
      const response = await router(request, mockEnv);

      // Assert
      expect(response.headers.get('Cache-Control')).toContain('no-store');
      expect(response.headers.get('Pragma')).toBe('no-cache');
    });
  });

  describe('Route Matching', () => {
    it('should not match /api/stats/extra', async () => {
      // Arrange
      const request = new Request('https://s.idling.app/api/stats/extra', {
        method: 'GET',
      });

      // Act
      const response = await router(request, mockEnv);

      // Assert
      expect(handleGetStats).not.toHaveBeenCalled();
      // Should fall through to 404 or other handler
    });

    it('should only accept GET method', async () => {
      // Arrange
      const request = new Request('https://s.idling.app/api/stats', {
        method: 'POST',
      });

      // Act
      const response = await router(request, mockEnv);

      // Assert
      expect(handleGetStats).not.toHaveBeenCalled();
    });
  });
});
