# Testing Migration Audit - What's Actually Still Using Old Approach

> **Comprehensive audit of what still needs to be migrated**

**Date:** 2025-01-04  
**Status:** ❌ **MIGRATION NOT COMPLETE** - Only infrastructure created, no actual migration done

---

## 🚨 Critical Finding

**The migration is NOT complete!** Only the infrastructure was created. All test files, configs, and scripts still use the old approach.

---

## 📋 What's Still Using Old Approach

### 1. Old Setup File - STILL EXISTS AND IN USE

**File:** `serverless/shared/vitest.setup.integration.ts` (662 lines)

**Still referenced in:**
- ✅ `serverless/mods-api/vitest.config.ts` - Line 23: `globalSetup: '../shared/vitest.setup.integration.ts'`
- ✅ `serverless/otp-auth-service/vitest.config.ts` - **WAIT, I updated this but need to verify**

**Status:** ❌ **STILL BEING USED** - Cannot be removed yet

---

### 2. Old Script - STILL EXISTS AND IN USE

**File:** `scripts/start-worker-with-health-check.js` (164 lines)

**Still used by:**
- ✅ `playwright.config.ts` - Lines 143-212 (E2E tests use it for webServer)
- ✅ `serverless/otp-auth-service/scripts/run-integration-tests.js` - Line 145
- ✅ `serverless/shared/vitest.setup.integration.ts` - Lines 248, 513

**Status:** ❌ **STILL BEING USED** - Cannot be removed yet (needed for E2E tests)

---

### 3. All Integration Test Files - NOT MIGRATED

#### OTP Auth Service Tests (All Still Use Old Approach)

1. **`api-key.integration.test.ts`** (1779 lines)
   - ❌ Uses `loadTestConfig()`
   - ❌ Uses `OTP_AUTH_SERVICE_URL` and `CUSTOMER_API_URL`
   - ❌ Has 100+ lines of health check polling in `beforeAll`
   - ❌ Uses `fetch()` to localhost URLs
   - **Status:** NOT MIGRATED

2. **`otp-login-flow.integration.test.ts`**
   - ❌ Uses `loadTestConfig()`
   - ❌ Uses `OTP_AUTH_SERVICE_URL` and `CUSTOMER_API_URL`
   - ❌ Has health check polling in `beforeAll`
   - ❌ Uses `fetch()` to localhost URLs
   - **Status:** NOT MIGRATED

3. **`customer-creation.integration.test.ts`**
   - ❌ Uses `loadTestConfig()`
   - ❌ Uses `CUSTOMER_API_URL`
   - ❌ Has health check polling in `beforeAll`
   - ❌ Uses `fetch()` to localhost URLs
   - **Status:** NOT MIGRATED

4. **`session.integration.test.ts`**
   - ❌ Uses `loadTestConfig()`
   - ❌ Uses `OTP_AUTH_SERVICE_URL` and `CUSTOMER_API_URL`
   - ❌ Has health check polling in `beforeAll`
   - ❌ Uses `fetch()` to localhost URLs
   - **Status:** NOT MIGRATED

5. **`session-by-ip.integration.test.ts`**
   - ❌ Likely uses old approach (need to verify)
   - **Status:** NOT MIGRATED

6. **`restore-session.integration.test.ts`**
   - ❌ Likely uses old approach (need to verify)
   - **Status:** NOT MIGRATED

7. **`auth-comprehensive.integration.test.ts`**
   - ❌ Likely uses old approach (need to verify)
   - **Status:** NOT MIGRATED

#### Mods API Tests (All Still Use Old Approach)

1. **`auth-flow.integration.test.ts`**
   - ❌ References old setup file in error messages
   - ❌ Uses old approach
   - **Status:** NOT MIGRATED

2. **`customer-isolation.integration.test.ts`**
   - ❌ References old setup file in error messages
   - ❌ Uses old approach
   - **Status:** NOT MIGRATED

3. **`session-restore.integration.test.ts`**
   - ❌ References old setup file in error messages
   - ❌ Uses old approach
   - **Status:** NOT MIGRATED

---

### 4. Config Files - MIXED STATUS

#### OTP Auth Service
- ✅ `vitest.config.ts` - **UPDATED** to use `defineWorkersConfig`
- ❌ But still excludes multi-worker tests (they need Miniflare)

#### Mods API
- ❌ `vitest.config.ts` - **STILL USES OLD SETUP**
  - Line 23: `globalSetup: '../shared/vitest.setup.integration.ts'`
  - **Status:** NOT MIGRATED

---

### 5. Helper Utilities - STILL USED BY OLD CODE

**File:** `serverless/otp-auth-service/utils/test-config-loader.ts`
- ❌ Still used by ALL integration tests
- ❌ Provides `loadTestConfig()` which returns localhost URLs
- **Status:** Still needed until tests are migrated

---

### 6. E2E Tests - STILL USE OLD SCRIPT

**File:** `playwright.config.ts`
- ❌ Uses `start-worker-with-health-check.js` for webServer setup
- ❌ Lines 143-212 use the old script
- **Status:** E2E tests are separate - can keep old script for them

---

## 📊 Migration Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| **Infrastructure** | ✅ Complete | Packages installed, helpers created |
| **OTP Auth Service Config** | ✅ Updated | Uses `defineWorkersConfig` |
| **Mods API Config** | ❌ Not Updated | Still uses old setup |
| **Test Files** | ❌ 0% Migrated | All 10+ test files still use old approach |
| **Old Setup File** | ❌ Still In Use | Referenced by mods-api config |
| **Old Script** | ❌ Still In Use | Used by E2E tests and old setup |
| **Helper Utilities** | ❌ Still In Use | Used by all test files |

**Overall Migration:** **~10% Complete** (only infrastructure done)

---

## 🎯 What Actually Needs to Happen

### Phase 1: Migrate Test Files (Priority)

1. **Migrate one test file** as proof of concept
   - Start with simplest single-worker test
   - Verify it works with new approach
   - Measure performance improvement

2. **Migrate remaining test files** incrementally
   - Single-worker tests first (easier)
   - Multi-worker tests second (need Miniflare)

### Phase 2: Update Configs

1. **Update mods-api vitest.config.ts**
   - Remove `globalSetup: '../shared/vitest.setup.integration.ts'`
   - Add `defineWorkersConfig` if mods-api has integration tests

2. **Verify otp-auth-service config**
   - Ensure it's correctly set up
   - Test that it works

### Phase 3: Cleanup (After All Tests Migrated)

1. **Remove old setup file** (only after all tests migrated)
   - `serverless/shared/vitest.setup.integration.ts`

2. **Keep old script for E2E tests** (or migrate E2E separately)
   - `scripts/start-worker-with-health-check.js` - Still needed for Playwright

3. **Remove unused utilities** (if any)
   - `test-config-loader.ts` - May still be needed for some tests

---

## ⚠️ Critical Dependencies

### Cannot Remove Yet

1. **`serverless/shared/vitest.setup.integration.ts`**
   - ❌ Still used by `mods-api/vitest.config.ts`
   - ❌ Still used by integration tests (they expect workers to be running)

2. **`scripts/start-worker-with-health-check.js`**
   - ❌ Still used by `playwright.config.ts` (E2E tests)
   - ❌ Still used by `serverless/shared/vitest.setup.integration.ts`
   - ❌ Still used by `serverless/otp-auth-service/scripts/run-integration-tests.js`

### Can Remove After Migration

1. **`serverless/shared/vitest.setup.integration.ts`** - After all integration tests migrated
2. **`serverless/otp-auth-service/utils/test-config-loader.ts`** - After all tests migrated (if not needed)

---

## 🚀 Actual Next Steps

1. **Migrate ONE test file** to prove the approach works
   - Choose simplest test: `session.integration.test.ts` or similar
   - Migrate to use `SELF.fetch()` from `cloudflare:test`
   - Remove health checks and URL constants
   - Test that it works

2. **Update mods-api config** if it has integration tests
   - Check if mods-api tests can use new approach
   - Update config accordingly

3. **Migrate remaining tests** one by one
   - Single-worker tests first
   - Multi-worker tests second

4. **Only then remove old files**
   - After ALL tests are migrated and verified
   - Keep E2E script if needed for Playwright

---

## 📝 Conclusion

**The migration is NOT complete.** Only the infrastructure was created. To actually complete the migration:

1. ✅ Infrastructure created (done)
2. ❌ Migrate test files (0% done)
3. ❌ Update all configs (50% done - otp-auth-service done, mods-api not)
4. ❌ Remove old files (0% done - can't remove yet)

**Realistic Status:** ~10% complete (infrastructure only)
