# E2E Testing Quick Start

Quick reference for running end-to-end tests.

## First Time Setup

1. **Install Playwright browsers**:
   ```bash
   pnpm exec playwright install
   ```

2. **Deploy workers to development**:
   ```bash
   pnpm deploy:dev:all
   ```

3. **Set development secrets** (one-time setup):
   ```bash
   # For each worker, set JWT_SECRET (must match across all services)
   cd serverless/otp-auth-service
   wrangler secret put JWT_SECRET --env development
   
   # Set other required secrets per worker
   wrangler secret put RESEND_API_KEY --env development
   wrangler secret put RESEND_FROM_EMAIL --env development
   ```

4. **Configure environment variables** (optional):
   ```bash
   # Set environment variables in your shell or .env file
   export E2E_OTP_AUTH_URL=https://otp-auth-service-dev.strixuns-script-suite.workers.dev
   # ... etc
   ```

## Running Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Interactive UI mode
pnpm test:e2e:ui

# Debug mode (step through tests)
pnpm test:e2e:debug

# View test report
pnpm test:e2e:report
```

## Common Commands

```bash
# Deploy all workers to development
pnpm deploy:dev:all

# Validate deployment (dry run)
pnpm deploy:dev:all:dry-run

# Deploy single worker
cd serverless/otp-auth-service
wrangler deploy --env development

# Check worker health
curl https://otp-auth-service-dev.strixuns-script-suite.workers.dev/health
```

## Troubleshooting

**Workers not accessible?**
- Deploy: `pnpm deploy:dev:all`
- Check secrets: `wrangler secret list --env development`

**Tests failing?**
- Verify workers are healthy: Check `e2e/api-health.spec.ts`
- Check worker logs: `wrangler tail --env development`

**Frontend not starting?**
- Ensure port 5173 is free
- Run `pnpm dev` manually to verify

For detailed documentation, see [E2E_TESTING_GUIDE.md](./E2E_TESTING_GUIDE.md).

