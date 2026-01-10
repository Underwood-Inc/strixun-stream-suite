# Authorization & Permissions System Redesign

**Status:** 🟢 Phase 1 Complete  
**Started:** 2026-01-09  
**Last Updated:** 2026-01-09 (Phase 1 Complete)

---

## 📋 **EXECUTIVE SUMMARY**

### **Problem Statement**
Current permission system is tightly coupled, email-based, fragmented across multiple services, and violates separation of concerns:
- 47+ files doing email-based permission checks
- Permissions stored in 5+ locations (env vars, multiple KV namespaces)
- OTP auth service mixed with business logic
- Performance bottleneck (email lookups for every permission check)
- Not scalable for subscriptions, SKUs, feature flags

### **Solution**
Implement **Authorization Service** - a decoupled, service-agnostic worker that handles ONLY authorization decisions:
- ✓ Decoupled from auth, customer, and business services
- ✓ Single source of truth for roles, permissions, quotas
- ✓ Scalable data model (supports any resource type)
- ✓ Cacheable (reduces API calls)
- ✓ Future-ready for subscriptions, feature flags

---

## 🏗️ **SERVICE ARCHITECTURE**

### **Service Boundaries (Properly Separated)**

```
┌─────────────────────────────────────────────────────────────┐
│                    SERVICE ARCHITECTURE                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────────────┐
│  OTP Auth Service   │  │  Customer Service   │  │    Mods Service      │
│  ─────────────────  │  │  ─────────────────  │  │  ──────────────────  │
│  • OTP generation   │  │  • Customer CRUD    │  │  • Mod CRUD          │
│  • OTP validation   │  │  • Profile data     │  │  • Version control   │
│  • JWT creation     │  │  • Display name     │  │  • File storage      │
│  • Session mgmt     │  │  • Preferences      │  │  • Downloads         │
│  • ONLY auth        │  │  • ONLY identity    │  │  • ONLY mods         │
└─────────────────────┘  └─────────────────────┘  └──────────────────────┘
         │                        │                          │
         └────────────────────────┴──────────────────────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │  Business Logic Layer       │
                    │  ────────────────────────   │
                    │  • Authorization Service    │
                    │  • Subscription Service     │
                    │  • Analytics Service        │
                    └─────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              AUTHORIZATION SERVICE (New)                     │
│  ──────────────────────────────────────────────────────     │
│  • Roles & permissions (independent KV)                     │
│  • Access control decisions                                  │
│  • Quota enforcement                                         │
│  • Service-agnostic (used by ALL services)                  │
│  • No knowledge of auth/customer internals                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              SUBSCRIPTION SERVICE (Future)                   │
│  ──────────────────────────────────────────────────────     │
│  • SKUs, tiers, plans                                       │
│  • Subscription lifecycle                                    │
│  • Billing/payments                                          │
│  • Feature flags                                             │
│  • Service-agnostic                                          │
└─────────────────────────────────────────────────────────────┘
```

### **What Each Service Does (and DOESN'T Do)**

#### **OTP Auth Service**
**DOES:**
- OTP generation/validation
- JWT creation/verification
- Session management
- User authentication

**DOES NOT:**
- Store permissions/roles
- Make authorization decisions
- Store customer profiles
- Handle business logic

#### **Customer Service**
**DOES:**
- Store customer identity (customerId, email)
- Store customer profile (display name, preferences)
- Customer CRUD operations

**DOES NOT:**
- Authenticate users
- Make authorization decisions
- Handle subscriptions

#### **Mods Service**
**DOES:**
- Mod CRUD operations
- File storage/retrieval
- Version control
- Download tracking

**DOES NOT:**
- Authenticate users
- Make authorization decisions directly
- Store customer data

#### **Authorization Service (NEW)**
**DOES:**
- Store roles & permissions per customer
- Answer: "Does customer X have permission Y?"
- Enforce quotas
- Provide authorization data to ANY service

**DOES NOT:**
- Authenticate users
- Store customer profiles
- Know about business-specific logic (what mods are, etc.)
- Handle payments

---

## 📊 **DATA MODELS**

### **Authorization Service Data Model**

```typescript
// Stored in: AUTHORIZATION_KV namespace
// Key: `authz_{customerId}`

interface CustomerAuthorization {
  customerId: string; // Only reference, not full customer data
  
  roles: string[]; // Generic roles
  // Examples: 'super-admin', 'admin', 'moderator', 'uploader', 'premium', 'customer', 'banned'
  
  permissions: string[]; // Generic permissions: 'action:resource'
  // Examples:
  // - 'upload:mod'
  // - 'delete:mod-any'
  // - 'edit:mod-any'
  // - 'approve:mod'
  // - 'access:admin-panel'
  // - 'manage:roles'
  // - 'manage:customers'
  // - 'view:analytics'
  // - 'api:unlimited'
  
  quotas: {
    [resource: string]: {
      limit: number;        // Max allowed
      period: 'day' | 'month' | 'year';
      current: number;      // Current usage
      resetAt: string;      // When counter resets
    };
  };
  // Examples:
  // quotas: {
  //   'upload:mod': { limit: 10, period: 'day', current: 3, resetAt: '2026-01-10T00:00:00Z' },
  //   'storage:bytes': { limit: 1073741824, period: 'month', current: 524288000, resetAt: '2026-02-01T00:00:00Z' }
  // }
  
  metadata: {
    createdAt: string;
    updatedAt: string;
    updatedBy?: string;   // Admin customerId who made changes
    reason?: string;      // Why permissions were changed
    source?: string;      // Where authorization came from ('migration', 'subscription', 'manual')
  };
}

// Role definitions (admin-managed)
// Key: `role_{roleName}`
interface RoleDefinition {
  name: string;
  displayName: string;
  description: string;
  permissions: string[];  // Permissions granted by this role
  defaultQuotas?: {
    [resource: string]: { limit: number; period: 'day' | 'month' | 'year' };
  };
  priority: number;       // For role hierarchy (higher = more powerful)
}

// Permission definitions (for UI/documentation)
// Key: `permission_{permissionName}`
interface PermissionDefinition {
  name: string;           // e.g., 'upload:mod'
  action: string;         // e.g., 'upload'
  resource: string;       // e.g., 'mod'
  displayName: string;
  description: string;
  category: string;       // e.g., 'Mod Management', 'Admin', 'Analytics'
}
```

### **Subscription Service Data Model (Future)**

```typescript
// Stored in: SUBSCRIPTIONS_KV namespace
// Key: `subscription_{customerId}`

interface CustomerSubscription {
  customerId: string;
  
  plan: {
    sku: string;          // 'free', 'pro', 'enterprise', 'custom'
    tier: number;         // 1-10
    name: string;         // Human-readable: "Pro Plan"
    price: number;        // Monthly price in cents
  };
  
  status: 'active' | 'trial' | 'cancelled' | 'expired' | 'suspended';
  
  billing: {
    startDate: string;
    endDate?: string;     // null for lifetime/permanent
    nextBillingDate?: string;
    paymentMethod?: string;              // 'stripe', 'paddle', etc.
    externalSubscriptionId?: string;     // Stripe subscription ID, etc.
  };
  
  features: {
    [featureKey: string]: boolean | number | string;
  };
  // Examples:
  // features: {
  //   'storage_gb': 50,
  //   'advanced_analytics': true,
  //   'custom_domain': true,
  //   'priority_support': true
  // }
  
  metadata: {
    createdAt: string;
    updatedAt: string;
    cancelledAt?: string;
    cancelReason?: string;
  };
}

// Subscription Plans (admin-managed)
// Key: `plan_{sku}`
interface SubscriptionPlan {
  sku: string;
  name: string;
  description: string;
  price: number;          // Monthly in cents
  features: { [key: string]: boolean | number | string };
  quotas: { [resource: string]: { limit: number; period: string } };
  // When a customer subscribes to this plan, quotas are synced to authz service
}
```

---

## 🔌 **API INTERFACES**

### **Authorization Service API**

#### **Authorization Queries (Read-Only, Any Service)**

```typescript
// Get full authorization data for a customer
GET /authz/:customerId
Response: CustomerAuthorization

// Get just permissions
GET /authz/:customerId/permissions
Response: { permissions: string[] }

// Get just roles
GET /authz/:customerId/roles
Response: { roles: string[] }

// Get just quotas
GET /authz/:customerId/quotas
Response: { quotas: { [resource: string]: QuotaInfo } }

// Check if customer has specific permission
POST /authz/check-permission
Body: {
  customerId: string;
  permission: string;       // e.g., 'upload:mod'
  resource?: string;        // Optional: specific resource ID for ownership checks
}
Response: {
  allowed: boolean;
  reason?: string;          // Why denied (for logging/debugging)
}

// Check quota availability
POST /authz/check-quota
Body: {
  customerId: string;
  resource: string;         // e.g., 'upload:mod'
  amount?: number;          // Default: 1
}
Response: {
  allowed: boolean;
  quota: {
    limit: number;
    current: number;
    remaining: number;
    resetAt: string;
  };
}

// Batch permission check (for multiple customers or permissions)
POST /authz/batch/check-permission
Body: {
  checks: Array<{
    customerId: string;
    permission: string;
    resource?: string;
  }>;
}
Response: {
  results: Array<{
    customerId: string;
    permission: string;
    allowed: boolean;
  }>;
}
```

#### **Authorization Management (Admin-Only)**

```typescript
// Assign/remove roles
PUT /authz/:customerId/roles
Body: {
  roles: string[];          // Replace all roles
  reason?: string;          // Audit trail
}

// Add single role
POST /authz/:customerId/roles/:roleName
Body: { reason?: string; }

// Remove single role
DELETE /authz/:customerId/roles/:roleName
Body: { reason?: string; }

// Grant/revoke permissions
PUT /authz/:customerId/permissions
Body: {
  permissions: string[];    // Replace all permissions
  reason?: string;
}

// Grant single permission
POST /authz/:customerId/permissions/:permission
Body: { reason?: string; }

// Revoke single permission
DELETE /authz/:customerId/permissions/:permission
Body: { reason?: string; }

// Update quotas
PUT /authz/:customerId/quotas
Body: {
  quotas: {
    [resource: string]: {
      limit: number;
      period: 'day' | 'month' | 'year';
    };
  };
  reason?: string;
}

// Update single quota
PUT /authz/:customerId/quotas/:resource
Body: {
  limit: number;
  period: 'day' | 'month' | 'year';
  reason?: string;
}

// Reset quota counters
POST /authz/:customerId/quotas/reset
Body: {
  resources?: string[];     // Specific resources to reset, or all if empty
  reason?: string;
}

// Increment quota usage (called by services after consuming resource)
POST /authz/:customerId/quotas/increment
Body: {
  resource: string;
  amount?: number;          // Default: 1
}

// Batch operations
POST /authz/batch/assign-role
Body: {
  customerIds: string[];
  role: string;
  reason?: string;
}

POST /authz/batch/grant-permission
Body: {
  customerIds: string[];
  permission: string;
  reason?: string;
}

POST /authz/batch/set-quotas
Body: {
  customerIds: string[];
  quotas: { [resource: string]: { limit: number; period: string } };
  reason?: string;
}
```

#### **Role & Permission Management (Admin-Only)**

```typescript
// Get all role definitions
GET /authz/roles
Response: { roles: RoleDefinition[] }

// Get specific role definition
GET /authz/roles/:roleName
Response: RoleDefinition

// Create/update role definition
PUT /authz/roles/:roleName
Body: {
  displayName: string;
  description: string;
  permissions: string[];
  defaultQuotas?: { [resource: string]: { limit: number; period: string } };
  priority: number;
}

// Delete role definition
DELETE /authz/roles/:roleName

// Get all permission definitions
GET /authz/permissions
Response: { permissions: PermissionDefinition[] }

// Get specific permission definition
GET /authz/permissions/:permissionName
Response: PermissionDefinition

// Create/update permission definition
PUT /authz/permissions/:permissionName
Body: {
  action: string;
  resource: string;
  displayName: string;
  description: string;
  category: string;
}
```

#### **Audit Log**

```typescript
// Get authorization change history for a customer
GET /authz/:customerId/audit-log
Query: {
  page?: number;
  pageSize?: number;
  action?: string;          // Filter by action type
}
Response: {
  logs: Array<{
    timestamp: string;
    action: string;         // 'role_added', 'role_removed', 'permission_granted', etc.
    details: any;
    performedBy: string;    // Admin customerId
    reason?: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}
```

### **Subscription Service API (Future)**

```typescript
// Get customer subscription
GET /subscriptions/:customerId

// Get subscription features
GET /subscriptions/:customerId/features

// Create/update subscription
PUT /subscriptions/:customerId
Body: {
  sku: string;
  tier: number;
  status: 'active' | 'trial' | 'cancelled' | 'expired';
}

// Cancel subscription
POST /subscriptions/:customerId/cancel
Body: { reason?: string; }

// Upgrade/downgrade
POST /subscriptions/:customerId/upgrade
POST /subscriptions/:customerId/downgrade
Body: { sku: string; }

// Get all plans
GET /plans

// Get specific plan
GET /plans/:sku

// Create/update plan
PUT /plans/:sku
Body: SubscriptionPlan

// Webhooks (from payment providers)
POST /webhooks/stripe
POST /webhooks/paddle
```

---

## 🔗 **SERVICE INTERACTION PATTERNS**

### **Example 1: User Uploads a Mod**

```
1. Frontend sends upload request to Mods Service
   POST /mods (with JWT token)

2. Mods Service:
   ├─> Verify JWT: Call OTP Auth Service
   │   GET /auth/verify (or local JWT verification)
   │   └─> Returns: { customerId: 'cust_123' }
   │
   ├─> Check permission: Call Authorization Service
   │   POST /authz/check-permission
   │   { customerId: 'cust_123', permission: 'upload:mod' }
   │   └─> Returns: { allowed: true }
   │
   ├─> Check quota: Call Authorization Service
   │   POST /authz/check-quota
   │   { customerId: 'cust_123', resource: 'upload:mod', amount: 1 }
   │   └─> Returns: { allowed: true, remaining: 7 }
   │
   ├─> Process upload (mods service business logic)
   │
   └─> Increment quota: Call Authorization Service
       POST /authz/cust_123/quotas/increment
       { resource: 'upload:mod', amount: 1 }
```

### **Example 2: Admin Assigns "Uploader" Role**

```
1. Admin UI sends request
   PUT /admin/customers/:customerId/roles
   { roles: ['uploader'] }

2. Mods Service (or Admin Gateway):
   ├─> Verify admin JWT: Call OTP Auth Service
   │   └─> Returns: { customerId: 'admin_456' }
   │
   ├─> Check admin permission: Call Authorization Service
   │   POST /authz/check-permission
   │   { customerId: 'admin_456', permission: 'manage:roles' }
   │   └─> Returns: { allowed: true }
   │
   └─> Assign role: Call Authorization Service
       PUT /authz/cust_123/roles
       { roles: ['uploader'], reason: 'Admin approval' }
       └─> Authorization service automatically applies role's default quotas
```

### **Example 3: Customer Subscribes to Pro Plan (Future)**

```
1. Frontend: Customer clicks "Upgrade to Pro"
   POST /subscriptions/cust_123/upgrade
   { sku: 'pro' }

2. Subscription Service:
   ├─> Verify JWT
   ├─> Create subscription record
   ├─> Initiate payment (Stripe/Paddle)
   ├─> Publish event: 'subscription.created'
   │
   └─> Event handler: Sync quotas to Authorization Service
       GET /plans/pro
       └─> Returns: { quotas: { 'upload:mod': { limit: 50, period: 'day' } } }
       
       PUT /authz/cust_123/quotas
       { quotas: { 'upload:mod': { limit: 50, period: 'day' } } }
```

---

## 📝 **IMPLEMENTATION PLAN**

### **Phase 1: Authorization Service Foundation** ✅ COMPLETE

- [x] **1.1 Create Authorization Service Worker**
  - [x] Initialize Cloudflare Worker: `serverless/authorization-service/`
  - [x] Setup `wrangler.toml` with AUTHORIZATION_KV namespace
  - [x] Create KV namespace in Cloudflare dashboard (TODO: manually create)
  - [x] Setup worker.ts with basic routing

- [x] **1.2 Implement Core Data Layer**
  - [x] Create types: `types/authorization.ts`
  - [x] Create utils: `utils/authz-kv.ts` (KV access helpers)
  - [x] Quota management built into handlers
  - [x] Role resolver built into check-permission handler

- [x] **1.3 Implement Read-Only Endpoints**
  - [x] GET `/authz/:customerId`
  - [x] GET `/authz/:customerId/permissions`
  - [x] GET `/authz/:customerId/roles`
  - [x] GET `/authz/:customerId/quotas`
  - [x] POST `/authz/check-permission`
  - [x] POST `/authz/check-quota`
  - [x] Add CORS headers
  - [x] Add error handling

- [x] **1.4 Implement Management Endpoints (Admin-Only)**
  - [x] PUT `/authz/:customerId/roles`
  - [x] PUT `/authz/:customerId/permissions`
  - [x] PUT `/authz/:customerId/quotas`
  - [x] POST `/authz/:customerId/quotas/reset`
  - [x] POST `/authz/:customerId/quotas/increment`
  - [ ] Add super-admin verification (TODO: Phase 3)

- [x] **1.5 Implement Role & Permission Definitions**
  - [x] GET `/authz/roles`
  - [x] GET `/authz/roles/:roleName`
  - [x] PUT `/authz/roles/:roleName`
  - [x] GET `/authz/permissions`
  - [x] Seed default roles (super-admin, admin, moderator, uploader, premium, customer, banned)
  - [x] Seed default permissions (10 core permissions)

- [ ] **1.6 Implement Batch Operations** (DEFERRED to Phase 3)
  - [ ] POST `/authz/batch/assign-role`
  - [ ] POST `/authz/batch/grant-permission`
  - [ ] POST `/authz/batch/set-quotas`

- [x] **1.7 Implement Audit Logging**
  - [x] Create audit log KV keys: `audit_{customerId}_{timestamp}`
  - [x] Log all authorization changes
  - [x] GET `/authz/:customerId/audit-log`

- [x] **1.8 Migration Script**
  - [x] Create migration script: `scripts/migrate-permissions.ts`
  - [x] Migrate KV upload approvals
  - [x] Document email-to-customerId mapping requirement

- [x] **1.9 Documentation**
  - [x] Create README.md with API reference
  - [x] Create package.json
  - [x] Update master document

### **Phase 2: Migration from Existing System** 🔴 Not Started

- [ ] **2.1 Audit Current Permission System**
  - [ ] List all env vars: SUPER_ADMIN_EMAILS, APPROVED_UPLOADER_EMAILS, ADMIN_EMAILS
  - [ ] List all KV keys: `upload_approval_*`, `approved_uploaders`
  - [ ] Map existing permissions to new permission strings

- [ ] **2.2 Create Migration Script**
  - [ ] Script: `serverless/authorization-service/scripts/migrate-permissions.ts`
  - [ ] Migrate env var super admins → role: 'super-admin'
  - [ ] Migrate env var approved uploaders → role: 'uploader'
  - [ ] Migrate KV upload approvals → role: 'uploader'
  - [ ] Set default quotas for each role

- [ ] **2.3 Run Migration (Dry Run)**
  - [ ] Test migration script with dry-run flag
  - [ ] Verify data integrity
  - [ ] Document any issues

- [ ] **2.4 Run Migration (Production)**
  - [ ] Backup existing KV data
  - [ ] Run migration script
  - [ ] Verify all customers have correct roles/permissions
  - [ ] Keep old KV data for 30 days (backup)

### **Phase 3: Update Mods Service** 🔴 Not Started

- [ ] **3.1 Create Authorization Client**
  - [ ] Create: `packages/api-framework/authz-client.ts`
  - [ ] Implement `checkPermission(customerId, permission)`
  - [ ] Implement `checkQuota(customerId, resource)`
  - [ ] Add caching (in-memory per request)
  - [ ] Add retry logic

- [ ] **3.2 Update Mods API Handlers**
  - [ ] Replace `hasUploadPermission()` → `authz.checkPermission('upload:mod')`
  - [ ] Replace `isSuperAdminEmail()` → `authz.checkPermission('access:admin-panel')`
  - [ ] Replace `checkUploadQuota()` → `authz.checkQuota('upload:mod')`
  - [ ] Update: `handlers/mods/upload.ts`
  - [ ] Update: `handlers/versions/upload.ts`
  - [ ] Update: `handlers/mods/update.ts`
  - [ ] Update: `handlers/mods/delete.ts`
  - [ ] Update: `handlers/variants/delete.ts`
  - [ ] Update: all admin handlers

- [ ] **3.3 Update Route Protection**
  - [ ] Update: `packages/api-framework/route-protection.ts`
  - [ ] Replace email lookups with authz checks
  - [ ] Update `protectAdminRoute()` to use authz

- [ ] **3.4 Remove Old Permission Code**
  - [ ] Delete: `serverless/mods-api/utils/admin.ts` (old permission functions)
  - [ ] Delete: `serverless/mods-api/utils/upload-quota.ts` (move to authz)
  - [ ] Remove: Email lookup functions
  - [ ] Remove: `SUPER_ADMIN_EMAILS` env var references
  - [ ] Remove: `APPROVED_UPLOADER_EMAILS` env var references

### **Phase 4: Admin UI for Role Management** 🔴 Not Started

- [ ] **4.1 Create Authorization API Client (Frontend)**
  - [ ] Create: `mods-hub/src/services/authz-api.ts`
  - [ ] Implement: `getCustomerAuthz(customerId)`
  - [ ] Implement: `assignRole(customerId, role)`
  - [ ] Implement: `setQuotas(customerId, quotas)`
  - [ ] Add React Query hooks: `mods-hub/src/hooks/useAuthz.ts`

- [ ] **4.2 Create Customer Detail Modal**
  - [ ] Component: `mods-hub/src/components/admin/CustomerDetailModal.tsx`
  - [ ] Section: Role management (multi-select with badges)
  - [ ] Section: Permission list (checklist, readonly from roles)
  - [ ] Section: Quota management (editable limits, usage progress bars)
  - [ ] Section: Audit log (timeline of changes)
  - [ ] Section: Customer stats (mods, downloads, account age)
  - [ ] Actions: Save roles, reset quotas, view mods

- [ ] **4.3 Update Customer Management Page**
  - [ ] Update: `mods-hub/src/pages/UserManagementPage.tsx`
  - [ ] Replace "Upload Permission" column with "Roles" column
  - [ ] Show role badges (stacked, tooltip for full list)
  - [ ] Wire up "View Details" button to open CustomerDetailModal
  - [ ] Add bulk role assignment actions

- [ ] **4.4 Create Role Management Page**
  - [ ] Page: `mods-hub/src/pages/RoleManagementPage.tsx`
  - [ ] List all role definitions
  - [ ] Edit role: name, permissions, default quotas, priority
  - [ ] Create custom roles
  - [ ] Delete roles (with safety checks)
  - [ ] Preview: customers with this role

- [ ] **4.5 Create Permission Definitions Page**
  - [ ] Page: `mods-hub/src/pages/PermissionDefinitionsPage.tsx`
  - [ ] List all permission definitions
  - [ ] Group by category
  - [ ] Edit permission descriptions
  - [ ] Add new custom permissions

### **Phase 5: Testing & Deployment** 🔴 Not Started

- [ ] **5.1 Write Tests**
  - [ ] Unit tests: authz service utils
  - [ ] Integration tests: authz API endpoints
  - [ ] E2E tests: permission checks in mods flow
  - [ ] E2E tests: admin role assignment
  - [ ] Load tests: authz service performance

- [ ] **5.2 Deploy Authorization Service**
  - [ ] Deploy to Cloudflare Workers (production)
  - [ ] Set up custom domain (e.g., authz.idling.app)
  - [ ] Configure secrets (SUPER_ADMIN_API_KEY, etc.)
  - [ ] Verify health check

- [ ] **5.3 Deploy Updated Mods Service**
  - [ ] Update environment variables
  - [ ] Deploy to production
  - [ ] Monitor for errors
  - [ ] Verify permission checks work

- [ ] **5.4 Deploy Admin UI**
  - [ ] Deploy frontend updates
  - [ ] Verify admin can manage roles
  - [ ] Verify customer detail modal works

- [ ] **5.5 Monitoring & Cleanup**
  - [ ] Set up alerts for authz service errors
  - [ ] Monitor permission check latency
  - [ ] Remove old env vars (SUPER_ADMIN_EMAILS, etc.) after 30 days
  - [ ] Delete old KV keys after 30 days
  - [ ] Update documentation

### **Phase 6: Subscription Service (Future)** ⚪ Planned

- [ ] **6.1 Create Subscription Service**
  - [ ] Initialize worker: `serverless/subscription-service/`
  - [ ] Create SUBSCRIPTIONS_KV namespace
  - [ ] Implement subscription CRUD
  - [ ] Implement plan management

- [ ] **6.2 Payment Integration**
  - [ ] Integrate Stripe
  - [ ] Implement webhooks
  - [ ] Handle subscription lifecycle events

- [ ] **6.3 Sync with Authorization Service**
  - [ ] When subscription created → update authz quotas
  - [ ] When subscription upgraded → update authz quotas
  - [ ] When subscription cancelled → revert to free quotas

- [ ] **6.4 Subscription UI**
  - [ ] Customer subscription page
  - [ ] Admin subscription management
  - [ ] Plan management UI

---

## 🐛 **ISSUES & FINDINGS**

### **Issue #1: Email-Based Permission Checks (RESOLVED)**
**Date:** 2026-01-09  
**Status:** ✓ Resolved  
**Problem:** `serverless/mods-api/handlers/versions/upload.ts` line 110 used undefined `email` variable for super admin check.  
**Solution:** Added `getCustomerEmail()` call to fetch email for permission check. This will be replaced in Phase 3 with authz service call.  

### **Issue #2: Tight Coupling to OTP Auth (RESOLVED)**
**Date:** 2026-01-09  
**Status:** ✓ Resolved via Architecture Redesign  
**Problem:** Initial proposal mixed business logic (permissions, subscriptions) into OTP auth service.  
**Solution:** Created separate Authorization Service and Subscription Service with proper service boundaries.  

---

## 🔄 **PROGRESS TRACKING**

### **Current Sprint**
**Focus:** Phase 1 - Authorization Service Foundation  
**Started:** 2026-01-09  
**Completed:** 2026-01-09  

**Completed:**
- ✓ Architecture design document created
- ✓ Authorization service worker skeleton
- ✓ Complete type definitions (roles, permissions, quotas)
- ✓ KV access layer (utils/authz-kv.ts)
- ✓ Router with all route definitions
- ✓ All read-only endpoints (GET)
- ✓ All management endpoints (PUT/POST)
- ✓ Permission/quota check logic
- ✓ Role & permission definition management
- ✓ Audit logging system
- ✓ Seed defaults system
- ✓ Migration script
- ✓ Complete README documentation

**Blocked:**
- None

**Manual Steps Required:**
1. Create AUTHORIZATION_KV namespace: `wrangler kv namespace create AUTHORIZATION_KV`
2. Update wrangler.toml with namespace IDs (production + preview)
3. Deploy authorization service to Cloudflare Workers
4. Set secrets (JWT_SECRET, SUPER_ADMIN_API_KEY, ALLOWED_ORIGINS)
5. Call POST /authz/seed to seed default roles/permissions
6. Run migration script to migrate existing permissions

### **Next Steps (Phase 2)**
1. Create KV namespace manually
2. Deploy authorization service
3. Run seed endpoint
4. Test all endpoints
5. Begin Phase 2: Migration from existing system

---

## 📚 **REFERENCES**

### **Related Files**
- Current permission system: `serverless/mods-api/utils/admin.ts`
- Current upload quota: `serverless/mods-api/utils/upload-quota.ts`
- Route protection: `packages/api-framework/route-protection.ts`
- Customer management UI: `mods-hub/src/pages/UserManagementPage.tsx`

### **Documentation**
- Upload Permissions System: `serverless/mods-api/docs/UPLOAD_PERMISSIONS_SYSTEM.md`
- Storage Architecture: `serverless/otp-auth-service/STORAGE_ARCHITECTURE.md`

### **External Resources**
- Cloudflare Workers KV: https://developers.cloudflare.com/kv/
- JWT Best Practices: https://tools.ietf.org/html/rfc8725

---

## 📞 **CONTACT & OWNERSHIP**

**Owner:** Development Team  
**Last Updated By:** AI Assistant  
**Review Status:** Pending User Approval  

---

**END OF DOCUMENT**
