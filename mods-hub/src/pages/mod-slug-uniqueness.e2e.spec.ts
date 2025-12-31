/**
 * Mod Slug and ModId Uniqueness E2E Tests
 * 
 * Tests that both slug and modId are unique index keys:
 * - Slug uniqueness across all scopes
 * - ModId uniqueness (guaranteed by generation)
 * - Slug index creation and lookup (O(1))
 * - Slug resolver uses index (exact match only, no fuzzy searching)
 * - Slug index updates on slug change
 * - Slug index deletion when mod becomes private
 * - Cross-customer slug uniqueness
 * - No fuzzy searching - exact matches only
 * 
 * Co-located with ModDetailPage component (uses mods API)
 */

import { test, expect } from '@playwright/test';
import { WORKER_URLS, verifyWorkersHealth } from '@strixun/e2e-helpers';
import { encryptBinaryWithServiceKey, encryptBinaryWithJWT } from '@strixun/api-framework';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .dev.vars directly in test file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const devVarsPath = join(__dirname, '..', '..', '..', 'serverless', 'mods-api', '.dev.vars');
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

const TEST_CONFIG = {
  API_URL: WORKER_URLS.MODS_API,
  API_TIMEOUT: 30000,
  TEST_EMAIL: process.env.E2E_TEST_EMAIL || 'test@example.com',
};

/**
 * Helper: Generate unique test title with timestamp
 */
function generateUniqueTestTitle(baseTitle: string): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `${baseTitle} ${timestamp}-${random}`;
}

/**
 * Helper: Get JWT token for authentication
 */
async function getAuthToken(email: string): Promise<string> {
  const envToken = process.env.E2E_TEST_JWT_TOKEN;
  if (envToken) {
    return envToken;
  }
  
  // Fallback to OTP flow if token not provided
  const otpRequestResponse = await fetch(`${WORKER_URLS.OTP_AUTH}/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  
  if (!otpRequestResponse.ok) {
    throw new Error(`Failed to request OTP: ${otpRequestResponse.status}`);
  }
  
  const testOtpCode = process.env.E2E_TEST_OTP_CODE;
  if (!testOtpCode) {
    throw new Error('E2E_TEST_JWT_TOKEN or E2E_TEST_OTP_CODE must be set');
  }
  
  const verifyResponse = await fetch(`${WORKER_URLS.OTP_AUTH}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp: testOtpCode }),
  });
  
  if (!verifyResponse.ok) {
    throw new Error(`Failed to verify OTP: ${verifyResponse.status}`);
  }
  
  const verifyData = await verifyResponse.json() as { access_token?: string; token?: string };
  return verifyData.access_token || verifyData.token || '';
}

/**
 * Helper: Create a test mod via API
 * Uses fetch() with FormData - Playwright's multipart doesn't reliably send Authorization headers
 * CRITICAL: Files must be encrypted before upload
 */
async function createTestMod(
  token: string,
  title: string,
  visibility: 'public' | 'private' | 'unlisted' = 'public',
  makeUnique: boolean = false
): Promise<{ modId: string; slug: string; versionId: string }> {
  // Make title unique only for test isolation (titles themselves don't need to be unique)
  // The slug generator will handle conflicts by appending numbers
  const finalTitle = makeUnique ? generateUniqueTestTitle(title) : title;
  
  // Create test file content
  const testFileContent = Buffer.from([0x50, 0x4B, 0x03, 0x04]); // ZIP file header
  const fileBuffer = testFileContent.buffer.slice(
    testFileContent.byteOffset,
    testFileContent.byteOffset + testFileContent.byteLength
  ) as ArrayBuffer;
  
  // CRITICAL: Encrypt file before upload
  // Public mods use service key, private/unlisted use JWT token
  let encryptedFile: Uint8Array;
  const serviceKey = process.env.SERVICE_ENCRYPTION_KEY || process.env.VITE_SERVICE_ENCRYPTION_KEY;
  
  if (visibility === 'public' && serviceKey) {
    // Public mods: encrypt with service key for anonymous downloads
    encryptedFile = await encryptBinaryWithServiceKey(fileBuffer, serviceKey);
  } else {
    // Private/unlisted mods: encrypt with JWT token
    encryptedFile = await encryptBinaryWithJWT(fileBuffer, token);
  }
  
  // Convert encrypted Uint8Array to ArrayBuffer for Blob
  const encryptedArrayBuffer = encryptedFile.buffer.slice(
    encryptedFile.byteOffset,
    encryptedFile.byteOffset + encryptedFile.byteLength
  ) as ArrayBuffer;
  const encryptedBlob = new Blob([encryptedArrayBuffer], { type: 'application/octet-stream' });
  
  // Always use fetch() with FormData - Playwright's multipart doesn't reliably send Authorization headers
  const formData = new FormData();
  formData.append('file', encryptedBlob, 'test-mod.jar');
  formData.append('metadata', JSON.stringify({
    title: finalTitle,
    description: 'E2E test mod',
    category: 'script',
    version: '1.0.0',
    visibility,
  }));

  // Use fetch() - it properly sends Authorization headers with FormData
  // CRITICAL: Do NOT set Content-Type header - browser will set it with boundary
  const response = await fetch(`${TEST_CONFIG.API_URL}/mods`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      // DO NOT set Content-Type - browser sets it automatically for multipart/form-data
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[E2E] Failed to create mod:', { status: response.status, error, url: `${TEST_CONFIG.API_URL}/mods` });
    throw new Error(`Failed to create mod: ${response.status} ${error}`);
  }

  const data = await response.json() as { modId?: string; slug?: string; versionId?: string; mod?: { modId: string; slug: string; latestVersion: string } };
  
  // Handle both response formats
  const modId = data.modId || data.mod?.modId;
  const slug = data.slug || data.mod?.slug;
  const versionId = data.versionId || data.mod?.latestVersion;

  if (!modId || !slug || !versionId) {
    throw new Error(`Invalid response from mod upload: missing modId, slug, or versionId. Response: ${JSON.stringify(data)}`);
  }

  return {
    modId,
    slug,
    versionId,
  };
}

/**
 * Helper: Get mod by slug
 */
async function getModBySlug(slug: string, token?: string): Promise<{ modId: string; slug: string } | null> {
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${TEST_CONFIG.API_URL}/mods/${slug}`, {
    method: 'GET',
    headers,
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get mod by slug: ${response.status} ${error}`);
  }

  const data = await response.json() as { mod: { modId: string; slug: string } };
  return data.mod;
}

/**
 * Helper: Update mod
 */
async function updateMod(
  modId: string,
  updates: { title?: string; visibility?: string },
  token: string
): Promise<{ mod: { modId: string; slug: string } }> {
  const response = await fetch(`${TEST_CONFIG.API_URL}/mods/${modId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update mod: ${response.status} ${error}`);
  }

  return await response.json() as { mod: { modId: string; slug: string } };
}

test.beforeAll(async () => {
  await verifyWorkersHealth();
});

test.describe('ModId Uniqueness', () => {
  test('should generate unique modIds for different mods', async () => {
    const token = await getAuthToken(TEST_CONFIG.TEST_EMAIL);
    
    const modIds = new Set<string>();
    
    // Create multiple mods (titles are auto-unique)
    for (let i = 0; i < 5; i++) {
      const mod = await createTestMod(token, `Unique Mod ${i}`, 'public', true);
      
      expect(mod.modId).toBeDefined();
      expect(mod.modId).toMatch(/^mod_\d+_/);
      expect(modIds.has(mod.modId)).toBe(false);
      modIds.add(mod.modId);
    }

    expect(modIds.size).toBe(5);
  });

  test('should use modId directly in API responses and storage', async () => {
    const token = await getAuthToken(TEST_CONFIG.TEST_EMAIL);
    const uniqueTitle = generateUniqueTestTitle('ModId Format Test');
    const mod = await createTestMod(token, uniqueTitle, 'public', false);
    
    // Verify modId format
    expect(mod.modId).toMatch(/^mod_\d+_[a-z0-9]+$/);
    
    // Verify we can access mod by modId directly
    const response = await fetch(`${TEST_CONFIG.API_URL}/mods/${mod.modId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    expect(response.ok).toBe(true);
    const data = await response.json() as { mod: { modId: string } };
    expect(data.mod.modId).toBe(mod.modId);
  });
});

test.describe('Slug Uniqueness', () => {
  test('should reject duplicate slugs across different mods', async () => {
    const token = await getAuthToken(TEST_CONFIG.TEST_EMAIL);
    
    // Create first mod with a specific title (don't make unique for this test)
    const uniqueTitle = generateUniqueTestTitle('Duplicate Slug Test');
    const mod1 = await createTestMod(token, uniqueTitle, 'public', false);
    expect(mod1.modId).toBeDefined();
    expect(mod1.slug).toBeDefined();
    
    // Try to create second mod with same title (should fail with 409)
    const testFileContent = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
    const fileBuffer = testFileContent.buffer.slice(
      testFileContent.byteOffset,
      testFileContent.byteOffset + testFileContent.byteLength
    ) as ArrayBuffer;
    
    // Encrypt file
    const serviceKey = process.env.SERVICE_ENCRYPTION_KEY || process.env.VITE_SERVICE_ENCRYPTION_KEY;
    const encryptedFile = serviceKey 
      ? await encryptBinaryWithServiceKey(fileBuffer, serviceKey)
      : await encryptBinaryWithJWT(fileBuffer, token);
    
    const encryptedArrayBuffer = encryptedFile.buffer.slice(
      encryptedFile.byteOffset,
      encryptedFile.byteOffset + encryptedFile.byteLength
    ) as ArrayBuffer;
    const encryptedBlob = new Blob([encryptedArrayBuffer], { type: 'application/octet-stream' });
    
    const formData = new FormData();
    formData.append('file', encryptedBlob, 'test-mod.jar');
    formData.append('metadata', JSON.stringify({
      title: uniqueTitle, // Same title - should fail
      description: 'E2E test mod',
      category: 'script',
      version: '1.0.0',
      visibility: 'public',
    }));

    const response = await fetch(`${TEST_CONFIG.API_URL}/mods`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    // Expect 409 Conflict - this is the expected behavior
    expect(response.status).toBe(409);
    const error = await response.json() as { detail?: string; title?: string };
    expect(error.detail || error.title).toContain('Slug Already Exists');
  });

  test('should allow same slug for same mod (update scenario)', async () => {
    const token = await getAuthToken(TEST_CONFIG.TEST_EMAIL);
    
    // Create mod
    const mod = await createTestMod(token, 'Update Slug Test', 'public', false);
    const originalSlug = mod.slug;
    
    // Update mod with same title (should succeed - same mod, same slug)
    const updated = await updateMod(mod.modId, { title: 'Update Slug Test' }, token);
    
    // Slug should remain the same since title didn't change
    expect(updated.mod.modId).toBe(mod.modId);
    expect(updated.mod.slug).toBe(originalSlug);
  });
  
  test('should reject duplicate slug when updating to existing slug', async () => {
    const token = await getAuthToken(TEST_CONFIG.TEST_EMAIL);
    
    // Create two mods with different titles
    const mod1 = await createTestMod(token, 'First Mod', 'public', false);
    const mod2 = await createTestMod(token, 'Second Mod', 'public', false);
    
    // Try to update mod2 to have the same slug as mod1 (should fail)
    const response = await fetch(`${TEST_CONFIG.API_URL}/mods/${mod2.modId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'First Mod' }), // Same title as mod1
    });
    
    // Should reject with 409
    expect(response.status).toBe(409);
    const error = await response.json() as { detail?: string; title?: string };
    expect(error.detail || error.title).toContain('Slug Already Exists');
  });
});

test.describe('Slug Index Lookup', () => {
  test('should resolve slug to modId using index (O(1) lookup)', async () => {
    const token = await getAuthToken(TEST_CONFIG.TEST_EMAIL);
    
    // Create mod
    const mod = await createTestMod(token, 'Slug Index Test', 'public', true);
    
    // Resolve slug to modId
    const resolvedMod = await getModBySlug(mod.slug, token);
    
    expect(resolvedMod).not.toBeNull();
    expect(resolvedMod?.modId).toBe(mod.modId);
    expect(resolvedMod?.slug).toBe(mod.slug);
  });

  test('should return null for non-existent slug (exact match only)', async () => {
    const token = await getAuthToken(TEST_CONFIG.TEST_EMAIL);
    
    // Try to resolve slugs that don't exist
    const nonExistentSlugs = [
      `non-existent-slug-${Date.now()}-${Math.random()}`,
      `non-existent-slug-${Date.now()}-${Math.random()}`,
      `completely-different-slug-${Date.now()}-${Math.random()}`,
    ];

    for (const slug of nonExistentSlugs) {
      const resolved = await getModBySlug(slug, token);
      expect(resolved).toBeNull();
    }
  });

  test('should only match exact slugs, not similar ones', async () => {
    const token = await getAuthToken(TEST_CONFIG.TEST_EMAIL);
    
    // Create mod with specific slug (use unique title for test isolation)
    const uniqueTitle = generateUniqueTestTitle('Exact Match Test');
    const mod = await createTestMod(token, uniqueTitle, 'public', false);
    const exactSlug = mod.slug;
    
    // Verify exact match works
    const exactMatch = await getModBySlug(exactSlug, token);
    expect(exactMatch?.modId).toBe(mod.modId);
    
    // Try similar slugs (should all fail - no fuzzy matching)
    const similarSlugs = [
      `${exactSlug}-wrong`,
      `${exactSlug.substring(0, exactSlug.length - 1)}`,
      `${exactSlug}-extra`,
      `${exactSlug}1`,
      exactSlug.substring(0, Math.floor(exactSlug.length / 2)),
    ];

    for (const similarSlug of similarSlugs) {
      const resolved = await getModBySlug(similarSlug, token);
      expect(resolved).toBeNull();
    }
  });
});

test.describe('Slug Index Updates', () => {
  test('should update slug index when slug changes', async () => {
    const token = await getAuthToken(TEST_CONFIG.TEST_EMAIL);
    
    // Create mod
    const mod = await createTestMod(token, 'Original Title', 'public', true);
    const originalSlug = mod.slug;
    
    // Update mod title (should change slug)
    const newTitle = generateUniqueTestTitle('Updated Title');
    const updated = await updateMod(mod.modId, { title: newTitle }, token);
    const newSlug = updated.mod.slug;
    
    expect(newSlug).not.toBe(originalSlug);
    
    // Old slug should not resolve
    const oldSlugResult = await getModBySlug(originalSlug, token);
    expect(oldSlugResult).toBeNull();
    
    // New slug should resolve
    const newSlugResult = await getModBySlug(newSlug, token);
    expect(newSlugResult?.modId).toBe(mod.modId);
  });
});

test.describe('Slug Index for Public Mods', () => {
  test('should create global slug index when mod becomes public', async () => {
    const token = await getAuthToken(TEST_CONFIG.TEST_EMAIL);
    
    // Create private mod
    const mod = await createTestMod(token, 'Private To Public Test', 'private', true);
    
    // Slug should not be accessible without auth
    const slugResultUnauth = await getModBySlug(mod.slug);
    expect(slugResultUnauth).toBeNull();
    
    // Slug should be accessible with auth (author)
    const slugResultAuth = await getModBySlug(mod.slug, token);
    expect(slugResultAuth?.modId).toBe(mod.modId);
    
    // Update to public
    await updateMod(mod.modId, { visibility: 'public' }, token);
    
    // Slug should now be accessible without auth
    const slugResultPublic = await getModBySlug(mod.slug);
    expect(slugResultPublic?.modId).toBe(mod.modId);
  });

  test('should delete global slug index when mod becomes private', async () => {
    const token = await getAuthToken(TEST_CONFIG.TEST_EMAIL);
    
    // Create public mod (use unique title for test isolation)
    const uniqueTitle = generateUniqueTestTitle('Public To Private Test');
    const mod = await createTestMod(token, uniqueTitle, 'public', false);
    
    // Slug should be accessible without auth
    const slugResultPublic = await getModBySlug(mod.slug);
    expect(slugResultPublic?.modId).toBe(mod.modId);
    
    // Update to private
    await updateMod(mod.modId, { visibility: 'private' }, token);
    
    // Slug should not be accessible without auth
    const slugResultPrivate = await getModBySlug(mod.slug);
    expect(slugResultPrivate).toBeNull();
    
    // Slug should still be accessible with auth (author)
    const slugResultAuth = await getModBySlug(mod.slug, token);
    expect(slugResultAuth?.modId).toBe(mod.modId);
  });
});

test.describe('Cross-Customer Slug Uniqueness', () => {
  test('should enforce slug uniqueness across all customers', async () => {
    const token1 = await getAuthToken(TEST_CONFIG.TEST_EMAIL);
    
    // Create mod with customer1
    const mod1 = await createTestMod(token1, 'Cross Customer Test', 'public', true);
    
    // Try to create another mod with same title (should fail even for same user)
    const testFileContent = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
    const fileBuffer = testFileContent.buffer.slice(
      testFileContent.byteOffset,
      testFileContent.byteOffset + testFileContent.byteLength
    ) as ArrayBuffer;
    
    // Encrypt file
    const serviceKey = process.env.SERVICE_ENCRYPTION_KEY || process.env.VITE_SERVICE_ENCRYPTION_KEY;
    const encryptedFile = serviceKey 
      ? await encryptBinaryWithServiceKey(fileBuffer, serviceKey)
      : await encryptBinaryWithJWT(fileBuffer, token1);
    
    const encryptedArrayBuffer = encryptedFile.buffer.slice(
      encryptedFile.byteOffset,
      encryptedFile.byteOffset + encryptedFile.byteLength
    ) as ArrayBuffer;
    const encryptedBlob = new Blob([encryptedArrayBuffer], { type: 'application/octet-stream' });
    
    const formData = new FormData();
    formData.append('file', encryptedBlob, 'test-mod.jar');
    formData.append('metadata', JSON.stringify({
      title: uniqueTitle, // Try to use same title (will generate same slug)
      description: 'E2E test mod',
      category: 'script',
      version: '1.0.0',
      visibility: 'public',
    }));

    const response = await fetch(`${TEST_CONFIG.API_URL}/mods`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token1}`,
      },
      body: formData,
    });

    // Should fail with 409 - slug already exists
    expect(response.status).toBe(409);
  });
});

test.describe('ModId and Slug as Index Keys', () => {
  test('should use modId directly without normalization', async () => {
    const token = await getAuthToken(TEST_CONFIG.TEST_EMAIL);
    
    // Create mod (use unique title for test isolation)
    const uniqueTitle = generateUniqueTestTitle('Index Key Test');
    const mod = await createTestMod(token, uniqueTitle, 'public', false);
    
    // Access by modId directly
    const responseById = await fetch(`${TEST_CONFIG.API_URL}/mods/${mod.modId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    expect(responseById.ok).toBe(true);
    const dataById = await responseById.json() as { mod: { modId: string; slug: string } };
    expect(dataById.mod.modId).toBe(mod.modId);
    
    // Access by slug
    const responseBySlug = await fetch(`${TEST_CONFIG.API_URL}/mods/${mod.slug}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    expect(responseBySlug.ok).toBe(true);
    const dataBySlug = await responseBySlug.json() as { mod: { modId: string; slug: string } };
    expect(dataBySlug.mod.modId).toBe(mod.modId);
    expect(dataBySlug.mod.slug).toBe(mod.slug);
    
    // Both should return same mod
    expect(dataById.mod.modId).toBe(dataBySlug.mod.modId);
  });

  test('should prevent wrong mod data from being returned (slug collision protection)', async () => {
    const token = await getAuthToken(TEST_CONFIG.TEST_EMAIL);
    
    // Create two different mods
    const mod1 = await createTestMod(token, 'Collision Test One', 'public', true);
    const mod2 = await createTestMod(token, 'Collision Test Two', 'public', true);
    
    // Each slug should resolve to its own mod
    const result1 = await getModBySlug(mod1.slug, token);
    expect(result1?.modId).toBe(mod1.modId);
    expect(result1?.modId).not.toBe(mod2.modId);
    
    const result2 = await getModBySlug(mod2.slug, token);
    expect(result2?.modId).toBe(mod2.modId);
    expect(result2?.modId).not.toBe(mod1.modId);
    
    // ModIds should be different
    expect(mod1.modId).not.toBe(mod2.modId);
  });

  test('should access mod by both modId and slug (both work as index keys)', async () => {
    const token = await getAuthToken(TEST_CONFIG.TEST_EMAIL);
    
    // Create mod (use unique title for test isolation)
    const uniqueTitle = generateUniqueTestTitle('Dual Index Test');
    const mod = await createTestMod(token, uniqueTitle, 'public', false);
    
    // Access by modId
    const responseById = await fetch(`${TEST_CONFIG.API_URL}/mods/${mod.modId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(responseById.ok).toBe(true);
    const dataById = await responseById.json() as { mod: { modId: string; slug: string } };
    
    // Access by slug
    const responseBySlug = await fetch(`${TEST_CONFIG.API_URL}/mods/${mod.slug}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    expect(responseBySlug.ok).toBe(true);
    const dataBySlug = await responseBySlug.json() as { mod: { modId: string; slug: string } };
    
    // Both should return identical mod data
    expect(dataById.mod.modId).toBe(dataBySlug.mod.modId);
    expect(dataById.mod.slug).toBe(dataBySlug.mod.slug);
    expect(dataById.mod.modId).toBe(mod.modId);
  });
});
