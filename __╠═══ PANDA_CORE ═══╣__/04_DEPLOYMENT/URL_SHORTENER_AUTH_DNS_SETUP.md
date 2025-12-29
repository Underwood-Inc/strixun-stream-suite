# Auth DNS Setup for auth.idling.app

> **Complete guide for setting up auth.idling.app DNS for URL Shortener**

**Date:** 2025-12-29

---

## Problem

The URL shortener standalone page is trying to use `auth.idling.app` for OTP authentication, but the DNS isn't resolving.

---

## Solution: Configure Route in Cloudflare Dashboard

The OTP auth service (`otp-auth-service`) already has the route configured in `wrangler.toml`, but you need to add it in the Cloudflare Dashboard for it to work.

### Step 1: Deploy OTP Auth Service (if not already deployed)

```bash
cd serverless/otp-auth-service
wrangler deploy
```

### Step 2: Add Route in Cloudflare Dashboard

1. Go to **Cloudflare Dashboard** → **Workers & Pages**
2. Click on **otp-auth-service**
3. Go to **Settings** → **Triggers** → **Routes**
4. Click **Add Route**
5. Enter: `auth.idling.app/*`
6. Click **Save**

### Step 3: Verify DNS Record

1. Go to **Cloudflare Dashboard** → **DNS** → **Records**
2. Look for a CNAME record for `auth` pointing to `otp-auth-service.strixuns-script-suite.workers.dev`
3. If it doesn't exist, Cloudflare should create it automatically when you add the route
4. If it still doesn't exist after a few minutes, create it manually:
   - Type: `CNAME`
   - Name: `auth`
   - Target: `otp-auth-service.strixuns-script-suite.workers.dev`
   - Proxy status: Proxied (orange cloud)

### Step 4: Wait for Propagation

- DNS changes: 1-5 minutes
- SSL certificate: 1-2 minutes (automatic)

### Step 5: Test

```bash
# Test the custom domain
curl https://auth.idling.app/health/ready

# Should return:
# {"status":"ready","service":"otp-auth-service","timestamp":"..."}
```

---

## Required Secrets for OTP Auth Service

Make sure the OTP auth service has these secrets set:

```bash
cd serverless/otp-auth-service

# Required secrets
wrangler secret put JWT_SECRET          # Must match URL shortener's JWT_SECRET
wrangler secret put RESEND_API_KEY       # Resend API key for sending emails
wrangler secret put RESEND_FROM_EMAIL    # Verified email address

# Optional
wrangler secret put ALLOWED_ORIGINS      # CORS origins (comma-separated)
```

---

## Required Secrets for URL Shortener

Make sure the URL shortener has this secret set:

```bash
cd serverless/url-shortener

# Required - MUST match OTP auth service's JWT_SECRET
wrangler secret put JWT_SECRET

# Optional
wrangler secret put ALLOWED_ORIGINS      # CORS origins (comma-separated)
```

---

## Troubleshooting

### Route Not Working After Adding in Dashboard

1. **Check route is active**: Dashboard → Workers → otp-auth-service → Settings → Triggers → Routes
2. **Check DNS**: Dashboard → DNS → Records (should see `auth` CNAME)
3. **Check SSL**: Dashboard → SSL/TLS → Overview (should show "Active Certificate")
4. **Test workers.dev URL**: `https://otp-auth-service.strixuns-script-suite.workers.dev/health/ready` (should work)

### DNS Not Resolving

1. Verify the CNAME record exists in Cloudflare DNS
2. Check that the proxy is enabled (orange cloud)
3. Wait a few minutes for DNS propagation
4. Try `dig auth.idling.app` or `nslookup auth.idling.app` to verify DNS

### JWT Verification Failing

1. Ensure both services use the **SAME** JWT_SECRET
2. Check secrets: `wrangler secret list` in both directories
3. Redeploy both services after setting secrets

---

**Last Updated**: 2025-12-29

