# Customer Storage Migration - Complete ✅

## Summary

Customer storage has been successfully migrated from `OTP_AUTH_KV` to `CUSTOMER_KV` (customer-api worker). All customer operations now go through the customer-api worker.

---

## ✅ Completed Changes

### 1. Service-to-Service Authentication Added

**File:** `serverless/customer-api/utils/auth.ts`
- Added `authenticateServiceRequest()` function
- Supports `X-Service-Key` header for internal service calls
- Constant-time comparison to prevent timing attacks

**File:** `serverless/customer-api/router/customer-routes.ts`
- Updated `authenticateRequest()` to support both JWT and service key
- Service calls identified by `userId === 'service'`
- Service responses are not encrypted (no JWT needed)

### 2. Service Client Created

**File:** `serverless/otp-auth-service/utils/customer-api-service-client.ts`
- Service-to-service client for internal calls
- Uses `SERVICE_API_KEY` instead of JWT
- Functions:
  - `getCustomerByEmailService()` - Lookup by email
  - `createCustomerService()` - Create customer
  - `getCustomerService()` - Get by ID
  - `updateCustomerService()` - Update customer

### 3. Customer Creation Updated

**File:** `serverless/otp-auth-service/handlers/auth/customer-creation.ts`
- `ensureCustomerAccount()` now uses customer-api service client
- All customer operations go through customer-api
- Removed dependency on local customer service

### 4. Customer API Enhanced

**File:** `serverless/customer-api/handlers/customer.ts`
- Added `handleUpdateCustomerById()` for service calls
- Supports updating customer by ID (for service-to-service)

**File:** `serverless/customer-api/router/customer-routes.ts`
- Added `PUT /customer/:id` route for service calls

---

## 🔧 Configuration Required

### 1. Set Service API Key (Both Workers)

**Option A: Manual Setup (Already Done)**
You've already set this manually via `wrangler secret put SERVICE_API_KEY`. ✅

**Option B: Automated via GitHub (Recommended for CI/CD)**
If you want the GitHub workflow to automatically set it:

1. **Add to GitHub Repository Secrets:**
   - Go to GitHub repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `SERVICE_API_KEY`
   - Value: The same secure random string you used (e.g., from `openssl rand -hex 32`)

2. **Workflow will automatically set it:**
   - The workflow (`.github/workflows/deploy-customer-api.yml` and `deploy-otp-auth.yml`) will automatically set `SERVICE_API_KEY` if it exists in GitHub secrets
   - Both workers will get the same value automatically

**⚠️ IMPORTANT:** Both workers must have the **SAME** `SERVICE_API_KEY` value!

### 2. Optional: Set Customer API URL

**OTP Auth Service (Optional):**
```bash
cd serverless/otp-auth-service
wrangler secret put CUSTOMER_API_URL
# Value: https://customer.idling.app (or custom URL)
```

**Note:** Defaults to `https://customer.idling.app` if not set.

---

## 📋 Migration Checklist

- [x] Service-to-service authentication implemented
- [x] Service client created
- [x] `ensureCustomerAccount()` updated to use customer-api
- [x] Customer API enhanced with service endpoints
- [ ] Set `SERVICE_API_KEY` secret in both workers
- [ ] Test customer creation during OTP flow
- [ ] Verify customer data is stored in `CUSTOMER_KV`
- [ ] Monitor for errors (24-48 hours)

---

## 🧪 Testing

### Test Customer Creation

1. **Trigger OTP Login:**
   ```bash
   curl -X POST https://auth.idling.app/auth/request-otp \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com"}'
   ```

2. **Verify OTP:**
   ```bash
   curl -X POST https://auth.idling.app/auth/verify-otp \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "otp": "123456"}'
   ```

3. **Check Customer Created:**
   ```bash
   # Customer should now exist in CUSTOMER_KV
   # Can verify via customer-api endpoint (with JWT)
   ```

### Test Service Authentication

```bash
curl -X GET https://customer.idling.app/customer/by-email/test@example.com \
  -H "X-Service-Key: YOUR_SERVICE_API_KEY"
```

---

## 🐛 Troubleshooting

### Error: "SERVICE_API_KEY is required"

**Solution:** Set `SERVICE_API_KEY` secret in both workers:
```bash
wrangler secret put SERVICE_API_KEY
```

### Error: "Authentication failed" (Service Calls)

**Solution:** Verify `SERVICE_API_KEY` matches in both workers:
```bash
# Check OTP auth service
cd serverless/otp-auth-service
wrangler secret list

# Check customer-api
cd serverless/customer-api
wrangler secret list
```

### Customer Not Created During OTP Flow

**Check:**
1. Service API key is set correctly
2. Customer-api is accessible
3. Check worker logs for errors
4. Verify `CUSTOMER_API_URL` is correct (if set)

---

## 📝 Notes

- **Service Calls:** Not encrypted (no JWT needed)
- **User Calls:** Still encrypted with JWT (automatic)
- **Backward Compatibility:** Old customer service functions still exist but are no longer used
- **Data Location:** All new customers stored in `CUSTOMER_KV` (customer-api)

---

**Status:** ✅ **MIGRATION COMPLETE**
**Last Updated:** 2024-12-19
**Next Step:** Set `SERVICE_API_KEY` secrets and test

