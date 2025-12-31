# Mods Hub E2E Testing Guide

This guide covers end-to-end testing for the Mods Hub application using Playwright.

## Overview

E2E tests for Mods Hub are **co-located** with the code they test, following the pattern `*.e2e.spec.ts`. This ensures tests live next to the components they verify.

## Test Structure

```
mods-hub/
└── src/
    └── pages/
        ├── mod-list.e2e.spec.ts      # Mod browsing tests
        ├── login.e2e.spec.ts          # Authentication tests
        ├── mod-upload.e2e.spec.ts     # Mod upload tests
        └── mod-detail.e2e.spec.ts     # Mod detail page tests
```

## Prerequisites

1. **Deploy workers to development environment**:
   ```bash
   pnpm deploy:dev:all
   ```

2. **Start mods-hub dev server** (or it will auto-start with Playwright):
   ```bash
   cd mods-hub
   pnpm dev
   ```

3. **Set environment variables** (optional):
   ```bash
   export E2E_MODS_HUB_URL=http://localhost:3001
   export E2E_MODS_API_URL=https://strixun-mods-api-dev.strixuns-script-suite.workers.dev
   ```

## Running Tests

### Run All E2E Tests

```bash
# From project root
pnpm test:e2e
```

This will:
- Start the frontend dev server (if not running)
- Start the mods-hub dev server (if not running)
- Run all E2E tests including mods-hub tests

### Run Only Mods Hub Tests

```bash
# Run tests matching mods-hub pattern
pnpm test:e2e --grep "Mods Hub"
```

### Run Specific Test File

```bash
# Run mod list tests
pnpm test:e2e mods-hub/src/pages/mod-list.e2e.spec.ts
```

## Test-Driven Development (TDD) Workflow

### 1. Write Failing Test First

```typescript
// mods-hub/src/pages/new-feature.e2e.spec.ts
import { test, expect } from '@playwright/test';

test.describe('New Feature', () => {
  test('should do something', async ({ page }) => {
    await page.goto('http://localhost:5174');
    // Write test for feature that doesn't exist yet
    await expect(page.locator('[data-testid="new-feature"]')).toBeVisible();
  });
});
```

### 2. Run Test (Should Fail)

```bash
pnpm test:e2e mods-hub/src/pages/new-feature.e2e.spec.ts
```

### 3. Implement Feature

Implement the feature in the corresponding component/page.

### 4. Run Test Again (Should Pass)

```bash
pnpm test:e2e mods-hub/src/pages/new-feature.e2e.spec.ts
```

### 5. Refactor

Refactor code while keeping tests green.

## Current Test Coverage

### [OK] Mod List Page (`mod-list.e2e.spec.ts`)
- Display mod list page
- Display mod cards when mods exist
- Search functionality
- Filter options

### [OK] Login Page (`login.e2e.spec.ts`)
- Display login page
- Email input for OTP request
- Submit button for OTP request
- OTP input after request

### [OK] Mod Upload (`mod-upload.e2e.spec.ts`)
- Redirect to login when unauthenticated
- Show upload form when authenticated
- Required upload fields

### [OK] Mod Detail Page (`mod-detail.e2e.spec.ts`)
- Display mod detail page structure
- Download button for published mods
- Mod metadata display

## Adding New E2E Tests

### 1. Create Test File

Create a new `*.e2e.spec.ts` file next to the component/page you're testing:

```typescript
// mods-hub/src/pages/my-page.e2e.spec.ts
import { test, expect } from '@playwright/test';
import { verifyWorkersHealth } from '../../../serverless/shared/e2e/helpers';

test.describe('My Page', () => {
  test.beforeAll(async () => {
    await verifyWorkersHealth();
  });

  test('should do something', async ({ page }) => {
    const modsHubUrl = process.env.E2E_MODS_HUB_URL || 'http://localhost:5174';
    await page.goto(`${modsHubUrl}/my-page`);
    
    // Your test assertions
    await expect(page.locator('h1')).toBeVisible();
  });
});
```

### 2. Use Shared Utilities

Import shared E2E utilities:

```typescript
import { 
  verifyWorkersHealth,
  authenticateUser,
  TEST_USERS,
  waitForAPIResponse
} from '../../../serverless/shared/e2e/helpers';
```

### 3. Use Authentication Fixtures

For tests requiring authentication:

```typescript
import { test, expect } from '../../../serverless/shared/e2e/fixtures';

test('should access protected route', async ({ authenticatedPage }) => {
  // authenticatedPage is already logged in
  await authenticatedPage.goto('http://localhost:5174/upload');
  // Your test...
});
```

## Best Practices

### 1. Test User Flows, Not Implementation

```typescript
// [OK] Good - Tests user flow
test('should upload a mod', async ({ page }) => {
  await page.goto('/upload');
  await page.fill('input[name="title"]', 'My Mod');
  await page.setInputFiles('input[type="file"]', 'mod.zip');
  await page.click('button:has-text("Upload")');
  await expect(page.locator('text=/success/i')).toBeVisible();
});

// [ERROR] Bad - Tests implementation details
test('should call upload API', async ({ page }) => {
  // Don't test API calls directly, test the user experience
});
```

### 2. Use Data Attributes for Test Selectors

```typescript
// [OK] Good - Stable selector
await page.locator('[data-testid="mod-card"]').click();

// [ERROR] Bad - Fragile selector
await page.locator('.mod-card-container > div:first-child').click();
```

### 3. Wait for Elements

```typescript
// [OK] Good - Explicit wait
await expect(page.locator('button')).toBeVisible();
await page.locator('button').click();

// [ERROR] Bad - No wait
await page.locator('button').click(); // May fail if not ready
```

### 4. Clean Up Test Data

```typescript
test.afterEach(async ({ page }) => {
  // Clean up any test data created during the test
  // This might involve calling admin APIs
});
```

## Troubleshooting

### Tests Failing: "Workers Not Healthy"

**Solution**: Deploy workers to development environment:
```bash
pnpm deploy:dev:all
```

### Tests Failing: "Mods Hub Not Accessible"

**Solution**: Start mods-hub dev server:
```bash
cd mods-hub
pnpm dev
```

Or let Playwright start it automatically (configured in `playwright.config.ts`).

### Tests Timing Out

**Solution**: 
1. Increase timeout: `test.setTimeout(60000)`
2. Check network connectivity
3. Verify workers are responding

### Authentication Tests Failing

**Solution**: 
1. Ensure OTP email service is integrated (currently placeholder)
2. Use test email accounts
3. Check JWT_SECRET matches across all services

## CI/CD Integration

E2E tests can be integrated into CI/CD:

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps
      
      - name: Deploy workers to development
        run: pnpm deploy:dev:all
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
      
      - name: Run E2E tests
        run: pnpm test:e2e
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## Next Steps

1. **Integrate OTP Email Service**: Set up MailSlurp or similar for automated OTP extraction
2. **Add More Test Coverage**: Cover admin features, mod management, ratings, etc.
3. **Visual Regression Testing**: Add screenshot comparison tests
4. **Performance Testing**: Add tests for page load times and API response times

## See Also

- [E2E_TESTING_GUIDE.md](../../E2E_TESTING_GUIDE.md) - Complete E2E testing guide
- [E2E_TEST_STRUCTURE.md](../../E2E_TEST_STRUCTURE.md) - E2E test structure documentation
