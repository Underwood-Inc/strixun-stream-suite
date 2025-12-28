# SERVICE_API_KEY Setup Guide [KEY]

## Overview

`SERVICE_API_KEY` is used for service-to-service authentication between the OTP auth service and customer-api worker. Both workers must have the **same** key value.

---

## [SUCCESS] Current Status

You've already set `SERVICE_API_KEY` manually via `wrangler secret put`. That's perfect! [SUCCESS]

---

## [CONFIG] Optional: GitHub Secrets (For Automated Deployment)

If you want the GitHub workflow to automatically set `SERVICE_API_KEY` during deployment:

### Step 1: Add to GitHub Repository Secrets

1. Go to your GitHub repository
2. Navigate to: **Settings** [EMOJI] **Secrets and variables** [EMOJI] **Actions**
3. Click **"New repository secret"**
4. **Name:** `SERVICE_API_KEY`
5. **Value:** The same secure random string you used when setting it manually
   - If you don't remember it, you can generate a new one: `openssl rand -hex 32`
   - **[WARNING] IMPORTANT:** If you generate a new one, you must update BOTH workers with the new value

### Step 2: Verify Workflow Will Set It

The workflows are already configured to set `SERVICE_API_KEY` if it exists in GitHub secrets:

- [SUCCESS] `.github/workflows/deploy-customer-api.yml` - Sets `SERVICE_API_KEY` for customer-api
- [SUCCESS] `.github/workflows/deploy-otp-auth.yml` - Sets `SERVICE_API_KEY` for OTP auth service

**No code changes needed** - the workflows will automatically use the GitHub secret if it exists.

---

## [SEARCH] Verification

### Check Current Secrets

**OTP Auth Service:**
```bash
cd serverless/otp-auth-service
wrangler secret list
# Should show SERVICE_API_KEY
```

**Customer API:**
```bash
cd serverless/customer-api
wrangler secret list
# Should show SERVICE_API_KEY
```

### Test Service Authentication

```bash
# Test service call to customer-api
curl -X GET https://customer.idling.app/customer/by-email/test@example.com \
  -H "X-Service-Key: YOUR_SERVICE_API_KEY"
```

---

## [CLIPBOARD] Summary

- [SUCCESS] **Manual Setup:** Already done via `wrangler secret put`
- [WARNING] **GitHub Secrets:** Optional - only needed if you want automated deployment to set it
- [SUCCESS] **Workflows:** Already configured to use GitHub secret if it exists

**Current State:** You're all set! The manual setup is sufficient. GitHub secrets are only needed if you want the workflow to automatically manage it.

---

**Status:** [SUCCESS] **CONFIGURED**
**Last Updated:** 2024-12-19

