# Running All Integration Tests

## Quick Command (From Root)

```bash
pnpm test:integration
```

This will:
1. ✓ Automatically start workers (OTP Auth Service + Customer API)
2. ✓ Run ALL integration tests across all services
3. ✓ Reuse workers across test suites (no restart overhead)
4. ✓ Clean up workers after all tests complete

**What it does:**
- Finds all services with integration tests
- Runs `pnpm vitest run **/*.integration.test.ts` in each service
- Workers start automatically via shared setup
- Shows summary of results

## What Gets Tested

Integration tests are automatically detected by pattern: `**/*.integration.test.ts`

**Services with integration tests:**
- `serverless/otp-auth-service` - OTP login, API keys, customer creation
- `serverless/mods-api` - Auth flow, customer isolation, encryption, etc.
- `serverless/url-shortener` - Stats integration
- `mods-hub` - API integration

## Alternative Commands

### Verbose Output
```bash
pnpm test:integration:verbose
```

### Run from Specific Service
```bash
# From serverless/mods-api
cd serverless/mods-api
pnpm vitest run **/*.integration.test.ts

# From serverless/otp-auth-service  
cd serverless/otp-auth-service
pnpm vitest run **/*.integration.test.ts
```

Workers still start automatically via shared setup!

## How It Works

1. **Shared Setup Detects Integration Tests**
   - Checks for `VITEST_INTEGRATION=true` env var
   - Checks command line args for "integration"
   - Checks for `*.integration.test.ts` file pattern

2. **Workers Start Once**
   - OTP Auth Service: `http://localhost:8787`
   - Customer API: `http://localhost:8790`
   - Singleton pattern - reused across all test suites

3. **Tests Run**
   - All `*.integration.test.ts` files are executed
   - Tests use real workers (no mocks)

4. **Workers Clean Up**
   - Workers stop after ALL tests complete

## Troubleshooting

### "Workers already started, reusing existing workers"
✓ **This is normal!** Workers are reused across test suites.

### "Cannot find wrapper script"
Make sure `scripts/start-worker-with-health-check.js` exists.

### "Required secret is not set"
Set secrets in `.dev.vars` files or as environment variables:
- `JWT_SECRET`
- `NETWORK_INTEGRITY_KEYPHRASE`

### Port conflicts
Make sure ports 8787 and 8790 are available, or set:
- `OTP_AUTH_SERVICE_URL`
- `CUSTOMER_API_URL`
