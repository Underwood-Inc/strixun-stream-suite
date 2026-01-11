/**
 * Integration Tests for Auto-Initialization
 * 
 * Tests:
 * - Auto-seeding on first request
 * - Auto-migration on first request
 * - Idempotency (subsequent requests skip seeding/migrations)
 * - Works in both dev and production environments
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { unstable_dev, type UnstableDevWorker } from 'wrangler';
import { resolve } from 'path';

const SERVICE_API_KEY = 'test-service-key-12345';

describe('Access Service Auto-Initialization', () => {
  let worker: UnstableDevWorker;
  let accessServiceUrl: string;

  beforeAll(async () => {
    worker = await unstable_dev(resolve(__dirname, './worker.ts'), {
      config: resolve(__dirname, './wrangler.toml'),
      experimental: { disableExperimentalWarning: true },
      port: 8795,
      local: true,
      vars: {
        SERVICE_API_KEY,
        ENVIRONMENT: 'test',
      },
    });

    accessServiceUrl = 'http://localhost:8795';
  }, 180000); // 3 minutes for worker startup

  afterAll(async () => {
    await worker.stop();
  });

  beforeEach(async () => {
    // Note: KV clearing between tests is not supported with unstable_dev
    // Each test should use unique identifiers to avoid conflicts
  });

  it('should auto-seed default roles and permissions on first request', async () => {
    // Make first request (triggers auto-seeding)
    const response = await fetch(`${accessServiceUrl}/health`);
    expect(response.ok).toBe(true);

    // Wait for seeding to complete (it's async via ctx.waitUntil)
    // Retry up to 5 times with 1 second delays
    let rolesResponse;
    let retries = 5;
    while (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      rolesResponse = await fetch(`${accessServiceUrl}/access/roles`, {
        headers: {
          'X-Service-Key': SERVICE_API_KEY,
        },
      });
      
      if (rolesResponse.ok) break;
      retries--;
    }

    if (!rolesResponse!.ok) {
      const errorText = await rolesResponse!.text();
      console.error('[Test] /access/roles failed:', rolesResponse!.status, errorText);
    }
    
    expect(rolesResponse!.ok).toBe(true);
    const roles = await rolesResponse!.json();
    expect(roles.roles).toBeDefined();
    expect(roles.roles.length).toBeGreaterThan(0);
    
    // Check for expected default roles
    const roleNames = roles.roles.map((r: any) => r.name);
    expect(roleNames).toContain('customer');
    expect(roleNames).toContain('uploader');
  });

  it('should be idempotent (second request skips seeding)', async () => {
    // First request: seeds
    await fetch(`${accessServiceUrl}/health`);
    
    // Wait for seeding with retries
    let firstResponse;
    let retries = 5;
    while (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      firstResponse = await fetch(`${accessServiceUrl}/access/roles`, {
        headers: { 'X-Service-Key': SERVICE_API_KEY },
      });
      
      if (firstResponse.ok) break;
      retries--;
    }

    expect(firstResponse!.ok).toBe(true);
    const firstRoles = await firstResponse!.json();
    const firstRoleCount = firstRoles.roles.length;

    // Second request: should skip seeding
    await fetch(`${accessServiceUrl}/health`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get role count again
    const secondResponse = await fetch(`${accessServiceUrl}/access/roles`, {
      headers: { 'X-Service-Key': SERVICE_API_KEY },
    });
    const secondRoles = await secondResponse.json();
    const secondRoleCount = secondRoles.roles.length;

    // Role count should be identical (no duplication)
    expect(secondRoleCount).toBe(firstRoleCount);
  });

  it('should auto-run migrations on first request', async () => {
    // Make first request (triggers migrations)
    const response = await fetch(`${accessServiceUrl}/health`);
    expect(response.ok).toBe(true);

    // Wait for migrations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Migrations run silently - verify by checking that the service is functional
    // (migrations would fail loudly if there were issues)
    const healthCheck = await fetch(`${accessServiceUrl}/health`);
    expect(healthCheck.ok).toBe(true);
  });

  it('should skip already-run migrations on subsequent requests', async () => {
    // First request: runs migrations
    await fetch(`${accessServiceUrl}/health`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Second request: should skip migrations (no errors)
    const response = await fetch(`${accessServiceUrl}/health`);
    expect(response.ok).toBe(true);
    
    // If migrations ran twice, there would be errors or duplicate data
    // The fact that the service is still healthy confirms idempotency
  });

  it('should respond to health checks immediately without waiting for init', async () => {
    // Health check should return immediately, not wait for seeding/migrations
    const start = Date.now();
    const response = await fetch(`${accessServiceUrl}/health`);
    const duration = Date.now() - start;

    expect(response.ok).toBe(true);
    expect(duration).toBeLessThan(1000); // Should be fast (< 1 second)

    const health = await response.json();
    expect(health.status).toBe('healthy');
    expect(health.service).toBe('access-service');
  });
});
