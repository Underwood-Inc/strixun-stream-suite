# Serverless Test Hang Fixes

> **Fixed issues causing tests to hang indefinitely**

**Date:** 2025-12-29

---

## Issues Identified and Fixed

### 1. **Global Fetch Mock Not Cleaned Up** ✅ FIXED
**File:** `serverless/mods-api/handlers/admin/users-email-privacy.test.ts`

**Problem:**
- Test was using `global.fetch = vi.fn()` which wasn't properly cleaned up
- Could cause tests to hang waiting for network calls

**Fix:**
- Replaced `global.fetch` mocking with proper `createServiceClient` mock
- Service client is now mocked at the module level
- No network calls are made during tests

### 2. **Missing Test Timeouts** ✅ FIXED
**Files:** 
- `vitest.serverless.config.ts`
- `serverless/otp-auth-service/vitest.config.ts`

**Problem:**
- Tests could hang indefinitely if something went wrong
- No timeout configuration to catch hangs early

**Fix:**
- Added `testTimeout: 10000` (10 seconds) to catch hangs faster
- Added `hookTimeout: 10000` for before/after hooks
- Added `teardownTimeout: 5000` for cleanup
- Reduced from 30s to 10s to catch issues faster

### 3. **Test Isolation Issues** ✅ FIXED
**File:** `vitest.serverless.config.ts`

**Problem:**
- Tests running in parallel could conflict
- Shared state between tests

**Fix:**
- Added `maxConcurrency: 1` to run tests sequentially
- Already had `isolate: true` for file isolation
- Added `poolOptions.forks.singleFork: false` for proper fork management

### 4. **Service Client Not Mocked** ✅ FIXED
**File:** `serverless/mods-api/handlers/admin/users-email-privacy.test.ts`

**Problem:**
- `listAllUsers` function uses `createServiceClient` which makes real network calls
- Tests were trying to make actual HTTP requests, causing hangs

**Fix:**
- Added module-level mock for `createServiceClient`
- All service client calls now return mocked responses immediately
- No network calls are made during tests

---

## Configuration Changes

### `vitest.serverless.config.ts`
```typescript
test: {
  testTimeout: 10000,        // Reduced from 30s to catch hangs faster
  hookTimeout: 10000,        // Timeout for hooks
  teardownTimeout: 5000,     // Timeout for teardown
  maxConcurrency: 1,         // Run tests sequentially
  pool: 'forks',
  isolate: true,
}
```

### `serverless/otp-auth-service/vitest.config.ts`
```typescript
test: {
  testTimeout: 10000,        // Added timeout
  pool: 'forks',             // Added fork pool
  isolate: true,             // Added isolation
}
```

---

## Test Files Fixed

1. ✅ `serverless/mods-api/handlers/admin/users-email-privacy.test.ts`
   - Replaced `global.fetch` with `createServiceClient` mock
   - All network calls are now mocked

2. ✅ `serverless/mods-api/handlers/mods/permissions.test.ts`
   - Already properly mocked (no changes needed)

3. ✅ `serverless/shared/service-client/integrity-customerid.test.ts`
   - Already properly mocked (no changes needed)

---

## Running Tests

### Run All Serverless Tests:
```bash
npm test -- --config vitest.serverless.config.ts
```

### Run Specific Test File:
```bash
npm test -- --config vitest.serverless.config.ts serverless/mods-api/handlers/mods/permissions.test.ts
```

### Run OTP Auth Service Tests:
```bash
cd serverless/otp-auth-service
pnpm test
```

---

## Prevention

To prevent future hangs:
1. ✅ Always mock external dependencies (fetch, service clients, etc.)
2. ✅ Use proper cleanup in `afterEach` hooks
3. ✅ Set reasonable test timeouts
4. ✅ Run tests sequentially if they share state
5. ✅ Use `vi.restoreAllMocks()` in cleanup

---

## Status

✅ **ALL HANGING ISSUES FIXED**

All test files now:
- Mock external dependencies properly
- Have timeout configurations
- Run in isolated environments
- Clean up after themselves

---

**Last Updated**: 2025-12-29

