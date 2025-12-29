# Customer API Setup Guide

**Last Updated:** 2025-12-29

This guide will walk you through setting up the Customer API worker with its dedicated KV namespace.

---

## Prerequisites

- Cloudflare account with Workers enabled
- Wrangler CLI installed (`npm install -g wrangler` or `pnpm add -g wrangler`)
- Access to the `idling.app` domain (or your custom domain)
- JWT_SECRET from the OTP auth service (must match)

---

## Step 1: Create KV Namespace

**Option A: Manual Creation (Recommended for First Time)**

Navigate to the customer-api directory and create the KV namespace:

```bash
cd serverless/customer-api
wrangler kv namespace create "CUSTOMER_API_KV"
```

**Output will look like:**
```
[INFO] Creating namespace with title "CUSTOMER_API_KV"
[SUCCESS] Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "CUSTOMER_KV", id = "abc123def456..." }
```

**Copy the `id` value** - you'll need it in the next step.

**Option B: Automatic Creation via GitHub Workflow**

The GitHub workflow (`.github/workflows/deploy-customer-api.yml`) will automatically create the KV namespace if it doesn't exist when you deploy. However, you still need to update `wrangler.toml` with the namespace ID after the first deployment.

---

## Step 2: Update wrangler.toml

Open `serverless/customer-api/wrangler.toml` and replace `PLACEHOLDER_ID` with the actual namespace ID:

```toml
[[kv_namespaces]]
binding = "CUSTOMER_KV"
id = "abc123def456..."  # Replace with your actual namespace ID
```

---

## Step 3: Set Wrangler Secrets

Set the required secrets for the customer API:

```bash
# Required: JWT secret (must match OTP auth service)
wrangler secret put JWT_SECRET
# When prompted, paste your JWT_SECRET value

# Optional: Allowed CORS origins (recommended for production)
wrangler secret put ALLOWED_ORIGINS
# When prompted, enter (production):
# https://auth.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://mods.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app
#
# For development, also include:
# ,http://localhost:5173,http://localhost:3000,http://localhost:5174,http://127.0.0.1:5173,http://localhost:8080
#
# See CORS_ORIGINS_AUDIT.md for complete list and details
```

**Important:** The `JWT_SECRET` must match the one used in the OTP auth service. If you don't know it, check the OTP auth service secrets:

```bash
cd serverless/otp-auth-service
wrangler secret list
```

---

## Step 4: Deploy the Worker

Deploy the customer API worker:

```bash
cd serverless/customer-api
wrangler deploy
```

**Expected output:**
```
[SUCCESS] Compiled Worker successfully
[SUCCESS] Uploaded customer-api (X.XX sec)
Published strixun-customer-api (X.XX sec)
  https://strixun-customer-api.YOUR_SUBDOMAIN.workers.dev
```

---

## Step 5: Configure Custom Domain (Optional but Recommended)

### Option A: Via Cloudflare Dashboard (Recommended)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** -> **strixun-customer-api**
3. Go to **Settings** -> **Triggers** -> **Routes**
4. Click **Add Route**
5. Enter: `customer.idling.app/*`
6. Select zone: `idling.app`
7. Click **Save**

Cloudflare will automatically manage DNS records.

### Option B: Via wrangler.toml (Already Configured)

The `wrangler.toml` already has the route configured:
```toml
routes = [
  { pattern = "customer.idling.app/*", zone_name = "idling.app" }
]
```

Routes configured in the dashboard take precedence over `wrangler.toml`.

---

## Step 6: Verify Setup

Test the health endpoint:

```bash
# Test via workers.dev URL
curl https://strixun-customer-api.YOUR_SUBDOMAIN.workers.dev/health

# Or test via custom domain (if configured)
curl https://customer.idling.app/health
```

**Expected response:**
```json
{
  "status": "ok",
  "message": "Customer API is running",
  "service": "strixun-customer-api",
  "timestamp": "2024-12-19T..."
}
```

---

## Step 7: Verify Secrets

Check that all secrets are set:

```bash
cd serverless/customer-api
wrangler secret list
```

**Expected output:**
```
JWT_SECRET
ALLOWED_ORIGINS (optional)
```

---

## Troubleshooting

### Error: "JWT_SECRET environment variable is required"

**Solution:** Set the JWT_SECRET secret:
```bash
wrangler secret put JWT_SECRET
```

### Error: "KV namespace not found"

**Solution:** 
1. Verify the namespace ID in `wrangler.toml` is correct
2. Check namespace exists: `wrangler kv namespace list`
3. If missing, create it: `wrangler kv namespace create "CUSTOMER_API_KV"`

### Error: "Authentication failed" when calling API

**Solution:**
1. Verify JWT_SECRET matches the OTP auth service
2. Check JWT token is valid and not expired
3. Verify Authorization header format: `Bearer <token>`

### Custom Domain Not Working

**Solution:**
1. Check DNS records in Cloudflare Dashboard
2. Verify route is configured in Workers & Pages -> Routes
3. Wait a few minutes for DNS propagation
4. Check zone name matches: `idling.app`

---

## Next Steps

After setup is complete:

1. **Update OTP Auth Service** to call customer-api instead of local customer service
2. **Update Dashboard** to use customer-api endpoints
3. **Migrate existing customer data** from OTP_AUTH_KV to CUSTOMER_KV (if needed)

---

## Environment Variables Summary

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `JWT_SECRET` | Secret | [SUCCESS] Yes | JWT signing secret (must match OTP auth service) |
| `ALLOWED_ORIGINS` | Secret | [ERROR] No | Comma-separated CORS origins |
| `ENVIRONMENT` | Var | [ERROR] No | Environment name (default: "production") |

---

## Wrangler Commands Reference

```bash
# Create KV namespace
wrangler kv namespace create "CUSTOMER_API_KV"

# List KV namespaces
wrangler kv namespace list

# Set secret
wrangler secret put JWT_SECRET

# List secrets
wrangler secret list

# Deploy worker
wrangler deploy

# View logs
wrangler tail

# Test locally
wrangler dev
```

---

**Status:** [SUCCESS] Ready for setup
