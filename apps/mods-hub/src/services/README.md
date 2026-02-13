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
- ✓ Lines: 100%
- ✓ Functions: 100%
- ✓ Branches: 100%
- ✓ Statements: 100%

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
- ✓ `listMods` - With all filter combinations
- ✓ `getModDetail` - By ID and slug
- ✓ `uploadMod` - With and without thumbnail
- ✓ `updateMod` - All update scenarios
- ✓ `deleteMod` - Delete operations
- ✓ `uploadVersion` - Version uploads

#### Admin Operations
- ✓ `listAllMods` - Admin list with filters
- ✓ `getModReview` - Review data retrieval
- ✓ `updateModStatus` - Status updates with/without reason
- ✓ `addReviewComment` - Comment creation
- ✓ `adminDeleteMod` - Admin delete operations

#### Ratings
- ✓ `getModRatings` - Rating retrieval
- ✓ `submitModRating` - With and without comment

#### User Management
- ✓ `listUsers` - User listing with filters
- ✓ `getUserDetails` - User detail retrieval
- ✓ `updateUser` - User updates
- ✓ `getUserMods` - User's mods listing

#### Permissions
- ✓ `checkUploadPermission` - Permission checking

#### Settings
- ✓ `getAdminSettings` - Settings retrieval
- ✓ `updateAdminSettings` - Settings updates

#### Downloads
- ✓ `downloadVersion` - File downloads with error handling

#### R2 Management
- ✓ `listR2Files` - File listing with date transformation
- ✓ `detectDuplicates` - Duplicate detection with date transformation
- ✓ `deleteR2File` - Single file deletion with URL encoding
- ✓ `bulkDeleteR2Files` - Bulk deletion with error handling

### Edge Cases Tested
- ✓ Missing optional parameters
- ✓ URL encoding for special characters
- ✓ Date string to Date object transformation
- ✓ Error responses and error handling
- ✓ Token expiration and logout events
- ✓ FormData creation for file uploads
- ✓ Query parameter building

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

