# Phase 4: Customer API Worker - Setup Instructions 🚀

## Overview

The Customer API worker has been created and is ready for deployment. This document provides step-by-step instructions for setting it up.

---

## ✅ What's Been Created

1. **Worker Structure** - Complete customer-api worker following game-api pattern
2. **Routes & Handlers** - Customer CRUD endpoints with automatic encryption
3. **Services** - Customer service using dedicated CUSTOMER_KV namespace
4. **Utilities** - Auth, encryption, CORS, error handling
5. **Configuration** - wrangler.toml, package.json, tsconfig.json

---

## 📋 Setup Steps

### Step 1: Create KV Namespace

Navigate to the customer-api directory and create the KV namespace:

```bash
cd serverless/customer-api
wrangler kv namespace create "CUSTOMER_API_KV"
```

**Expected Output:**
```
🌀  Creating namespace with title "CUSTOMER_API_KV"
✨  Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "CUSTOMER_KV", id = "abc123def456ghi789..." }
```

**⚠️ IMPORTANT:** Copy the `id` value - you'll need it in the next step!

---

### Step 2: Update wrangler.toml

Open `serverless/customer-api/wrangler.toml` and replace `PLACEHOLDER_ID` with the actual namespace ID from Step 1:

```toml
[[kv_namespaces]]
binding = "CUSTOMER_KV"
id = "abc123def456ghi789..."  # ← Replace PLACEHOLDER_ID with your actual ID
```

---

### Step 3: Set Wrangler Secrets

Set the required secrets. The JWT_SECRET **must match** the OTP auth service:

```bash
# First, get the JWT_SECRET from OTP auth service
cd serverless/otp-auth-service
wrangler secret list
# Note the JWT_SECRET value (or set it if missing)

# Now set it for customer-api
cd ../customer-api
wrangler secret put JWT_SECRET
# When prompted, paste the JWT_SECRET value

# Optional: Set allowed CORS origins (recommended for production)
wrangler secret put ALLOWED_ORIGINS
# When prompted, enter: https://auth.idling.app,https://dashboard.idling.app
```

**⚠️ CRITICAL:** The JWT_SECRET must be **identical** to the one in the OTP auth service, otherwise authentication will fail!

---

### Step 4: Install Dependencies

Install the required dependencies:

```bash
cd serverless/customer-api
pnpm install
```

---

### Step 5: Deploy the Worker

Deploy the customer API worker:

```bash
wrangler deploy
```

**Expected Output:**
```
✨ Compiled Worker successfully
✨ Uploaded strixun-customer-api (X.XX sec)
Published strixun-customer-api (X.XX sec)
  https://strixun-customer-api.YOUR_SUBDOMAIN.workers.dev
```

---

### Step 6: Configure Custom Domain (Optional but Recommended)

#### Option A: Via Cloudflare Dashboard (Recommended)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** → **strixun-customer-api**
3. Go to **Settings** → **Triggers** → **Routes**
4. Click **Add Route**
5. Enter: `customer.idling.app/*`
6. Select zone: `idling.app`
7. Click **Save**

Cloudflare will automatically manage DNS records.

#### Option B: Already Configured in wrangler.toml

The route is already configured in `wrangler.toml`:
```toml
routes = [
  { pattern = "customer.idling.app/*", zone_name = "idling.app" }
]
```

**Note:** Routes configured in the dashboard take precedence over `wrangler.toml`.

---

### Step 7: Verify Setup

Test the health endpoint:

```bash
# Test via workers.dev URL
curl https://strixun-customer-api.YOUR_SUBDOMAIN.workers.dev/health

# Or test via custom domain (if configured)
curl https://customer.idling.app/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "message": "Customer API is running",
  "service": "strixun-customer-api",
  "timestamp": "2024-12-19T..."
}
```

---

## 🔍 Verification Checklist

- [ ] KV namespace created and ID updated in wrangler.toml
- [ ] JWT_SECRET set (matches OTP auth service)
- [ ] ALLOWED_ORIGINS set (optional but recommended)
- [ ] Dependencies installed (`pnpm install`)
- [ ] Worker deployed successfully
- [ ] Custom domain configured (optional)
- [ ] Health endpoint returns 200 OK

---

## 📝 Quick Reference Commands

```bash
# Create KV namespace
cd serverless/customer-api
wrangler kv namespace create "CUSTOMER_API_KV"

# List KV namespaces
wrangler kv namespace list

# Set secrets
wrangler secret put JWT_SECRET
wrangler secret put ALLOWED_ORIGINS

# List secrets
wrangler secret list

# Deploy
wrangler deploy

# View logs
wrangler tail

# Test locally
wrangler dev
```

---

## 🚨 Troubleshooting

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
2. Verify route is configured in Workers & Pages → Routes
3. Wait a few minutes for DNS propagation
4. Check zone name matches: `idling.app`

---

## 📊 API Endpoints

Once deployed, the following endpoints are available:

- `GET /health` - Health check
- `GET /customer/me` - Get current customer (requires JWT)
- `PUT /customer/me` - Update current customer (requires JWT)
- `POST /customer` - Create new customer (requires JWT)
- `GET /customer/:id` - Get customer by ID (requires JWT, admin only)

All endpoints:
- Require JWT authentication
- Automatically encrypt responses with requester's JWT
- Include `id` and `customerId` in responses (API architecture compliance)
- Support CORS

---

## 🔄 Next Steps (After Setup)

1. **Update OTP Auth Service** to call customer-api instead of local customer service
2. **Update Dashboard** to use customer-api endpoints
3. **Migrate existing customer data** from OTP_AUTH_KV to CUSTOMER_KV (if needed)
4. **Test integration** with OTP auth service and dashboard

---

## 📚 Documentation

- **Setup Guide:** `SETUP.md` (detailed setup instructions)
- **API Documentation:** See handlers for endpoint details
- **Architecture:** Follows game-api pattern for consistency

---

**Status:** ✅ Ready for deployment
**Last Updated:** 2024-12-19

**Need Help?** Check `SETUP.md` for detailed troubleshooting or review the game-api worker for reference implementation.

