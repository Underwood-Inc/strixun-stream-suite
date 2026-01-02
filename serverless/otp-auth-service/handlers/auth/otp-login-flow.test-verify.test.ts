/**
 * Test Verification - Proves integration test infrastructure works
 * This test doesn't require services to be running - it just verifies the test code is correct
 */

import { describe, it, expect } from 'vitest';
import { loadTestConfig } from '../../utils/test-config-loader.js';

describe('Integration Test Infrastructure Verification', () => {
  it('should load test config correctly', () => {
    const config = loadTestConfig('dev');
    
    expect(config.customerApiUrl).toBe('http://localhost:8790');
    expect(config.otpAuthServiceUrl).toBe('http://localhost:8787');
    expect(config.customerApiUrl).toContain('localhost');
    expect(config.otpAuthServiceUrl).toContain('localhost');
  });

  it('should reject non-localhost URLs', () => {
    // Temporarily override to test validation
    const originalEnv = process.env.CUSTOMER_API_URL;
    
    try {
      process.env.CUSTOMER_API_URL = 'https://deployed-worker.workers.dev';
      expect(() => loadTestConfig('dev')).toThrow('must point to localhost');
    } finally {
      if (originalEnv) {
        process.env.CUSTOMER_API_URL = originalEnv;
      } else {
        delete process.env.CUSTOMER_API_URL;
      }
    }
  });

  it('should allow localhost URLs', () => {
    const config = loadTestConfig('dev');
    expect(config.customerApiUrl).toMatch(/localhost|127\.0\.0\.1/);
    expect(config.otpAuthServiceUrl).toMatch(/localhost|127\.0\.0\.1/);
  });
});
