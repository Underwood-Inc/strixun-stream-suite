# Local E2E Testing for Mods API

This guide explains how to run E2E tests against a local mods-api worker instead of the deployed development worker.

## Quick Start

### Option 1: Automatic (Recommended)

The test runner will automatically start the local worker for you:

```bash
# Windows PowerShell
$env:E2E_USE_LOCAL_WORKERS="true"
pnpm test:e2e

# Or use the npm script (sets env var automatically)
pnpm test:e2e:local
```

### Option 2: Manual

1. **Start the local worker in a separate terminal:**
   ```bash
   cd serverless/mods-api
   pnpm dev
   ```
   The worker will start on `http://localhost:8787` by default.

2. **Run tests with local worker URL:**
   ```bash
   # Windows PowerShell
   $env:E2E_MODS_API_URL="http://localhost:8787"; pnpm test:e2e
   
   # Or set it globally
   $env:E2E_USE_LOCAL_WORKERS="true"
   pnpm test:e2e
   ```

## Configuration

### Environment Variables

- `E2E_USE_LOCAL_WORKERS=true` - Use local workers for all services (defaults to port 8787)
- `E2E_MODS_API_URL=http://localhost:8787` - Override mods-api URL specifically
- `E2E_LOCAL_WORKER_PORT=8787` - Change the default local worker port
- `E2E_START_LOCAL_WORKER=false` - Disable automatic worker startup (if you're running it manually)

### Example: Custom Port

If your local worker runs on a different port:

```bash
$env:E2E_MODS_API_URL="http://localhost:8788"
$env:E2E_START_LOCAL_WORKER="false"
pnpm test:e2e
```

## Prerequisites

### 1. Local Worker Setup

**Automatic Setup (Recommended)**

Test secrets are **automatically set up** when you run e2e tests! The setup script creates `.dev.vars` with safe test defaults.

```bash
# Just run tests - secrets are set up automatically
pnpm test:e2e:local
```

**Manual Setup (Optional)**

If you want to customize secrets manually:

```bash
cd serverless/mods-api

# Run the setup script to create .dev.vars with defaults
pnpm setup:test-secrets

# Or set secrets manually via wrangler
wrangler secret put JWT_SECRET
wrangler secret put SERVICE_ENCRYPTION_KEY
wrangler secret put ALLOWED_ORIGINS
```

**Important Notes:**
- **Automatic**: Test secrets are set up automatically before e2e tests run
- **JWT_SECRET**: Can be any value for local dev. Defaults to a test value.
- **SERVICE_ENCRYPTION_KEY**: Must be 32+ characters. Defaults to a test value.
- **ALLOWED_ORIGINS**: Defaults to `"*"` (allow all) for local development
- **ALLOWED_EMAILS**: Optional - leave unset to allow all authenticated users
- **CI Override**: CI secrets (set via `wrangler secret put`) take precedence over defaults

### 2. KV and R2 Access

The local worker needs access to:
- **KV Namespaces**: MODS_KV, OTP_AUTH_KV
- **R2 Bucket**: MODS_R2

These are configured in `wrangler.toml` and will use your Cloudflare account's resources.

### 3. Test Data

For the download tests to work, you need:
- At least one public published mod with a version
- The mod should be encrypted with service key (new uploads will be automatically)

## Running Specific Tests

### Run Only Download Tests

```bash
$env:E2E_USE_LOCAL_WORKERS="true"
pnpm test:e2e serverless/mods-api/handlers/versions/download.e2e.spec.ts
```

### Run with UI Mode

```bash
pnpm test:e2e:local:ui
```

### Debug Mode

```bash
pnpm test:e2e:local:debug
```

## Troubleshooting

### Worker Not Starting

**Error**: `Unhealthy local workers: Mods API`

**Solution**:
1. Check if port 8787 is already in use
2. Verify secrets are set: `wrangler secret list`
3. Check worker logs in the terminal where `pnpm dev` is running

### Tests Can't Connect

**Error**: `ECONNREFUSED` or timeout errors

**Solution**:
1. Verify the worker is running: `curl http://localhost:8787/health`
2. Check the URL in test output matches your worker URL
3. Ensure firewall isn't blocking localhost connections

### No Test Data

**Error**: Tests skip because no mods found

**Solution**:
1. Upload a test mod via the UI or API
2. Ensure the mod is set to `visibility: 'public'` and `status: 'published'`
3. Verify the mod has at least one version

### Decryption Errors

**Error**: `Decryption failed - service key does not match`

**Solution**:
1. For local development, ensure `SERVICE_ENCRYPTION_KEY` matches between:
   - Local worker secrets: `wrangler secret put SERVICE_ENCRYPTION_KEY`
   - Frontend environment: `VITE_SERVICE_ENCRYPTION_KEY` (if testing uploads)
2. **For local dev only**: You can use any matching values - they don't need to match production
3. Generate a test key: `openssl rand -hex 32` and use the same value in both places

## Benefits of Local Testing

- **Faster iteration**: No deployment needed
- **Debugging**: Full access to worker logs and breakpoints
- **Isolation**: Test against local data without affecting development environment
- **Cost**: No Cloudflare worker invocation costs

## Local Development Flexibility

For local development, you have **full flexibility**:

[OK] **Use any secret values** - They don't need to match production/development  
[OK] **Use test/dummy data** - Create test mods, versions, etc.  
[OK] **Custom ports** - Run on any available port  
[OK] **Skip optional secrets** - Only set what you need for your tests  
[OK] **Use `*` for ALLOWED_ORIGINS** - Allow all origins locally  

**Constraints:**
- **KV/R2**: Still uses Cloudflare resources (not fully local)
- **Secrets**: Must be configured via `wrangler secret put` (stored locally in `.dev.vars`)
- **Network**: Requires internet connection for KV/R2 access
- **Format requirements**: SERVICE_ENCRYPTION_KEY must be 32+ characters
- **JWT_SECRET matching**: Only matters if testing cross-service auth flows

## Next Steps

Once local tests pass, you can:
1. Deploy to development: `pnpm deploy:dev:all`
2. Run tests against deployed workers: `pnpm test:e2e`
3. Compare results between local and deployed environments

