# E2E Test Structure - Co-Located Architecture

> **E2E tests are co-located with the code they test for easy discovery and maintenance**

**Date:** 2025-12-29

---

## Overview

E2E tests are **co-located** with the code they test, following the naming pattern `*.e2e.spec.ts` or `*.e2e.test.ts`. This ensures tests live next to the code they verify, making them easy to find and maintain.

---

## Directory Structure

```
src/
└── pages/
    └── auth.e2e.spec.ts              # Frontend authentication E2E tests

serverless/
├── shared/
│   └── e2e/
│       ├── helpers.ts                 # Shared E2E test utilities
│       └── fixtures.ts                # Shared test fixtures (auth, etc.)
│
├── otp-auth-service/
│   └── health.e2e.spec.ts            # OTP Auth Service health checks
│
├── mods-api/
│   └── health.e2e.spec.ts            # Mods API health checks
│
├── twitch-api/
│   └── health.e2e.spec.ts            # Twitch API health checks
│
├── customer-api/
│   └── health.e2e.spec.ts            # Customer API health checks
│
├── game-api/
│   └── health.e2e.spec.ts            # Game API health checks
│
├── chat-signaling/
│   └── health.e2e.spec.ts            # Chat Signaling health checks
│
└── url-shortener/
    └── health.e2e.spec.ts            # URL Shortener health checks
```

---

## Benefits

1. **Co-location**: Tests live next to the code they test
2. **Easy Discovery**: Find tests by looking next to the code
3. **Clear Ownership**: Each module owns its E2E tests
4. **No Monolithic Directory**: No single `e2e/` directory to maintain
5. **Consistent Pattern**: Follows the same pattern as unit/integration tests

---

## Naming Convention

- **E2E tests**: `*.e2e.spec.ts` or `*.e2e.test.ts`
- **Unit tests**: `*.test.ts`
- **Integration tests**: `*.integration.test.ts`
- **Live tests**: `*.live.test.ts`

---

## Shared Utilities

Shared E2E utilities are located in `serverless/shared/e2e/`:

- **helpers.ts**: Common utilities (auth, API requests, health checks)
- **fixtures.ts**: Playwright fixtures (authenticated pages, etc.)

Import shared utilities in your tests:

```typescript
import { verifyWorkersHealth, authenticateUser } from '../../../serverless/shared/e2e/helpers';
import { test, expect } from '../../../serverless/shared/e2e/fixtures';
```

---

## Playwright Configuration

Playwright automatically discovers all E2E tests using the pattern:

```typescript
testMatch: /.*\.e2e\.(spec|test)\.(ts|js)/
```

This finds all `*.e2e.spec.ts` and `*.e2e.test.ts` files throughout the codebase.

---

## Adding New E2E Tests

1. **Create test file** next to the code you're testing:
   - Frontend: `src/pages/my-page.e2e.spec.ts`
   - Worker: `serverless/my-worker/my-feature.e2e.spec.ts`

2. **Import shared utilities**:
   ```typescript
   import { test, expect } from '@playwright/test';
   import { WORKER_URLS } from '../../../playwright.config';
   import { verifyWorkersHealth } from '../../../serverless/shared/e2e/helpers';
   ```

3. **Write tests** following Playwright best practices

4. **Run tests**: `pnpm test:e2e`

---

## Migration from Monolithic Structure

If you have existing tests in a monolithic `e2e/` directory:

1. Identify which code each test covers
2. Move the test file next to that code
3. Rename to `*.e2e.spec.ts`
4. Update imports to use shared utilities from `serverless/shared/e2e/`
5. Delete the old `e2e/` directory

---

## Examples

### Frontend E2E Test

```typescript
// src/pages/auth.e2e.spec.ts
import { test, expect } from '@playwright/test';
import { verifyWorkersHealth } from '../../../serverless/shared/e2e/helpers';

test.describe('Authentication', () => {
  test.beforeAll(async () => {
    await verifyWorkersHealth();
  });

  test('should display login screen', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('button:has-text("Login")')).toBeVisible();
  });
});
```

### Worker Health Check

```typescript
// serverless/otp-auth-service/health.e2e.spec.ts
import { test, expect } from '@playwright/test';
import { WORKER_URLS } from '../../../playwright.config';

test.describe('OTP Auth Service Health', () => {
  test('should be healthy', async ({ request }) => {
    const response = await request.get(`${WORKER_URLS.OTP_AUTH}/health`);
    expect(response.ok()).toBeTruthy();
  });
});
```

---

## See Also

- [E2E Testing Guide](./E2E_TESTING_GUIDE.md) - Complete E2E testing guide
- [E2E Quick Start](./E2E_QUICK_START.md) - Quick reference
- [E2E Environment Verification](./E2E_ENVIRONMENT_VERIFICATION.md) - Verify development environment setup

---

**Last Updated**: 2025-12-29

