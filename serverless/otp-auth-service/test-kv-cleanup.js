/**
 * KV Cleanup Helper for Integration Tests
 *
 * Provides utilities to clear local KV namespaces between tests
 * to ensure test isolation and prevent data leakage.
 */
import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
/**
 * Clear all keys from a local KV namespace
 *
 * In local development with Miniflare/wrangler dev, KV data is stored in:
 * .wrangler/state/v3/kv/{namespace_id}/
 *
 * @param namespaceId - The KV namespace ID (from wrangler.toml)
 */
export async function clearLocalKVNamespace(namespaceId) {
    try {
        // Path to local KV storage
        const kvPath = join(PROJECT_ROOT, '.wrangler', 'state', 'v3', 'kv', namespaceId);
        if (existsSync(kvPath)) {
            console.log(`[KV Cleanup] Clearing KV namespace ${namespaceId}...`);
            rmSync(kvPath, { recursive: true, force: true });
            console.log(`[KV Cleanup] ✓ Cleared KV namespace ${namespaceId}`);
        }
        else {
            console.log(`[KV Cleanup] KV namespace ${namespaceId} not found (already clean)`);
        }
    }
    catch (error) {
        console.error(`[KV Cleanup] ✗ Failed to clear KV namespace ${namespaceId}:`, error);
        // Don't throw - cleanup failures shouldn't break tests
    }
}
/**
 * Clear all local KV namespaces
 * Clears the entire .wrangler/state directory
 */
export async function clearAllLocalKV() {
    try {
        const wranglerStatePath = join(PROJECT_ROOT, '.wrangler', 'state');
        if (existsSync(wranglerStatePath)) {
            console.log('[KV Cleanup] Clearing all local KV storage...');
            rmSync(wranglerStatePath, { recursive: true, force: true });
            console.log('[KV Cleanup] ✓ Cleared all local KV storage');
        }
        else {
            console.log('[KV Cleanup] Local KV storage not found (already clean)');
        }
    }
    catch (error) {
        console.error('[KV Cleanup] ✗ Failed to clear all local KV:', error);
        // Don't throw - cleanup failures shouldn't break tests
    }
}
