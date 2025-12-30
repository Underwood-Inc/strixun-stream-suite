# Mods API Scripts

## setup-test-secrets.js

Automatically sets up test secrets for local development and E2E testing.

### What It Does

1. **Creates `.dev.vars`** if it doesn't exist with safe test defaults
2. **Adds missing secrets** to existing `.dev.vars` files
3. **Skips in CI** - CI should use `wrangler secret put` directly (which takes precedence)

### Usage

```bash
# Run manually
cd serverless/mods-api
pnpm setup:test-secrets

# Or use the npm script
pnpm setup:test-secrets
```

### Test Secrets

The script sets these default test secrets (safe for local development):

- `JWT_SECRET`: `test-jwt-secret-for-local-development-...`
- `SERVICE_ENCRYPTION_KEY`: `test-service-encryption-key-for-local-development-...`
- `ALLOWED_ORIGINS`: `*` (allow all origins locally)

### CI Integration

**CI secrets take precedence** over these defaults:

1. CI uses `wrangler secret put` to set secrets (stored in Cloudflare)
2. These override `.dev.vars` when deploying to development
3. The setup script detects `CI=true` and skips automatically

### How It Works

1. **Local Development**: 
   - Script creates/updates `.dev.vars` with test secrets
   - `wrangler dev` reads from `.dev.vars`
   - Secrets are gitignored (safe to commit `.dev.vars.example`)

2. **CI/CD**:
   - Script detects `CI=true` and skips
   - CI workflow uses `wrangler secret put` to set real secrets
   - Secrets are stored in Cloudflare (not in `.dev.vars`)
   - Deployed workers use Cloudflare secrets (higher precedence)

### Precedence Order

When `wrangler dev` runs, secrets are loaded in this order (highest to lowest):

1. **Cloudflare secrets** (via `wrangler secret put`) - Highest precedence
2. **`.dev.vars` file** - Local development defaults
3. **Environment variables** - System/env vars

This ensures:
- ✅ CI secrets always win (set via `wrangler secret put`)
- ✅ Local dev has defaults (from `.dev.vars`)
- ✅ No accidental overwrites of production secrets

### Automatic Setup

The script runs automatically before:
- `pnpm test:e2e` (all e2e test commands)
- `pnpm test:e2e:local` (local worker tests)
- Local worker startup in Playwright config

You can also run it manually:
```bash
pnpm setup:test-secrets
```

