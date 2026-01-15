# Access Service Testing Guide

## Overview

The Access Service has comprehensive test coverage including:
- **Unit Tests**: Test individual functions and utilities
- **Integration Tests**: Test complete workflows and API endpoints
- **Security Tests**: Test authentication and authorization enforcement
- **Rate Limiting Tests**: Test rate limiting logic and enforcement

## Running Tests

### All Tests
```bash
pnpm test
```

### Unit Tests Only
```bash
pnpm test:unit
```

### Integration Tests Only
```bash
pnpm test:integration
```

### With Coverage
```bash
pnpm test:coverage
```

### Watch Mode (Development)
```bash
pnpm test:watch
```

## Test Structure

### Unit Tests

#### `utils/auth.test.ts`
Tests authentication logic:
- Service key authentication
- JWT authentication (fallback)
- Authentication requirement enforcement
- Security header validation
- Error handling

**Coverage**: 100% of authentication logic

#### `utils/rate-limit.test.ts`
Tests rate limiting:
- Sliding window algorithm
- Rate limit enforcement
- Identifier generation (service key > customer ID > IP)
- Header generation
- Error responses

**Coverage**: 100% of rate limiting logic

### Integration Tests

#### `access-service.integration.test.ts`
Tests complete workflows:
- Authentication enforcement on all endpoints
- Rate limiting enforcement
- Permission checks
- Quota management
- Role assignment
- End-to-end access control flows
- CORS handling
- Health checks

**Coverage**: All critical API paths

## Test Environment

### Environment Variables
Tests require these environment variables:
- `JWT_SECRET`: JWT signing secret (defaults to test value)
- `SERVICE_API_KEY`: Service API key for authentication (defaults to test value)

### Local Testing
```bash
# Set environment variables
export JWT_SECRET="test-jwt-secret"
export SERVICE_API_KEY="test-service-key"

# Run tests
pnpm test
```

### CI/CD Testing
Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests
- Manual workflow dispatch

See `.github/workflows/test-access-service.yml`

## Coverage Thresholds

The Access Service maintains high coverage standards:
- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 75%
- **Statements**: 80%

Coverage reports are generated in `coverage/` directory.

## Test Scenarios

### Authentication Tests
- ✅ Valid service key authentication
- ✅ Invalid service key rejection
- ✅ Missing service key rejection
- ✅ Unconfigured SERVICE_API_KEY handling
- ✅ JWT authentication (fallback)
- ✅ Unauthenticated request rejection

### Rate Limiting Tests
- ✅ Requests under limit allowed
- ✅ Requests over limit blocked
- ✅ Sliding window expiration
- ✅ Different identifiers tracked separately
- ✅ Correct remaining count calculation
- ✅ Retry-after header generation
- ✅ Identifier priority (service key > customer ID > IP)

### Integration Tests
- ✅ GET /access/:customerId (authenticated)
- ✅ POST /access/check-permission (authenticated)
- ✅ POST /access/check-quota (authenticated)
- ✅ PUT /access/:customerId/roles (authenticated)
- ✅ POST /access/:customerId/quotas/increment (authenticated)
- ✅ Rate limiting enforcement
- ✅ CORS preflight handling
- ✅ Health check (unauthenticated)
- ✅ End-to-end access control workflow

## Security Testing

### Critical Security Tests
1. **Authentication Enforcement**: All endpoints require authentication
2. **Service Key Validation**: Invalid keys are rejected
3. **Rate Limiting**: Prevents abuse and DoS attacks
4. **Secret Protection**: Secrets not leaked in responses or errors
5. **CORS**: Proper CORS headers for cross-origin requests

### Security Audit Checklist
- [x] All GET endpoints require authentication
- [x] All POST endpoints require authentication
- [x] All PUT endpoints require authentication
- [x] Rate limiting implemented
- [x] Service key validation working
- [x] No secrets leaked in responses
- [x] Proper error messages (no information disclosure)

## Continuous Integration

### GitHub Actions Workflow
File: `.github/workflows/test-access-service.yml`

**Triggers**:
- Push to main/develop
- Pull requests
- Manual dispatch

**Steps**:
1. Run unit tests
2. Run integration tests
3. Generate coverage report
4. Upload to Codecov
5. Security audit
6. Generate summary

### Coverage Reporting
Coverage reports are:
- Generated locally in `coverage/` directory
- Uploaded to Codecov in CI
- Displayed in GitHub PR comments
- Summarized in GitHub Actions summary

## Writing New Tests

### Unit Test Template
```typescript
import { describe, it, expect } from 'vitest';

describe('Feature Name', () => {
    it('should do something', () => {
        // Arrange
        const input = 'test';
        
        // Act
        const result = myFunction(input);
        
        // Assert
        expect(result).toBe('expected');
    });
});
```

### Integration Test Template
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Miniflare } from 'miniflare';

describe('Feature Integration', () => {
    let mf: Miniflare;

    beforeAll(async () => {
        mf = new Miniflare({
            scriptPath: './worker.ts',
            modules: true,
            // ... config
        });
    });

    afterAll(async () => {
        await mf.dispose();
    });

    it('should handle request', async () => {
        const response = await mf.dispatchFetch('http://localhost:8791/test');
        expect(response.status).toBe(200);
    });
});
```

## Debugging Tests

### Run Single Test File
```bash
pnpm test utils/auth.test.ts
```

### Run Single Test
```bash
pnpm test -t "should authenticate with valid service key"
```

### Debug Mode
```bash
NODE_OPTIONS='--inspect-brk' pnpm test
```

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Clear Names**: Test names should describe what they test
3. **Arrange-Act-Assert**: Follow AAA pattern
4. **Mock External Dependencies**: Don't call real services
5. **Test Edge Cases**: Test error conditions and edge cases
6. **Keep Tests Fast**: Unit tests should run in milliseconds
7. **Integration Tests**: Test real workflows, not implementation details

## Troubleshooting

### Tests Failing Locally
1. Check environment variables are set
2. Ensure dependencies are installed (`pnpm install`)
3. Clear coverage cache (`rm -rf coverage`)
4. Run tests in isolation (`pnpm test:unit` then `pnpm test:integration`)

### Coverage Not Generated
1. Ensure `@vitest/coverage-v8` is installed
2. Check `vitest.config.ts` coverage configuration
3. Run `pnpm test:coverage` explicitly

### Integration Tests Timeout
1. Increase `testTimeout` in `vitest.config.ts`
2. Check Miniflare is properly initialized
3. Ensure worker script path is correct

## Related Documentation

- [Security Audit Findings](../../__SECURITY_AUDIT_FINDINGS.md)
- [Access Service README](./README.md)
- [Quick Start Guide](./QUICK_START.md)
- [GitHub Workflow](.github/workflows/test-access-service.yml)
