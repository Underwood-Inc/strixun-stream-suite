# Test Coverage Audit - Authentication & Customer-API Integration

## Current Test Coverage

### ✓ Covered

1. **OTP Login Flow** (`otp-login-flow.integration.test.ts`)
   - ✓ Request OTP
   - ✓ Verify OTP
   - ✓ JWT token creation
   - ✓ Customer account creation during login
   - ✓ displayName generation

2. **Customer Creation** (`customer-creation.integration.test.ts`)
   - ✓ ensureCustomerAccount - create new customer
   - ✓ ensureCustomerAccount - UPSERT existing customer
   - ✓ Customer-api integration
   - ✓ displayName generation (MANDATORY)

3. **API Key System** (`api-key.integration.test.ts`)
   - ✓ API key generation during signup
   - ✓ API key authentication (Bearer header)
   - ✓ API key authentication (X-OTP-API-Key header)
   - ✓ API key usage for authenticated endpoints
   - ✓ API key management (create, list, revoke)
   - ✓ Customer isolation with API keys

### ✗ Missing Coverage

1. **Session Management** (`session.integration.test.ts` - NEW)
   - ✗ GET /auth/me - JWT-only, no customer-api calls, no email
   - ✗ POST /auth/logout - Session deletion, IP mapping cleanup
   - ✗ POST /auth/refresh - Token refresh flow
   - ✗ Fail-fast: missing customerId in JWT
   - ✗ Fail-fast: missing displayName during creation

2. **Session Restoration** (`restore-session.integration.test.ts` - NEW)
   - ✗ POST /auth/restore-session - IP-based restoration
   - ✗ Customer-api integration during restoration
   - ✗ displayName generation for missing customers

3. **Session by IP** (`session-by-ip.integration.test.ts` - NEW)
   - ✗ GET /auth/session-by-ip - IP session lookup
   - ✗ Admin authentication for specific IP queries
   - ✗ Rate limiting for session lookup

4. **JWT Creation Fail-Fast** (needs test)
   - ✗ Missing customerId throws error
   - ✗ Missing displayName throws error
   - ✗ customerId mismatch throws error

5. **Customer-API Integration Edge Cases** (needs test)
   - ✗ Customer-api failure scenarios
   - ✗ Retry logic for customer-api calls
   - ✗ Customer-api eventual consistency

6. **API Key + JWT Combinations** (needs expansion)
   - ✗ Valid JWT + invalid API key (should fail)
   - ✗ Valid JWT + valid API key (different customers - should fail)
   - ✗ Invalid JWT + valid API key (should fail - JWT required)
   - ✗ Missing JWT + valid API key (should fail - JWT required)

## Test Files Created

1. ✓ `session.integration.test.ts` - Session management tests
2. ✓ `restore-session.integration.test.ts` - Session restoration tests
3. ✓ `session-by-ip.integration.test.ts` - IP session lookup tests

## Next Steps

1. Run all integration tests to verify coverage
2. Add missing edge case tests
3. Verify 100% coverage for authentication flows
4. Verify 100% coverage for customer-api integration
