# Customer API Client Consolidation

**Date:** 2025-01-02  
**Status:** ✓ Completed

## Overview

All customer API client implementations have been consolidated into a single package (`@strixun/customer-lookup`) that uses the API framework as the source of truth.

## Changes Made

### 1. Consolidated Package Created

**Package:** `packages/customer-lookup/index.ts`

- Supports both JWT authentication (user requests) and service-client (service-to-service)
- Uses `@strixun/api-framework` as source of truth
- Automatic localhost support in development (`http://localhost:8790`)
- Full TypeScript support

### 2. Removed Dead Code

- ✓ Deleted `serverless/otp-auth-service/utils/customer-api-client.ts`
  - Functionality moved to `@strixun/customer-lookup` with JWT support

### 3. Backward Compatibility Wrapper

**File:** `serverless/otp-auth-service/utils/customer-api-service-client.ts`

- Now re-exports from `@strixun/customer-lookup`
- Maintains backward compatibility for existing code
- Marked as `@deprecated` - use `@strixun/customer-lookup` directly

### 4. CORS Standardization

- All CORS implementations now use `@strixun/api-framework/enhanced/workers/cors-with-localhost`
- Automatic localhost support in development
- Standardized across all services

## Migration Guide

### For Service-to-Service Calls

**Before:**
```typescript
import { getCustomerService } from '../../utils/customer-api-service-client.js';
const customer = await getCustomerService(customerId, env);
```

**After:**
```typescript
import { getCustomerService } from '@strixun/customer-lookup';
const customer = await getCustomerService(customerId, env);
```

### For JWT-Authenticated User Requests

**Before:**
```typescript
import { getCustomer } from '../../utils/customer-api-client.js';
const customer = await getCustomer(customerId, jwtToken, env);
```

**After:**
```typescript
import { getCustomer } from '@strixun/customer-lookup';
const customer = await getCustomer(customerId, jwtToken, env);
```

## API Reference

### Service-to-Service Functions

- `fetchCustomerByCustomerId(customerId, env)` - Get customer by ID
- `getCustomerService(customerId, env)` - Alias for fetchCustomerByCustomerId
- `getCustomerByEmailService(email, env)` - Get customer by email
- `createCustomer(customerData, env)` - Create new customer
- `updateCustomer(customerId, updates, env)` - Update customer
- `fetchDisplayNameByCustomerId(customerId, env)` - Get display name only
- `fetchCustomersByCustomerIds(customerIds[], env)` - Batch fetch
- `fetchDisplayNamesByCustomerIds(customerIds[], env)` - Batch fetch display names

### JWT-Authenticated Functions

- `getCustomer(customerId, jwtToken, env?)` - Get customer by ID
- `getCustomerByEmail(email, jwtToken, env?)` - Get customer by email
- `getCurrentCustomer(jwtToken, env?)` - Get current customer (me)

## Environment Variables

### Required for Service-to-Service

- `SUPER_ADMIN_API_KEY` - For service-to-service authentication
- `NETWORK_INTEGRITY_KEYPHRASE` - For integrity verification

### Optional

- `CUSTOMER_API_URL` - Override API URL (defaults to workers.dev or localhost:8790 in dev)
- `ENVIRONMENT` - Set to 'development' or 'test' for localhost support

## Testing

### Integration Tests

Integration tests have been updated to include `SUPER_ADMIN_API_KEY` in mock environment:

```typescript
const mockEnv = {
    CUSTOMER_API_URL,
    ENVIRONMENT: 'dev',
    NETWORK_INTEGRITY_KEYPHRASE,
    SUPER_ADMIN_API_KEY, // ✓ Added
};
```

### Unit Tests

Unit tests continue to work as they mock `customer-api-service-client`, which now re-exports from the consolidated package.

## Benefits

1. **Single Source of Truth**: All customer API access goes through one package
2. **API Framework Integration**: Uses framework utilities instead of duplicating code
3. **Consistency**: Same patterns across all services
4. **Maintainability**: Easier to update and maintain
5. **Type Safety**: Full TypeScript support throughout

## Files Updated

- ✓ `packages/customer-lookup/index.ts` - Consolidated implementation
- ✓ `packages/customer-lookup/package.json` - Added API framework dependency
- ✓ `packages/customer-lookup/README.md` - Complete documentation
- ✓ `serverless/otp-auth-service/utils/customer-api-service-client.ts` - Backward compatibility wrapper
- ✓ `serverless/otp-auth-service/handlers/admin/api-keys.ts` - Updated import
- ✓ `serverless/otp-auth-service/handlers/admin/customers.js` - Already using service-client
- ✓ `serverless/otp-auth-service/handlers/auth/customer-creation.ts` - Already using service-client
- ✓ `serverless/otp-auth-service/handlers/auth/customer-creation.integration.test.ts` - Added SUPER_ADMIN_API_KEY
- ✓ `docs/services/customer-api/integration.md` - Updated documentation
- ✓ `docs/services/customer-api/CONSOLIDATION.md` - This file

## Files Removed

- ✗ `serverless/otp-auth-service/utils/customer-api-client.ts` - Consolidated into customer-lookup

## Next Steps

1. ✓ Consolidation complete
2. ✓ Documentation updated
3. ✓ Integration tests updated
4. ✓ Backward compatibility maintained

All customer API access now uses the consolidated `@strixun/customer-lookup` package with the API framework as the source of truth.
