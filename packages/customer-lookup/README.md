# Customer Lookup Package

Consolidated customer API client using the API framework as source of truth. Supports both JWT authentication (for user requests) and service-client (for service-to-service calls).

## Features

- **Unified API**: Single package for all customer API operations
- **Dual Authentication**: Supports both JWT (user requests) and service-client (service-to-service)
- **API Framework Integration**: Uses `@strixun/api-framework` as source of truth
- **Automatic Localhost Support**: Automatically uses `http://localhost:8790` in development
- **Type-Safe**: Full TypeScript support

## Installation

This is a workspace package. It's automatically available to all packages in the monorepo.

## Usage

### Service-to-Service Calls (Recommended)

For service-to-service calls, use the service-client functions:

```typescript
import { 
    fetchCustomerByCustomerId,
    getCustomerByEmailService,
    createCustomer,
    updateCustomer,
    getCustomerService
} from '@strixun/customer-lookup';

// Get customer by ID (service-to-service)
const customer = await fetchCustomerByCustomerId(customerId, env);

// Get customer by email (service-to-service)
const customer = await getCustomerByEmailService(email, env);

// Create customer (service-to-service)
const newCustomer = await createCustomer({
    customerId: 'cust_123',
    email: 'user@example.com',
    status: 'active'
}, env);

// Update customer (service-to-service)
const updated = await updateCustomer(customerId, {
    displayName: 'New Name'
}, env);
```

**Required Environment Variables:**
- `SUPER_ADMIN_API_KEY` - For service-to-service authentication
- `NETWORK_INTEGRITY_KEYPHRASE` - For integrity verification
- `CUSTOMER_API_URL` (optional) - Override API URL
- `ENVIRONMENT` (optional) - Set to 'development' or 'test' for localhost

### JWT-Authenticated User Requests

For user requests with JWT tokens:

```typescript
import { 
    getCustomer,
    getCustomerByEmail,
    getCurrentCustomer
} from '@strixun/customer-lookup';

// Get customer by ID (JWT auth)
const customer = await getCustomer(customerId, jwtToken, env);

// Get customer by email (JWT auth)
const customer = await getCustomerByEmail(email, jwtToken, env);

// Get current customer (me) - JWT auth
const customer = await getCurrentCustomer(jwtToken, env);
```

**Required:**
- `jwtToken` - Valid JWT token from OTP auth service
- `CUSTOMER_API_URL` (optional) - Override API URL
- `ENVIRONMENT` (optional) - Set to 'development' or 'test' for localhost

## Environment Configuration

### Local Development

The package automatically uses `http://localhost:8790` when:
- `ENVIRONMENT === 'development'` or `ENVIRONMENT === 'test'`
- `CUSTOMER_API_URL` is not set

### Production

In production, set `CUSTOMER_API_URL` explicitly or it defaults to:
- `https://strixun-customer-api.strixuns-script-suite.workers.dev`

## Migration from Old Clients

### From `customer-api-client.ts`

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

### From `customer-api-service-client.ts`

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

The old `customer-api-service-client.ts` file is now a backward-compatibility wrapper that re-exports from this package.

## API Reference

### Service-to-Service Functions

- `fetchCustomerByCustomerId(customerId, env)` - Get customer by ID
- `getCustomerService(customerId, env)` - Alias for fetchCustomerByCustomerId
- `getCustomerByEmailService(email, env)` - Get customer by email
- `createCustomer(customerData, env)` - Create new customer
- `updateCustomer(customerId, updates, env)` - Update customer
- `fetchDisplayNameByCustomerId(customerId, env)` - Get display name only
- `fetchCustomersByCustomerIds(customerIds[], env)` - Batch fetch customers
- `fetchDisplayNamesByCustomerIds(customerIds[], env)` - Batch fetch display names

### JWT-Authenticated Functions

- `getCustomer(customerId, jwtToken, env?)` - Get customer by ID
- `getCustomerByEmail(email, jwtToken, env?)` - Get customer by email
- `getCurrentCustomer(jwtToken, env?)` - Get current customer (me)

## Architecture

This package consolidates all customer API access patterns:

1. **Service-to-Service**: Uses `@strixun/service-client` with integrity verification
2. **User Requests**: Uses `@strixun/api-framework/client` with JWT authentication
3. **CORS**: Uses `@strixun/api-framework/enhanced/workers/cors-with-localhost` for standardized CORS

All implementations use the API framework as the source of truth, ensuring consistency across the codebase.
