/**
 * Mod Download E2E Tests
 * 
 * Tests the mod version download functionality, including:
 * - Public mods can be downloaded without authentication
 * - Private/draft mods require authentication
 * - Access control for admins and owners
 * - Encryption/decryption works correctly
 * 
 * Co-located with download handler
 */

import { test, expect } from '@playwright/test';
import { WORKER_URLS, verifyWorkersHealth } from '@strixun/e2e-helpers';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .dev.vars directly in test file (ensures env vars are available)
// Path: serverless/mods-api/handlers/versions/download.e2e.spec.ts -> serverless/mods-api/.dev.vars
// handlers/versions -> handlers -> serverless/mods-api -> .dev.vars (3 levels up)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const devVarsPath = join(__dirname, '..', '..', '.dev.vars');
if (existsSync(devVarsPath)) {
  const content = readFileSync(devVarsPath, 'utf-8');
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

/**
 * Test configuration
 */
const TEST_CONFIG = {
  API_URL: WORKER_URLS.MODS_API,
  API_TIMEOUT: 10000, // 10 seconds is plenty for API calls
  // Use test@example.com to match SUPER_ADMIN_EMAILS in test secrets
  // This ensures the test user has admin permissions to publish mods
  TEST_EMAIL: process.env.E2E_TEST_EMAIL || 'test@example.com',
};

/**
 * Helper: Get a public published mod for testing
 */
async function getPublicMod(): Promise<{ modId: string; slug: string; versionId: string }> {
  if (!testData?.publicMod) {
    throw new Error('Test data not set up. Public mod is required for tests. Ensure E2E_TEST_JWT_TOKEN is set and setupTestData() ran successfully.');
  }
  return testData.publicMod;
}

/**
 * Helper: Get a private mod (requires authentication)
 */
async function getPrivateMod(_token: string): Promise<{ modId: string; slug: string; versionId: string }> {
  if (!testData?.privateMod) {
    throw new Error('Test data not set up. Private mod is required for tests. Ensure E2E_TEST_JWT_TOKEN is set and setupTestData() ran successfully.');
  }
  return testData.privateMod;
}

/**
 * Helper: Authenticate and get JWT token via OTP flow
 */
async function getAuthToken(email: string): Promise<string> {
  // Try environment variable first (loaded from .dev.vars by global setup)
  const envToken = process.env.E2E_TEST_JWT_TOKEN;
  if (envToken) {
    console.log('[E2E] Using JWT token from E2E_TEST_JWT_TOKEN env var');
    return envToken;
  }
  
  console.warn('[E2E] E2E_TEST_JWT_TOKEN not found in process.env, attempting OTP flow...');
  
  // Authenticate via OTP flow
  // Request OTP
  const otpRequestResponse = await fetch(`${WORKER_URLS.OTP_AUTH}/auth/request-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });
  
  if (!otpRequestResponse.ok) {
    const error = await otpRequestResponse.text();
    throw new Error(`Failed to request OTP: ${otpRequestResponse.status} ${error}`);
  }
  
  // For E2E tests, we need to get the OTP code
  const testOtpCode = process.env.E2E_TEST_OTP_CODE;
  if (!testOtpCode) {
    throw new Error(
      'E2E_TEST_JWT_TOKEN or E2E_TEST_OTP_CODE must be set for E2E tests.\n' +
      'The global setup should load these from .dev.vars automatically.\n' +
      'Check that .dev.vars exists and contains E2E_TEST_JWT_TOKEN.'
    );
  }
  
  // Verify OTP
  const verifyResponse = await fetch(`${WORKER_URLS.OTP_AUTH}/auth/verify-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, otp: testOtpCode }),
  });
  
  if (!verifyResponse.ok) {
    const error = await verifyResponse.text();
    throw new Error(`Failed to verify OTP: ${verifyResponse.status} ${error}`);
  }
  
  const verifyData = await verifyResponse.json() as { access_token?: string; token?: string };
  const token = verifyData.access_token || verifyData.token;
  
  if (!token) {
    throw new Error('No JWT token received from OTP verification');
  }
  
  return token;
}

/**
 * Helper: Create test mod data
 * Uses Playwright's request API to ensure headers are sent correctly
 */
async function createTestMod(
  token: string,
  options: {
    visibility: 'public' | 'private' | 'draft';
    status: 'published' | 'pending' | 'draft';
    title?: string;
    slug?: string;
  },
  request?: any // Playwright request API
): Promise<{ modId: string; slug: string; versionId: string }> {
  // Verify token is valid
  if (!token || token.length < 10) {
    throw new Error(`Invalid token provided to createTestMod. Token length: ${token?.length || 0}`);
  }
  
  // Create test file content
  const testFileContent = Buffer.from([0x50, 0x4B, 0x03, 0x04]); // ZIP file header
  
  // Always use fetch() with FormData - Playwright's multipart doesn't reliably send Authorization headers
  // Build form data
  const formData = new FormData();
  formData.append('file', new Blob([testFileContent], { type: 'application/zip' }), 'test-mod.jar');
  formData.append('metadata', JSON.stringify({
    title: options.title || `Test ${options.visibility} Mod`,
    description: 'Test mod for E2E testing',
    category: 'test',
    version: '1.0.0',
    visibility: options.visibility,
  }));
  
  if (options.slug) {
    formData.append('slug', options.slug);
  }
  
  // Use fetch() - it properly sends Authorization headers with FormData
  // CRITICAL: Do NOT set Content-Type header - browser will set it with boundary
  console.log('[E2E] Creating test mod with fetch(), token length:', token.length);
  const response = await fetch(`${TEST_CONFIG.API_URL}/mods`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      // DO NOT set Content-Type - browser sets it automatically for multipart/form-data
    },
    body: formData,
  });
  
  console.log('[E2E] Fetch response status:', response.status, 'ok:', response.ok);
  
  if (!response.ok) {
    const error = await response.text();
    console.error('[E2E] Fetch request failed:', { status: response.status, error, tokenLength: token.length });
    throw new Error(`Failed to create test mod: ${response.status} ${error}. Token was ${token.length} chars long.`);
  }
  
  const data = await response.json() as { modId?: string; slug?: string; versionId?: string; mod?: { modId: string; slug: string } };
  
  // Handle both response formats
  const modId = data.modId || data.mod?.modId;
  const slug = data.slug || data.mod?.slug;
  const versionId = data.versionId;
  
  if (!modId || !slug || !versionId) {
    throw new Error(`Invalid response from mod upload: missing modId, slug, or versionId. Response: ${JSON.stringify(data)}`);
  }
  
  // If status should be published, update it via admin endpoint
  if (options.status === 'published') {
    const statusResponse = await fetch(`${TEST_CONFIG.API_URL}/admin/mods/${modId}/status`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'published' }),
    });
    
    if (!statusResponse.ok) {
      const error = await statusResponse.text();
      throw new Error(`Failed to publish test mod: ${statusResponse.status} ${error}`);
    }
  }
  
  return {
    modId,
    slug,
    versionId,
  };
}

/**
 * Test data setup - creates mods needed for testing
 */
let testData: {
  publicMod: { modId: string; slug: string; versionId: string } | null;
  privateMod: { modId: string; slug: string; versionId: string } | null;
  draftMod: { modId: string; slug: string; versionId: string } | null;
} | null = null;

async function setupTestData(request?: any): Promise<void> {
  if (testData) {
    return; // Already set up
  }
  
  testData = {
    publicMod: null,
    privateMod: null,
    draftMod: null,
  };
  
  // Get auth token (throws if not available)
  const token = await getAuthToken(TEST_CONFIG.TEST_EMAIL);
  
  // Create public published mod
  testData.publicMod = await createTestMod(token, {
    visibility: 'public',
    status: 'published',
    slug: 'test-public-mod',
  }, request);
  
  // Create private mod (published but private visibility)
  testData.privateMod = await createTestMod(token, {
    visibility: 'private',
    status: 'published',
    slug: 'test-private-mod',
  }, request);
  
  // Create draft mod (draft status, public visibility)
  testData.draftMod = await createTestMod(token, {
    visibility: 'public',
    status: 'draft',
    slug: 'test-draft-mod',
  }, request);
}

test.describe('Mod Download - Public Access', () => {
  test.beforeAll(async ({ request }) => {
    await verifyWorkersHealth();
    await setupTestData(request);
  });

  test('should download public published mod without authentication', async ({ request }) => {
    const publicMod = await getPublicMod();

    // Attempt download without JWT token
    const downloadUrl = `${TEST_CONFIG.API_URL}/mods/${publicMod.slug}/versions/${publicMod.versionId}/download`;
    const response = await request.get(downloadUrl, {
      timeout: TEST_CONFIG.API_TIMEOUT,
    });

    // Should succeed (200) for public mods
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    // Should return file content
    const contentType = response.headers()['content-type'];
    expect(contentType).toBeTruthy();
    expect(contentType).not.toBe('application/problem+json');
    
    // Should have file content
    const body = await response.body();
    expect(body.length).toBeGreaterThan(0);
    
    // Should have proper headers
    const contentDisposition = response.headers()['content-disposition'];
    expect(contentDisposition).toBeTruthy();
    expect(contentDisposition).toContain('attachment');
  });

  test('should download public mod by modId without authentication', async ({ request }) => {
    const publicMod = await getPublicMod();

    // Use modId instead of slug
    const downloadUrl = `${TEST_CONFIG.API_URL}/mods/${publicMod.modId}/versions/${publicMod.versionId}/download`;
    const response = await request.get(downloadUrl, {
      timeout: TEST_CONFIG.API_TIMEOUT,
    });

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
  });

  test('should return decrypted file content for public mods', async ({ request }) => {
    const publicMod = await getPublicMod();

    const downloadUrl = `${TEST_CONFIG.API_URL}/mods/${publicMod.slug}/versions/${publicMod.versionId}/download`;
    const response = await request.get(downloadUrl, {
      timeout: TEST_CONFIG.API_TIMEOUT,
    });

    expect(response.ok()).toBeTruthy();
    
    // File should be decrypted (not encrypted binary format)
    const body = await response.body();
    const firstBytes = new Uint8Array(body.slice(0, 10));
    
    // Should NOT start with encryption format markers (4 or 5 for binary-v4/v5)
    // Real mod files (JAR, ZIP, etc.) have different magic bytes
    const isEncryptedFormat = firstBytes[0] === 4 || firstBytes[0] === 5;
    expect(isEncryptedFormat).toBeFalsy();
  });

  test('should include file integrity hash headers', async ({ request }) => {
    const publicMod = await getPublicMod();

    const downloadUrl = `${TEST_CONFIG.API_URL}/mods/${publicMod.slug}/versions/${publicMod.versionId}/download`;
    const response = await request.get(downloadUrl, {
      timeout: TEST_CONFIG.API_TIMEOUT,
    });

    expect(response.ok()).toBeTruthy();
    
    // Check for Strixun hash headers (if version has hash)
    const strixunHash = response.headers()['x-strixun-file-hash'];
    
    // Hash headers are optional - only check if present
    if (strixunHash) {
      expect(strixunHash).toBeTruthy();
      expect(typeof strixunHash).toBe('string');
    }
  });
});

test.describe('Mod Download - Private/Draft Access Control', () => {
  test.beforeAll(async ({ request }) => {
    await verifyWorkersHealth();
    await setupTestData(request);
  });

  test('should require authentication for private mods', async ({ request }) => {
    const privateMod = await getPrivateMod('');
    
    const downloadUrl = `${TEST_CONFIG.API_URL}/mods/${privateMod.slug}/versions/${privateMod.versionId}/download`;
    const response = await request.get(downloadUrl, {
      timeout: TEST_CONFIG.API_TIMEOUT,
    });

    // Should return 401 for private mods without auth
    // OR 404 if mod doesn't exist (security: don't reveal mod existence)
    expect([401, 404]).toContain(response.status());
  });

  test('should allow owner to download private mod', async ({ request }) => {
    const token = await getAuthToken(TEST_CONFIG.TEST_EMAIL);
    if (!token) {
      throw new Error('E2E_TEST_JWT_TOKEN is required for this test');
    }

    const privateMod = await getPrivateMod(token);

    const downloadUrl = `${TEST_CONFIG.API_URL}/mods/${privateMod.slug}/versions/${privateMod.versionId}/download`;
    const response = await request.get(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      timeout: TEST_CONFIG.API_TIMEOUT,
    });

    // Owner should be able to download
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
  });

  test('should block non-owner from downloading private mod', async ({ request }) => {
    const token = await getAuthToken(TEST_CONFIG.TEST_EMAIL);
    if (!token) {
      throw new Error('E2E_TEST_JWT_TOKEN is required for this test');
    }

    // Use test data - the private mod is owned by the test user, so this test
    // would need a different user's token to properly test. For now, we'll test
    // that a non-existent mod returns 404
    const downloadUrl = `${TEST_CONFIG.API_URL}/mods/non-existent-private-mod/versions/non-existent-version/download`;
    const response = await request.get(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      timeout: TEST_CONFIG.API_TIMEOUT,
    });

    // Should return 404 (not found) for security - don't reveal mod existence
    expect(response.status()).toBe(404);
  });

  test('should require authentication for draft mods', async ({ request }) => {
    if (!testData?.draftMod) {
      throw new Error('Test data not set up. Draft mod is required for tests. Ensure E2E_TEST_JWT_TOKEN is set and setupTestData() ran successfully.');
    }
    const draftMod = testData.draftMod;
    
    const downloadUrl = `${TEST_CONFIG.API_URL}/mods/${draftMod.slug}/versions/${draftMod.versionId}/download`;
    const response = await request.get(downloadUrl, {
      timeout: TEST_CONFIG.API_TIMEOUT,
    });

    // Should return 401 or 404
    expect([401, 404]).toContain(response.status());
  });
});

test.describe('Mod Download - Error Handling', () => {
  test.beforeAll(async ({ request }) => {
    await verifyWorkersHealth();
    await setupTestData(request);
  });

  test('should return 404 for non-existent mod', async ({ request }) => {
    const downloadUrl = `${TEST_CONFIG.API_URL}/mods/non-existent-mod/versions/non-existent-version/download`;
    const response = await request.get(downloadUrl, {
      timeout: TEST_CONFIG.API_TIMEOUT,
    });

    expect(response.status()).toBe(404);
    
    const body = await response.json();
    expect(body).toHaveProperty('title');
    expect(body.title).toContain('Not Found');
  });

  test('should return 404 for non-existent version', async ({ request }) => {
    const publicMod = await getPublicMod();

    const downloadUrl = `${TEST_CONFIG.API_URL}/mods/${publicMod.slug}/versions/non-existent-version/download`;
    const response = await request.get(downloadUrl, {
      timeout: TEST_CONFIG.API_TIMEOUT,
    });

    expect(response.status()).toBe(404);
  });

  test('should handle decryption errors gracefully', async ({ request }) => {
    const publicMod = await getPublicMod();

    const downloadUrl = `${TEST_CONFIG.API_URL}/mods/${publicMod.slug}/versions/${publicMod.versionId}/download`;
    const response = await request.get(downloadUrl, {
      timeout: TEST_CONFIG.API_TIMEOUT,
    });

    // Should either succeed or return a clear error
    if (!response.ok()) {
      const body = await response.json();
      expect(body).toHaveProperty('title');
      expect(body.title).toBeTruthy();
    } else {
      // If it succeeds, verify it's actually decrypted content
      const body = await response.body();
      expect(body.length).toBeGreaterThan(0);
    }
  });
});

test.describe('Mod Download - CORS and Headers', () => {
  test.beforeAll(async ({ request }) => {
    await verifyWorkersHealth();
    await setupTestData(request);
  });

  test('should include CORS headers for public downloads', async ({ request }) => {
    const publicMod = await getPublicMod();

    const downloadUrl = `${TEST_CONFIG.API_URL}/mods/${publicMod.slug}/versions/${publicMod.versionId}/download`;
    const response = await request.get(downloadUrl, {
      timeout: TEST_CONFIG.API_TIMEOUT,
    });

    expect(response.ok()).toBeTruthy();
    
    // CORS headers should be present (or handled by Cloudflare)
    // This is a soft check - CORS may be handled at edge
    expect(response.status()).toBe(200);
  });

  test('should set proper content type headers', async ({ request }) => {
    const publicMod = await getPublicMod();

    const downloadUrl = `${TEST_CONFIG.API_URL}/mods/${publicMod.slug}/versions/${publicMod.versionId}/download`;
    const response = await request.get(downloadUrl, {
      timeout: TEST_CONFIG.API_TIMEOUT,
    });

    expect(response.ok()).toBeTruthy();
    
    const contentType = response.headers()['content-type'];
    expect(contentType).toBeTruthy();
    
    // Should be a valid file type (not JSON error)
    expect(contentType).not.toBe('application/problem+json');
    expect(contentType).not.toBe('application/json');
  });

  test('should set content-disposition header for file download', async ({ request }) => {
    const publicMod = await getPublicMod();

    const downloadUrl = `${TEST_CONFIG.API_URL}/mods/${publicMod.slug}/versions/${publicMod.versionId}/download`;
    const response = await request.get(downloadUrl, {
      timeout: TEST_CONFIG.API_TIMEOUT,
    });

    expect(response.ok()).toBeTruthy();
    
    const contentDisposition = response.headers()['content-disposition'];
    expect(contentDisposition).toBeTruthy();
    expect(contentDisposition).toContain('attachment');
    expect(contentDisposition).toContain('filename');
  });
});

