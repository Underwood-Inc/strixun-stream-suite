# Access Service Usage Guide - NO PROXYING!

## ⚠️ CRITICAL RULE: NO PROXY ROUTES

**The Access Service is an independent microservice with its own endpoints.**
**ALL other services and frontends MUST call it DIRECTLY - NO PROXYING!**

## Correct Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Access Service (access-api.idling.app:8795)                │
│  - Owns: Roles, Permissions, Quotas                         │
│  - Provides: REST API                                        │
│  - Authentication: JWT + Service Keys                        │
└─────────────────────────────────────────────────────────────┘
                           ▲
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
    JWT Auth         Service-to-Service    Service-to-Service
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Frontend   │  │  OTP Auth       │  │  Mods API       │
│   Dashboard  │  │  Service        │  │  Service        │
└──────────────┘  └─────────────────┘  └─────────────────┘
```

## Client Types (TWO DIFFERENT USE CASES)

### 1. Frontend Client (Browser/UI)
**File:** `serverless/otp-auth-service/src/dashboard/lib/access-api-client.ts`

**Purpose:** Frontend dashboard calls Access Service with JWT authentication

**Usage:**
```typescript
import { accessApiClient } from '$dashboard/lib/access-api-client';

// Get all roles (super-admin only)
const roles = await accessApiClient.getAllRoles();

// Get all permissions (super-admin only)
const permissions = await accessApiClient.getAllPermissions();

// Get customer-specific roles
const customerRoles = await accessApiClient.getCustomerRoles(customerId);
```

**Authentication:** JWT token from localStorage (`auth_token`)

**Endpoints:**
- `GET /access/roles` - List all role definitions
- `GET /access/permissions` - List all permission definitions
- `GET /access/:customerId/roles` - Get customer's roles
- `GET /access/:customerId/permissions` - Get customer's permissions

**Environment:**
- **Dev:** Calls through Vite proxy → `localhost:8795`
- **Prod:** Calls directly → `https://access-api.idling.app`

---

### 2. Backend Service Client (Service-to-Service)
**File:** `serverless/shared/access-client.ts`

**Purpose:** Backend services call Access Service with SERVICE_API_KEY

**Usage:**
```typescript
import { createAccessClient } from '../../shared/access-client.js';

const accessClient = createAccessClient(env);

// Check permission
const allowed = await accessClient.checkPermission(customerId, 'upload:mod');

// Check quota
const quota = await accessClient.checkQuota(customerId, 'upload:mod', 'mod');

// Get full authorization
const auth = await accessClient.getCustomerAuthorization(customerId);

// Ensure customer exists
await accessClient.ensureCustomer(customerId, ['customer']);
```

**Authentication:** `X-Service-Key` header with `SERVICE_API_KEY`

**Endpoints:**
- `POST /access/check-permission` - Check if customer has permission
- `POST /access/check-quota` - Check quota availability
- `POST /access/:customerId/quotas/increment` - Increment quota usage
- `GET /access/:customerId` - Get full authorization
- `PUT /access/:customerId/roles` - Assign roles

**Environment:**
- Uses `env.ACCESS_SERVICE_URL` or defaults to `https://access-api.idling.app`

---

## ❌ WRONG: Proxy Routes (REMOVED!)

**What We HAD (WRONG):**
```typescript
// ❌ serverless/otp-auth-service/router/dashboard/roles-admin-routes.ts
// THIS FILE HAS BEEN DELETED!

async function handleGetAllRoles(request: Request, env: Env) {
    // WRONG: Proxying Access Service through OTP Auth
    const response = await fetch(`${accessUrl}/access/roles`, {
        headers: { 'X-Service-Key': env.SERVICE_API_KEY }
    });
    return response;
}
```

**Problems:**
1. ❌ Extra latency (Frontend → OTP Auth → Access Service)
2. ❌ Unnecessary coupling between services
3. ❌ Duplicate code (proxy handlers)
4. ❌ Violates microservices architecture
5. ❌ More points of failure

---

## ✓ CORRECT: Direct Calls

**Frontend:**
```typescript
// ✓ Direct call from browser to Access Service
import { accessApiClient } from '$dashboard/lib/access-api-client';
const roles = await accessApiClient.getAllRoles();
```

**Backend:**
```typescript
// ✓ Direct service-to-service call
import { createAccessClient } from '../../shared/access-client.js';
const access = createAccessClient(env);
const allowed = await access.checkPermission(customerId, 'upload:mod');
```

---

## Service Responsibilities

### Access Service
**Owns:**
- Role definitions
- Permission definitions
- Customer authorizations (roles, permissions, quotas)
- Authorization decisions

**Provides:**
- REST API for authorization operations
- JWT authentication for frontend
- Service-to-service authentication

**Does NOT:**
- Proxy other services
- Store customer profile data
- Handle OTP authentication

---

### OTP Auth Service
**Owns:**
- OTP authentication
- JWT token issuance
- Customer management
- Admin dashboard UI (frontend only)

**Provides:**
- OTP login endpoints
- Dashboard UI
- Customer CRUD operations

**Does NOT:**
- Proxy Access Service endpoints
- Duplicate Access Service functionality
- Store authorization data

---

### Mods API Service
**Owns:**
- Mod upload/download
- Mod metadata
- File storage

**Provides:**
- Mod CRUD endpoints
- File upload/download

**Does NOT:**
- Proxy Access Service endpoints
- Make authorization decisions (delegates to Access Service)

---

## Configuration

### Access Service URLs

**Development:**
- Access Service: `http://localhost:8791`
- OTP Auth Service: `http://localhost:8787`
- Dashboard (Vite): `http://localhost:5174`

**Production:**
- Access Service: `https://access-api.idling.app`
- OTP Auth Service: `https://otp.idling.app`

### Vite Proxy Configuration

```typescript
// serverless/otp-auth-service/vite.config.ts
server: {
  proxy: {
    '/access': {
      target: 'http://localhost:8791',  // Access Service - DIRECT!
      changeOrigin: true
    }
  }
}
```

### Environment Variables

**Access Service:**
- `SERVICE_API_KEY` - Service-to-service authentication
- `JWT_SECRET` - JWT token signing
- `SUPER_ADMIN_API_KEY` - Super admin access

**OTP Auth Service:**
- `ACCESS_SERVICE_URL` - Access Service endpoint (for backend calls)
- `SERVICE_API_KEY` - Service-to-service authentication
- `JWT_SECRET` - JWT token signing (must match Access Service)

**Mods API Service:**
- `ACCESS_SERVICE_URL` - Access Service endpoint
- `SERVICE_API_KEY` - Service-to-service authentication

---

## Testing

### Verify Direct Calls (No Proxy)

**Test 1: Frontend Calls**
1. Open browser DevTools → Network tab
2. Navigate to Roles & Permissions page
3. **Expected:** Requests go to `/access/roles` (proxied to localhost:8791)
4. **NOT:** Requests to `/admin/roles/all` (old proxy route)

**Test 2: Backend Service Calls**
1. Check OTP Auth logs
2. Look for Access Service calls
3. **Expected:** Direct fetch to `access-api.idling.app` or `localhost:8795`
4. **NOT:** Internal route handling

### Network Request Examples

**Correct (Frontend):**
```
GET http://localhost:5174/access/roles
→ (Vite proxy) →
GET http://localhost:8791/access/roles
Authorization: Bearer <JWT_TOKEN>
```

**Correct (Backend):**
```
GET http://localhost:8791/access/cust_123
X-Service-Key: <SERVICE_API_KEY>
```

**Wrong (REMOVED):**
```
❌ GET http://localhost:8787/admin/roles/all
   (This proxy route has been deleted!)
```

---

## Migration Notes

### Files Deleted
- ✓ `serverless/otp-auth-service/router/dashboard/roles-admin-routes.ts` - Proxy file removed

### Files Modified
- ✓ `serverless/otp-auth-service/router/dashboard-routes.ts` - Removed proxy router reference
- ✓ `serverless/otp-auth-service/vite.config.ts` - Added `/access` proxy to localhost:8791

### Files Added
- ✓ `serverless/otp-auth-service/src/dashboard/lib/access-api-client.ts` - Frontend client
- ✓ `serverless/access-service/index.ts` - Type exports

### Files Kept (CORRECT Usage)
- ✓ `serverless/shared/access-client.ts` - Backend service-to-service client
- ✓ `serverless/otp-auth-service/router/dashboard/roles-routes.ts` - Uses access-client correctly

---

## Summary

**The Golden Rule:** 
> Access Service is independent. Call it DIRECTLY. Never proxy it through another service.

**Two Client Types:**
1. **Frontend Client** (`access-api-client.ts`) - Uses JWT
2. **Backend Client** (`shared/access-client.ts`) - Uses SERVICE_API_KEY

**Zero Proxy Routes:**
- No `/admin/roles/all` proxy
- No `/admin/permissions/all` proxy
- Frontend calls Access Service directly
- Backend services call Access Service directly

---

*Last Updated: 2026-01-11*
*Architecture: Microservices with Direct Communication*
