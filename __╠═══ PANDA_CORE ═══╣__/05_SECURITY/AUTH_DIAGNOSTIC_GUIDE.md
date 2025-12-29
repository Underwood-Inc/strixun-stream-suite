# Auth Diagnostic Guide - 401 Errors

## The Problem

You're getting 401 Unauthorized errors when `otp-auth-service` tries to call `customer-api`. Based on the logs, there are TWO issues:

1. **Service-to-Service Auth**: The `X-Service-Key` header is not being received by `customer-api` (logs show `hasServiceKeyHeader: false`)
2. **Frontend Encryption Key**: The frontend doesn't have `VITE_SERVICE_ENCRYPTION_KEY` set, causing OTP encryption to fail

## Why We Can't Verify Secrets Match

Cloudflare Workers secrets are encrypted and cannot be read back for security reasons. We can only:
- Set secrets (`wrangler secret put`)
- List secret names (`wrangler secret list`)
- **NOT** read secret values (`wrangler secret get` doesn't exist)

## How to Diagnose the Issue

The code now has comprehensive debug logging that will show you exactly what's happening:

### Step 1: Check Cloudflare Worker Logs

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select `otp-auth-service` worker
3. Go to Logs tab
4. Make a request (try to log in)
5. Look for these log messages:

**From otp-auth-service (sending request):**
```
[Customer API Service Client] Creating service client
  hasServiceApiKey: true/false
  serviceApiKeyLength: <number>
  hasNetworkIntegrityKeyphrase: true/false
  networkIntegrityKeyphraseLength: <number>

[ServiceClient] Making request
  authHeaderName: "X-Service-Key"
  authHeaderValueLength: <number>
  authHeaderValuePreview: "abc12345..."
```

**From customer-api (receiving request):**
```
[Customer API Auth] Service authentication attempt
  hasServiceKeyHeader: true/false
  serviceKeyLength: <number>
  serviceKeyPreview: "xyz67890..."
  hasEnvServiceApiKey: true/false
  envServiceApiKeyLength: <number>
  envServiceApiKeyPreview: "abc12345..."
```

### Step 2: Compare the Previews

The `authHeaderValuePreview` from otp-auth-service should match `envServiceApiKeyPreview` from customer-api.

**If they DON'T match:**
- The keys are different
- You need to set the SAME key in both services

**If one is missing:**
- That service doesn't have the secret set
- Set it via `wrangler secret put`

### Step 3: Check for Length Mismatches

If the lengths are different, the keys definitely don't match:
- `serviceKeyLength` (from request) vs `envServiceApiKeyLength` (from customer-api)

## How to Fix

### Option 1: Use the PowerShell Script (Recommended)

The `set-all-encryption-keys.ps1` script will set `SERVICE_API_KEY` in both services with the SAME value:

```powershell
cd serverless
.\set-all-encryption-keys.ps1
```

When prompted for `SERVICE_API_KEY`, enter the SAME key you want to use for both services.

### Option 2: Manual Fix

1. **Generate a key** (if you don't have one):
   ```bash
   openssl rand -hex 32
   ```

2. **Set in otp-auth-service**:
   ```bash
   cd serverless/otp-auth-service
   echo "YOUR_KEY_HERE" | wrangler secret put SERVICE_API_KEY
   ```

3. **Set in customer-api** (SAME KEY):
   ```bash
   cd ../customer-api
   echo "YOUR_KEY_HERE" | wrangler secret put SERVICE_API_KEY
   ```

4. **Set NETWORK_INTEGRITY_KEYPHRASE** (same process, SAME value in both):
   ```bash
   # Generate keyphrase
   openssl rand -hex 32
   
   # Set in otp-auth-service
   cd serverless/otp-auth-service
   echo "YOUR_KEYPHRASE_HERE" | wrangler secret put NETWORK_INTEGRITY_KEYPHRASE
   
   # Set in customer-api (SAME KEYPHRASE)
   cd ../customer-api
   echo "YOUR_KEYPHRASE_HERE" | wrangler secret put NETWORK_INTEGRITY_KEYPHRASE
   ```

5. **Redeploy both services**:
   ```bash
   cd serverless/otp-auth-service
   pnpm exec wrangler deploy
   
   cd ../customer-api
   pnpm exec wrangler deploy
   ```

## What the Logs Will Show

### Success (Keys Match):
```
[ServiceClient] Making request
  authHeaderValuePreview: "abc12345..."

[Customer API Auth] Service authentication attempt
  serviceKeyPreview: "abc12345..."
  envServiceApiKeyPreview: "abc12345..."

[Customer API Auth] Service authentication successful
```

### Failure (Keys Don't Match):
```
[ServiceClient] Making request
  authHeaderValuePreview: "abc12345..."

[Customer API Auth] Service authentication attempt
  serviceKeyPreview: "abc12345..."
  envServiceApiKeyPreview: "xyz67890..."  <-- DIFFERENT!

[Customer API Auth] Service key does not match. Keys must be identical...
```

### Failure (Key Missing):
```
[Customer API Auth] Service authentication attempt
  serviceKeyPreview: "abc12345..."
  envServiceApiKeyPreview: "missing"  <-- NOT SET!

[Customer API Auth] SERVICE_API_KEY is not configured in customer-api worker...
```

## Quick Checklist

- [ ] `SERVICE_API_KEY` set in otp-auth-service
- [ ] `SERVICE_API_KEY` set in customer-api (SAME value)
- [ ] `NETWORK_INTEGRITY_KEYPHRASE` set in otp-auth-service
- [ ] `NETWORK_INTEGRITY_KEYPHRASE` set in customer-api (SAME value)
- [ ] Both services redeployed after setting secrets
- [ ] Check logs to verify keys match (compare previews)

## Frontend Encryption Key Issue

The browser logs show:
```
[OtpLogin] ❌ CRITICAL ERROR: otpEncryptionKey is missing!
```

This means `VITE_SERVICE_ENCRYPTION_KEY` is not set in your frontend build environment.

### How to Fix

1. **Set the key in your `.env` file** (root of the project):
   ```bash
   VITE_SERVICE_ENCRYPTION_KEY=your-key-here
   ```

2. **Or set it in your build environment** (CI/CD):
   - Add `VITE_SERVICE_ENCRYPTION_KEY` as a GitHub secret
   - Use it in your build workflow

3. **Rebuild the frontend**:
   ```bash
   pnpm build
   ```

4. **Verify the key matches the server**:
   - Frontend: `VITE_SERVICE_ENCRYPTION_KEY` (in `.env`)
   - Backend: `SERVICE_ENCRYPTION_KEY` (Cloudflare Workers secret)
   - **They must be the SAME value**

## Summary

The debug logging will tell you exactly what's wrong. Look for:
1. **Missing keys** - one service doesn't have the secret set
2. **Mismatched keys** - the previews don't match (different values)
3. **Length mismatches** - keys are different lengths (definitely don't match)
4. **Header not being sent** - `X-Service-Key` header missing in request (check `[ServiceClient] Setting auth header` logs)
5. **Frontend key missing** - `VITE_SERVICE_ENCRYPTION_KEY` not set in build environment

The logs are your best diagnostic tool since we can't read secret values directly.

