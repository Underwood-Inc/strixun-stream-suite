# End-to-End Testing Guide

This guide covers setting up and running end-to-end (E2E) tests using Playwright against development Cloudflare Workers.

## Overview

E2E tests verify the complete user experience by testing against live development deployments. This ensures:
- **No production data tampering**: Tests run against isolated development environments
- **100% accuracy**: Tests use real services, not mocks
- **Full integration**: Tests verify the entire stack from frontend to backend

## Architecture

```
┌─────────────────┐
│   Frontend      │  (Local dev server: localhost:5173)
│   (Svelte App)  │
└────────┬────────┘
         │
         │ HTTP Requests
         │
┌────────▼────────────────────────────────────────┐
│         Development Cloudflare Workers          │
│  ┌──────────────┐  ┌──────────────┐           │
│  │ OTP Auth     │  │ Mods API     │  ...       │
│  │ Service      │  │              │           │
│  └──────────────┘  └──────────────┘           │
│  (Deployed to *.workers.dev)                  │
└────────────────────────────────────────────────┘
```

## Prerequisites

1. **Playwright installed**: Already included in `package.json`
2. **Cloudflare Workers CLI**: `wrangler` (already installed)
3. **Development worker deployments**: All workers must be deployed to development environment

## Setup

### Step 1: Install Playwright Browsers

```bash
pnpm exec playwright install
```

This installs Chromium, Firefox, and WebKit browsers needed for testing.

### Step 2: Configure Environment Variables

Set environment variables for worker URLs. You can do this via:

**Option 1: Environment variables in your shell**
```bash
export E2E_OTP_AUTH_URL=https://otp-auth-service-dev.strixuns-script-suite.workers.dev
export E2E_MODS_API_URL=https://strixun-mods-api-dev.strixuns-script-suite.workers.dev
# ... etc
```

**Option 2: Create a `.env` file in the project root** (not committed to git)
```env
E2E_OTP_AUTH_URL=https://otp-auth-service-dev.strixuns-script-suite.workers.dev
E2E_MODS_API_URL=https://strixun-mods-api-dev.strixuns-script-suite.workers.dev
# ... etc
```

**Option 3: Use default URLs** (configured in `playwright.config.ts`)

### Step 3: Deploy Workers to Development Environment

Deploy all workers to the development environment:

```bash
pnpm deploy:dev:all
```

This script:
- Deploys all workers with `--env development` flag
- Uses development-specific configurations from `wrangler.toml`
- Provides progress feedback and error handling

**Dry run** (validate without deploying):
```bash
pnpm deploy:dev:all:dry-run
```

### Step 4: Set Development Secrets

For each worker, set development environment secrets:

```bash
# OTP Auth Service
cd serverless/otp-auth-service
wrangler secret put JWT_SECRET --env development
wrangler secret put RESEND_API_KEY --env development
wrangler secret put RESEND_FROM_EMAIL --env development

# Mods API
cd ../mods-api
wrangler secret put JWT_SECRET --env development
wrangler secret put ALLOWED_EMAILS --env development

# Repeat for other workers...
```

**Important**: Use the same `JWT_SECRET` across all services for authentication to work.

## Running Tests

### Run All E2E Tests

```bash
pnpm test:e2e
```

### Run Tests in UI Mode

Interactive test runner with time-travel debugging:

```bash
pnpm test:e2e:ui
```

### Run Tests in Debug Mode

Step through tests with Playwright Inspector:

```bash
pnpm test:e2e:debug
```

### Run Tests in Headed Mode

See the browser while tests run:

```bash
pnpm test:e2e:headed
```

### View Test Report

After running tests, view the HTML report:

```bash
pnpm test:e2e:report
```

## Test Structure

E2E tests are **co-located** with the code they test, following the pattern `*.e2e.spec.ts`:

```
src/
└── pages/
    └── auth.e2e.spec.ts              # Frontend auth E2E tests

serverless/
├── shared/
│   └── e2e/
│       ├── helpers.ts                 # Shared E2E test utilities
│       └── fixtures.ts                # Shared test fixtures
├── otp-auth-service/
│   └── health.e2e.spec.ts            # OTP Auth Service health tests
├── mods-api/
│   └── health.e2e.spec.ts            # Mods API health tests
├── twitch-api/
│   └── health.e2e.spec.ts            # Twitch API health tests
└── ... (other workers with health.e2e.spec.ts)
```

**Benefits of co-location:**
- Tests live next to the code they test
- Easy to find and maintain
- Clear ownership and context
- No monolithic test directory

## Writing Tests

### Basic Test Example

```typescript
import { test, expect } from '@playwright/test';

test('should load homepage', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Stream Suite/);
});
```

### Using Authentication Fixtures

```typescript
import { test, expect } from '../../../serverless/shared/e2e/fixtures';

test('should access protected route', async ({ authenticatedPage }) => {
  // authenticatedPage is already logged in
  await authenticatedPage.goto('/dashboard');
  await expect(authenticatedPage.locator('h1')).toContainText('Dashboard');
});
```

### Making API Requests

```typescript
import { test, expect } from '@playwright/test';
import { WORKER_URLS } from '../../../playwright.config';

test('should return health status', async ({ request }) => {
  const response = await request.get(`${WORKER_URLS.OTP_AUTH}/health`);
  expect(response.ok()).toBeTruthy();
  
  const body = await response.json();
  expect(body).toHaveProperty('status', 'ok');
});
```

### Waiting for API Responses

```typescript
import { waitForAPIResponse } from '../../../serverless/shared/e2e/helpers';

test('should wait for API call', async ({ page }) => {
  await page.goto('/');
  await waitForAPIResponse(page, '/api/user');
});
```

## Test Helpers

### `authenticateUser(page, email, otpCode?)`

Authenticates a user via the OTP flow. If `otpCode` is not provided, it will attempt to extract it from a test email service (requires integration).

### `checkWorkerHealth(workerUrl)`

Checks if a worker is healthy by calling its `/health` endpoint.

### `verifyWorkersHealth()`

Verifies all development workers are accessible. Throws an error if any are unhealthy.

### `authenticatedRequest(page, url, options?)`

Makes an authenticated API request using the user's auth token from localStorage/cookies.

## Configuration

### Playwright Config (`playwright.config.ts`)

- **Test pattern**: `**/*.e2e.spec.ts` or `**/*.e2e.test.ts` (co-located with code)
- **Browsers**: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **Base URL**: `http://localhost:5173` (frontend dev server)
- **Retries**: 2 retries in CI, 0 locally
- **Screenshots**: On failure only
- **Videos**: Retained on failure

### Worker URLs

Worker URLs are configured in `playwright.config.ts` and can be overridden via environment variables:

- `E2E_OTP_AUTH_URL`
- `E2E_MODS_API_URL`
- `E2E_TWITCH_API_URL`
- `E2E_CUSTOMER_API_URL`
- `E2E_GAME_API_URL`
- `E2E_CHAT_SIGNALING_URL`
- `E2E_URL_SHORTENER_URL`
- `E2E_FRONTEND_URL`

## Development Environment Setup

### Worker Configuration

Each worker's `wrangler.toml` now includes a `[env.development]` section:

```toml
[env.development]
vars = { ENVIRONMENT = "development" }

[[env.development.kv_namespaces]]
binding = "OTP_AUTH_KV"
id = "680c9dbe86854c369dd23e278abb41f9"
```

### Deploying Individual Workers

```bash
# Deploy specific worker to development
cd serverless/otp-auth-service
wrangler deploy --env development
```

### Checking Worker Status

```bash
# List all workers
wrangler deployments list

# View worker logs
wrangler tail --env development
```

## Best Practices

### 1. Test Isolation

Each test should be independent and not rely on state from other tests. Use `test.beforeEach` to set up clean state:

```typescript
test.beforeEach(async ({ page }) => {
  // Clear localStorage, cookies, etc.
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    document.cookie.split(";").forEach(c => {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
  });
});
```

### 2. Use Page Object Model

For complex pages, create page objects:

```typescript
// e2e/pages/LoginPage.ts
export class LoginPage {
  constructor(private page: Page) {}
  
  async goto() {
    await this.page.goto('/login');
  }
  
  async login(email: string, otp: string) {
    await this.page.fill('input[type="email"]', email);
    await this.page.click('button:has-text("Send")');
    await this.page.fill('input[type="text"][inputmode="numeric"]', otp);
    await this.page.click('button:has-text("Verify")');
  }
}
```

### 3. Wait for Elements

Always wait for elements to be visible before interacting:

```typescript
// Good
await page.locator('button').waitFor({ state: 'visible' });
await page.locator('button').click();

// Bad - may fail if element isn't ready
await page.locator('button').click();
```

### 4. Use Test Data

Use dedicated test accounts and data. Never use production data:

```typescript
const TEST_USERS = {
  admin: { email: 'test-admin@example.com' },
  regular: { email: 'test-user@example.com' },
};
```

### 5. Clean Up After Tests

If tests create data, clean it up:

```typescript
test.afterEach(async ({ page }) => {
  // Clean up test data via API
  await cleanupTestData(page);
});
```

## Troubleshooting

### Workers Not Accessible

**Error**: `Unhealthy workers: OTP Auth, Mods API`

**Solution**: Deploy workers to development environment:
```bash
pnpm deploy:dev:all
```

### Authentication Failures

**Error**: `401 Unauthorized` or `Invalid token`

**Solution**: 
1. Ensure all workers use the same `JWT_SECRET` in development
2. Check that secrets are set: `wrangler secret list --env development`

### Frontend Not Starting

**Error**: `WebServer failed to start`

**Solution**: 
1. Ensure port 5173 is available
2. Check that `pnpm dev` works manually
3. Verify no other process is using the port

### Tests Timing Out

**Error**: `Timeout of 30000ms exceeded`

**Solution**:
1. Increase timeout in test: `test.setTimeout(60000)`
2. Check network connectivity to workers
3. Verify workers are responding: `curl https://worker-url/health`

## CI/CD Integration

### GitHub Actions Example

```yaml
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
        with:
          node-version: '18'
      
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
        env:
          E2E_OTP_AUTH_URL: ${{ secrets.E2E_OTP_AUTH_URL }}
          # ... other worker URLs
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## Next Steps

1. **Add more test coverage**: Create tests for critical user flows
2. **Integrate test email service**: Set up MailSlurp or similar for OTP extraction
3. **Add visual regression testing**: Use Playwright's screenshot comparison
4. **Set up CI/CD**: Automate E2E tests in your deployment pipeline
5. **Monitor test stability**: Track flaky tests and improve reliability

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
