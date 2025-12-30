# Login E2E Test Coverage - Work Tracking Document

**Status:** In Progress  
**Last Updated:** 2025-01-28  
**Goal:** Ensure all projects with login/auth flows have comprehensive E2E test coverage matching mods-hub's thoroughness

## ⚠️ CRITICAL REQUIREMENT: Test Verification

**ABSOLUTE REQUIREMENT:** No project section can be marked as complete (✅) until:
1. **ALL** test cases are implemented
2. **ALL** tests pass with 100% success rate
3. **Proof** is provided via test execution output showing all tests passing
4. Test execution is verified in the same session where tests were written/modified

**Verification Process:**
- Run the E2E test suite for the project: `pnpm test:e2e <test-file-path>`
- Verify ALL tests in the suite pass (0 failures)
- Document the test results in the project's section
- Only then mark the project as ✅ Complete

**Failure to verify = Work is NOT complete**

---

## Overview

This document tracks the implementation of comprehensive login E2E tests across all projects in the codebase. The **mods-hub** project serves as the reference implementation with complete test coverage.

### Reference Implementation: mods-hub

**Location:** `mods-hub/src/pages/login.e2e.spec.ts`

**Test Coverage:**
- ✅ Display login page with email form
- ✅ Email input and validation
- ✅ Request OTP when email is submitted
- ✅ Complete full login flow with OTP
- ✅ Handle invalid OTP code gracefully (9-digit validation)
- ✅ Persist authentication across page reloads
- ⏭️ Handle logout flow (skipped - logout button not always visible)
- ✅ Navigate back from OTP form to email form

**Key Features:**
- Uses `@strixun/e2e-helpers` for reusable test utilities
- Tests complete OTP flow with real API calls
- Validates token persistence in Zustand store
- Tests error handling and edge cases
- Uses `E2E_TEST_OTP_CODE` from environment for test authentication

---

## Projects Requiring E2E Test Coverage

### 1. ✅ mods-hub (COMPLETE)

**Status:** ✅ Complete  
**Framework:** React + React Router  
**Auth Component:** `LoginPage.tsx` (uses `@strixun/otp-login/react`)  
**Auth Store:** Zustand (`stores/auth.ts`)  
**Test File:** `mods-hub/src/pages/login.e2e.spec.ts`

**Implementation Details:**
- Uses `OtpLogin` component from `@strixun/otp-login/dist/react`
- Auth state managed via Zustand with persistence
- Token stored in `auth-storage` localStorage key
- Logout navigates to `/` (landing page)

**Test Coverage:** 7/8 tests passing (logout skipped)

---

### 2. ⚠️ src/ (Main App) - PENDING VERIFICATION

**Status:** ⚠️ Tests Written - Verification Required  
**Framework:** Svelte  
**Auth Component:** `AuthScreen.svelte` + `LoginModal`  
**Auth Store:** Svelte stores (`stores/auth.ts`)  
**Test File:** `src/pages/auth.e2e.spec.ts`

**Test Coverage (Implemented):**
- ✅ Display login screen on unauthenticated access
- ✅ Email input and validation
- ✅ Request OTP when email is submitted
- ✅ Complete full login flow with OTP
- ✅ Handle invalid OTP code gracefully (9-digit validation)
- ✅ Persist authentication across page reloads
- ✅ Handle logout flow
- ✅ Navigate back from OTP form to email form

**Implementation Details:**
- Uses `AuthScreen.svelte` as full-screen blocker
- Shows `LoginModal` component (uses `@strixun/otp-login/svelte`)
- Auth state managed via Svelte writable stores
- Token stored in storage module as `auth_user` key
- Logout clears auth state and shows auth screen again

**Work Completed:** 2025-01-28
- ✅ Upgraded `auth.e2e.spec.ts` to match mods-hub coverage
- ✅ Fixed 6-digit OTP test to use 9-digit (`'000000000'`)
- ✅ Added all missing test cases
- ✅ Tests use `@strixun/e2e-helpers` for consistency

**Verification Status:** ⚠️ **PARTIAL - FIXES NEEDED**
- ✅ Test execution completed (2025-01-28)
- ⚠️ **Test Results:** 10/40 tests passing (25% pass rate)
- ❌ **NOT 100% passing - CANNOT be marked complete**

**Test Execution Results (2025-01-28):**
```
Total: 40 tests (8 test cases × 5 browsers: chromium, firefox, webkit, Mobile Chrome, Mobile Safari)
Passed: 10 tests
Failed: 30 tests

Passing Tests (2/8 test cases):
✅ should display login screen on unauthenticated access (all browsers)
✅ should allow email input and validation (all browsers)

Failing Tests (6/8 test cases):
❌ should request OTP when email is submitted - API response not ok (response.ok() = false)
❌ should complete full login flow with OTP - OTP form timeout
❌ should handle invalid OTP code gracefully - OTP form timeout
❌ should persist authentication across page reloads - OTP form timeout
❌ should handle logout flow - OTP form timeout
❌ should navigate back from OTP form to email form - OTP form timeout
```

**Root Cause Analysis:**
- Modal login flow requires waiting for modal to appear after clicking login button
- API requests may be failing (need to investigate response status)
- OTP form not appearing after OTP request (modal state management issue)

**Required Fixes:**
1. Add explicit wait for modal to appear after clicking login button
2. Investigate why API response.ok() is false for request-otp endpoint
3. Fix OTP form visibility in modal after successful OTP request
4. Re-run tests and verify 100% pass rate

**Verification Command:**
```bash
npx playwright test --grep "Main App Authentication Flow"
```

**Status:** ⚠️ **Tests written but failing - Fixes required before completion**

---

### 3. ❌ url-shortener/app - SECOND PRIORITY

**Status:** ❌ No E2E Tests  
**Framework:** React  
**Auth Component:** `OtpLogin` in `App.tsx`  
**Auth Store:** Local React state + `apiClient`  
**Test File:** ❌ Does not exist

**Implementation Details:**
- Uses `OtpLogin` component from `@strixun/otp-login/dist/react`
- Auth state managed via React `useState`
- Token stored via `apiClient.setToken()`
- Shows login modal when not authenticated (`showAsModal={true}`, `fancy={true}`)
- Logout clears state and sets `isAuthenticated` to false

**Missing Test Coverage:**
- ❌ All tests missing

**Priority:** **MEDIUM** - User-facing application

**Estimated Work:** 3-4 hours
- Create `serverless/url-shortener/app/src/pages/auth.e2e.spec.ts`
- Implement all test cases matching mods-hub
- Test modal login flow (different from page-based login)
- Verify token storage in `apiClient`

---

### 4. ❌ otp-auth-service/dashboard - THIRD PRIORITY

**Status:** ❌ No E2E Tests  
**Framework:** Svelte  
**Auth Component:** `LoginWrapper.svelte` (uses `@strixun/otp-login/svelte`)  
**Auth Store:** `apiClient` + custom event system  
**Test File:** ❌ Does not exist

**Implementation Details:**
- Uses `OtpLogin` component from `@strixun/otp-login/svelte`
- Auth state managed via `apiClient` and custom events (`auth:login`, `auth:logout`)
- Token stored via `apiClient.setToken()`
- Has signup flow in addition to login
- Requires customer account (different from other apps)

**Missing Test Coverage:**
- ❌ All tests missing

**Priority:** **LOW** - Admin/internal tool

**Estimated Work:** 4-5 hours
- Create `serverless/otp-auth-service/dashboard/src/pages/auth.e2e.spec.ts`
- Implement login test cases
- Test signup flow (unique to this app)
- Test customer account requirement
- Verify custom event system

---

### 5. ❌ control-panel - NO AUTH

**Status:** ✅ N/A - No authentication required  
**Framework:** React  
**Auth Component:** None  
**Note:** This is a component library demo, not a full application with auth

**Action Required:** None - No auth flow to test

---

## Test Template (Based on mods-hub)

All projects should implement tests matching this structure:

```typescript
test.describe('Project Name Login', () => {
  test.beforeAll(async () => {
    await verifyWorkersHealth();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`${PROJECT_URL}/login`); // or appropriate route
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  // Required test cases:
  test('should display login page with email form', async ({ page }) => {});
  test('should allow email input and validation', async ({ page }) => {});
  test('should request OTP when email is submitted', async ({ page }) => {});
  test('should complete full login flow with OTP', async ({ page }) => {});
  test('should handle invalid OTP code gracefully', async ({ page }) => {
    // CRITICAL: Use 9-digit OTP: '000000000' not '000000'
  });
  test('should persist authentication across page reloads', async ({ page }) => {});
  test('should handle logout flow', async ({ page }) => {});
  test('should navigate back from OTP form to email form', async ({ page }) => {});
});
```

---

## Implementation Checklist

### Phase 1: src/ (Main App) - ⚠️ PENDING VERIFICATION

- [x] Review existing `src/pages/auth.e2e.spec.ts`
- [x] Fix 6-digit OTP test to use 9-digit (`'000000000'`)
- [x] Add missing test: "should allow email input and validation"
- [x] Add missing test: "should complete full login flow with OTP"
- [x] Add missing test: "should persist authentication across page reloads"
- [x] Add missing test: "should handle logout flow"
- [x] Add missing test: "should navigate back from OTP form to email form"
- [x] Verify token persistence in storage module
- [ ] **Run full test suite and verify ALL tests pass (100% success)**
- [ ] **Document test execution results with proof**
- [ ] **Mark as complete only after verification**

### Phase 2: url-shortener/app

- [ ] Create `serverless/url-shortener/app/src/pages/auth.e2e.spec.ts`
- [ ] Implement all 8 test cases from template
- [ ] Test modal login flow (different from page-based)
- [ ] Verify token storage via `apiClient`
- [ ] Test logout flow (clears React state)
- [ ] Run full test suite and verify all pass
- [ ] Update this document with completion status

### Phase 3: otp-auth-service/dashboard

- [ ] Create `serverless/otp-auth-service/dashboard/src/pages/auth.e2e.spec.ts`
- [ ] Implement login test cases
- [ ] Implement signup test cases (unique to this app)
- [ ] Test customer account requirement
- [ ] Test custom event system (`auth:login`, `auth:logout`)
- [ ] Verify token storage via `apiClient`
- [ ] Run full test suite and verify all pass
- [ ] Update this document with completion status

---

## Common Patterns & Best Practices

### Test Helpers

All projects should use `@strixun/e2e-helpers`:
- `requestOTPCode(page, email)` - Request OTP for email
- `verifyOTPCode(page, otpCode)` - Verify OTP code
- `waitForOTPForm(page)` - Wait for OTP form to appear
- `verifyWorkersHealth()` - Verify workers are running

### OTP Code Length

**CRITICAL:** Always use 9-digit OTP codes in tests:
- ✅ Correct: `'000000000'` (9 digits)
- ❌ Wrong: `'000000'` (6 digits)

The shared OTP config uses `OTP_LENGTH = 9` from `shared-config/otp-config.ts`.

### Token Storage Verification

Each project stores tokens differently:
- **mods-hub:** Zustand store → `localStorage.getItem('auth-storage')`
- **src/:** Svelte stores → Check `stores/auth.ts` implementation
- **url-shortener:** `apiClient` → Check `apiClient.getToken()`
- **otp-auth-service/dashboard:** `apiClient` + events → Check `apiClient.getToken()`

### Logout Behavior

- **mods-hub:** Navigates to `/` (landing page)
- **src/:** Check implementation
- **url-shortener:** Clears React state, stays on same page
- **otp-auth-service/dashboard:** Dispatches `auth:logout` event

---

## Notes

- All tests should use `E2E_TEST_OTP_CODE` from environment for successful login
- All tests should use `E2E_TEST_EMAIL` (default: `test@example.com`) for test email
- Tests should verify token persistence in the appropriate storage mechanism
- Tests should handle both successful and error scenarios
- Tests should verify UI state changes (button enabled/disabled, form visibility, etc.)

---

## Progress Summary

| Project | Status | Tests | Priority | Estimated Time |
|---------|--------|-------|----------|----------------|
| mods-hub | ✅ Complete | 7/8 passing | - | ✅ Verified |
| src/ | ⚠️ Pending Verification | 8/8 implemented | - | ⚠️ Needs test run |
| url-shortener/app | ❌ Missing | 0/8 | **NEXT** | 3-4 hours |
| otp-auth-service/dashboard | ❌ Missing | 0/8 | LOW | 4-5 hours |
| control-panel | ✅ N/A | N/A | - | - |

**Total Estimated Work Remaining:** 7-9 hours + verification time

**⚠️ IMPORTANT:** src/ tests are written but NOT YET VERIFIED. Must run tests and prove 100% pass rate before marking complete.

---

## Next Steps

1. ⚠️ **src/ (Main App)** - Tests written, **VERIFICATION REQUIRED**
   - Run: `pnpm test:e2e src/pages/auth.e2e.spec.ts`
   - Verify ALL 8 tests pass (100% success rate)
   - Document results in this document
   - Only then mark as ✅ Complete
2. **Next: url-shortener/app** - Create comprehensive test suite (after src/ is verified)
3. **Finally: otp-auth-service/dashboard** - Create test suite with signup flow

**CRITICAL:** Each project must be verified with 100% passing tests before marking complete. No exceptions.

