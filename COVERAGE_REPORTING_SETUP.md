# Test Coverage Reporting Setup

## Overview

Test coverage reporting has been added to all GitHub Actions workflows that run tests. All coverage steps are configured to be **non-blocking** - they will not cause workflows to fail, but will provide visibility into test coverage.

## Changes Made

### 1. Root Package.json
- Added `test:coverage` script: `vitest run --coverage`

### 2. Vitest Configuration Updates
- **Root `vitest.config.ts`**: Added `json-summary` and `lcov` reporters
- **`serverless/otp-auth-service/vitest.config.ts`**: Added `json-summary` and `lcov` reporters

### 3. Workflow Updates

#### Workflows with Coverage Reporting Added:

1. **`.github/workflows/deploy-mods-hub.yml`**
   - Generates coverage after tests
   - Uploads to Codecov with flag `root-client`
   - Displays coverage summary in workflow summary

2. **`.github/workflows/deploy-storybook.yml`**
   - Generates coverage after tests
   - Uploads to Codecov with flag `root-client`
   - Displays coverage summary in workflow summary

3. **`.github/workflows/deploy-otp-auth.yml`**
   - Generates coverage after OTP Auth Service tests
   - Uploads to Codecov with flag `otp-auth-service`
   - Displays coverage summary in workflow summary

4. **`.github/workflows/test-manager.yml`**
   - Added coverage reporting to Root/Client test job
   - Added coverage reporting to OTP Auth Service test job
   - Coverage included in test results summary

#### Workflows with Coverage Reporting Updated:

5. **`.github/workflows/mods-hub-tests.yml`**
   - Removed blocking 100% coverage threshold check
   - Changed to informational coverage display only
   - Made Codecov upload non-blocking (`fail_ci_if_error: false`)
   - Added `continue-on-error: true` to coverage generation

6. **`.github/workflows/test-encryption.yml`**
   - Already had non-blocking coverage (no changes needed)
   - Uses flag `encryption-libs`

## Coverage Reporters

All vitest configs now generate:
- `text` - Console output
- `json` - Full coverage data (`coverage-final.json`)
- `json-summary` - Summary with percentages (`coverage-summary.json`)
- `html` - HTML report for local viewing
- `lcov` - LCOV format for Codecov compatibility

## Codecov Integration

All workflows upload coverage to Codecov with:
- **Non-blocking**: `fail_ci_if_error: false`
- **Always runs**: `if: always()` and `continue-on-error: true`
- **Flagged by service**: Each service has its own flag for tracking

### Coverage Flags:
- `root-client` - Root/Client Svelte component tests
- `otp-auth-service` - OTP Auth Service tests
- `encryption-libs` - Encryption library tests
- `mods-hub-api` - Mods Hub API tests

## Coverage Display

Coverage percentages are displayed in:
1. **GitHub Actions workflow summary** - Shows coverage percentage after tests
2. **Codecov dashboard** - Detailed coverage reports and trends
3. **Console output** - Text format during test runs

## Non-Blocking Configuration

All coverage steps use:
```yaml
continue-on-error: true  # Step won't fail workflow
fail_ci_if_error: false  # Codecov upload won't fail workflow
if: always()              # Runs even if previous steps fail
```

This ensures:
- ✅ Tests must pass for deployment
- ✅ Coverage is reported but doesn't block
- ✅ Coverage failures are visible but don't stop CI/CD
- ✅ Coverage data is available for analysis

## Viewing Coverage

### In GitHub Actions:
- Check workflow summary for coverage percentage
- View Codecov comments on PRs (if configured)

### In Codecov Dashboard:
- Visit your Codecov repository page
- View coverage trends and detailed reports
- Compare coverage across flags/services

### Locally:
```bash
# Generate coverage
pnpm test:coverage

# View HTML report
open coverage/index.html
```

## Files Modified

1. `package.json` - Added `test:coverage` script
2. `vitest.config.ts` - Added coverage reporters
3. `serverless/otp-auth-service/vitest.config.ts` - Added coverage reporters
4. `.github/workflows/deploy-mods-hub.yml` - Added coverage reporting
5. `.github/workflows/deploy-storybook.yml` - Added coverage reporting
6. `.github/workflows/deploy-otp-auth.yml` - Added coverage reporting
7. `.github/workflows/test-manager.yml` - Added coverage reporting
8. `.github/workflows/mods-hub-tests.yml` - Made coverage non-blocking

## Notes

- **No coverage requirements**: Coverage is informational only
- **No blocking thresholds**: Workflows will not fail due to low coverage
- **Optional Codecov**: If Codecov is not configured, uploads will fail silently (non-blocking)
- **Coverage generation may fail**: If coverage generation fails, it's logged but doesn't block the workflow

## Future Enhancements

If you want to add coverage requirements later:
1. Add threshold checks in vitest config
2. Add coverage comparison in workflows
3. Set minimum coverage percentages
4. Add coverage badges to README

For now, coverage is purely informational and helps track test coverage trends over time.

