import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect } from 'vitest';

const distJsDir = resolve(import.meta.dirname, '../../dist/stream-suite/assets/js');
const distExists = existsSync(distJsDir);

test.skipIf(!distExists)('[FR-SS-URL-009] stream-suite JS chunks do not reference svelte/internal', () => {
  const chunks = readdirSync(distJsDir).filter((name) => name.endsWith('.js'));
  expect(chunks.length).toBeGreaterThan(0);

  for (const chunk of chunks) {
    const src = readFileSync(resolve(distJsDir, chunk), 'utf8');
    expect(src, chunk).not.toContain('svelte/internal');
  }
});