# Shared Integration Test Setup

**Location:** `serverless/shared/vitest.setup.integration.ts`

## Overview

This shared setup file provides **automatic worker startup** for ALL integration tests across all services. It replaces the previous per-service setup files and ensures:

1. ✓ **All integration tests use real local workers** (no mocks)
2. ✓ **Workers are reused across test suites** (singleton pattern)
3. ✓ **Automatic detection** of integration tests by file pattern
4. ✓ **Works for any service** (otp-auth-service, mods-api, etc.)

## How It Works

### Automatic Detection

The setup automatically detects integration tests by:
1. Environment variable: `VITEST_INTEGRATION=true`
2. Command line arguments containing "integration"
3. Test file pattern: `**/*.integration.test.ts`

### Worker Management

- **Starts once:** Workers start when the first integration test runs
- **Reuses workers:** All subsequent test suites reuse the same workers
- **Cleans up once:** Workers stop only after ALL tests complete

### Services Started

1. **OTP Auth Service** - `http://localhost:8787`
2. **Customer API** - `http://localhost:8790`

## Usage

### For Any Service

Add to your `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    // ... other config
    globalSetup: '../shared/vitest.setup.integration.ts',
  },
});
```

### Example: mods-api

```typescript
// serverless/mods-api/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: '../shared/vitest.setup.integration.ts',
    // ... rest of config
  },
});
```

### Example: otp-auth-service

```typescript
// serverless/otp-auth-service/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: '../shared/vitest.setup.integration.ts',
    // ... rest of config
  },
});
```

## Benefits

### Before (Problems)
- ✗ Each test suite restarted workers (~8-9s overhead per suite)
- ✗ Some tests used mocks instead of real workers
- ✗ Inconsistent setup across services
- ✗ Total time: ~30-35 seconds wasted on worker startup

### After (Solutions)
- ✓ Workers start once and are reused
- ✓ ALL integration tests use real workers
- ✓ Consistent setup across all services
- ✓ Time saved: ~27-30 seconds per test run

## Requirements

### Required Secrets

The setup requires these secrets (in `.dev.vars` or environment variables):

**OTP Auth Service:**
- `JWT_SECRET`
- `NETWORK_INTEGRITY_KEYPHRASE`
- `RESEND_API_KEY` (optional for tests)
- `RESEND_FROM_EMAIL` (optional for tests)

**Customer API:**
- `JWT_SECRET`
- `NETWORK_INTEGRITY_KEYPHRASE`

### Wrapper Script

Requires `scripts/start-worker-with-health-check.js` to exist.

## Migration Guide

### Migrating from Per-Service Setup

**Old way (otp-auth-service):**
```typescript
// serverless/otp-auth-service/vitest.config.ts
globalSetup: './vitest.setup.integration.ts',
```

**New way:**
```typescript
// serverless/otp-auth-service/vitest.config.ts
globalSetup: '../shared/vitest.setup.integration.ts',
```

### Migrating from Mocked Tests

**Old way (mods-api - using mocks):**
```typescript
// Test file
import { vi } from 'vitest';
vi.mock('@strixun/api-framework/enhanced', () => ({
  createCORSHeaders: vi.fn(() => new Headers()),
}));
```

**New way (using real workers):**
```typescript
// Test file - no mocks needed!
// Workers are automatically started by shared setup
// Just use real API calls:
const response = await fetch('http://localhost:8787/auth/me', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## Troubleshooting

### "Workers already started, reusing existing workers"

✓ **This is normal!** The singleton pattern prevents restarting workers between test suites.

### "Cannot find wrapper script"

Make sure `scripts/start-worker-with-health-check.js` exists in the project root.

### "Required secret is not set"

Set the required secrets in `.dev.vars` files or as environment variables.

### Services not starting

1. Check that ports 8787 and 8790 are available
2. Verify wrangler is installed: `pnpm add -D wrangler`
3. Check that `.dev.vars` files exist with required secrets

## Performance Impact

### Time Savings

- **Before:** ~8-9 seconds per test suite × 3 suites = ~27-30 seconds
- **After:** ~8-9 seconds once = ~8-9 seconds total
- **Savings:** ~20-22 seconds per full test run

### Test Execution

- Integration tests now run against real workers
- More accurate test results
- Better confidence in production behavior
