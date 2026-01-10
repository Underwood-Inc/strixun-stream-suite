# Authorization Service Migration - Progress Tracker

**Status:** 🟡 IN PROGRESS  
**Started:** 2026-01-09  
**Phase:** Phase 2B - Mods API Integration  

---

## ✅ COMPLETED

### Phase 1: Authorization Service Foundation
- [x] Authorization Service worker deployed
- [x] GitHub Actions deployment workflow
- [x] Local dev setup (port 8789)
- [x] Default roles & permissions seeded
- [x] Added to `deploy-dev-all.js`

### Phase 2A: SDK & Migration Tools
- [x] `serverless/shared/authz-client.ts` - Authorization Service SDK
- [x] `serverless/shared/authz-migration-helpers.ts` - Migration helpers
- [x] `serverless/otp-auth-service/handlers/auth/jwt-creation.ts` - Auto-provisioning hook
- [x] `serverless/authorization-service/scripts/migrate-existing-customers.ts` - Bulk migration script

### Phase 2B: Core Utilities (IN PROGRESS)
- [x] `serverless/mods-api/utils/admin.ts` - **REWRITTEN** to use authz-client
  - New functions: `isSuperAdmin()`, `isAdmin()`, `hasUploadPermission()`, `canManageMod()`, `canDeleteAnyMod()`, `canReviewMods()`, `hasAdminDashboardAccess()`, `getCustomerPermissionInfo()`
  - Deprecated: `isSuperAdminEmail()`, `isApprovedUploaderEmail()`, `getSuperAdminEmails()`, `getApprovedUploaderEmails()`
- [x] `serverless/mods-api/utils/upload-quota.ts` - **REWRITTEN** to use Authorization Service quotas
  - `checkUploadQuota()` now calls authz-client
  - `trackUpload()` now calls `authz.incrementQuota()`
- [x] `serverless/mods-api/utils/admin-legacy.ts` - Created for reference

### Phase 2B: Upload Handlers
- [x] `serverless/mods-api/handlers/mods/upload.ts` - Updated quota check format
- [x] `serverless/mods-api/handlers/versions/upload.ts` - Replaced `isSuperAdminEmail` with `isSuperAdmin()`
- [x] `serverless/mods-api/handlers/mods/permissions.ts` - Returns full authz data

---

## 🔴 TODO: Remaining Files (15 files)

### High Priority - Handlers with Permission Checks
1. [ ] `serverless/mods-api/handlers/mods/detail.ts`
2. [ ] `serverless/mods-api/handlers/mods/list.ts`
3. [ ] `serverless/mods-api/handlers/mods/review.ts`
4. [ ] `serverless/mods-api/handlers/mods/thumbnail.ts`
5. [ ] `serverless/mods-api/handlers/variants/delete.ts`
6. [ ] `serverless/mods-api/handlers/versions/download.ts`
7. [ ] `serverless/mods-api/handlers/versions/badge.ts`

### Admin Handlers
8. [ ] `serverless/mods-api/handlers/admin/approvals.ts`
9. [ ] `serverless/mods-api/handlers/admin/delete.ts`
10. [ ] `serverless/mods-api/handlers/admin/r2-management.ts`
11. [ ] `serverless/mods-api/handlers/admin/users.ts`
12. [ ] `serverless/mods-api/handlers/admin/triage.ts`

### Test Files
13. [ ] `serverless/mods-api/handlers/mods/permissions.test.ts`
14. [ ] `serverless/mods-api/handlers/mod-review-flow.integration.test.ts`
15. [ ] `serverless/mods-api/handlers/api-framework-integration.integration.test.ts`

---

## 🔄 MIGRATION PATTERN

### OLD Pattern (Email-Based):
```typescript
import { isSuperAdminEmail } from '../../utils/admin.js';

const { getCustomerEmail } = await import('../../utils/customer-email.js');
const email = await getCustomerEmail(auth.customerId, env);
const isSuperAdmin = email ? await isSuperAdminEmail(email, env) : false;
```

### NEW Pattern (Role-Based):
```typescript
import { isSuperAdmin } from '../../utils/admin.js';

const isSuper = await isSuperAdmin(auth.customerId, env);
```

### For Admin Dashboard Access:
```typescript
import { hasAdminDashboardAccess } from '../../utils/admin.js';

const hasAccess = await hasAdminDashboardAccess(auth.customerId, env);
```

### For Mod Review:
```typescript
import { canReviewMods } from '../../utils/admin.js';

const canReview = await canReviewMods(auth.customerId, env);
```

---

## 📊 STATISTICS

- **Total files needing updates:** 41+
- **Files updated:** 11
- **Files remaining:** 15 (handlers) + 15+ (other references)
- **Completion:** ~37%

---

## 🎯 NEXT IMMEDIATE STEPS

1. Update all 15 handler files with `isSuperAdminEmail` references
2. Update OTP Auth Service handlers
3. Run migration script to provision existing customers
4. Test end-to-end
5. Deploy all services

---

**END OF PROGRESS TRACKER**
