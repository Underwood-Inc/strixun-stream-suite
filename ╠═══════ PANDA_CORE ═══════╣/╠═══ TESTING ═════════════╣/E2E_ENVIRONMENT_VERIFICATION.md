# E2E Environment Verification

This document verifies that E2E tests are properly configured to use **development** worker deployments, not production.

## ✓ Verification Checklist

### 1. Worker Development Configurations

All workers have `[env.development]` sections in their `wrangler.toml`:

- ✓ **mods-api** - `serverless/mods-api/wrangler.toml`
- ✓ **otp-auth-service** - `serverless/otp-auth-service/wrangler.toml`
- ✓ **twitch-api** - `serverless/twitch-api/wrangler.toml`
- ✓ **customer-api** - `serverless/customer-api/wrangler.toml`
- ✓ **game-api** - `serverless/game-api/wrangler.toml`
- ✓ **chat-signaling** - `serverless/chat-signaling/wrangler.toml`
- ✓ **url-shortener** - `serverless/url-shortener/wrangler.toml`

### 2. E2E Test Configuration

**File**: `playwright.config.ts`

All worker URLs point to **development** deployments:

```typescript
const WORKER_URLS = {
  OTP_AUTH: 'https://otp-auth-service-dev.strixuns-script-suite.workers.dev',  // ✓ -dev
  MODS_API: 'https://strixun-mods-api-dev.strixuns-script-suite.workers.dev',   // ✓ -dev
  TWITCH_API: 'https://strixun-twitch-api-dev.strixuns-script-suite.workers.dev', // ✓ -dev
  CUSTOMER_API: 'https://strixun-customer-api-dev.strixuns-script-suite.workers.dev', // ✓ -dev
  GAME_API: 'https://strixun-game-api-dev.strixuns-script-suite.workers.dev',   // ✓ -dev
  CHAT_SIGNALING: 'https://strixun-chat-signaling-dev.strixuns-script-suite.workers.dev', // ✓ -dev
  URL_SHORTENER: 'https://strixun-url-shortener-dev.strixuns-script-suite.workers.dev', // ✓ -dev
};
```

**All URLs use `-dev` suffix** ✓

### 3. Deployment Script

**File**: `serverless/deploy-dev-all.js`

The deployment script:
- ✓ Checks for `[env.development]` in each worker's `wrangler.toml`
- ✓ Deploys with `wrangler deploy --env development` flag
- ✓ Skips workers without development config

### 4. Package.json Scripts

**File**: `package.json`

```json
{
  "scripts": {
    "deploy:dev:all": "node serverless/deploy-dev-all.js",
    "deploy:dev:all:dry-run": "node serverless/deploy-dev-all.js --dry-run",
    "test:e2e": "playwright test"
  }
}
```

✓ Scripts are properly configured

## How to Verify

### 1. Check Worker Configurations

```bash
# Verify each worker has [env.development]
grep -r "\[env.development\]" serverless/*/wrangler.toml
```

Should show 7 workers with development configs.

### 2. Deploy to Development

```bash
pnpm deploy:dev:all
```

This will deploy all workers to development environment.

### 3. Verify Development URLs

After deployment, verify workers are accessible at development URLs:

```bash
# OTP Auth Service
curl https://otp-auth-service-dev.strixuns-script-suite.workers.dev/health

# Mods API
curl https://strixun-mods-api-dev.strixuns-script-suite.workers.dev/health

# ... etc
```

### 4. Run E2E Tests

```bash
pnpm test:e2e
```

Tests will use development worker URLs from `playwright.config.ts`.

## Environment Variable Override

You can override worker URLs via environment variables:

```bash
export E2E_OTP_AUTH_URL=https://otp-auth-service-dev.strixuns-script-suite.workers.dev
export E2E_MODS_API_URL=https://strixun-mods-api-dev.strixuns-script-suite.workers.dev
# ... etc

pnpm test:e2e
```

## Production vs Development URLs

| Service | Production URL | Development URL (E2E) |
|---------|---------------|----------------------|
| OTP Auth | `auth.idling.app` | `otp-auth-service-dev.strixuns-script-suite.workers.dev` ✓ |
| Mods API | `mods-api.idling.app` | `strixun-mods-api-dev.strixuns-script-suite.workers.dev` ✓ |
| Twitch API | `api.idling.app` | `strixun-twitch-api-dev.strixuns-script-suite.workers.dev` ✓ |
| Customer API | `customer-api.idling.app` | `strixun-customer-api-dev.strixuns-script-suite.workers.dev` ✓ |
| Game API | `game.idling.app` | `strixun-game-api-dev.strixuns-script-suite.workers.dev` ✓ |
| Chat Signaling | `chat.idling.app` | `strixun-chat-signaling-dev.strixuns-script-suite.workers.dev` ✓ |
| URL Shortener | `s.idling.app` | `strixun-url-shortener-dev.strixuns-script-suite.workers.dev` ✓ |

**All E2E tests use development URLs** ✓

## Safety Guarantees

1. ✓ **No Production Data**: E2E tests run against development deployments
2. ✓ **Isolated Environment**: Development workers are separate from production
3. ✓ **Safe Testing**: Can test destructive operations without affecting production
4. ✓ **Clear Separation**: Development URLs have `-dev` suffix

## Troubleshooting

### Tests Hitting Production

**Symptom**: Tests are accessing production URLs (e.g., `*.idling.app`)

**Solution**: 
1. Check `playwright.config.ts` - all URLs should have `-dev` suffix
2. Verify environment variables aren't overriding to production URLs
3. Check worker deployments: `wrangler deployments list --env development`

### Development Workers Not Deployed

**Symptom**: Tests failing with "Worker not found"

**Solution**:
```bash
# Deploy all workers to development
pnpm deploy:dev:all

# Verify deployment
wrangler deployments list --env development
```

## Summary

✓ **All workers have development configurations**  
✓ **E2E tests use development URLs exclusively**  
✓ **Deployment script properly targets development environment**  
✓ **No risk of affecting production data**

The E2E testing setup is **fully isolated** from production.
