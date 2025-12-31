# Test URL Audit - Production vs Development

> **Audit of test files to ensure they use development URLs, not production URLs**

**Date:** 2025-12-29

---

## Audit Results

### [OK] Safe - Mock/Test Data Only

These files use production URLs in **mock data or test fixtures only**, not actual API calls:

1. **`serverless/mods-api/handlers/api-framework-integration.integration.test.ts`**
   - Uses `https://mods-api.idling.app` in `Request` constructor for testing
   - This is mock data, not actual API calls [OK]

2. **`serverless/mods-api/handlers/auth-flow.integration.test.ts`**
   - Uses `https://auth.idling.app` in mock environment
   - This is mock data, not actual API calls [OK]

3. **`serverless/mods-api/handlers/session-restore.integration.test.ts`**
   - Uses `https://auth.idling.app` in mock environment
   - This is mock data, not actual API calls [OK]

---

### [OK] Environment-Aware Tests

These tests already use environment-aware logic:

1. **`serverless/mods-api/handlers/service-integration.live.test.ts`**
   - Uses `TEST_ENV` or `NODE_ENV` to determine environment
   - Defaults to dev: `https://strixun-otp-auth-service.strixuns-script-suite.workers.dev`
   - Only uses production when `testEnv === 'prod'` [OK]

2. **`serverless/otp-auth-service/handlers/auth/customer-creation.integration.test.ts`**
   - Uses `test-config-loader.ts` which is environment-aware [OK]

---

### [WARNING] Production URLs in Code (Not Tests)

These files use production URLs but are **runtime code**, not tests:

1. **`serverless/mods-api/handlers/mods/update.ts`**
   - Uses `https://mods-api.idling.app` as default for production
   - This is correct - it's production code [OK]

2. **`serverless/mods-api/handlers/mods/upload.ts`**
   - Uses `https://mods-api.idling.app` as default for production
   - This is correct - it's production code [OK]

3. **`serverless/otp-auth-service/utils/email.ts`**
   - Uses `https://auth.idling.app` in email templates
   - This is correct - it's production code [OK]

---

## Recommendations

### For Integration Tests

Integration tests that make actual API calls should:

1. **Use environment variables**:
   ```typescript
   const AUTH_API_URL = process.env.AUTH_API_URL || 
     (process.env.NODE_ENV === 'test' 
       ? 'https://otp-auth-service-dev.strixuns-script-suite.workers.dev'
       : 'https://auth.idling.app');
   ```

2. **Use test config loader** (already implemented):
   ```typescript
   import { loadTestConfig } from '../../utils/test-config-loader.js';
   const config = loadTestConfig('dev');
   ```

### For Unit Tests

Unit tests using mocks can use any URL - they don't make actual API calls.

---

## Action Items

1. [OK] **No changes needed** - All tests are properly configured
2. [OK] **Mock data URLs are safe** - They're not making actual API calls
3. [OK] **Live tests are environment-aware** - They use dev URLs by default

---

## Verification

To verify tests use development URLs:

```bash
# Run tests with environment variable
TEST_ENV=dev pnpm test

# Or set in test files
NODE_ENV=test pnpm test
```

---

## See Also

- [E2E Testing Guide](./E2E_TESTING_GUIDE.md) - E2E testing guide
- [Development Deployment Setup](../04_DEPLOYMENT/DEVELOPMENT_DEPLOYMENT_SETUP.md) - Development deployment setup
- [E2E Environment Verification](./E2E_ENVIRONMENT_VERIFICATION.md) - Verify development environment setup

---

**Last Updated**: 2025-12-29

