# GitHub Workflows E2E Setup - Complete Guide

This document explains the complete E2E testing setup in GitHub Actions workflows.

## Overview

All workflows now support:
1. **Development deployments** - Deploy workers to development environment
2. **E2E tests** - Run end-to-end tests against development workers
3. **Fail-fast validation** - Dry-run before actual deployment

## Updated Workflows

### 1. Deploy Manager (`deploy-manager.yml`)

**New Feature**: Environment selection (production or development)

**Usage**:
1. Go to **Actions** → **Deploy Service(s)**
2. Select **Environment**: `production` or `development`
3. Select which services to deploy
4. Click **Run workflow**

**Changes**:
- ✅ Added `environment` input (production/development)
- ✅ All worker deployments respect environment selection
- ✅ Secrets are set for the selected environment
- ✅ Pages deployments (Mods Hub, Storybook, GitHub Pages) are production-only

**Example**:
```yaml
# Deploy to development
environment: development
deploy_mods_api: true
deploy_otp_auth: true

# Deploys with: wrangler deploy --env development
```

### 2. Test Manager (`test-manager.yml`)

**New Feature**: E2E tests option

**Usage**:
1. Go to **Actions** → **Test Service(s)**
2. Check **Run E2E Tests**
3. Click **Run workflow**

**E2E Test Flow**:
1. ✅ Validates worker configs (dry-run)
2. ✅ Deploys all workers to development
3. ✅ Sets development secrets
4. ✅ Verifies worker health
5. ✅ Runs E2E tests
6. ✅ Uploads test results and screenshots

**Fail-Fast**:
- If dry-run fails → workflow stops
- If deployment fails → workflow stops
- If health checks fail → workflow stops

### 3. E2E Tests Workflow (`e2e-tests.yml`)

**New Workflow**: Dedicated E2E testing workflow

**Triggers**:
- Manual dispatch (`workflow_dispatch`)
- Pull requests (when E2E-related files change)
- Automatic on PRs to main/master

**Flow**:
1. ✅ Install dependencies
2. ✅ Install Playwright browsers
3. ✅ **Dry-run validation** (fail-fast)
4. ✅ **Deploy workers to development**
5. ✅ Set development secrets
6. ✅ Verify worker health (fail-fast)
7. ✅ Run E2E tests
8. ✅ Upload artifacts

## Development Worker URLs

After deployment, workers are accessible at:

| Service | Development URL |
|---------|----------------|
| OTP Auth | `https://otp-auth-service-dev.strixuns-script-suite.workers.dev` |
| Mods API | `https://strixun-mods-api-dev.strixuns-script-suite.workers.dev` |
| Twitch API | `https://strixun-twitch-api-dev.strixuns-script-suite.workers.dev` |
| Customer API | `https://strixun-customer-api-dev.strixuns-script-suite.workers.dev` |
| Game API | `https://strixun-game-api-dev.strixuns-script-suite.workers.dev` |
| Chat Signaling | `https://strixun-chat-signaling-dev.strixuns-script-suite.workers.dev` |
| URL Shortener | `https://strixun-url-shortener-dev.strixuns-script-suite.workers.dev` |

**Note**: After you deploy workers, these URLs will be available. The workflows use these URLs by default.

## Getting Actual Worker URLs

After deploying workers to development, you can get the actual URLs:

```bash
# Deploy workers
pnpm deploy:dev:all

# Get worker URLs
cd serverless/otp-auth-service
wrangler deployments list --env development

# Or check in Cloudflare Dashboard
# Workers & Pages → [worker-name] → Settings → Triggers
```

**Once you have the actual URLs**, update:
1. `playwright.config.ts` - Update `WORKER_URLS` defaults
2. `.github/workflows/e2e-tests.yml` - Update environment variables
3. `.github/workflows/test-manager.yml` - Update environment variables

## Fail-Fast Strategy

All E2E workflows use fail-fast:

1. **Dry-run first**: Validates configurations before deployment
   ```bash
   pnpm deploy:dev:all:dry-run
   ```
   - If this fails → workflow stops immediately

2. **Deploy workers**: Deploys to development
   ```bash
   pnpm deploy:dev:all
   ```
   - If this fails → workflow stops immediately

3. **Health checks**: Verifies workers are responding
   ```bash
   curl https://worker-url/health
   ```
   - If any worker fails → workflow stops immediately

4. **Run tests**: Only runs if all previous steps succeed

## Test URL Audit

### ✅ Safe - Mock Data Only

These tests use production URLs in **mock data only** (not actual API calls):
- `serverless/mods-api/handlers/api-framework-integration.integration.test.ts`
- `serverless/mods-api/handlers/auth-flow.integration.test.ts`
- `serverless/mods-api/handlers/session-restore.integration.test.ts`

### ✅ Environment-Aware

These tests already use development URLs by default:
- `serverless/mods-api/handlers/service-integration.live.test.ts` - Uses dev URLs
- `serverless/otp-auth-service/handlers/auth/customer-creation.integration.test.ts` - Uses test-config-loader

### ✅ Updated

- `serverless/otp-auth-service/utils/test-config-loader.ts` - Now defaults to `-dev` URLs

## Required GitHub Secrets

For E2E tests to work, ensure these secrets are set:

- `CF_API_TOKEN` - Cloudflare API token
- `CF_ACCOUNT_ID` - Cloudflare account ID
- `JWT_SECRET` - JWT signing secret (same across all services)
- `RESEND_API_KEY` - Resend API key (for OTP emails)
- `RESEND_FROM_EMAIL` - Verified email for sending OTPs
- `TWITCH_CLIENT_ID` - Twitch API client ID (optional)
- `TWITCH_CLIENT_SECRET` - Twitch API client secret (optional)

## Workflow Summary

| Workflow | Development Deploy | E2E Tests | Fail-Fast |
|----------|------------------|-----------|-----------|
| `deploy-manager.yml` | ✅ (with env selection) | ❌ | ✅ |
| `test-manager.yml` | ✅ (before E2E) | ✅ | ✅ |
| `e2e-tests.yml` | ✅ (before tests) | ✅ | ✅ |

## Next Steps

1. **Deploy workers to development** (one-time):
   ```bash
   pnpm deploy:dev:all
   ```

2. **Get actual worker URLs** from Cloudflare Dashboard or `wrangler deployments list`

3. **Update URLs in code**:
   - `playwright.config.ts`
   - `.github/workflows/e2e-tests.yml`
   - `.github/workflows/test-manager.yml`

4. **Run E2E tests**:
   - Via workflow: **Actions** → **E2E Tests** or **Test Service(s)**
   - Locally: `pnpm test:e2e`

## See Also

- [E2E_TESTING_GUIDE.md](../E2E_TESTING_GUIDE.md) - Complete E2E testing guide
- [DEVELOPMENT_DEPLOYMENT_SETUP.md](../DEVELOPMENT_DEPLOYMENT_SETUP.md) - Development deployment guide
- [TEST_URL_AUDIT.md](../TEST_URL_AUDIT.md) - Test URL audit results

