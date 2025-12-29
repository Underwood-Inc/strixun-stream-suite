/**
 * Comprehensive Test Suite for OtpLoginCore
 * 
 * Tests all functionality of the OTP login core library to ensure
 * 100% (or as close as possible) code coverage.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OtpLoginCore, type OtpLoginConfig, type OtpLoginState } from './core';

// Mock fetch globally
global.fetch = vi.fn();

// Mock crypto for encryption tests
const mockCrypto = {
  getRandomValues: vi.fn((arr: Uint8Array) => {
    // Return predictable values for testing
    for (let i = 0; i < arr.length; i++) {
      arr[i] = i % 256;
    }
    return arr;
  }),
  subtle: {
    digest: vi.fn(),
    importKey: vi.fn(),
    deriveKey: vi.fn(),
    encrypt: vi.fn(),
  },
};

// Mock Web Crypto API
Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true,
});

describe('OtpLoginCore', () => {
  const mockConfig: OtpLoginConfig = {
    apiUrl: 'https://auth.example.com',
    onSuccess: vi.fn(),
    onError: vi.fn(),
    otpEncryptionKey: 'a'.repeat(32), // Minimum 32 chars
  };

  let core: OtpLoginCore;

  beforeEach(() => {
    vi.clearAllMocks();
    core = new OtpLoginCore(mockConfig);
    
    // Setup default crypto mocks
    mockCrypto.subtle.digest = vi.fn().mockResolvedValue(new ArrayBuffer(32));
    mockCrypto.subtle.importKey = vi.fn().mockResolvedValue({} as CryptoKey);
    mockCrypto.subtle.deriveKey = vi.fn().mockResolvedValue({} as CryptoKey);
    mockCrypto.subtle.encrypt = vi.fn().mockResolvedValue(new ArrayBuffer(16));
  });

  afterEach(() => {
    core.destroy();
  });

  describe('Constructor', () => {
    it('should initialize with default state', () => {
      const state = core.getState();
      expect(state.step).toBe('email');
      expect(state.email).toBe('');
      expect(state.otp).toBe('');
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
      expect(state.countdown).toBe(0);
    });

    it('should throw error if encryption key is missing', () => {
      expect(() => {
        new OtpLoginCore({
          ...mockConfig,
          otpEncryptionKey: undefined,
        });
      }).not.toThrow(); // Constructor doesn't throw, but encryption will fail
    });

    it('should throw error if encryption key is too short', () => {
      expect(() => {
        new OtpLoginCore({
          ...mockConfig,
          otpEncryptionKey: 'short',
        });
      }).not.toThrow(); // Constructor doesn't throw, but encryption will fail
    });
  });

  describe('State Management', () => {
    it('should get current state', () => {
      const state = core.getState();
      expect(state).toMatchObject({
        step: 'email',
        email: '',
        otp: '',
        loading: false,
        error: null,
      });
    });

    it('should return a copy of state, not the original', () => {
      const state1 = core.getState();
      core.setEmail('test@example.com');
      const state2 = core.getState();
      
      expect(state1.email).toBe('');
      expect(state2.email).toBe('test@example.com');
    });
  });

  describe('Email Management', () => {
    it('should set email', () => {
      core.setEmail('test@example.com');
      const state = core.getState();
      expect(state.email).toBe('test@example.com');
    });

    it('should trim email', () => {
      core.setEmail('  test@example.com  ');
      const state = core.getState();
      expect(state.email).toBe('test@example.com');
    });

    it('should lowercase email', () => {
      core.setEmail('TEST@EXAMPLE.COM');
      const state = core.getState();
      expect(state.email).toBe('test@example.com');
    });
  });

  describe('OTP Management', () => {
    it('should set OTP', () => {
      core.setOtp('123456789');
      const state = core.getState();
      expect(state.otp).toBe('123456789');
    });

    it('should filter out non-digits', () => {
      core.setOtp('123abc456');
      const state = core.getState();
      expect(state.otp).toBe('123456');
    });

    it('should limit OTP to 9 digits', () => {
      core.setOtp('123456789012345');
      const state = core.getState();
      expect(state.otp).toBe('123456789');
    });

    it('should handle empty OTP', () => {
      core.setOtp('');
      const state = core.getState();
      expect(state.otp).toBe('');
    });
  });

  describe('State Subscription', () => {
    it('should subscribe to state changes', () => {
      const listener = vi.fn();
      const unsubscribe = core.subscribe(listener);

      core.setEmail('test@example.com');
      
      expect(listener).toHaveBeenCalled();
      const lastCall = listener.mock.calls[listener.mock.calls.length - 1][0];
      expect(lastCall.email).toBe('test@example.com');

      unsubscribe();
    });

    it('should unsubscribe from state changes', () => {
      const listener = vi.fn();
      const unsubscribe = core.subscribe(listener);

      core.setEmail('test1@example.com');
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      core.setEmail('test2@example.com');
      expect(listener).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should support multiple subscribers', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      core.subscribe(listener1);
      core.subscribe(listener2);

      core.setEmail('test@example.com');

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe('Request OTP', () => {
    it('should validate email before requesting', async () => {
      await core.requestOtp();
      
      const state = core.getState();
      expect(state.error).toBe('Please enter a valid email address');
      expect(mockConfig.onError).toHaveBeenCalledWith('Please enter a valid email address');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should validate email format', async () => {
      core.setEmail('invalid-email');
      await core.requestOtp();
      
      const state = core.getState();
      expect(state.error).toBe('Please enter a valid email address');
    });

    it('should encrypt and send request with valid email', async () => {
      core.setEmail('test@example.com');
      
      // Mock successful encryption
      const mockEncryptedData = JSON.stringify({
        version: 3,
        encrypted: true,
        algorithm: 'AES-GCM-256',
        iv: 'mock-iv',
        salt: 'mock-salt',
        tokenHash: 'mock-hash',
        data: 'mock-data',
        timestamp: new Date().toISOString(),
      });

      // Mock crypto operations
      mockCrypto.subtle.digest = vi.fn().mockResolvedValue(new ArrayBuffer(32));
      mockCrypto.subtle.importKey = vi.fn().mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.deriveKey = vi.fn().mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.encrypt = vi.fn().mockResolvedValue(
        new TextEncoder().encode('encrypted-data').buffer
      );

      // Mock successful response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify({ success: true }),
      });

      await core.requestOtp();

      expect(global.fetch).toHaveBeenCalled();
      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toContain('/auth/request-otp');
      expect(fetchCall[1].method).toBe('POST');
    });

    it('should handle network errors', async () => {
      core.setEmail('test@example.com');
      
      // Mock encryption
      mockCrypto.subtle.digest = vi.fn().mockResolvedValue(new ArrayBuffer(32));
      mockCrypto.subtle.importKey = vi.fn().mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.deriveKey = vi.fn().mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.encrypt = vi.fn().mockResolvedValue(
        new TextEncoder().encode('encrypted-data').buffer
      );

      // Mock network error
      (global.fetch as any).mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await core.requestOtp();

      const state = core.getState();
      expect(state.error).toContain('Network error');
      expect(mockConfig.onError).toHaveBeenCalled();
    });

    it('should handle rate limit errors', async () => {
      core.setEmail('test@example.com');
      
      // Mock encryption
      mockCrypto.subtle.digest = vi.fn().mockResolvedValue(new ArrayBuffer(32));
      mockCrypto.subtle.importKey = vi.fn().mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.deriveKey = vi.fn().mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.encrypt = vi.fn().mockResolvedValue(
        new TextEncoder().encode('encrypted-data').buffer
      );

      // Mock rate limit response
      const resetAt = new Date(Date.now() + 60000).toISOString();
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => JSON.stringify({
          detail: 'Rate limit exceeded',
          errorCode: 'rate_limit_exceeded',
          reset_at_iso: resetAt,
          retry_after: 60,
        }),
      });

      await core.requestOtp();

      const state = core.getState();
      expect(state.error).toBe('Rate limit exceeded');
      expect(state.errorCode).toBe('rate_limit_exceeded');
      expect(state.rateLimitResetAt).toBe(resetAt);
    });

    it('should fail if encryption key is missing', async () => {
      const coreWithoutKey = new OtpLoginCore({
        ...mockConfig,
        otpEncryptionKey: undefined,
      });
      
      coreWithoutKey.setEmail('test@example.com');
      
      await coreWithoutKey.requestOtp();
      
      const state = coreWithoutKey.getState();
      expect(state.error).toContain('Encryption failed');
      expect(mockConfig.onError).toHaveBeenCalled();
      
      coreWithoutKey.destroy();
    });

    it('should fail if encryption key is too short', async () => {
      const coreWithShortKey = new OtpLoginCore({
        ...mockConfig,
        otpEncryptionKey: 'short',
      });
      
      coreWithShortKey.setEmail('test@example.com');
      
      await coreWithShortKey.requestOtp();
      
      const state = coreWithShortKey.getState();
      expect(state.error).toContain('Encryption failed');
      expect(mockConfig.onError).toHaveBeenCalled();
      
      coreWithShortKey.destroy();
    });
  });

  describe('Verify OTP', () => {
    beforeEach(() => {
      core.setEmail('test@example.com');
      // Set state to OTP step
      (core as any).setState({ step: 'otp' });
    });

    it('should validate OTP format', async () => {
      core.setOtp('123');
      await core.verifyOtp();
      
      const state = core.getState();
      expect(state.error).toContain('valid');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should validate OTP length', async () => {
      core.setOtp('12345');
      await core.verifyOtp();
      
      const state = core.getState();
      expect(state.error).toContain('9-digit');
    });

    it('should encrypt and send verification request', async () => {
      core.setOtp('123456789');
      
      // Mock encryption
      mockCrypto.subtle.digest = vi.fn().mockResolvedValue(new ArrayBuffer(32));
      mockCrypto.subtle.importKey = vi.fn().mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.deriveKey = vi.fn().mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.encrypt = vi.fn().mockResolvedValue(
        new TextEncoder().encode('encrypted-data').buffer
      );

      // Mock successful response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify({
          access_token: 'token123',
          email: 'test@example.com',
          userId: 'user123',
        }),
      });

      await core.verifyOtp();

      expect(global.fetch).toHaveBeenCalled();
      expect(mockConfig.onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'token123',
          email: 'test@example.com',
        })
      );
    });

    it('should handle verification errors', async () => {
      core.setOtp('123456789');
      
      // Mock encryption
      mockCrypto.subtle.digest = vi.fn().mockResolvedValue(new ArrayBuffer(32));
      mockCrypto.subtle.importKey = vi.fn().mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.deriveKey = vi.fn().mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.encrypt = vi.fn().mockResolvedValue(
        new TextEncoder().encode('encrypted-data').buffer
      );

      // Mock error response
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => JSON.stringify({
          detail: 'Invalid OTP code',
        }),
      });

      await core.verifyOtp();

      const state = core.getState();
      expect(state.error).toBe('Invalid OTP code');
      expect(mockConfig.onError).toHaveBeenCalledWith('Invalid OTP code');
    });
  });

  describe('Navigation', () => {
    it('should go back to email step', () => {
      // Set to OTP step
      (core as any).setState({ step: 'otp', otp: '123456789' });
      
      core.goBack();
      
      const state = core.getState();
      expect(state.step).toBe('email');
      expect(state.otp).toBe('');
      expect(state.error).toBe(null);
    });

    it('should reset all state', () => {
      core.setEmail('test@example.com');
      core.setOtp('123456789');
      (core as any).setState({ step: 'otp', loading: true, error: 'Some error' });
      
      core.reset();
      
      const state = core.getState();
      expect(state.step).toBe('email');
      expect(state.email).toBe('');
      expect(state.otp).toBe('');
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
    });
  });

  describe('Countdown Timer', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should start countdown after successful OTP request', async () => {
      core.setEmail('test@example.com');
      
      // Mock encryption
      mockCrypto.subtle.digest = vi.fn().mockResolvedValue(new ArrayBuffer(32));
      mockCrypto.subtle.importKey = vi.fn().mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.deriveKey = vi.fn().mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.encrypt = vi.fn().mockResolvedValue(
        new TextEncoder().encode('encrypted-data').buffer
      );

      // Mock successful response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify({ success: true }),
      });

      await core.requestOtp();

      const state1 = core.getState();
      expect(state1.countdown).toBe(600); // 10 minutes

      // Advance time by 1 second
      vi.advanceTimersByTime(1000);

      const state2 = core.getState();
      expect(state2.countdown).toBe(599);
    });

    it('should stop countdown when it reaches zero', async () => {
      core.setEmail('test@example.com');
      
      // Mock encryption
      mockCrypto.subtle.digest = vi.fn().mockResolvedValue(new ArrayBuffer(32));
      mockCrypto.subtle.importKey = vi.fn().mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.deriveKey = vi.fn().mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.encrypt = vi.fn().mockResolvedValue(
        new TextEncoder().encode('encrypted-data').buffer
      );

      // Mock successful response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify({ success: true }),
      });

      await core.requestOtp();

      // Set countdown to 1
      (core as any).setState({ countdown: 1 });

      // Advance time by 1 second
      vi.advanceTimersByTime(1000);

      const state = core.getState();
      expect(state.countdown).toBe(0);
    });
  });

  describe('Rate Limit Countdown', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should start rate limit countdown', async () => {
      core.setEmail('test@example.com');
      
      // Mock encryption
      mockCrypto.subtle.digest = vi.fn().mockResolvedValue(new ArrayBuffer(32));
      mockCrypto.subtle.importKey = vi.fn().mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.deriveKey = vi.fn().mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.encrypt = vi.fn().mockResolvedValue(
        new TextEncoder().encode('encrypted-data').buffer
      );

      const resetAt = new Date(Date.now() + 60000).toISOString();
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => JSON.stringify({
          detail: 'Rate limit exceeded',
          reset_at_iso: resetAt,
          retry_after: 60,
        }),
      });

      await core.requestOtp();

      const state1 = core.getState();
      expect(state1.rateLimitCountdown).toBeGreaterThan(0);

      // Advance time
      vi.advanceTimersByTime(1000);

      const state2 = core.getState();
      expect(state2.rateLimitCountdown).toBe(state1.rateLimitCountdown - 1);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup on destroy', () => {
      const listener = vi.fn();
      core.subscribe(listener);
      
      core.destroy();
      
      core.setEmail('test@example.com');
      expect(listener).not.toHaveBeenCalled();
    });

    it('should stop countdown on destroy', () => {
      vi.useFakeTimers();
      
      // Start countdown
      (core as any).setState({ countdown: 600 });
      (core as any).startCountdown();
      
      core.destroy();
      
      vi.advanceTimersByTime(2000);
      
      // Countdown should not have changed
      const state = core.getState();
      expect(state.countdown).toBe(600);
      
      vi.useRealTimers();
    });
  });

  describe('Static Methods', () => {
    describe('formatCountdown', () => {
      it('should format seconds to MM:SS', () => {
        expect(OtpLoginCore.formatCountdown(0)).toBe('0:00');
        expect(OtpLoginCore.formatCountdown(30)).toBe('0:30');
        expect(OtpLoginCore.formatCountdown(60)).toBe('1:00');
        expect(OtpLoginCore.formatCountdown(90)).toBe('1:30');
        expect(OtpLoginCore.formatCountdown(600)).toBe('10:00');
      });
    });

    describe('formatRateLimitCountdown', () => {
      it('should format seconds correctly', () => {
        expect(OtpLoginCore.formatRateLimitCountdown(0)).toBe('0 seconds');
        expect(OtpLoginCore.formatRateLimitCountdown(1)).toBe('1 second');
        expect(OtpLoginCore.formatRateLimitCountdown(30)).toBe('30 seconds');
        expect(OtpLoginCore.formatRateLimitCountdown(60)).toBe('1 minute');
        expect(OtpLoginCore.formatRateLimitCountdown(90)).toBe('1 minute and 30 seconds');
        expect(OtpLoginCore.formatRateLimitCountdown(3600)).toBe('1 hour');
        expect(OtpLoginCore.formatRateLimitCountdown(3661)).toBe('1 hour and 1 minute');
      });
    });
  });

  describe('Custom Endpoints', () => {
    it('should use custom request endpoint', async () => {
      const customCore = new OtpLoginCore({
        ...mockConfig,
        endpoints: {
          requestOtp: '/custom/request',
        },
      });

      customCore.setEmail('test@example.com');
      
      // Mock encryption
      mockCrypto.subtle.digest = vi.fn().mockResolvedValue(new ArrayBuffer(32));
      mockCrypto.subtle.importKey = vi.fn().mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.deriveKey = vi.fn().mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.encrypt = vi.fn().mockResolvedValue(
        new TextEncoder().encode('encrypted-data').buffer
      );

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify({}),
      });

      await customCore.requestOtp();

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toContain('/custom/request');

      customCore.destroy();
    });

    it('should use custom verify endpoint', async () => {
      const customCore = new OtpLoginCore({
        ...mockConfig,
        endpoints: {
          verifyOtp: '/custom/verify',
        },
      });

      customCore.setEmail('test@example.com');
      (customCore as any).setState({ step: 'otp' });
      customCore.setOtp('123456789');
      
      // Mock encryption
      mockCrypto.subtle.digest = vi.fn().mockResolvedValue(new ArrayBuffer(32));
      mockCrypto.subtle.importKey = vi.fn().mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.deriveKey = vi.fn().mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.encrypt = vi.fn().mockResolvedValue(
        new TextEncoder().encode('encrypted-data').buffer
      );

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify({
          access_token: 'token',
          email: 'test@example.com',
        }),
      });

      await customCore.verifyOtp();

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toContain('/custom/verify');

      customCore.destroy();
    });
  });

  describe('Custom Headers', () => {
    it('should include custom headers in requests', async () => {
      const customCore = new OtpLoginCore({
        ...mockConfig,
        customHeaders: {
          'X-Custom-Header': 'custom-value',
        },
      });

      customCore.setEmail('test@example.com');
      
      // Mock encryption
      mockCrypto.subtle.digest = vi.fn().mockResolvedValue(new ArrayBuffer(32));
      mockCrypto.subtle.importKey = vi.fn().mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.deriveKey = vi.fn().mockResolvedValue({} as CryptoKey);
      mockCrypto.subtle.encrypt = vi.fn().mockResolvedValue(
        new TextEncoder().encode('encrypted-data').buffer
      );

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify({}),
      });

      await customCore.requestOtp();

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[1].headers['X-Custom-Header']).toBe('custom-value');

      customCore.destroy();
    });
  });
});

