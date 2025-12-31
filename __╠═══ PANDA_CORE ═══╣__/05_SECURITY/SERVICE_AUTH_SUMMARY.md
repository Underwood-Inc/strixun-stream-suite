# Service-to-Service Authentication Summary

## Overview

All service-to-service calls now use the correct authentication method. This document summarizes which services use which keys.

## Authentication Methods

### SERVICE_API_KEY
- **Header**: `X-Service-Key: <key>`
- **Use Case**: General service-to-service calls between services
- **Example**: `otp-auth-service` calling `customer-api` to create/lookup customers

### SUPER_ADMIN_API_KEY
- **Header**: `Authorization: Bearer <key>`
- **Use Case**: Admin/system-wide operations that require super-admin privileges
- **Example**: `mods-api` calling `otp-auth-service` `/admin/users` endpoint

## Service-to-Service Call Matrix

### ✓ otp-auth-service ★ customer-api
- **Endpoint**: `/customer`, `/customer/by-email/:email`, etc.
- **Auth Method**: `SERVICE_API_KEY` (X-Service-Key header)
- **Status**: ✓ **FIXED** - Now explicitly uses `SERVICE_API_KEY` only
- **File**: `serverless/otp-auth-service/utils/customer-api-service-client.ts`
- **Key**: Both services must have the **SAME** `SERVICE_API_KEY` value

### ✓ mods-api ★ otp-auth-service
- **Endpoint**: `/admin/users`
- **Auth Method**: `SUPER_ADMIN_API_KEY` (Authorization: Bearer header)
- **Status**: ✓ **CORRECT** - Admin endpoints require super-admin access
- **File**: `serverless/mods-api/handlers/admin/users.ts`
- **Key**: `mods-api` must have `SUPER_ADMIN_API_KEY` set (matches `otp-auth-service`)

## Key Configuration Requirements

### otp-auth-service
**Required Secrets:**
- `SERVICE_API_KEY` - For calling customer-api
- `SUPER_ADMIN_API_KEY` - For admin operations (if needed)
- `NETWORK_INTEGRITY_KEYPHRASE` - For request/response integrity verification

### customer-api
**Required Secrets:**
- `SERVICE_API_KEY` - **MUST MATCH** the value in `otp-auth-service`
- `NETWORK_INTEGRITY_KEYPHRASE` - **MUST MATCH** the value in `otp-auth-service`
- `JWT_SECRET` - For JWT token verification

### mods-api
**Required Secrets:**
- `SUPER_ADMIN_API_KEY` - For calling otp-auth-service admin endpoints
- `SERVICE_API_KEY` - Optional, for future service-to-service calls
- `NETWORK_INTEGRITY_KEYPHRASE` - For request/response integrity verification

## Critical Requirements

### 1. SERVICE_API_KEY Must Match
- `otp-auth-service` and `customer-api` **MUST** have the **SAME** `SERVICE_API_KEY` value
- If they don't match, you'll get 401 Unauthorized errors
- The logs will show key previews to help diagnose mismatches

### 2. NETWORK_INTEGRITY_KEYPHRASE Must Match
- All services that communicate with each other **MUST** have the **SAME** `NETWORK_INTEGRITY_KEYPHRASE` value
- This is used for HMAC-SHA256 signature verification to detect tampering

### 3. SUPER_ADMIN_API_KEY for Admin Operations
- Admin endpoints require `SUPER_ADMIN_API_KEY`
- This is different from `SERVICE_API_KEY` and is used for system-wide admin operations

## How to Verify

### Check Logs
After making a request, check the Cloudflare Worker logs for:

**From the calling service (otp-auth-service):**
```
[ServiceClient] Setting auth header
  authHeaderName: 'X-Service-Key'  // Should be X-Service-Key for service calls
  hasServiceKey: true
  hasSuperAdminKey: false  // Should be false for service calls
```

**From the receiving service (customer-api):**
```
[Customer API Auth] Service authentication attempt
  hasServiceKeyHeader: true  // Should be true
  serviceKeyPreview: 'abc12345...'
  envServiceApiKeyPreview: 'abc12345...'  // Should match!
```

### If Keys Don't Match
- The previews will be different
- You'll see: `[Customer API Auth] Service key does not match`
- Fix: Set the **SAME** `SERVICE_API_KEY` in both services

## Recent Fixes

### ✓ Fixed: otp-auth-service ★ customer-api
**Problem**: Service client was using `SUPER_ADMIN_API_KEY` instead of `SERVICE_API_KEY`, causing 401 errors.

**Solution**: Modified `createServiceApiClient` to explicitly filter the env object to only include `SERVICE_API_KEY`, excluding `SUPER_ADMIN_API_KEY`.

**File**: `serverless/otp-auth-service/utils/customer-api-service-client.ts`

**Change**:
```typescript
// Before: Passed full env (could use SUPER_ADMIN_API_KEY if both were set)
return createServiceClient(getCustomerApiUrl(env), env, {...});

// After: Explicitly use only SERVICE_API_KEY
const serviceEnv = {
    SERVICE_API_KEY: env.SERVICE_API_KEY,
    NETWORK_INTEGRITY_KEYPHRASE: env.NETWORK_INTEGRITY_KEYPHRASE,
};
return createServiceClient(getCustomerApiUrl(env), serviceEnv, {...});
```

## Summary

- ✓ **otp-auth-service ★ customer-api**: Uses `SERVICE_API_KEY` (X-Service-Key header)
- ✓ **mods-api ★ otp-auth-service**: Uses `SUPER_ADMIN_API_KEY` (Authorization: Bearer header) - **CORRECT** for admin endpoints
- ✓ All services now use the correct authentication method
- ✓ Keys must match between communicating services

## Next Steps

1. Ensure `SERVICE_API_KEY` is set and matches in both `otp-auth-service` and `customer-api`
2. Ensure `NETWORK_INTEGRITY_KEYPHRASE` is set and matches across all services
3. Verify authentication is working by checking the logs after making requests

