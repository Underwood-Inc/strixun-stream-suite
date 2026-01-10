# Authorization Service - Migration Audit & Action Plan

**Status:** 🔴 Phase 2 - Integration Required  
**Date:** 2026-01-09  
**Authorization Service:** ✓ Deployed & Seeded  

---

## 📊 **AUDIT SUMMARY**

### Phase 1: Authorization Service ✓ COMPLETE
- [x] Authorization Service worker created
- [x] GitHub Actions deployment workflow
- [x] Local dev setup (port 8789)
- [x] Deployed to production
- [x] Default roles & permissions seeded
- [x] Added to `deploy-dev-all.js`

### Phase 2: Integration - 🔴 **IN PROGRESS**
Current state: Authorization Service is deployed but **NOT integrated** into existing services.

---

## 🔍 **CURRENT PERMISSION SYSTEM (TO BE REPLACED)**

### Files Using Old Permission Logic
**Total Files:** 41+ using `isSuperAdmin`/`ALLOWED_EMAILS`, 59+ using `superadmin` variations

### Mods API - Permission Logic to Migrate

#### 1. **`serverless/mods-api/utils/admin.ts`** - 🔴 PRIMARY TARGET
**Current logic:**
- `getSuperAdminEmails()` - Reads `SUPER_ADMIN_EMAILS` env var
- `isSuperAdminEmail()` - Checks if email is super admin
- `getApprovedUploaderEmails()` - Reads `APPROVED_UPLOADER_EMAILS` env var
- `isApprovedUploaderEmail()` - Checks if email is approved uploader
- `hasUploadPermission()` - Currently returns `true` for ALL authenticated users
- `getCustomerUploadPermissionInfo()` - Returns detailed permission breakdown

**Issues:**
- Email-based checks (requires customer email lookup every time)
- Multiple permission sources (env vars, KV, hardcoded)
- Not scalable

**Migration Target:**
```typescript
// NEW: Authorization Service integration
async function hasPermission(customerId: string, permission: string): Promise<boolean> {
  const response = await fetch(`${AUTHZ_SERVICE_URL}/authz/check-permission`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${JWT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ customerId, permission }),
  });
  const data = await response.json();
  return data.allowed;
}
```

#### 2. **`serverless/mods-api/utils/upload-quota.ts`** - 🔴 QUOTA MIGRATION
**Current logic:**
- `checkUploadQuota()` - Tracks daily upload quotas in KV
- Hardcoded limits: 10 uploads/day for regular users
- Super admins bypass quotas

**Issues:**
- Quota logic embedded in mods-api (should be service-agnostic)
- Hardcoded limits (should be configurable per role/subscription)

**Migration Target:**
```typescript
// NEW: Use Authorization Service quotas
async function checkUploadQuota(customerId: string): Promise<{ allowed: boolean, remaining: number }> {
  const response = await fetch(`${AUTHZ_SERVICE_URL}/authz/check-quota`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${JWT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customerId,
      action: 'upload:mod',
      resource: 'mod',
    }),
  });
  return await response.json();
}
```

#### 3. **Handlers Using Permission Checks** - 🔴 41+ FILES
**Files to update:**
- `handlers/mods/upload.ts` - Upload permission check + quota check
- `handlers/mods/update.ts` - Ownership check
- `handlers/mods/delete.ts` - Ownership check + super admin override
- `handlers/versions/upload.ts` - Version upload permission + quota
- `handlers/versions/download.ts` - Super admin analytics bypass
- `handlers/variants/delete.ts` - Ownership check
- `handlers/mods/permissions.ts` - Permission status endpoint
- `handlers/mods/detail.ts` - Super admin visibility override
- `handlers/mods/list.ts` - Super admin unpublished visibility
- `handlers/mods/review.ts` - Moderator permission
- `handlers/mods/thumbnail.ts` - Ownership check
- **All `handlers/admin/*` files** - Admin permission checks

**Common Pattern:**
```typescript
// OLD:
const { getCustomerEmail } = await import('../../utils/customer-email.js');
const email = await getCustomerEmail(auth.customerId, env);
const isSuperAdmin = email ? await isSuperAdminEmail(email, env) : false;

// NEW:
const isSuperAdmin = await checkPermission(auth.customerId, 'admin:dashboard', env);
```

---

## 🗺️ **MIGRATION ACTION PLAN**

### **PHASE 2A: Authorization Service Integration (HIGH PRIORITY)**

#### Step 1: Create Authorization Service SDK
**File:** `serverless/shared/authz-client.ts`

```typescript
export interface AuthzClient {
  checkPermission(customerId: string, permission: string): Promise<boolean>;
  checkQuota(customerId: string, action: string, resource: string): Promise<{ allowed: boolean, remaining: number, resetAt: string }>;
  incrementQuota(customerId: string, action: string, resource: string): Promise<void>;
  getCustomerAuthorization(customerId: string): Promise<CustomerAuthorization>;
}

export function createAuthzClient(env: Env): AuthzClient {
  const AUTHZ_URL = env.AUTHORIZATION_SERVICE_URL || 'https://strixun-authorization-service.strixuns-script-suite.workers.dev';
  
  return {
    async checkPermission(customerId: string, permission: string): Promise<boolean> {
      const response = await fetch(`${AUTHZ_URL}/authz/check-permission`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Key': env.SERVICE_API_KEY || '',
        },
        body: JSON.stringify({ customerId, permission }),
      });
      const data = await response.json();
      return data.allowed;
    },
    
    async checkQuota(customerId: string, action: string, resource: string) {
      const response = await fetch(`${AUTHZ_URL}/authz/check-quota`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Key': env.SERVICE_API_KEY || '',
        },
        body: JSON.stringify({ customerId, action, resource }),
      });
      return await response.json();
    },
    
    async incrementQuota(customerId: string, action: string, resource: string) {
      await fetch(`${AUTHZ_URL}/authz/${customerId}/quotas/increment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Key': env.SERVICE_API_KEY || '',
        },
        body: JSON.stringify({ action, resource }),
      });
    },
    
    async getCustomerAuthorization(customerId: string) {
      const response = await fetch(`${AUTHZ_URL}/authz/${customerId}`, {
        headers: {
          'X-Service-Key': env.SERVICE_API_KEY || '',
        },
      });
      return await response.json();
    },
  };
}
```

#### Step 2: Update Mods API Environment Variables
**File:** `serverless/mods-api/wrangler.toml`

Add:
```toml
[vars]
AUTHORIZATION_SERVICE_URL = "https://strixun-authorization-service.strixuns-script-suite.workers.dev"

[env.development.vars]
AUTHORIZATION_SERVICE_URL = "http://localhost:8789"
```

#### Step 3: Create Migration Script
**File:** `serverless/authorization-service/scripts/migrate-existing-permissions.ts`

Migrate existing users:
1. Read `SUPER_ADMIN_EMAILS` → assign `super-admin` role
2. Read `APPROVED_UPLOADER_EMAILS` → assign `uploader` role
3. Read all customers from Customer API → assign `customer` role
4. Set default quotas based on roles

#### Step 4: Update Mods API Handlers
**Priority Order:**
1. ✓ Create `authz-client.ts` SDK
2. ✓ Update `utils/admin.ts` to use Authorization Service
3. ✓ Update `utils/upload-quota.ts` to use Authorization Service
4. ✓ Update `handlers/mods/upload.ts`
5. ✓ Update `handlers/versions/upload.ts`
6. ✓ Update `handlers/mods/permissions.ts` → new endpoint `/mods/permissions/me`
7. ✓ Update all admin handlers
8. ✓ Remove old permission logic

---

### **PHASE 2B: OTP Auth Service Integration (MEDIUM PRIORITY)**

#### Files to Update:
- `handlers/auth/session.ts` - Super admin session handling
- `router/dashboard-routes.ts` - Dashboard access checks
- `router/admin-routes.ts` - Admin API access
- `utils/super-admin.ts` - Replace with authz calls

**Pattern:**
```typescript
// OLD:
import { isSuperAdmin } from '../utils/super-admin.js';
const isAdmin = await isSuperAdmin(email, env);

// NEW:
const authz = createAuthzClient(env);
const isAdmin = await authz.checkPermission(customerId, 'admin:dashboard');
```

---

### **PHASE 2C: Customer Service Role Management (LOW PRIORITY)**

Currently: Customer service has NO role management.

**Add endpoints:**
- `GET /customer/:customerId/authorization` - Get customer roles/permissions
- `PUT /customer/:customerId/roles` - Update customer roles (admin only)

**OR:**
- Direct calls to Authorization Service (preferred, avoids duplication)

---

### **PHASE 2D: Frontend Integration (MEDIUM PRIORITY)**

#### Mods Hub
**Files:**
- `mods-hub/src/services/api.ts` - Add `getMyPermissions()` API call
- `mods-hub/src/hooks/useAuth.ts` - Add `permissions` to auth context
- `mods-hub/src/components/mod/UploadButton.tsx` - Check `upload:mod` permission

**Pattern:**
```typescript
// Get permissions from new endpoint
const { data: permissions } = useQuery({
  queryKey: ['permissions', 'me'],
  queryFn: () => api.getMyPermissions(),
});

// Check permission in UI
{permissions?.includes('upload:mod') && <UploadButton />}
```

---

## 📋 **MIGRATION CHECKLIST**

### Phase 2A: Authorization Service Integration
- [ ] Create `serverless/shared/authz-client.ts` SDK
- [ ] Update `serverless/mods-api/wrangler.toml` with `AUTHORIZATION_SERVICE_URL`
- [ ] Create migration script `migrate-existing-permissions.ts`
- [ ] Run migration script to seed existing users
- [ ] Update `serverless/mods-api/utils/admin.ts`
- [ ] Update `serverless/mods-api/utils/upload-quota.ts`
- [ ] Update `serverless/mods-api/handlers/mods/upload.ts`
- [ ] Update `serverless/mods-api/handlers/versions/upload.ts`
- [ ] Update `serverless/mods-api/handlers/mods/permissions.ts`
- [ ] Update all admin handlers (18 files)
- [ ] Update all other handlers with permission checks (23+ files)
- [ ] Add tests for authorization integration
- [ ] Remove old email-based permission logic
- [ ] Remove `ALLOWED_EMAILS`, `SUPER_ADMIN_EMAILS` env var usage
- [ ] Update documentation

### Phase 2B: OTP Auth Service Integration
- [ ] Update `serverless/otp-auth-service/handlers/auth/session.ts`
- [ ] Update `serverless/otp-auth-service/router/dashboard-routes.ts`
- [ ] Update `serverless/otp-auth-service/router/admin-routes.ts`
- [ ] Update `serverless/otp-auth-service/utils/super-admin.ts`
- [ ] Add tests
- [ ] Update documentation

### Phase 2C: Customer Service Role Management
- [ ] Decide on approach (direct authz calls vs. proxy endpoints)
- [ ] Implement chosen approach
- [ ] Add tests
- [ ] Update documentation

### Phase 2D: Frontend Integration
- [ ] Update `mods-hub/src/services/api.ts`
- [ ] Update `mods-hub/src/hooks/useAuth.ts`
- [ ] Update UI components to check permissions
- [ ] Add permission-based UI rendering
- [ ] Add tests
- [ ] Update documentation

### Phase 3: Cleanup
- [ ] Remove deprecated permission utilities
- [ ] Remove hardcoded email lists
- [ ] Archive old permission documentation
- [ ] Update all READMEs
- [ ] Verify all tests pass
- [ ] Deploy to production
- [ ] Monitor for issues

---

## 🚨 **BLOCKERS & DEPENDENCIES**

### Blockers:
1. **SERVICE_API_KEY secret** - Need to set this in all workers for service-to-service auth
2. **Migration script** - Must run before switching to new system
3. **Rollback plan** - Need feature flag or gradual rollout strategy

### Dependencies:
1. Authorization Service must be deployed (✓ DONE)
2. Authorization Service must be seeded (✓ DONE)
3. Existing users must be migrated to Authorization Service
4. All services must have `AUTHORIZATION_SERVICE_URL` env var

---

## 📈 **ESTIMATED EFFORT**

- **Phase 2A (Mods API Integration):** 8-12 hours
  - SDK creation: 2 hours
  - Migration script: 2 hours
  - Handler updates: 6-8 hours
  - Testing: 2 hours

- **Phase 2B (OTP Auth Integration):** 4-6 hours
  - Handler updates: 3-4 hours
  - Testing: 1-2 hours

- **Phase 2C (Customer Service):** 2-4 hours
  - Implementation: 1-2 hours
  - Testing: 1-2 hours

- **Phase 2D (Frontend):** 4-6 hours
  - API updates: 1 hour
  - Hook updates: 1 hour
  - Component updates: 2-3 hours
  - Testing: 1-2 hours

- **Phase 3 (Cleanup):** 2-4 hours

**Total:** 20-32 hours

---

## 🎯 **NEXT IMMEDIATE STEPS**

1. **Create Authorization Service SDK** (`serverless/shared/authz-client.ts`)
2. **Update Mods API environment variables** (add `AUTHORIZATION_SERVICE_URL`)
3. **Create migration script** to seed existing users with roles
4. **Set `SERVICE_API_KEY` secret** in all workers
5. **Update one handler as proof-of-concept** (`handlers/mods/upload.ts`)
6. **Test end-to-end** (upload mod with new authorization)
7. **Roll out to remaining handlers**

---

## 📚 **REFERENCES**

- **Authorization Service Docs:** `serverless/authorization-service/README.md`
- **Architecture Doc:** `__AUTHORIZATION_AND_PERMISSIONS_REDESIGN.md`
- **Quick Start:** `serverless/authorization-service/QUICK_START.md`
- **Worker URL:** `https://strixun-authorization-service.strixuns-script-suite.workers.dev`
- **Local Dev:** `http://localhost:8789`

---

**END OF AUDIT**
