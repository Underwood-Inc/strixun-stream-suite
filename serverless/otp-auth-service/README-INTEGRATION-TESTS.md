# Integration Tests Setup Guide

Integration tests verify the actual connection between `otp-auth-service` and `customer-api` using **LOCAL workers only**.

⚠ **CRITICAL: Integration tests ONLY work with LOCAL workers!**
- NO SUPPORT FOR DEPLOYED/LIVE WORKERS
- OTP Auth Service must be running on `http://localhost:8787`
- Customer API must be running on `http://localhost:8790`

## Quick Start

### 1. Start Required Services

**Terminal 1 - OTP Auth Service:**
```bash
cd serverless/otp-auth-service
pnpm dev
```

**Terminal 2 - Customer API:**
```bash
cd serverless/customer-api
pnpm dev
```

### 2. Run Integration Tests

**Terminal 3 - Run Tests:**
```bash
cd serverless/otp-auth-service
pnpm test:integration
```

Or run specific test:
```bash
pnpm test:integration:otp
```

## What Gets Tested

Integration tests verify:

✓ **OTP Login Flow**
- Request OTP endpoint works
- Verify OTP endpoint works
- Customer account is created/retrieved during login
- JWT token is returned after successful verification
- Full integration between OTP auth service and customer-api

✓ **Customer Account Creation**
- Customer API URL is correct and reachable
- Customer account creation works end-to-end
- UPSERT functionality (existing accounts are updated correctly)

✓ **Service Integration**
- Customer API is reachable from OTP auth service
- Service-to-service calls work without JWT

## Configuration

Tests use these defaults (can be overridden with environment variables):

- `CUSTOMER_API_URL` - Default: `http://localhost:8790`
- `OTP_AUTH_SERVICE_URL` - Default: `http://localhost:8787`

**Environment Variables:**
```bash
# Override URLs if needed (but must be localhost!)
CUSTOMER_API_URL=http://localhost:8790 \
OTP_AUTH_SERVICE_URL=http://localhost:8787 \
pnpm test:integration
```

## Troubleshooting

### "OTP Auth Service is not running!"
- Start OTP auth service: `cd serverless/otp-auth-service && pnpm dev`
- Verify it's running on port 8787

### "Customer API is not running!"
- Start customer API: `cd serverless/customer-api && pnpm dev`
- Verify it's running on port 8790

### "CUSTOMER_API_URL must point to localhost"
- Integration tests ONLY work with local workers
- Do NOT use deployed worker URLs
- Always use `http://localhost:8790` for customer API
- Always use `http://localhost:8787` for OTP auth service

### "OTP code not available"
- Ensure OTP auth service is running in dev mode
- Check `/dev/otp` endpoint is accessible
- Or set `E2E_TEST_OTP_CODE` environment variable

## CI/CD

In GitHub Actions CI, integration tests:
- Use local workers (via wrangler dev in CI)
- Verify both services are running before tests
- Fail fast if services aren't available

## Security Notes

- ✓ Integration tests only run against local workers
- ✓ No secrets required for local testing
- ✓ Tests use local KV namespaces (via wrangler dev)
