# Customer API Integration Guide

> **Complete guide for integrating Customer API with OTP auth service and dashboard**

**Date:** 2025-12-29

---

## Overview

This guide documents the integration of the customer-api worker with the OTP auth service and dashboard.

---

## [OK] Completed Integration Steps

### 1. Customer API Client Created

**File:** `serverless/otp-auth-service/utils/customer-api-client.ts`

A client utility for making authenticated requests to the customer-api worker:
- `getCustomer(customerId, jwtToken, env)` - Get customer by ID
- `getCustomerByEmail(email, jwtToken, env)` - Get customer by email
- `getCurrentCustomer(jwtToken, env)` - Get current customer (me)
- `createCustomer(customerData, jwtToken, env)` - Create new customer
- `updateCustomer(customerId, updates, jwtToken, env)` - Update customer

**Features:**
- Automatic JWT-based authentication
- Automatic response decryption (handles `X-Encrypted` header)
- Error handling and logging

---

### 2. Dashboard Updated to Use Customer API

**File:** `serverless/otp-auth-service/dashboard/src/lib/api-client.ts`

The dashboard API client now calls customer-api endpoints instead of OTP auth service endpoints:

**Before:**
```typescript
async getCustomer(): Promise<Customer> {
  return await this.get('/admin/customers/me');
}
```

**After:**
```typescript
async getCustomer(): Promise<Customer> {
  const customerApiUrl = import.meta.env.VITE_CUSTOMER_API_URL || 'https://customer.idling.app';
  const response = await fetch(`${customerApiUrl}/customer/me`, {
    method: 'GET',
    headers: this.getHeaders(),
  });
  return await this.decryptResponse<Customer>(response);
}
```

**Environment Variable:**
- `VITE_CUSTOMER_API_URL` - Optional override for customer-api URL (defaults to `https://customer.idling.app`)

---

### 3. Customer API Endpoints Added

**New Endpoint:** `GET /customer/by-email/:email`

Allows looking up customers by email address (required for account recovery).

**File:** `serverless/customer-api/handlers/customer.ts`
- `handleGetCustomerByEmail()` - Handler for email lookup

**File:** `serverless/customer-api/router/customer-routes.ts`
- Route added: `/customer/by-email/:email`

---

## [EMOJI] Migration Status

### [OK] Migrated to Customer API

1. **Dashboard Customer Endpoints**
   - `GET /customer/me` - Get current customer
   - `PUT /customer/me` - Update current customer

### [OK] Fully Migrated to Customer API

All customer operations now go through customer-api:

1. **`ensureCustomerAccount()`** (`handlers/auth/customer-creation.ts`)
   - [OK] Now uses customer-api via service-to-service authentication
   - [OK] Uses `SERVICE_API_KEY` for internal calls (no JWT needed)
   - [OK] All customer data stored in `CUSTOMER_KV` (customer-api)

2. **All handlers that call `ensureCustomerAccount()`:**
   - [OK] `handlers/auth/verify-otp.ts` - Uses customer-api
   - [OK] `handlers/auth/session.ts` - Uses customer-api
   - [OK] `handlers/admin/customers.js` - Uses customer-api
   - [OK] `handlers/user/preferences.ts` - Uses customer-api
   - [OK] `router/admin-routes.ts` - Uses customer-api

---

## [EMOJI] Next Steps

### [OK] Phase 1 & 2: Complete! 

Service-to-service authentication is implemented and `ensureCustomerAccount()` is fully migrated to customer-api.

### Phase 3: Data Migration (Optional)

Migrate existing customer data from `OTP_AUTH_KV` to `CUSTOMER_KV`:
- See [Data Migration Guide](./CUSTOMER_API_DATA_MIGRATION.md) for detailed steps
- Use migration script to copy customer records
- Verify data integrity after migration

---

## [EMOJI] API Endpoints Reference

### Customer API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/customer/me` | Get current customer | [OK] JWT |
| `GET` | `/customer/:id` | Get customer by ID | [OK] JWT |
| `GET` | `/customer/by-email/:email` | Get customer by email | [OK] JWT |
| `POST` | `/customer` | Create new customer | [OK] JWT |
| `PUT` | `/customer/me` | Update current customer | [OK] JWT |

### OTP Auth Service Endpoints (Legacy)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| `GET` | `/admin/customers/me` | Get current customer | [WARNING] Deprecated (use customer-api) |
| `PUT` | `/admin/customers/me` | Update current customer | [WARNING] Deprecated (use customer-api) |

**Note:** Legacy endpoints may still work but should be migrated to customer-api.

---

## [EMOJI] Configuration

### Environment Variables

**OTP Auth Service:**
- `CUSTOMER_API_URL` (optional) - Override customer-api URL (defaults to `https://customer.idling.app`)

**Dashboard:**
- `VITE_CUSTOMER_API_URL` (optional) - Override customer-api URL for frontend (defaults to `https://customer.idling.app`)

**Customer API:**
- `JWT_SECRET` (required) - Must match OTP auth service JWT secret
- `ALLOWED_ORIGINS` (optional) - CORS origins

---

## [EMOJI] Troubleshooting

### Dashboard Can't Load Customer Data

**Symptoms:** Dashboard shows "Failed to load customer" error

**Solutions:**
1. Check that customer-api is deployed and accessible
2. Verify `VITE_CUSTOMER_API_URL` is set correctly (if using custom URL)
3. Check browser console for CORS errors
4. Verify JWT token is valid and includes `customerId`

### Customer API Returns 401 Unauthorized

**Symptoms:** Customer API returns 401 errors

**Solutions:**
1. Verify `JWT_SECRET` matches between OTP auth service and customer-api
2. Check that JWT token is being sent in `Authorization: Bearer <token>` header
3. Verify JWT token hasn't expired
4. Check customer-api logs for authentication errors

### Customer Not Found After Migration

**Symptoms:** Customer exists in `OTP_AUTH_KV` but not found via customer-api

**Solutions:**
1. Run data migration script (see [Data Migration Guide](./CUSTOMER_API_DATA_MIGRATION.md))
2. Verify customer data was migrated correctly
3. Check that email-to-customerId mapping was migrated
4. Verify customer-api is using correct KV namespace

---

## [EMOJI] Notes

- **Backward Compatibility:** Legacy endpoints (`/admin/customers/me`) may still work but are deprecated
- **Data Storage:** Customer data is stored in `CUSTOMER_KV` (customer-api) and `OTP_AUTH_KV` (OTP auth service) during migration period
- **Encryption:** All customer-api responses are automatically encrypted using JWT (E2E encryption)
- **CORS:** Customer-api must have correct `ALLOWED_ORIGINS` configured for dashboard to work

---

**Status:** [OK] **FULLY INTEGRATED**  
**Last Updated:** 2025-12-29  
**Next Step:** Test integration and optionally migrate existing customer data

---

**Last Updated**: 2025-12-29

