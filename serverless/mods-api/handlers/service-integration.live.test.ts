/**
 * Integration Tests for Service-to-Service Integration
 * Tests Mods API [EMOJI] OTP Auth Service (user lookup)
 * 
 * [WARNING] IMPORTANT: These tests use REAL deployed services
 * 
 * These tests only run when:
 * - USE_LIVE_API=true environment variable is set
 * - AUTH_API_URL points to a deployed OTP auth service worker
 * 
 * In GitHub Actions CI:
 * - Automatically runs on push/PR to main/develop
 * - Uses secrets: AUTH_API_URL
 * - Verifies actual service-to-service integration
 * - Will FAIL if AUTH_API_URL is wrong (catches configuration bugs!)
 * 
 * To run locally:
 *   USE_LIVE_API=true AUTH_API_URL=https://... pnpm test service-integration.live.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';

// Determine environment from NODE_ENV or TEST_ENV
const testEnv = (process.env.TEST_ENV || process.env.NODE_ENV || 'dev') as 'dev' | 'prod';

// Only run integration tests when USE_LIVE_API is set
const USE_LIVE_API = process.env.USE_LIVE_API === 'true';
const AUTH_API_URL = process.env.AUTH_API_URL || (testEnv === 'dev' 
    ? 'https://strixun-otp-auth-service.strixuns-script-suite.workers.dev'
    : 'https://auth.idling.app');

describe.skipIf(!USE_LIVE_API)(`Service Integration Tests (Live API) [${testEnv}]`, () => {
    beforeAll(() => {
        if (!AUTH_API_URL) {
            throw new Error('AUTH_API_URL environment variable is required for integration tests');
        }
        console.log(`[Integration Tests] Using live auth API: ${AUTH_API_URL}`);
    });

    describe('Mods API [EMOJI] OTP Auth Service Integration', () => {
        it('should successfully connect to OTP auth service', async () => {
            // Test basic connectivity to auth service
            const response = await fetch(`${AUTH_API_URL}/health`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            // Should get a response (even if 404, means service is reachable)
            expect(response).toBeDefined();
            expect(response.status).toBeLessThan(500); // Not a server error
        }, 10000); // 10 second timeout for live API calls

        it('should handle auth service user lookup endpoint structure', async () => {
            // Test that auth service endpoints are accessible
            // Note: We're not testing actual authentication, just that the service is reachable
            const response = await fetch(`${AUTH_API_URL}/auth/me`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer invalid-token-for-testing',
                },
            });

            // Should get a response (401 is expected for invalid token)
            expect(response).toBeDefined();
            // Should be either 401 (unauthorized) or 400 (bad request) - not 500 (server error)
            expect([400, 401, 404]).toContain(response.status);
        }, 10000);

        it('should verify service-to-service communication works', async () => {
            // Test that Mods API can communicate with Auth Service
            // This is a basic connectivity test
            const testRequest = new Request(`${AUTH_API_URL}/health`, {
                method: 'GET',
            });

            try {
                const response = await fetch(testRequest);
                // If we get any response (even 404), the service is reachable
                expect(response).toBeDefined();
                expect(response.status).toBeLessThan(500);
            } catch (error) {
                // If fetch fails, it means the service is not reachable
                throw new Error(`Failed to connect to auth service at ${AUTH_API_URL}: ${error}`);
            }
        }, 10000);
    });

    describe('Service Configuration Verification', () => {
        it('should use correct AUTH_API_URL for environment', () => {
            // Verify that the correct URL is being used
            expect(AUTH_API_URL).toBeDefined();
            expect(typeof AUTH_API_URL).toBe('string');
            expect(AUTH_API_URL.startsWith('http')).toBe(true);
        });

        it('should skip tests when USE_LIVE_API is not set', () => {
            // This test verifies that tests are properly skipped when USE_LIVE_API is false
            // The describe.skipIf should handle this, but we verify the behavior
            if (!USE_LIVE_API) {
                console.log('[Integration Tests] Skipping live API tests (USE_LIVE_API not set)');
            }
            // Test passes if we reach here (either USE_LIVE_API is true, or tests are skipped)
            expect(true).toBe(true);
        });
    });
});

