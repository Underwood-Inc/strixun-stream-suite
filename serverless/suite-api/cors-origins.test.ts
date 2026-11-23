import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect } from 'vitest';

/**
 * Production Stream Suite is served from https://sss.idling.app (and streamkit).
 * api.idling.app must allow those origins or the SPA health check fails before any UI loads.
 */
test('[FR-SS-SUITE-CORS-001] suite-api ALLOWED_ORIGINS includes sss.idling.app', () => {
  const toml = readFileSync(resolve(__dirname, 'wrangler.toml'), 'utf8');
  const origins = [
    ...toml.matchAll(/ALLOWED_ORIGINS\s*=\s*"([^"]+)"/g),
    ...toml.matchAll(/ALLOWED_ORIGINS\s*=\s*\{[^}]*"([^"]+)"/g),
  ].flatMap((m) => m[1].split(','));

  expect(origins).toContain('https://sss.idling.app');
  expect(origins).toContain('https://streamkit.idling.app');
});