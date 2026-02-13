# Customer Management Networking Architecture Fix

## Problem Statement

The customer management networking was incorrectly architected with mods-api acting as a proxy/middleman for customer-api requests. The frontend called mods-api's `/admin/customers` endpoints, which then made service-to-service calls to customer-api. This was:

- **Inefficient**: Extra hop through mods-api
- **Incorrect**: Violated separation of concerns
- **Unmaintainable**: Dead proxy code scattered across mods-api

## Correct Architecture

```
Frontend (mods-hub)
  ├─→ Mods API (direct)        # For mod management
  ├─→ Customer API (direct)     # For customer management  
  └─→ OTP Auth API (direct)     # For authentication

Mods API
  └─→ Customer API (for customer mod queries only - mod data, not customer data)
```

**Key Principle**: Services call each other directly using dedicated service clients. No proxying through intermediary services.

## Changes Made

### 1. Created Dedicated Customer Service Client (✓)

**File**: `serverless/shared/customer-client.ts`

- Follows the same pattern as `access-client.ts`
- Provides type-safe methods for customer operations
- Uses `@strixun/service-client` with proper authentication and integrity verification
- Exported functions:
  - `getCustomer()` - Get customer by ID
  - `getCustomerByEmail()` - Get customer by email
  - `createCustomer()` - Create new customer
  - `updateCustomer()` - Update customer data
  - `getPreferences()` - Get customer preferences
  - `updatePreferences()` - Update customer preferences
  - `updateDisplayName()` - Update display name
  - `listAllCustomers()` - Admin: List all customers
  - `getCustomerDetails()` - Admin: Get customer details
  - `adminUpdateCustomer()` - Admin: Update customer

**Usage**:
```typescript
import { createCustomerClient } from '../shared/customer-client.js';

const customerClient = createCustomerClient(env);
const customer = await customerClient.getCustomer('cust_123');
```

### 2. Removed Proxy Routes from Mods API (✓)

**File**: `serverless/mods-api/router/admin-routes.ts`

**Removed**:
- `GET /admin/customers` - List customers (moved to customer-api)
- `GET /admin/customers/:customerId` - Get customer details (moved to customer-api)
- `PUT /admin/customers/:customerId` - Update customer (moved to customer-api)

**Kept**:
- `GET /admin/customers/:customerId/mods` - Get customer's mods (MOD data, not customer data - belongs in mods-api)

### 3. Removed Proxy Handlers from Mods API (✓)

**Deleted**: `serverless/mods-api/handlers/admin/customers.ts`

This file contained proxy handlers that called customer-api. All customer management logic now lives in customer-api where it belongs.

**Created**: `serverless/mods-api/handlers/admin/customer-mods.ts`

Extracted just the mod-related customer query (getting mods by author/customer ID) since this is mod data, not customer data.

### 4. Enhanced Customer API Admin Endpoints (✓)

**File**: `serverless/customer-api/handlers/admin.ts`

**Added**:
- `handleGetCustomerDetails()` - Get customer details with validation
- `handleUpdateCustomer()` - Update customer with validation

**File**: `serverless/customer-api/router/customer-routes.ts`

**Added Routes**:
- `GET /admin/customers/:customerId` - Get customer details
- `PUT /admin/customers/:customerId` - Update customer

All admin routes require `SUPER_ADMIN_API_KEY` authentication for service-to-service security.

### 5. Updated Frontend to Call Customer API Directly (✓)

**File**: `mods-hub/src/services/api.ts`

**Added**:
- `CUSTOMER_API_BASE_URL` constant (uses `/customer-api` proxy in dev, production URL in prod)
- `createCustomerClient()` - Dedicated API client for customer management
- `customerApi` singleton instance

**Updated Functions** (now use `customerApi` instead of `api`):
- `listCustomers()` - Now calls customer-api directly
- `getCustomerDetails()` - Now calls customer-api directly
- `updateCustomer()` - Now calls customer-api directly

**Unchanged** (stays with `api` for mods-api):
- `getCustomerMods()` - Still calls mods-api (mod data, not customer data)

### 6. Added Vite Dev Proxy for Customer API (✓)

**File**: `mods-hub/vite.config.ts`

**Added Proxy**:
```typescript
'/customer-api': {
  target: 'http://localhost:8790', // Customer API port
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/customer-api/, ''),
  // ... error handling and logging
}
```

This allows the frontend to call `/customer-api/*` in development, which proxies to the local customer-api worker on port 8790.

## Service Ports Reference

| Service | Dev Port | Production URL |
|---------|----------|----------------|
| Mods Hub (Frontend) | 3001 | mods.idling.app |
| OTP Auth API | 8787 | auth.idling.app |
| Mods API | 8788 | mods-api.idling.app |
| Customer API | 8790 | customer-api.idling.app |
| Access API | 8791 | access-api.idling.app |

## Authentication Flow

### Frontend → Customer API (Admin Operations)

1. User authenticates via OTP Auth API
2. Receives JWT token (stored in localStorage)
3. Frontend calls customer-api with JWT in `Authorization: Bearer <token>` header
4. Customer-api verifies JWT and executes operation
5. Response is encrypted with JWT (E2E encryption)

### Service → Customer API (Service-to-Service)

1. Service imports `createCustomerClient` from `serverless/shared/customer-client.ts`
2. Client automatically uses `SUPER_ADMIN_API_KEY` from env for authentication
3. Requests include integrity headers (`X-Strixun-Request-Integrity`)
4. Customer-api verifies super-admin key and integrity
5. Response includes integrity headers for verification

## Security Model

### Customer API Endpoints

| Endpoint | Auth Required | Who Can Access |
|----------|---------------|----------------|
| `GET /customer/me` | JWT | Authenticated customer (self) |
| `PUT /customer/me` | JWT | Authenticated customer (self) |
| `GET /customer/:customerId` | Service Key | Services only (internal) |
| `PUT /customer/:customerId` | Service Key | Services only (internal) |
| `GET /admin/customers` | Super Admin Key | Super admins only |
| `GET /admin/customers/:customerId` | Super Admin Key | Super admins only |
| `PUT /admin/customers/:customerId` | Super Admin Key | Super admins only |

## Dead Code Removed

- ✓ `serverless/mods-api/handlers/admin/customers.ts` (entire file)
- ✓ Proxy routes in `serverless/mods-api/router/admin-routes.ts`
- ✓ Service-to-service customer-api calls from mods-api handlers

## Verification Checklist

- [x] Mods-api no longer has customer management routes
- [x] Mods-api no longer has customer management handlers
- [x] Customer-api has proper admin endpoints
- [x] Customer-client.ts created and follows access-client pattern
- [x] Frontend uses customerApi client for customer operations
- [x] Frontend uses api client for mod operations
- [x] Vite proxy configured for customer-api in dev mode
- [x] No linting errors
- [x] Dead code removed

## Testing

### Manual Testing

1. **Start all services**:
   ```bash
   # Terminal 1: OTP Auth API
   cd serverless/otp-auth-service && pnpm dev
   
   # Terminal 2: Customer API
   cd serverless/customer-api && pnpm dev
   
   # Terminal 3: Mods API
   cd serverless/mods-api && pnpm dev
   
   # Terminal 4: Frontend
   cd mods-hub && pnpm dev
   ```

2. **Test customer management**:
   - Login as super-admin
   - Navigate to customer management page
   - Verify customers list loads (should call `/customer-api/admin/customers`)
   - Click on a customer (should call `/customer-api/admin/customers/:id`)
   - Update customer permissions (should call `/customer-api/admin/customers/:id` with PUT)
   - View customer's mods (should call `/mods-api/admin/customers/:id/mods`)

3. **Verify network calls** (Chrome DevTools Network tab):
   - Customer list: `GET /customer-api/admin/customers` → 200
   - Customer details: `GET /customer-api/admin/customers/:id` → 200
   - Update customer: `PUT /customer-api/admin/customers/:id` → 200
   - Customer mods: `GET /mods-api/admin/customers/:id/mods` → 200

### E2E Tests

Customer management E2E tests should be updated to verify the correct API endpoints are called:

```typescript
// tests/customer-management.e2e.spec.ts
test('should fetch customers from customer-api', async ({ page }) => {
  // Intercept network request
  await page.route('**/customer-api/admin/customers*', route => {
    // Verify request goes to customer-api, not mods-api
    expect(route.request().url()).toContain('/customer-api/');
    route.continue();
  });
  
  await page.goto('/admin/customers');
  // ... rest of test
});
```

## Migration Notes

### Production Deployment

1. Deploy customer-api first (ensures new admin endpoints are available)
2. Deploy mods-api second (removes proxy routes)
3. Deploy frontend last (uses new customer-api endpoints)

### Rollback Plan

If issues occur:
1. Revert frontend deployment (will call old mods-api proxy routes)
2. Revert mods-api deployment (restores proxy routes)
3. Customer-api changes are backwards compatible (no rollback needed)

## Future Improvements

1. **Add E2E tests** for customer management using new architecture
2. **Add integration tests** for customer-client in mods-api
3. **Document service-to-service patterns** in architecture docs
4. **Create service diagram** showing correct service relationships
5. **Audit other services** for similar proxy anti-patterns

## References

- Service Client: `packages/service-client/index.ts`
- Access Client Pattern: `serverless/shared/access-client.ts`
- API Framework: `packages/api-framework/`
- Customer API Worker: `serverless/customer-api/worker.ts`
- Mods API Worker: `serverless/mods-api/worker.ts`
