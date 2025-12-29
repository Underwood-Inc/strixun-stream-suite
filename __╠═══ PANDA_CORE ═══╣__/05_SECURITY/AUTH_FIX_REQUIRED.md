# CRITICAL: Auth Fix Required for streamkit.idling.app

## Current Issues

1. **Frontend**: Missing `VITE_SERVICE_ENCRYPTION_KEY` in build environment
2. **Backend**: Service-to-service authentication failing (401 errors)
   - `SERVICE_API_KEY` may be missing or mismatched between services
   - `NETWORK_INTEGRITY_KEYPHRASE` may be missing or mismatched between services

## Immediate Fix Steps

### Step 1: Verify GitHub Secrets

Check that these secrets are set in GitHub repository settings:

1. Go to: Repository → Settings → Secrets and variables → Actions
2. Verify these secrets exist:
   - `VITE_SERVICE_ENCRYPTION_KEY` (32+ characters)
   - `SERVICE_API_KEY` (same value for all services)
   - `NETWORK_INTEGRITY_KEYPHRASE` (same value for all services)
   - `JWT_SECRET` (same value for all services)

### Step 2: Verify Cloudflare Worker Secrets

**For otp-auth-service:**
```bash
cd serverless/otp-auth-service
wrangler secret list
```

Should show:
- `SERVICE_ENCRYPTION_KEY` (must match `VITE_SERVICE_ENCRYPTION_KEY` value)
- `SERVICE_API_KEY` (must match customer-api)
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
- `SERVICE_API_KEY` (must match otp-auth-service)
- `NETWORK_INTEGRITY_KEYPHRASE` (must match otp-auth-service)
- `JWT_SECRET` (must match otp-auth-service)

### Step 3: Set Missing Secrets

If any secrets are missing, set them:

**Set SERVICE_API_KEY (same value in both services):**
```bash
# Generate a key if you don't have one
openssl rand -hex 32

# Set in otp-auth-service
cd serverless/otp-auth-service
echo "YOUR_KEY_HERE" | wrangler secret put SERVICE_API_KEY

# Set in customer-api (SAME KEY)
cd ../customer-api
echo "YOUR_KEY_HERE" | wrangler secret put SERVICE_API_KEY
```

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

**Set SERVICE_ENCRYPTION_KEY in otp-auth-service:**
```bash
# Use the SAME value as VITE_SERVICE_ENCRYPTION_KEY
cd serverless/otp-auth-service
echo "YOUR_ENCRYPTION_KEY_HERE" | wrangler secret put SERVICE_ENCRYPTION_KEY
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

### Step 5: Rebuild Frontend

The frontend build should automatically use `VITE_SERVICE_ENCRYPTION_KEY` from GitHub secrets. If it's not set, the build will fail with a clear error message.

To rebuild:
- Push to main branch (triggers deploy-pages workflow)
- Or manually trigger the "Deploy to GitHub Pages" workflow

## Verification

After fixing, verify:

1. **Frontend**: Check browser console - should NOT see "otpEncryptionkey is missing" error
2. **Backend**: Check Cloudflare Worker logs - should NOT see 401 errors from customer-api
3. **Auth Flow**: Try logging in - should work without errors

## Error Messages

The code now provides clear error messages:

- **"SERVICE_API_KEY is not configured"** → Set `SERVICE_API_KEY` in both workers
- **"NETWORK_INTEGRITY_KEYPHRASE is not configured"** → Set `NETWORK_INTEGRITY_KEYPHRASE` in both workers
- **"Service authentication failed"** → Keys don't match between services
- **"Network integrity verification failed"** → Keyphrases don't match between services
- **"otpEncryptionkey is missing"** → `VITE_SERVICE_ENCRYPTION_KEY` not set in GitHub secrets or build

## Quick Fix Script

You can use the PowerShell script to set encryption keys:

```powershell
cd serverless
.\set-all-encryption-keys.ps1
```

This will:
- Set `VITE_SERVICE_ENCRYPTION_KEY` in frontend `.env` files
- Set `SERVICE_ENCRYPTION_KEY` in all workers
- Set `SERVICE_API_KEY` in otp-auth-service and customer-api

**Note**: You still need to set `NETWORK_INTEGRITY_KEYPHRASE` manually in both services.

## Summary

**Required Secrets (must match between services):**
- `SERVICE_API_KEY` - otp-auth-service ↔ customer-api
- `NETWORK_INTEGRITY_KEYPHRASE` - otp-auth-service ↔ customer-api
- `JWT_SECRET` - otp-auth-service ↔ customer-api

**Required Secrets (same value, different names):**
- Frontend: `VITE_SERVICE_ENCRYPTION_KEY` (GitHub secret)
- Backend: `SERVICE_ENCRYPTION_KEY` (worker secret)

**All secrets must be set before auth will work!**

