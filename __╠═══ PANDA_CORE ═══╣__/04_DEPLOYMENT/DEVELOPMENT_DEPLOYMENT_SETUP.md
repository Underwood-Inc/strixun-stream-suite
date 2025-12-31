# Development Worker Deployment Setup

This document explains how to set up and deploy workers to the development environment for E2E testing.

## Overview

All workers now support **development** and **production** environments. Development deployments are used for:
- E2E testing (to avoid affecting production data)
- Local development with live services
- Testing new features before production

## Worker Configuration

All workers have `[env.development]` sections in their `wrangler.toml` files:

### ✓ Configured Workers

1. **mods-api** - `serverless/mods-api/wrangler.toml`
2. **otp-auth-service** - `serverless/otp-auth-service/wrangler.toml`
3. **twitch-api** - `serverless/twitch-api/wrangler.toml`
4. **customer-api** - `serverless/customer-api/wrangler.toml`
5. **game-api** - `serverless/game-api/wrangler.toml`
6. **chat-signaling** - `serverless/chat-signaling/wrangler.toml`
7. **url-shortener** - `serverless/url-shortener/wrangler.toml`

### Development Environment Structure

Each worker's `wrangler.toml` follows this pattern:

```toml
# Production environment
[env.production]
vars = { ENVIRONMENT = "production" }

[[env.production.kv_namespaces]]
binding = "MY_KV"
id = "production-kv-id"

# Development environment
[env.development]
vars = { ENVIRONMENT = "development" }

[[env.development.kv_namespaces]]
binding = "MY_KV"
id = "production-kv-id"  # Can use same KV for testing, or separate test KV

# Default (for backward compatibility)
[vars]
ENVIRONMENT = "production"
```

## Deployment

### Deploy All Workers to Development

```bash
pnpm deploy:dev:all
```

This script:
1. Checks each worker for `[env.development]` configuration
2. Deploys each worker with `wrangler deploy --env development`
3. Provides progress feedback and error handling

### Deploy Individual Worker to Development

```bash
cd serverless/mods-api
wrangler deploy --env development
```

### Validate Deployment (Dry Run)

```bash
pnpm deploy:dev:all:dry-run
```

## Setting Development Secrets

After deploying to development, set secrets for the development environment:

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

**Important**: Use the **same `JWT_SECRET`** across all services in development for authentication to work.

## Development Worker URLs

When deployed to development, workers are accessible at:

- `https://otp-auth-service-dev.strixuns-script-suite.workers.dev`
- `https://strixun-mods-api-dev.strixuns-script-suite.workers.dev`
- `https://strixun-twitch-api-dev.strixuns-script-suite.workers.dev`
- `https://strixun-customer-api-dev.strixuns-script-suite.workers.dev`
- `https://strixun-game-api-dev.strixuns-script-suite.workers.dev`
- `https://strixun-chat-signaling-dev.strixuns-script-suite.workers.dev`
- `https://strixun-url-shortener-dev.strixuns-script-suite.workers.dev`

Note the `-dev` suffix in the worker name.

## E2E Test Configuration

E2E tests are configured to use development worker URLs in `playwright.config.ts`:

```typescript
const WORKER_URLS = {
  OTP_AUTH: process.env.E2E_OTP_AUTH_URL || 'https://otp-auth-service-dev.strixuns-script-suite.workers.dev',
  MODS_API: process.env.E2E_MODS_API_URL || 'https://strixun-mods-api-dev.strixuns-script-suite.workers.dev',
  // ... etc
};
```

**All E2E tests use development URLs by default** to ensure:
- No production data is affected
- Tests run against isolated development environment
- Safe testing of new features

## Verifying Development Deployments

### Check Worker Health

```bash
# OTP Auth Service
curl https://otp-auth-service-dev.strixuns-script-suite.workers.dev/health

# Mods API
curl https://strixun-mods-api-dev.strixuns-script-suite.workers.dev/health

# ... etc
```

### List Deployments

```bash
cd serverless/mods-api
wrangler deployments list
```

You should see both production and development deployments.

### View Development Logs

```bash
cd serverless/mods-api
wrangler tail --env development
```

## Production vs Development

| Aspect | Production | Development |
|--------|-----------|-------------|
| **Environment Variable** | `ENVIRONMENT=production` | `ENVIRONMENT=development` |
| **Worker URL** | `*.idling.app` or `*.workers.dev` | `*-dev.workers.dev` |
| **KV Namespaces** | Production KV | Can use same KV or separate test KV |
| **Routes** | Custom domains (idling.app) | workers.dev subdomain only |
| **Secrets** | Production secrets | Development secrets (can be same) |
| **Purpose** | Live production traffic | E2E testing, development |

## Troubleshooting

### Worker Not Found After Deployment

**Issue**: `Worker not found` error when accessing development URL

**Solution**: 
1. Verify deployment succeeded: `wrangler deployments list`
2. Check worker name matches: `wrangler.toml` `name` field
3. Development workers use `-dev` suffix automatically

### Authentication Failing in Development

**Issue**: E2E tests failing with 401 Unauthorized

**Solution**:
1. Ensure all workers use the same `JWT_SECRET` in development
2. Check secrets are set: `wrangler secret list --env development`
3. Verify OTP auth service is deployed to development

### KV Namespace Not Found

**Issue**: `KV namespace not found` error

**Solution**:
1. KV namespaces are shared across environments by default
2. If you want separate test KV, create new namespace:
   ```bash
   wrangler kv namespace create "MODS_KV_DEV"
   ```
3. Update `wrangler.toml` development section with new namespace ID

## Best Practices

1. **Use Same JWT_SECRET**: All services must use the same `JWT_SECRET` in development
2. **Separate Test Data**: Consider using separate KV namespaces for development if needed
3. **Regular Updates**: Keep development deployments in sync with production code
4. **Clean Up**: Periodically clean up test data in development KV namespaces
5. **Monitor Costs**: Development deployments count toward Cloudflare Workers usage

## CI/CD Integration

For CI/CD, deploy to development before running E2E tests:

```yaml
- name: Deploy workers to development
  run: pnpm deploy:dev:all
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}

- name: Run E2E tests
  run: pnpm test:e2e
```

## See Also

- [E2E_TESTING_GUIDE.md](../08_TESTING/E2E_TESTING_GUIDE.md) - Complete E2E testing guide
- [mods-hub/E2E_TESTING.md](../../mods-hub/E2E_TESTING.md) - Mods Hub E2E testing
