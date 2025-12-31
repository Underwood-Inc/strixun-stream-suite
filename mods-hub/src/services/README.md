# Mods Hub API Service - Testing

This directory contains comprehensive tests for the API service with **100% test coverage**.

## Test Structure

### Unit Tests (`api.test.ts`)
- Tests all API functions with mocked API client
- Verifies correct API calls, parameters, and response transformation
- Fast execution, no network calls
- **Coverage: 100% of all functions**

### Integration Tests (`api.integration.test.ts`)
- Tests actual API framework integration
- Verifies token handling, request/response transformation
- Tests error handling and edge cases
- **Coverage: All integration scenarios**

## Running Tests

```bash
# Run all tests
pnpm test

# Run only API service tests
pnpm test:api

# Run tests in watch mode
pnpm test:api:watch

# Run with coverage report
pnpm test:api:coverage

# Run with UI
pnpm test:ui
```

## Coverage Requirements

The API service requires **100% test coverage**:
- [OK] Lines: 100%
- [OK] Functions: 100%
- [OK] Branches: 100%
- [OK] Statements: 100%

Coverage is enforced in:
- Vitest configuration
- CI/CD pipeline (GitHub Actions)
- Pre-commit hooks (if configured)

## CI/CD Integration

Tests run automatically on:
- Every push to `main` or `develop` branches
- Every pull request
- Manual workflow dispatch

The CI pipeline will:
1. Run all unit tests
2. Run all integration tests
3. Generate coverage report
4. Verify 100% coverage threshold
5. Fail the build if coverage is below 100%

## Test Coverage

### Functions Tested

#### Mod Operations
- [OK] `listMods` - With all filter combinations
- [OK] `getModDetail` - By ID and slug
- [OK] `uploadMod` - With and without thumbnail
- [OK] `updateMod` - All update scenarios
- [OK] `deleteMod` - Delete operations
- [OK] `uploadVersion` - Version uploads

#### Admin Operations
- [OK] `listAllMods` - Admin list with filters
- [OK] `getModReview` - Review data retrieval
- [OK] `updateModStatus` - Status updates with/without reason
- [OK] `addReviewComment` - Comment creation
- [OK] `adminDeleteMod` - Admin delete operations

#### Ratings
- [OK] `getModRatings` - Rating retrieval
- [OK] `submitModRating` - With and without comment

#### User Management
- [OK] `listUsers` - User listing with filters
- [OK] `getUserDetails` - User detail retrieval
- [OK] `updateUser` - User updates
- [OK] `getUserMods` - User's mods listing

#### Permissions
- [OK] `checkUploadPermission` - Permission checking

#### Settings
- [OK] `getAdminSettings` - Settings retrieval
- [OK] `updateAdminSettings` - Settings updates

#### Downloads
- [OK] `downloadVersion` - File downloads with error handling

#### R2 Management
- [OK] `listR2Files` - File listing with date transformation
- [OK] `detectDuplicates` - Duplicate detection with date transformation
- [OK] `deleteR2File` - Single file deletion with URL encoding
- [OK] `bulkDeleteR2Files` - Bulk deletion with error handling

### Edge Cases Tested
- [OK] Missing optional parameters
- [OK] URL encoding for special characters
- [OK] Date string to Date object transformation
- [OK] Error responses and error handling
- [OK] Token expiration and logout events
- [OK] FormData creation for file uploads
- [OK] Query parameter building

## Adding New Tests

When adding new API functions:

1. **Add unit test** in `api.test.ts`:
   - Mock the API client
   - Test all parameter combinations
   - Test response transformation
   - Test error cases

2. **Add integration test** in `api.integration.test.ts`:
   - Test actual API framework integration
   - Test token handling
   - Test request/response flow

3. **Verify coverage**:
   ```bash
   pnpm test:api:coverage
   ```

4. **Ensure 100% coverage** before committing

## Troubleshooting

### Tests failing with "Cannot find module"
- Run `pnpm install` to ensure all dependencies are installed
- Check that `@strixun/api-framework` is properly linked (workspace dependency)

### Coverage below 100%
- Check coverage report: `pnpm test:api:coverage`
- Open `coverage/index.html` in browser to see uncovered lines
- Add tests for any uncovered code paths

### Integration tests failing
- Ensure API framework is properly mocked
- Check that fetch is properly mocked in test setup
- Verify localStorage mocks are working correctly

