# Integration Tests Setup Guide

Integration tests verify the actual connection between `otp-auth-service` and `customer-api` using the **live API**.

## Quick Start

### 1. Create Configuration Files

Copy the example files and fill in your values:

```bash
# For development environment
cp .dev.toml.example .dev.toml

# For production environment (optional)
cp .prod.toml.example .prod.toml
```

### 2. Edit Configuration Files

Edit `.dev.toml` (or `.prod.toml`) and fill in:

```toml
[integration]
customer_api_url = "https://strixun-customer-api.strixuns-script-suite.workers.dev"
service_api_key = "your-actual-service-api-key-here"
use_live_api = true
```

**[WARNING] IMPORTANT:** 
- `.dev.toml` and `.prod.toml` are gitignored (secrets won't be committed)
- Never commit these files with real secrets
- Use `.dev.toml.example` and `.prod.toml.example` as templates

### 3. Run Integration Tests

```bash
# Run with dev config (default)
pnpm test:integration:dev

# Run with prod config
pnpm test:integration:prod

# Run with environment variables (overrides TOML)
TEST_ENV=dev pnpm test:integration
```

## Configuration Priority

The test config loader uses this priority (highest to lowest):

1. **Environment Variables** (highest priority)
   - `CUSTOMER_API_URL`
   - `SERVICE_API_KEY`
   - `USE_LIVE_API`

2. **TOML Files**
   - `.dev.toml` (when `TEST_ENV=dev` or default)
   - `.prod.toml` (when `TEST_ENV=prod`)

3. **Defaults** (lowest priority)
   - Dev: `https://strixun-customer-api.strixuns-script-suite.workers.dev`
   - Prod: `https://customer.idling.app`

## Environment Variables

You can override TOML config with environment variables:

```bash
# Using environment variables (no TOML needed)
CUSTOMER_API_URL=https://strixun-customer-api.strixuns-script-suite.workers.dev \
SERVICE_API_KEY=your-key \
USE_LIVE_API=true \
pnpm test:integration
```

## What Gets Tested

Integration tests verify:

[SUCCESS] **Customer API URL is correct and reachable**
- Catches wrong URLs, DNS issues, unreachable services

[SUCCESS] **SERVICE_API_KEY authentication works**
- Verifies service-to-service auth is configured correctly

[SUCCESS] **Customer account creation works end-to-end**
- Tests actual customer-api integration

[SUCCESS] **UPSERT functionality**
- Verifies existing accounts are updated correctly

## GitHub Actions CI

Integration tests run automatically in CI using GitHub secrets:
- `CUSTOMER_API_URL` (optional, has fallback)
- `SERVICE_API_KEY` (required)

See `.github/workflows/test-otp-auth-integration.yml`

## Troubleshooting

### "SERVICE_API_KEY is required"
- Set it in `.dev.toml` or `.prod.toml`
- Or use environment variable: `SERVICE_API_KEY=...`

### "Customer API URL is incorrect or unreachable"
- Check `customer_api_url` in your TOML file
- Verify customer-api worker is deployed
- Test URL manually: `curl https://your-customer-api-url/health`

### "Tests skipped"
- Set `use_live_api = true` in TOML file
- Or set `USE_LIVE_API=true` environment variable

## Security Notes

- [SUCCESS] `.dev.toml` and `.prod.toml` are gitignored
- [SUCCESS] Example files (`.dev.toml.example`, `.prod.toml.example`) are safe to commit
- [SUCCESS] Never commit actual secrets
- [SUCCESS] Use different keys for dev/prod if possible

