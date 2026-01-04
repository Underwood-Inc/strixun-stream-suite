# Session Integration Test Migration Status

**Date:** 2025-01-04  
**Status:** ⚠️ **PARTIALLY COMPLETE** - Test file migrated, but Miniflare configuration needs fixing

---

## ✅ What's Done

1. **Test file migrated** (`session.integration.test.ts`):
   - Removed all health check polling (100+ lines)
   - Removed URL constants and `loadTestConfig()` usage
   - Replaced `fetch()` calls with `Miniflare.dispatchFetch()`
   - Uses `createMultiWorkerSetup()` helper
   - Reduced timeout from 60000ms to 30000ms

2. **Miniflare helper created** (`serverless/shared/test-helpers/miniflare-workers.ts`):
   - Creates both OTP Auth Service and Customer API workers
   - Handles environment variable loading from `.dev.vars`
   - Provides cleanup function

3. **Vitest config updated**:
   - Switched from `defineWorkersConfig` to `defineConfig` (because `@cloudflare/vitest-pool-workers` doesn't support Vitest 4.0.16)
   - Uses Node.js environment for Miniflare tests

---

## ❌ Current Issue

**Miniflare can't parse TypeScript files directly.**

Error:
```
MiniflareCoreError [ERR_MODULE_PARSE]: Unable to parse "worker.ts": Unexpected token (15:38)
```

**Root Cause:**
- Miniflare expects compiled JavaScript or needs bundler configuration
- `wrangler dev` handles TypeScript compilation automatically, but programmatic Miniflare doesn't
- The worker files are TypeScript (`.ts`), not JavaScript

---

## 🔧 Solutions

### Option 1: Use Wrangler to Bundle Workers (Recommended)
Use `wrangler` to bundle the workers before creating Miniflare instances:

```typescript
import { execSync } from 'child_process';
import { join } from 'path';

// Bundle worker using wrangler
const workerPath = join(rootDir, 'serverless/otp-auth-service');
execSync('wrangler deploy --dry-run --outdir .wrangler', { cwd: workerPath });

// Then use bundled output
const mf = new Miniflare({
  scriptPath: join(workerPath, '.wrangler/dist/worker.js'),
  // ...
});
```

### Option 2: Configure Miniflare with Bundler
Configure Miniflare to use esbuild or another bundler:

```typescript
import { Miniflare } from 'miniflare';
import esbuild from 'esbuild';

// Bundle TypeScript first
await esbuild.build({
  entryPoints: [workerPath],
  bundle: true,
  format: 'esm',
  outfile: 'worker-bundled.js',
  // ...
});

const mf = new Miniflare({
  scriptPath: 'worker-bundled.js',
  // ...
});
```

### Option 3: Use Wrangler's Miniflare Integration
Use `wrangler`'s built-in Miniflare integration instead of direct Miniflare:

```typescript
import { unstable_dev } from 'wrangler';

const worker = await unstable_dev('worker.ts', {
  config: 'wrangler.toml',
  local: true,
});
```

### Option 4: Downgrade Vitest (Not Recommended)
Downgrade Vitest to 3.2.x to use `@cloudflare/vitest-pool-workers`, which handles TypeScript automatically. But this might break other tests.

---

## 📝 Next Steps

1. **Choose a solution** from above (Option 1 or 3 recommended)
2. **Update `createMultiWorkerSetup()`** to bundle workers before creating Miniflare instances
3. **Test the migrated test** to ensure it works
4. **Fix inter-worker communication** (OTP Auth Service -> Customer API via fetch)
5. **Migrate remaining tests** once this one works

---

## 🎯 Progress

- ✅ Test file structure migrated
- ✅ Removed old setup code
- ✅ Created Miniflare helper
- ⚠️ Miniflare configuration (needs bundler)
- ❌ Inter-worker communication (needs fetch mock or service bindings)
- ❌ Test execution (blocked by Miniflare config)

**Overall:** ~60% complete - test file is ready, but Miniflare setup needs work.
