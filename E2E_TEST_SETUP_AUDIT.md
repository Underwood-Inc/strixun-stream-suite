# E2E Test Setup Audit - Complete Configuration Guide

## Overview

This document outlines the complete E2E test setup requirements based on auditing all projects in the codebase.

## Critical Configuration Requirements

### 1. Test Email Configuration

**Standard Test Email**: `test@example.com`

This email MUST be used consistently across all E2E tests because:
- It matches `SUPER_ADMIN_EMAILS` in OTP Auth Service test secrets
- Super admins bypass rate limiting automatically
- It's the default in `download.e2e.spec.ts` and other API-level tests

**Files Using Test Email**:
- `mods-hub/src/pages/login.e2e.spec.ts`: Uses `process.env.E2E_TEST_EMAIL || 'test@example.com'`
- `serverless/mods-api/handlers/versions/download.e2e.spec.ts`: Uses `process.env.E2E_TEST_EMAIL || 'test@example.com'`
- `packages/otp-login/authentication-flow.e2e.spec.ts`: Uses `process.env.E2E_TEST_EMAIL || 'test@example.com'`

### 2. SUPER_ADMIN_EMAILS Configuration

**Location**: `serverless/otp-auth-service/.dev.vars`

**Required Value**: `SUPER_ADMIN_EMAILS=test@example.com`

**Why**: 
- Super admins bypass rate limiting (see `serverless/otp-auth-service/services/rate-limit.ts`)
- The rate limit check calls `isSuperAdminEmail()` which checks `SUPER_ADMIN_EMAILS`
- This allows E2E tests to run without hitting 429 rate limit errors

**Setup**: Automatically configured by `serverless/otp-auth-service/scripts/setup-test-secrets.js`

### 3. Email Interception for E2E Tests

**How It Works**:
1. When `ENVIRONMENT='test'` AND `RESEND_API_KEY` starts with `'re_test_'`, emails are intercepted
2. OTP code is stored in local KV with key: `e2e_otp_{emailHash}`
3. E2E tests read OTP from local KV filesystem (`.wrangler/state/v3/kv/`)

**Security**:
- Only works in local development (wrangler dev --local)
- Production never has `ENVIRONMENT='test'` or `RESEND_API_KEY='re_test_*'`
- No endpoint exposes OTP codes

**Files**:
- `serverless/otp-auth-service/handlers/email.ts`: Intercepts emails in test mode
- `packages/e2e-helpers/email-interception.ts`: Reads OTP from local KV

### 4. Environment Variables Flow

**Setup Scripts**:
1. `serverless/otp-auth-service/scripts/setup-test-secrets.js`:
   - Sets `ENVIRONMENT='test'`
   - Sets `RESEND_API_KEY='re_test_key_for_local_development'`
   - Sets `SUPER_ADMIN_EMAILS='test@example.com'`
   - Generates `E2E_TEST_OTP_CODE` and `E2E_TEST_JWT_TOKEN`

2. `serverless/mods-api/scripts/setup-test-secrets.js`:
   - Sets matching `JWT_SECRET` and `SERVICE_ENCRYPTION_KEY`

**Playwright Configuration** (`playwright.config.ts`):
- Loads `.dev.vars` files via `loadDevVars()`
- Passes `E2E_TEST_EMAIL`, `E2E_TEST_OTP_CODE`, `E2E_TEST_JWT_TOKEN` to test workers
- Configures local worker URLs (localhost:8787+)

**Global Setup** (`playwright.global-setup.ts`):
- Loads `.dev.vars` into `process.env` before tests run
- Verifies `E2E_TEST_JWT_TOKEN` or `E2E_TEST_OTP_CODE` is set

### 5. Rate Limiting Bypass

**Implementation**: `serverless/otp-auth-service/services/rate-limit.ts`

```typescript
// Super admins are ALWAYS exempt from rate limits
if (email) {
    const { isSuperAdminEmail } = await import('../utils/super-admin.js');
    const isSuperAdmin = await isSuperAdminEmail(email, env);
    if (isSuperAdmin) {
        return {
            allowed: true,
            remaining: 999999, // Effectively unlimited
            resetAt: resetAt
        };
    }
}
```

**Check**: `serverless/otp-auth-service/utils/super-admin.ts`
- Reads `SUPER_ADMIN_EMAILS` from environment
- Normalizes email (trim, lowercase) before comparison

### 6. Test Email Helper Configuration

**File**: `packages/e2e-helpers/helpers.ts`

**TEST_USERS**:
```typescript
export const TEST_USERS = {
  admin: {
    email: process.env.E2E_TEST_ADMIN_EMAIL || 'test-admin@example.com',
  },
  regular: {
    email: process.env.E2E_TEST_USER_EMAIL || 'test-user@example.com',
  },
};
```

**Note**: These are NOT used in login tests. Login tests use `test@example.com` directly.

### 7. OTP Code Retrieval

**Helper**: `packages/e2e-helpers/email-interception.ts`

**Function**: `waitForInterceptedOTP(email, timeout)`
- Reads from local KV filesystem: `.wrangler/state/v3/kv/{namespace-id}/e2e_otp_{emailHash}`
- Tries multiple paths:
  1. `serverless/otp-auth-service/.wrangler/state/v3/kv/`
  2. `.wrangler/state/v3/kv/`
  3. `~/.wrangler/state/v3/kv/`
- Uses known namespace ID: `680c9dbe86854c369dd23e278abb41f9`

## Complete Setup Checklist

### Required Files and Values

1. **`serverless/otp-auth-service/.dev.vars`**:
   ```
   ENVIRONMENT=test
   RESEND_API_KEY=re_test_key_for_local_development
   SUPER_ADMIN_EMAILS=test@example.com
   SERVICE_ENCRYPTION_KEY=test-service-encryption-key-for-local-development-...
   VITE_SERVICE_ENCRYPTION_KEY=test-service-encryption-key-for-local-development-...
   JWT_SECRET=test-jwt-secret-for-local-development-...
   E2E_TEST_OTP_CODE=... (auto-generated)
   E2E_TEST_JWT_TOKEN=... (auto-generated)
   ```

2. **`serverless/mods-api/.dev.vars`**:
   ```
   JWT_SECRET=test-jwt-secret-for-local-development-... (must match OTP Auth Service)
   SERVICE_ENCRYPTION_KEY=test-service-encryption-key-for-local-development-... (must match)
   ```

3. **Test Files**:
   - Use `process.env.E2E_TEST_EMAIL || 'test@example.com'`
   - Import `waitForInterceptedOTP` from `@strixun/e2e-helpers`
   - Call `waitForInterceptedOTP(TEST_EMAIL, 5000)` after requesting OTP

## Verification Steps

1. **Check SUPER_ADMIN_EMAILS**:
   ```bash
   grep SUPER_ADMIN_EMAILS serverless/otp-auth-service/.dev.vars
   # Should output: SUPER_ADMIN_EMAILS=test@example.com
   ```

2. **Check Test Email in Tests**:
   ```bash
   grep "TEST_EMAIL.*test@example" mods-hub/src/pages/login.e2e.spec.ts
   # Should use test@example.com
   ```

3. **Verify Email Interception**:
   - Check `serverless/otp-auth-service/handlers/email.ts` has test mode check
   - Check `packages/e2e-helpers/email-interception.ts` can read from KV

4. **Run Tests**:
   ```bash
   pnpm test:e2e mods-hub/src/pages/login.e2e.spec.ts --project=chromium --workers=1
   ```

## Common Issues and Fixes

### Issue: Rate Limiting (429 errors)
**Cause**: Test email not in SUPER_ADMIN_EMAILS
**Fix**: Ensure `SUPER_ADMIN_EMAILS=test@example.com` in `.dev.vars`

### Issue: OTP Code Not Found
**Cause**: Email interception not working or KV path incorrect
**Fix**: 
- Verify `ENVIRONMENT=test` and `RESEND_API_KEY=re_test_*` in `.dev.vars`
- Check `.wrangler/state/v3/kv/` exists after requesting OTP
- Verify namespace ID matches: `680c9dbe86854c369dd23e278abb41f9`

### Issue: Import Errors
**Cause**: Email interception helper not exported
**Fix**: Ensure `packages/e2e-helpers/helpers.ts` exports `waitForInterceptedOTP`

## Summary

The E2E test setup requires:
1. **Consistent test email**: `test@example.com` across all tests
2. **Super admin configuration**: `SUPER_ADMIN_EMAILS=test@example.com` in OTP Auth Service
3. **Email interception**: Enabled when `ENVIRONMENT=test` and `RESEND_API_KEY=re_test_*`
4. **OTP retrieval**: From local KV filesystem using email interception helper
5. **Rate limit bypass**: Automatic for super admin emails

All of this is automatically configured by the `setup-test-secrets.js` scripts, but tests must use `test@example.com` to match the super admin configuration.

