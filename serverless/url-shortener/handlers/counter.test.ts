/**
 * URL Shortener Counter Logic Unit Tests
 * 
 * Tests for counter increment/decrement in create and delete handlers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCreateShortUrl, handleDeleteUrl } from './url.js';
import { authenticateRequest } from '../utils/auth.js';

// Mock dependencies
vi.mock('../utils/auth.js', () => ({
  authenticateRequest: vi.fn(),
}));

vi.mock('../utils/cors.js', () => ({
  getCorsHeaders: vi.fn(() => ({
    'Access-Control-Allow-Origin': '*',
  })),
}));

vi.mock('../utils/url.js', () => ({
  generateShortCode: vi.fn(() => 'abc123'),
  isValidUrl: vi.fn((url: string) => url.startsWith('http')),
  isValidShortCode: vi.fn(() => true),
}));

describe('URL Counter Logic', () => {
  const mockEnv = {
    URL_KV: {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
    JWT_SECRET: 'test-secret',
    ALLOWED_ORIGINS: 'https://example.com',
  } as any;

  const mockAuth = {
    authenticated: true,
    userId: 'user-123',
    email: 'test@example.com',
    customerId: 'cust-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateRequest).mockResolvedValue(mockAuth);
  });

  describe('Counter Increment on Create', () => {
    it('should increment counter from 0 to 1 when creating first URL', async () => {
      // Arrange
      const request = new Request('https://s.idling.app/api/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({ url: 'https://example.com' }),
      });

      vi.mocked(mockEnv.URL_KV.get)
        .mockResolvedValueOnce(null) // No existing short code
        .mockResolvedValueOnce(null); // No existing user URLs

      vi.mocked(mockEnv.URL_KV.put).mockResolvedValue(undefined);

      // Act
      await handleCreateShortUrl(request, mockEnv);

      // Assert
      // Should be called to get current count
      expect(mockEnv.URL_KV.get).toHaveBeenCalledWith('total_urls_count');
      // Should be called to increment counter
      expect(mockEnv.URL_KV.put).toHaveBeenCalledWith('total_urls_count', '1');
    });

    it('should increment counter from existing value', async () => {
      // Arrange
      const request = new Request('https://s.idling.app/api/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({ url: 'https://example.com' }),
      });

      // Mock the get calls in order: short code check, user URLs, counter
      vi.mocked(mockEnv.URL_KV.get)
        .mockResolvedValueOnce(null) // No existing short code
        .mockResolvedValueOnce(null) // No existing user URLs (get with type json)
        .mockResolvedValueOnce('42'); // Existing counter value

      vi.mocked(mockEnv.URL_KV.put).mockResolvedValue(undefined);

      // Act
      await handleCreateShortUrl(request, mockEnv);

      // Assert
      // Should increment from 42 to 43
      const counterPutCall = vi.mocked(mockEnv.URL_KV.put).mock.calls.find(
        (call) => call[0] === 'total_urls_count'
      );
      expect(counterPutCall).toBeDefined();
      expect(counterPutCall?.[1]).toBe('43');
    });

    it('should handle counter when it does not exist (first URL ever)', async () => {
      // Arrange
      const request = new Request('https://s.idling.app/api/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
        body: JSON.stringify({ url: 'https://example.com' }),
      });

      // Mock get calls: short code check, user URLs (with type json), counter
      vi.mocked(mockEnv.URL_KV.get).mockImplementation((key: string, options?: any) => {
        if (key === 'url_abc123') {
          return Promise.resolve(null); // No existing short code
        }
        if (key === 'user_urls_user-123' && options?.type === 'json') {
          return Promise.resolve(null); // No existing user URLs
        }
        if (key === 'total_urls_count') {
          return Promise.resolve(null); // Counter doesn't exist
        }
        return Promise.resolve(null);
      });

      vi.mocked(mockEnv.URL_KV.put).mockResolvedValue(undefined);

      // Act
      await handleCreateShortUrl(request, mockEnv);

      // Assert
      // Should create counter with value 1
      expect(mockEnv.URL_KV.put).toHaveBeenCalledWith('total_urls_count', '1');
    });
  });

  describe('Counter Decrement on Delete', () => {
    it('should decrement counter from 1 to 0', async () => {
      // Arrange
      const request = new Request('https://s.idling.app/api/delete/abc123', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer test-token',
        },
      });

      const urlData = {
        url: 'https://example.com',
        shortCode: 'abc123',
        userId: 'user-123',
        email: 'test@example.com',
        createdAt: new Date().toISOString(),
        clickCount: 0,
      };

      // Mock get calls: URL check, user URLs (with type json), counter
      vi.mocked(mockEnv.URL_KV.get).mockImplementation((key: string, options?: any) => {
        if (key === 'url_abc123') {
          return Promise.resolve(JSON.stringify(urlData)); // URL exists
        }
        if (key === 'user_urls_user-123' && options?.type === 'json') {
          return Promise.resolve([{ shortCode: 'abc123', url: 'https://example.com' }]); // User URLs
        }
        if (key === 'total_urls_count' && !options) {
          // This is the counter get call (no options)
          return Promise.resolve('1'); // Counter is 1
        }
        return Promise.resolve(null);
      });

      vi.mocked(mockEnv.URL_KV.put).mockResolvedValue(undefined);
      vi.mocked(mockEnv.URL_KV.delete).mockResolvedValue(undefined);

      // Act
      await handleDeleteUrl(request, mockEnv);

      // Assert
      // Should decrement from 1 to 0
      const counterPutCall = vi.mocked(mockEnv.URL_KV.put).mock.calls.find(
        (call) => call[0] === 'total_urls_count'
      );
      expect(counterPutCall).toBeDefined();
      expect(counterPutCall?.[1]).toBe('0');
    });

    it('should decrement counter from existing value', async () => {
      // Arrange
      const request = new Request('https://s.idling.app/api/delete/abc123', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer test-token',
        },
      });

      const urlData = {
        url: 'https://example.com',
        shortCode: 'abc123',
        userId: 'user-123',
        email: 'test@example.com',
        createdAt: new Date().toISOString(),
        clickCount: 0,
      };

      // Mock get calls: URL check, user URLs (with type json), counter
      vi.mocked(mockEnv.URL_KV.get).mockImplementation((key: string, options?: any) => {
        if (key === 'url_abc123') {
          return Promise.resolve(JSON.stringify(urlData)); // URL exists
        }
        if (key === 'user_urls_user-123' && options?.type === 'json') {
          return Promise.resolve([{ shortCode: 'abc123', url: 'https://example.com' }]); // User URLs
        }
        if (key === 'total_urls_count' && !options) {
          // This is the counter get call (no options)
          return Promise.resolve('100'); // Counter is 100
        }
        return Promise.resolve(null);
      });

      vi.mocked(mockEnv.URL_KV.put).mockResolvedValue(undefined);
      vi.mocked(mockEnv.URL_KV.delete).mockResolvedValue(undefined);

      // Act
      await handleDeleteUrl(request, mockEnv);

      // Assert
      // Should decrement from 100 to 99
      const counterPutCall = vi.mocked(mockEnv.URL_KV.put).mock.calls.find(
        (call) => call[0] === 'total_urls_count'
      );
      expect(counterPutCall).toBeDefined();
      expect(counterPutCall?.[1]).toBe('99');
    });

    it('should not decrement below 0', async () => {
      // Arrange
      const request = new Request('https://s.idling.app/api/delete/abc123', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer test-token',
        },
      });

      const urlData = {
        url: 'https://example.com',
        shortCode: 'abc123',
        userId: 'user-123',
        email: 'test@example.com',
        createdAt: new Date().toISOString(),
        clickCount: 0,
      };

      vi.mocked(mockEnv.URL_KV.get)
        .mockResolvedValueOnce(JSON.stringify(urlData)) // URL exists
        .mockResolvedValueOnce(JSON.stringify([{ shortCode: 'abc123', url: 'https://example.com' }])) // User URLs
        .mockResolvedValueOnce('0'); // Counter is already 0

      vi.mocked(mockEnv.URL_KV.put).mockResolvedValue(undefined);
      vi.mocked(mockEnv.URL_KV.delete).mockResolvedValue(undefined);

      // Act
      await handleDeleteUrl(request, mockEnv);

      // Assert
      // Should not update counter if it's already 0 or less
      // The handler checks if currentCount > 0 before decrementing
      const counterPutCalls = vi.mocked(mockEnv.URL_KV.put).mock.calls.filter(
        (call) => call[0] === 'total_urls_count'
      );
      expect(counterPutCalls.length).toBe(0);
    });

    it('should handle counter when it does not exist (should not decrement)', async () => {
      // Arrange
      const request = new Request('https://s.idling.app/api/delete/abc123', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer test-token',
        },
      });

      const urlData = {
        url: 'https://example.com',
        shortCode: 'abc123',
        userId: 'user-123',
        email: 'test@example.com',
        createdAt: new Date().toISOString(),
        clickCount: 0,
      };

      vi.mocked(mockEnv.URL_KV.get)
        .mockResolvedValueOnce(JSON.stringify(urlData)) // URL exists
        .mockResolvedValueOnce(JSON.stringify([{ shortCode: 'abc123', url: 'https://example.com' }])) // User URLs
        .mockResolvedValueOnce(null); // Counter doesn't exist

      vi.mocked(mockEnv.URL_KV.put).mockResolvedValue(undefined);
      vi.mocked(mockEnv.URL_KV.delete).mockResolvedValue(undefined);

      // Act
      await handleDeleteUrl(request, mockEnv);

      // Assert
      // Should not update counter if it doesn't exist (parseInt(null || '0') = 0, and 0 > 0 is false)
      // So it should not call put for counter
      const counterPutCalls = vi.mocked(mockEnv.URL_KV.put).mock.calls.filter(
        (call) => call[0] === 'total_urls_count'
      );
      expect(counterPutCalls.length).toBe(0);
    });
  });
});
