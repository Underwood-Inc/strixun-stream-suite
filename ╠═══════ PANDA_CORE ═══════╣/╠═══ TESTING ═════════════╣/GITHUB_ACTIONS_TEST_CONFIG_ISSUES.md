# GitHub Actions Test Configuration Issues

> **Missing configurations and issues preventing tests from running properly**

**Date:** 2025-12-29

---

## Summary

Based on the workflow failures, here are the missing configurations and issues preventing tests from running properly:

---

## Critical Issues

### 1. **Svelte Component Compilation Error in CI**

**Problem**: `OtpLogin.svelte` fails to compile during build with error:
```
Expected a valid element or component name. Components must have a valid variable name or dot notation expression
at line 12, column 312
```

**Root Cause**: The Svelte build process in CI may be missing:
- Proper Svelte plugin configuration in the build step
- Environment variables needed for compilation
- Build dependencies not being installed correctly

**Missing Configuration**:
- The `deploy-otp-auth.yml` workflow builds Svelte components but doesn't explicitly configure the Svelte plugin
- Missing `VITE_SERVICE_ENCRYPTION_KEY` environment variable during build (only set during deploy step)

**Fix Required**:
```yaml
- name: Build and Deploy to Cloudflare Workers
  working-directory: serverless/otp-auth-service
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CF_ACCOUNT_ID }}
    VITE_SERVICE_ENCRYPTION_KEY: ${{ secrets.VITE_SERVICE_ENCRYPTION_KEY }}  # Already present
  run: pnpm run deploy
```

The build script needs to ensure Svelte components compile correctly. Check `serverless/otp-auth-service/scripts/build-with-key.js`.

---

### 2. **Test Environment Setup Missing for Root/Client Tests**

**Problem**: Tests in `shared-components/otp-login/svelte/OtpLogin.test.ts` are failing because:
- Mocks aren't being called (function calls expected but not happening)
- Test environment may not be properly configured

**Missing Configuration**:
- `vitest.setup.ts` may not be running correctly
- Test environment variables may be missing
- Svelte component testing setup may be incomplete

**Current Workflow** (`deploy-mods-hub.yml`, `deploy-storybook.yml`):
```yaml
- name: Run Root/Client Tests
  working-directory: .
  run: pnpm test
```

**Fix Required**:
```yaml
- name: Run Root/Client Tests
  working-directory: .
  env:
    # Add any required test environment variables
    NODE_ENV: test
  run: pnpm test
```

Also verify that `vitest.config.ts` is properly configured and `vitest.setup.ts` exists and is being loaded.

---

### 3. **Customer API Test Script Placeholder**

**Problem**: `serverless/customer-api/package.json` has:
```json
"test": "echo \"Error: no test specified\" && exit 1"
```

**Current Workflow** (`deploy-customer-api.yml`):
- Has logic to detect if tests exist, but the detection isn't working correctly
- Still runs `pnpm test` which executes the placeholder script

**Fix Required**:
The workflow's test detection logic needs improvement, OR the customer-api needs actual tests:

**Option A - Fix Detection** (if no tests needed yet):
```yaml
- name: Check for test script
  id: check_test
  working-directory: serverless/customer-api
  run: |
    # More robust check - look for actual test files or vitest/jest config
    if [ -f "vitest.config.ts" ] || [ -f "vitest.config.js" ] || [ -f "jest.config.js" ]; then
      echo "has_tests=true" >> $GITHUB_OUTPUT
    elif grep -q '"test"' package.json && ! grep -q 'Error: no test specified' package.json; then
      echo "has_tests=true" >> $GITHUB_OUTPUT
    else
      echo "has_tests=false" >> $GITHUB_OUTPUT
    fi
```

**Option B - Add Tests** (recommended):
Create actual test files and update `package.json`:
```json
"test": "vitest run"
```

---

### 4. **Node.js Cache Configuration Issue**

**Problem**: `test-encryption.yml` workflow fails with:
```
Error: Some specified paths were not resolved, unable to cache dependencies
```

**Root Cause**: 
- `cache-dependency-path` points to `serverless/otp-auth-service/pnpm-lock.yaml`
- But the workspace uses a root-level `pnpm-lock.yaml` (monorepo setup)
- The cache action can't find the specified path

**Current Configuration**:
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'pnpm'
    cache-dependency-path: serverless/otp-auth-service/pnpm-lock.yaml  # WRONG
```

**Fix Required**:
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'pnpm'
    cache-dependency-path: 'pnpm-lock.yaml'  # Use root lockfile for monorepo
```

**Note**: This same issue exists in `test-otp-auth-integration.yml`.

---

### 5. **Missing Test Environment Variables**

**Problem**: Tests may require environment variables that aren't set in CI.

**Missing Configuration**:
- No explicit test environment setup
- Secrets may not be available to test jobs
- Test-specific configuration missing

**Fix Required**:
Add environment variables to test steps:
```yaml
- name: Run Root/Client Tests
  working-directory: .
  env:
    NODE_ENV: test
    # Add any test-specific environment variables
    # VITE_SERVICE_ENCRYPTION_KEY: ${{ secrets.VITE_SERVICE_ENCRYPTION_KEY }}  # If needed for tests
  run: pnpm test
```

---

### 6. **Missing Vitest Configuration Verification**

**Problem**: Tests may be running with incorrect configuration.

**Missing Configuration**:
- No verification that `vitest.config.ts` is correct
- No check that test setup files exist
- No validation of test environment

**Fix Required**:
Add a verification step before running tests:
```yaml
- name: Verify Test Configuration
  working-directory: .
  run: |
    if [ ! -f "vitest.config.ts" ]; then
      echo "✗ vitest.config.ts not found"
      exit 1
    fi
    if [ ! -f "vitest.setup.ts" ]; then
      echo "⚠ vitest.setup.ts not found - tests may fail"
    fi
    echo "✓ Test configuration verified"
```

---

## Recommended Fixes Priority

1. **HIGH**: Fix Node.js cache path in `test-encryption.yml` and `test-otp-auth-integration.yml`
2. **HIGH**: Fix Customer API test detection or add actual tests
3. **MEDIUM**: Add environment variables to test steps
4. **MEDIUM**: Investigate and fix Svelte compilation error in build step
5. **MEDIUM**: Fix test mock setup issues in `OtpLogin.test.ts`
6. **LOW**: Add test configuration verification steps

---

## Additional Recommendations

### Create a Shared Test Job Template

Consider creating a reusable test job that can be included in multiple workflows:

```yaml
# .github/workflows/test-template.yml (or use workflow_call)
on:
  workflow_call:
    inputs:
      working_directory:
        required: false
        type: string
        default: '.'
      test_command:
        required: false
        type: string
        default: 'pnpm test'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9.15.1
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          cache-dependency-path: 'pnpm-lock.yaml'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Run tests
        working-directory: ${{ inputs.working_directory }}
        env:
          NODE_ENV: test
        run: ${{ inputs.test_command }}
```

### Add Test Coverage Reporting

Consider adding test coverage upload to workflows:
```yaml
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage/coverage-final.json
    flags: unittests
    name: codecov-umbrella
```

---

## Files That Need Updates

1. `.github/workflows/test-encryption.yml` - Fix cache path
2. `.github/workflows/test-otp-auth-integration.yml` - Fix cache path
3. `.github/workflows/deploy-customer-api.yml` - Fix test detection
4. `.github/workflows/deploy-mods-hub.yml` - Add test env vars
5. `.github/workflows/deploy-storybook.yml` - Add test env vars
6. `.github/workflows/deploy-otp-auth.yml` - Verify build step has all env vars
7. `serverless/customer-api/package.json` - Add actual test script or remove placeholder
8. `shared-components/otp-login/svelte/OtpLogin.test.ts` - Fix mock setup
9. `vitest.setup.ts` - Verify it exists and is properly configured

---

**Last Updated**: 2025-12-29

