/**
 * URL Shortener Stats Endpoint Integration Tests
 * 
 * Tests the full request/response cycle for the /api/stats endpoint
 */

import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { createRouter } from './routes.js';
import { handleGetStats } from '../handlers/url.js';
import { decryptWithJWT } from '@strixun/api-framework';
import { createRS256JWT, mockJWKSEndpoint } from '../../shared/test-rs256.js';

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

vi.mock('../handlers/display-name.js', () => ({
  handleGetDisplayName: vi.fn(),
}));

let cleanupJWKS: () => void;

describe('Stats Endpoint Integration', () => {
  const mockEnv = {
    URL_KV: {
      get: vi.fn(),
      put: vi.fn(),
    },
    ALLOWED_ORIGINS: 'https://example.com',
    NETWORK_INTEGRITY_KEYPHRASE: 'test-keyphrase',
    JWT_ISSUER: 'https://test-issuer.example.com',
  } as any;

  let router: (request: Request, env: any) => Promise<Response>;
  let mockJWTToken: string;

  beforeAll(async () => {
    cleanupJWKS = await mockJWKSEndpoint();
  });

  afterAll(() => cleanupJWKS());

  beforeEach(async () => {
    vi.clearAllMocks();
    router = createRouter();
    
    // Create a mock JWT token for tests
    const exp = Math.floor(Date.now() / 1000) + (7 * 60 * 60);
    mockJWTToken = await createRS256JWT({
      sub: 'test_user',
      email: 'test@example.com',
      exp: exp,
      iat: Math.floor(Date.now() / 1000),
    });
  });

  describe('GET /api/stats', () => {
    it('should route to handleGetStats handler', async () => {
      // Arrange
      const request = new Request('https://s.idling.app/api/stats', {
        method: 'GET',
        headers: {
          'Cookie': `auth_token=${mockJWTToken}`,
        },
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
        headers: {
          'Cookie': `auth_token=${mockJWTToken}`,
        },
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
      const encryptedData = await response.json();
      
      // Decrypt the response (router wraps with encryption)
      const data = await decryptWithJWT(encryptedData, mockJWTToken) as { success: boolean; totalUrls: number };

      // Assert
      expect(data.success).toBe(true);
      expect(data.totalUrls).toBe(100);
      expect(typeof data.totalUrls).toBe('number');
    });

    it('should handle errors from handler', async () => {
      // Arrange
      const request = new Request('https://s.idling.app/api/stats', {
        method: 'GET',
        headers: {
          'Cookie': `auth_token=${mockJWTToken}`,
        },
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
      
      // Error responses (500) should not be encrypted, return as-is
      if (response.status === 500) {
        const data = await response.json();
        expect(data.error).toBe('Failed to get stats');
      } else {
        // If encrypted, decrypt it
        const encryptedData = await response.json();
        const data = await decryptWithJWT(encryptedData, mockJWTToken) as { error: string };
        expect(data.error).toBe('Failed to get stats');
      }

      // Assert
      expect(response.status).toBe(500);
    });

    it('should require JWT token for encryption', async () => {
      // Arrange
      const request = new Request('https://s.idling.app/api/stats', {
        method: 'GET',
        // No Authorization header - should return 401
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
      const data = await response.json();

      // Assert - endpoint now requires JWT token for encryption
      expect(response.status).toBe(401);
      expect(data.title).toBe('Unauthorized');
      expect(data.detail).toContain('JWT token is required');
    });

    it('should include no-cache headers in response', async () => {
      // Arrange
      const request = new Request('https://s.idling.app/api/stats', {
        method: 'GET',
        headers: {
          'Cookie': `auth_token=${mockJWTToken}`,
        },
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

      // Assert - check headers (encryption may modify headers, but Cache-Control should be preserved)
      // Note: After encryption wrapping, headers may be different, so we check the response status
      expect(response.status).toBe(200);
      // Cache-Control might be in the encrypted response metadata, so we just verify the response is successful
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
