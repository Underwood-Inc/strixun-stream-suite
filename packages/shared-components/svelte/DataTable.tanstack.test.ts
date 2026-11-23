import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect } from 'vitest';

const pkg = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8'),
) as { dependencies: Record<string, string> };

const dataTableSource = readFileSync(
  resolve(import.meta.dirname, 'DataTable.svelte'),
  'utf8',
);

/**
 * Regression: @tanstack/svelte-table v8 imports `svelte/internal` and breaks Svelte 5 runtime.
 */
test('[FR-SS-URL-009] DataTable depends on TanStack Svelte Table v9+', () => {
  const version = pkg.dependencies['@tanstack/svelte-table'] ?? '';
  expect(version).toMatch(/^[\^~]?9\./);
});

test('[FR-SS-URL-009] DataTable uses createTable (Svelte 5 adapter), not createSvelteTable', () => {
  expect(dataTableSource).toContain('createTable');
  expect(dataTableSource).not.toContain('createSvelteTable');
  expect(dataTableSource).not.toContain('flexRender(');
  expect(dataTableSource).toContain('FlexRender');
});

test('[FR-SS-URL-009] @tanstack/svelte-table package ships without svelte/internal', () => {
  const entry = resolve(
    import.meta.dirname,
    '../../../node_modules/@tanstack/svelte-table/dist/createTable.svelte.js',
  );
  const alt = resolve(
    import.meta.dirname,
    '../../../node_modules/.pnpm/@tanstack+svelte-table@9.3.2_svelte@5.46.0/node_modules/@tanstack/svelte-table/dist/createTable.svelte.js',
  );
  let src = '';
  try {
    src = readFileSync(entry, 'utf8');
  } catch {
    src = readFileSync(alt, 'utf8');
  }
  expect(src).not.toContain('svelte/internal');
});