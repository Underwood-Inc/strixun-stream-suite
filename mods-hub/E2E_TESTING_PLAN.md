# Mods Hub E2E Testing Plan

**Status:** Planning Phase  
**Last Updated:** 2025-12-30  
**Goal:** Create comprehensive E2E tests for mods-hub features that are confirmed working in production

## Strategy

We will focus on writing E2E tests for **confirmed working features** first. This approach:
- Builds confidence in our test infrastructure
- Establishes baseline coverage for working features
- Allows us to fix defects later with confidence we won't break existing functionality
- Validates that our E2E test setup correctly replicates production behavior

## Prerequisites

### Infrastructure Setup
- [x] Local workers configured (OTP Auth, Mods API, etc.)
- [x] Test secrets automatically generated (`E2E_TEST_JWT_TOKEN`, `E2E_TEST_OTP_CODE`)
- [x] Playwright configured for local-only testing
- [ ] **FIX REQUIRED:** Ensure `decryptBinaryWithServiceKey` and `getServiceKey` are properly exported from `@strixun/api-framework` (see Export Fix section below)

### Test Data
- [ ] Test mods can be created programmatically
- [ ] Test JWT tokens are generated and available
- [ ] Test OTP codes are generated and available
- [ ] Test user accounts are seeded (or use test credentials)

## Phase 1: Authentication Flow E2E Tests

### Overview
The authentication flow in mods-hub is **confirmed working in production**. This is our first priority for E2E test coverage.

### Test File
`mods-hub/src/pages/login.e2e.spec.ts` (exists but needs expansion)

### Test Scenarios

#### 1. Successful Login Flow
- **Description:** Complete OTP authentication flow from email entry to dashboard redirect
- **Steps:**
  1. Navigate to `/login`
  2. Enter test email address
  3. Submit email form
  4. Wait for OTP form to appear
  5. Enter OTP code (from `E2E_TEST_OTP_CODE` env var or test email service)
  6. Submit OTP form
  7. Verify redirect to dashboard/home page
  8. Verify user is authenticated (check localStorage/auth store)
  9. Verify JWT token is stored correctly
  10. Verify user info is displayed in UI (email, etc.)

#### 2. Email Validation
- **Description:** Test email form validation
- **Steps:**
  1. Navigate to `/login`
  2. Submit empty email form → should show validation error
  3. Submit invalid email format → should show validation error
  4. Submit valid email → should proceed to OTP form

#### 3. OTP Code Validation
- **Description:** Test OTP form validation and error handling
- **Steps:**
  1. Complete email submission
  2. Enter invalid OTP code → should show error message
  3. Enter expired OTP code → should show appropriate error
  4. Enter valid OTP code → should proceed to login

#### 4. Error Handling
- **Description:** Test error scenarios (network errors, rate limiting, etc.)
- **Steps:**
  1. Test network error during OTP request
  2. Test rate limiting (if applicable)
  3. Test invalid credentials
  4. Verify error messages are user-friendly

#### 5. Session Persistence
- **Description:** Test that authentication persists across page reloads
- **Steps:**
  1. Complete login flow
  2. Reload page
  3. Verify user remains authenticated
  4. Verify token is still valid

#### 6. Logout Flow
- **Description:** Test logout functionality
- **Steps:**
  1. Complete login flow
  2. Click logout button
  3. Verify user is logged out
  4. Verify redirect to login page
  5. Verify token is cleared from storage

### Integration Points
- **OTP Auth Service:** Must be running locally on port 8787
- **Mods API:** Must be running locally on port 8788 (for post-login API calls)
- **Test Credentials:** Use `E2E_TEST_EMAIL` and `E2E_TEST_OTP_CODE` from environment

### Test Helpers Needed
- `loginAsTestUser(page)` - Helper to complete full login flow
- `isAuthenticated(page)` - Check if user is logged in
- `getAuthToken(page)` - Extract JWT token from storage
- `logout(page)` - Perform logout action

## Phase 2: Protected Routes E2E Tests

### Overview
Test that protected routes correctly require authentication and redirect appropriately.

### Test Scenarios
1. **Unauthenticated Access to Protected Routes**
   - Navigate to protected route without auth
   - Verify redirect to `/login`
   - Verify redirect back to original route after login

2. **Authenticated Access to Protected Routes**
   - Complete login flow
   - Navigate to protected routes
   - Verify access is granted

3. **Admin Route Protection**
   - Test regular user cannot access admin routes
   - Test super admin can access admin routes
   - Test proper error messages for unauthorized access

## Phase 3: Mod Management E2E Tests

### Overview
Test mod upload, management, and download flows (only after auth flow is fully tested).

### Test Scenarios
1. **Mod Upload Flow**
   - Authenticate as test user
   - Navigate to upload page
   - Fill out mod metadata form
   - Upload mod file
   - Verify upload success
   - Verify mod appears in user's mod list

2. **Mod Download Flow**
   - Authenticate as test user
   - Navigate to public mod detail page
   - Click download button
   - Verify download starts
   - Verify file integrity headers are present

3. **Mod Management**
   - Edit mod metadata
   - Delete mod
   - Update mod status
   - Verify changes persist

## Export Fix: API Framework Exports

### Issue
The build is failing with:
```
ERROR No matching export in "../../packages/api-framework/index.ts" for import "decryptBinaryWithServiceKey"
ERROR No matching export in "../../packages/api-framework/index.ts" for import "getServiceKey"
```

### Root Cause
The functions are exported from `packages/api-framework/encryption/index.ts` and re-exported in `packages/api-framework/index.ts`, but there may be a TypeScript compilation or build issue.

### Verification Steps
1. Verify exports exist in `packages/api-framework/encryption/index.ts`:
   - `getServiceKey` (line 53)
   - `decryptBinaryWithServiceKey` (line 58)

2. Verify re-exports in `packages/api-framework/index.ts`:
   - `getServiceKey` (line 66)
   - `decryptBinaryWithServiceKey` (line 54)

3. Check TypeScript compilation:
   - Run `pnpm build` in `packages/api-framework`
   - Verify no TypeScript errors
   - Verify exports are in compiled output

4. Check import in `serverless/mods-api/handlers/versions/download.ts`:
   - Current: `import { decryptBinaryWithServiceKey, getServiceKey } from '@strixun/api-framework';`
   - Verify this matches the export path

### Fix Actions
- [ ] Verify `packages/api-framework/index.ts` re-exports `decryptBinaryWithServiceKey` and `getServiceKey` (lines 54 and 66)
- [ ] Verify `packages/api-framework/encryption/index.ts` exports these functions (lines 53 and 58)
- [ ] Check `packages/api-framework/package.json` exports field - ensure it includes encryption exports
- [ ] Run `pnpm build` in `packages/api-framework` to ensure exports are compiled (if build step exists)
- [ ] Verify TypeScript can resolve the imports (check `tsconfig.json` paths)
- [ ] Check if there's a build order issue (api-framework must build before mods-api)
- [ ] If using ESM, verify package.json exports field includes all necessary paths

### Test After Fix
- [ ] Run `pnpm build` in `serverless/mods-api`
- [ ] Verify no import errors
- [ ] Run E2E tests to verify download handler works

## Implementation Checklist

### Phase 1: Auth Flow (Priority 1)
- [ ] Expand `mods-hub/src/pages/login.e2e.spec.ts` with comprehensive test scenarios
- [ ] Create test helpers in `packages/e2e-helpers/helpers.ts` for auth operations
- [ ] Set up test data seeding for OTP codes
- [ ] Verify OTP auth service is properly configured for E2E
- [ ] Write tests for all 6 authentication scenarios listed above
- [ ] Run tests and verify they pass
- [ ] Document any issues found

### Phase 2: Protected Routes (Priority 2)
- [ ] Write E2E tests for protected route access
- [ ] Test admin route protection
- [ ] Verify redirect behavior

### Phase 3: Mod Management (Priority 3)
- [ ] Write E2E tests for mod upload
- [ ] Write E2E tests for mod download
- [ ] Write E2E tests for mod management

### Infrastructure
- [ ] Fix API framework export issues (see Export Fix section)
- [ ] Verify all local workers start correctly
- [ ] Verify test secrets are available
- [ ] Set up test data cleanup between test runs

## Test Execution

### Running Tests
```bash
# Run all mods-hub E2E tests
pnpm test:e2e mods-hub

# Run only auth flow tests
pnpm test:e2e mods-hub/src/pages/login.e2e.spec.ts

# Run in UI mode for debugging
pnpm test:e2e:ui mods-hub/src/pages/login.e2e.spec.ts
```

### CI Integration
- Tests should run in CI after deployment
- Use CI secrets for `E2E_TEST_JWT_TOKEN` and `E2E_TEST_OTP_CODE`
- Ensure local workers are started in CI environment

## Success Criteria

### Phase 1 Complete When:
- [ ] All 6 authentication scenarios pass
- [ ] Tests run reliably in headless mode
- [ ] Tests can be run in CI
- [ ] Test helpers are reusable for other test files

### Overall Success:
- [ ] E2E tests provide confidence that working features remain working
- [ ] Tests catch regressions before deployment
- [ ] Test infrastructure is stable and maintainable

## Notes

- **Focus on working features first:** This plan prioritizes testing features that are confirmed working in production
- **Fix defects later:** Once we have comprehensive E2E coverage for working features, we can fix defects with confidence
- **Incremental approach:** Each phase builds on the previous one
- **Export fix is critical:** The API framework export issue must be resolved before mod download E2E tests can pass

## References

- Existing auth flow E2E tests: `packages/otp-login/authentication-flow.e2e.spec.ts`
- Existing login E2E test: `mods-hub/src/pages/login.e2e.spec.ts`
- E2E helpers: `packages/e2e-helpers/helpers.ts`
- Playwright config: `playwright.config.ts`

