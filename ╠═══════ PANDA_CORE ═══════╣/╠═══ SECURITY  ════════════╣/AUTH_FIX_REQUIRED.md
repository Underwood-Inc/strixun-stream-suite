# CRITICAL: Auth Fix Required

## Current Issues

1. **Frontend**: Service key encryption has been removed - HTTPS provides transport security
2. **Backend**: Service-to-service calls should work without authentication
   - Internal calls to customer-api are unauthenticated
   - `NETWORK_INTEGRITY_KEYPHRASE` may be missing or mismatched between services

## Immediate Fix Steps

### Step 1: Verify GitHub Secrets

Check that these secrets are set in GitHub repository settings:

1. Go to: Repository ★ Settings ★ Secrets and variables ★ Actions
2. Verify these secrets exist:
   - `NETWORK_INTEGRITY_KEYPHRASE` (same value for all services)
   - `JWT_SECRET` (same value for all services)

### Step 2: Verify Cloudflare Worker Secrets

**For otp-auth-service:**
```bash
cd serverless/otp-auth-service
wrangler secret list
```

Should show:
- `NETWORK_INTEGRITY_KEYPHRASE` (must match customer-api)
- `JWT_SECRET` (must match customer-api)
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

**For customer-api:**
```bash
cd serverless/customer-api
wrangler secret list
```

Should show:
- `NETWORK_INTEGRITY_KEYPHRASE` (must match otp-auth-service)
- `JWT_SECRET` (must match otp-auth-service)

### Step 3: Set Missing Secrets

If any secrets are missing, set them:

**Set NETWORK_INTEGRITY_KEYPHRASE (same value in both services):**
```bash
# Generate a keyphrase if you don't have one
openssl rand -hex 32

# Set in otp-auth-service
cd serverless/otp-auth-service
echo "YOUR_KEYPHRASE_HERE" | wrangler secret put NETWORK_INTEGRITY_KEYPHRASE

# Set in customer-api (SAME KEYPHRASE)
cd ../customer-api
echo "YOUR_KEYPHRASE_HERE" | wrangler secret put NETWORK_INTEGRITY_KEYPHRASE
```

### Step 4: Redeploy Services

After setting secrets, redeploy:

```bash
# Redeploy otp-auth-service
cd serverless/otp-auth-service
pnpm exec wrangler deploy

# Redeploy customer-api
cd ../customer-api
pnpm exec wrangler deploy
```

Or trigger GitHub Actions workflows to redeploy.

## Verification

After fixing, verify:

1. **Backend**: Check Cloudflare Worker logs - should NOT see 401 errors from customer-api
2. **Auth Flow**: Try logging in - should work without errors

## Error Messages

The code now provides clear error messages:

- **"NETWORK_INTEGRITY_KEYPHRASE is not configured"** ★ Set `NETWORK_INTEGRITY_KEYPHRASE` in both workers
- **"Network integrity verification failed"** ★ Keyphrases don't match between services

## Summary

**Required Secrets (must match between services):**
- `NETWORK_INTEGRITY_KEYPHRASE` - otp-auth-service ★ customer-api
- `JWT_SECRET` - otp-auth-service ★ customer-api

**Internal calls don't require authentication** - customer-api accepts unauthenticated internal calls.

**All secrets must be set before auth will work!**
