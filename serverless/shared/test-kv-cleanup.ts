/**
 * KV Cleanup Utility for Integration Tests
 * Clears local KV storage to ensure test isolation
 * 
 * This utility deletes all keys from the local KV namespace used by workers
 * during integration tests. It's called in afterAll hooks to clean up test data.
 */

import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Get the path to local wrangler KV storage
 */
function getLocalKVPath(): string {
  const homeDir = homedir();
  if (process.platform === 'win32') {
    return join(homeDir, '.wrangler', 'state', 'v3', 'kv');
  } else {
    return join(homeDir, '.wrangler', 'state', 'v3', 'kv');
  }
}

/**
 * Clear all local KV storage for integration tests
 * This ensures complete test isolation by removing all test data
 */
export async function clearLocalKV(): Promise<void> {
  const kvPath = getLocalKVPath();
  
  if (!existsSync(kvPath)) {
    console.log('[KV Cleanup] No local KV storage found - nothing to clean');
    return;
  }
  
  try {
    console.log(`[KV Cleanup] Clearing local KV storage at: ${kvPath}`);
    rmSync(kvPath, { recursive: true, force: true });
    console.log('[KV Cleanup] ✓ Local KV storage cleared');
  } catch (error: any) {
    console.warn(`[KV Cleanup] ⚠ Failed to clear KV storage: ${error.message}`);
    // Don't throw - cleanup failures shouldn't fail tests
  }
}

/**
 * Clear local KV storage for a specific namespace
 * @param namespaceId - The KV namespace ID (from wrangler.toml)
 */
export async function clearLocalKVNamespace(namespaceId: string): Promise<void> {
  const kvPath = getLocalKVPath();
  const namespacePath = join(kvPath, namespaceId);
  
  if (!existsSync(namespacePath)) {
    return;
  }
  
  try {
    console.log(`[KV Cleanup] Clearing KV namespace: ${namespaceId}`);
    rmSync(namespacePath, { recursive: true, force: true });
    console.log(`[KV Cleanup] ✓ KV namespace ${namespaceId} cleared`);
  } catch (error: any) {
    console.warn(`[KV Cleanup] ⚠ Failed to clear namespace ${namespaceId}: ${error.message}`);
  }
}
