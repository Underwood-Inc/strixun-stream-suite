# Authentication & SSO Architecture Audit Report

**Date:** 2026-01-13  
**Auditor:** AI Assistant (Wise Sage/Black Sailor Persona)  
**Scope:** Complete authentication and SSO architecture analysis  
**Status:** COMPREHENSIVE AUDIT COMPLETE

---

## Executive Summary

This audit examines the authentication and Single Sign-On (SSO) architecture across the codebase. The system implements a sophisticated multi-tenant authentication system with HttpOnly cookie-based SSO, JWT token management, and inter-tenant session sharing controls.

**Overall Assessment:** The architecture is **well-designed and secure**, with proper separation of concerns between authentication (JWT) and tenant identification (API keys). However, several inconsistencies and potential improvements were identified.

---

## 1. Architecture Overview

### 1.1 Core Components

The authentication system consists of:

1. **OTP Auth Service** (`serverless/otp-auth-service/`)
   - Primary authentication service
   - Handles OTP generation, verification, JWT creation
   - Manages HttpOnly cookie SSO
   - Implements multi-tenant SSO scoping

2. **Authentication Flow**
   - Email-based OTP (One-Time Password)
   - JWT token generation with 7-hour expiration
   - HttpOnly cookie storage for browser-based SSO
   - Authorization header support for service-to-service calls

3. **Multi-Tenant Architecture**
   - API keys for tenant identification (NOT authentication)
   - SSO scope validation for inter-tenant session sharing
   - Customer isolation at KV storage level

### 1.2 Key Design Principles

✓ **Separation of Concerns**
- API keys = Tenant identification (multi-tenancy, rate limiting, data isolation)
- JWT tokens = Authentication (security, encryption, session management)
- SSO config = Authorization (which keys can share sessions)

✓ **Security First**
- HttpOnly cookies prevent XSS attacks
- JWT signature validation
- Token blacklisting on logout
- Session expiration (7 hours)
- Device fingerprinting

✓ **Backwards Compatibility**
- Supports both HttpOnly cookies (browser) and Authorization header (service-to-service)
- API keys optional (backward compatible)
- Default SSO config enables global SSO

---

## 2. Authentication Flow Analysis

### 2.1 OTP Request Flow

**Endpoint:** `POST /auth/request-otp`

**Flow:**
1. Client sends email address
2. Service validates email format
3. Checks rate limits (3 requests per email per hour)
4. Generates 9-digit OTP
5. Stores OTP in KV with 10-minute TTL
6. Sends email via Resend
7. Returns success response

**Status:** ✓ **CORRECTLY IMPLEMENTED**

**Location:** `serverless/otp-auth-service/handlers/auth/request-otp.ts`

### 2.2 OTP Verification Flow

**Endpoint:** `POST /auth/verify-otp`

**Flow:**
1. Client sends email + OTP code
2. Service validates OTP from KV
3. Creates/retrieves customer account
4. Generates JWT token with SSO scope
5. Stores session in KV
6. Sets HttpOnly cookies for all root domains
7. Returns token response (OAuth 2.0 format)

**Status:** ✓ **CORRECTLY IMPLEMENTED**

**Key Features:**
- Extracts API key ID for SSO scoping (if present)
- Sets cookies for all root domains from `ALLOWED_ORIGINS`
- Includes `keyId` and `ssoScope` in JWT payload
- Does NOT return OTP email in response (security)

**Location:** `serverless/otp-auth-service/handlers/auth/verify-otp.ts`

### 2.3 Session Management

**Endpoints:**
- `GET /auth/me` - Get current customer info
- `POST /auth/logout` - Logout and clear session
- `POST /auth/refresh` - Refresh token

**Status:** ⚠️ **MOSTLY CORRECT, WITH ISSUES**

#### 2.3.1 `/auth/me` Endpoint

**Implementation:** ✓ **CORRECT**

- Only checks HttpOnly cookie (no Authorization header fallback)
- Verifies session exists in KV
- Checks session expiration
- Returns ONLY JWT payload data (no service calls)
- Does NOT return OTP email

**Location:** `serverless/otp-auth-service/handlers/auth/session.ts:50-206`

#### 2.3.2 `/auth/logout` Endpoint

**Implementation:** ✓ **CORRECT**

- Extracts JWT from HttpOnly cookie
- Blacklists token in KV
- Deletes session from KV
- Clears HttpOnly cookies for all root domains
- Handles browser security (can only clear cookies for matching domains)

**Location:** `serverless/otp-auth-service/handlers/auth/session.ts:212-388`

#### 2.3.3 `/auth/refresh` Endpoint

**Implementation:** ⚠️ **INCONSISTENT WITH SSO ARCHITECTURE**

**Issues Found:**

1. **Token Source Inconsistency**
   - Currently expects token in request body: `{ token: string }`
   - Should extract from HttpOnly cookie (like `/auth/me` and `/auth/logout`)
   - Documentation says it "sets a new HttpOnly cookie" but doesn't actually set cookies

2. **Missing Cookie Setting**
   - Does NOT set HttpOnly cookies in response
   - Only returns token in JSON body
   - Breaks SSO flow (other apps won't get refreshed token)

3. **SSO Scope Preservation**
   - Does NOT preserve `ssoScope` from original token
   - Does NOT preserve `keyId` from original token
   - May break inter-tenant SSO after refresh

**Location:** `serverless/otp-auth-service/handlers/auth/session.ts:394-502`

**Recommendation:**
```typescript
// Should extract token from cookie first, then fall back to body
const cookieHeader = request.headers.get('Cookie');
let token: string | null = null;
if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    const authCookie = cookies.find(c => c.startsWith('auth_token='));
    if (authCookie) {
        token = authCookie.substring('auth_token='.length).trim();
    }
}
// Fall back to body if no cookie
if (!token) {
    const body = await request.json() as { token?: string };
    token = body.token;
}

// After creating new token, preserve SSO scope and keyId
const newTokenPayload = {
    // ... existing fields ...
    keyId: payload.keyId, // PRESERVE
    ssoScope: payload.ssoScope, // PRESERVE
};

// Set HttpOnly cookies (like verify-otp does)
const setCookieHeaders = createCookieHeaders(newToken, env, request);
for (const cookieValue of setCookieHeaders) {
    response.headers.append('Set-Cookie', cookieValue);
}
```

---

## 3. SSO Implementation Analysis

### 3.1 HttpOnly Cookie SSO

**Implementation:** ✓ **CORRECTLY IMPLEMENTED**

**How It Works:**
1. On login (`/auth/verify-otp`), service sets HttpOnly cookies for all root domains
2. Cookies are set with:
   - `Domain=.idling.app` (or other root domain)
   - `HttpOnly` (prevents JavaScript access)
   - `Secure` (HTTPS only in production)
   - `SameSite=Lax` (CSRF protection)
   - `Path=/` (available to all routes)
   - `Max-Age=25200` (7 hours)

3. Browser automatically sends cookies to all subdomains
4. Other apps can call `/auth/me` to validate session

**Location:** `serverless/otp-auth-service/handlers/auth/verify-otp.ts:386-460`

**Cookie Domain Logic:**
- Extracts root domains from `env.ALLOWED_ORIGINS`
- Sets cookies for all matching root domains
- Handles browser security (can only set cookies for response origin's domain)

**Location:** `serverless/otp-auth-service/utils/cookie-domains.ts`

### 3.2 Inter-Tenant SSO (Multi-Tenant)

**Implementation:** ✓ **CORRECTLY IMPLEMENTED**

**Architecture:**
1. API keys have SSO configuration (`SSOConfig`)
2. JWT tokens include `keyId` and `ssoScope` in payload
3. On authentication, system validates if requesting API key can use session

**SSO Isolation Modes:**
- `none` + `globalSsoEnabled: true` → `ssoScope: ['*']` (all keys)
- `selective` → `ssoScope: [keyId, ...allowedKeyIds]`
- `complete` → `ssoScope: [keyId]` (only this key)

**Validation Flow:**
1. Request arrives with JWT (cookie) + API key (header)
2. Extract `keyId` from API key
3. Extract `ssoScope` from JWT payload
4. Validate: `requestingKeyId in ssoScope || ssoScope.includes('*')`
5. Deny if not authorized

**Location:** `serverless/otp-auth-service/router/auth-routes.ts:85-158`

**Status:** ✓ **CORRECTLY IMPLEMENTED**

### 3.3 SSO Scope Creation

**Implementation:** ✓ **CORRECTLY IMPLEMENTED**

**Location:** `serverless/otp-auth-service/handlers/auth/jwt-creation.ts:149-180`

**Flow:**
1. Extract API key ID from request (if present)
2. Retrieve API key's SSO config from KV
3. Build `ssoScope` array based on isolation mode
4. Include `keyId` and `ssoScope` in JWT payload

**Status:** ✓ **CORRECT**

---

## 4. Security Analysis

### 4.1 Token Storage

**Status:** ✓ **SECURE**

- HttpOnly cookies prevent XSS attacks
- Secure flag ensures HTTPS-only transmission
- SameSite=Lax provides CSRF protection
- No localStorage/sessionStorage usage (correct)

### 4.2 Token Validation

**Status:** ✓ **SECURE**

- JWT signature verification
- Expiration checking
- Session existence validation (prevents use after logout)
- Token blacklisting on logout

### 4.3 Session Management

**Status:** ✓ **SECURE**

- 7-hour expiration
- Session stored in KV with TTL
- Device fingerprinting for enhanced security
- IP address tracking

### 4.4 API Key Security

**Status:** ✓ **SECURE**

- API keys stored as SHA-256 hashes
- Encrypted keys for retrieval (AES-256)
- Customer isolation at KV level
- Origin validation for browser requests
- IP allowlist support

### 4.5 SSO Security

**Status:** ✓ **SECURE**

- SSO scope validation prevents unauthorized session sharing
- Customer isolation (sessions can't cross customer boundaries)
- API key ownership validation
- JWT signature validation before SSO check

---

## 5. Issues and Inconsistencies Found

### 5.1 Critical Issues

#### Issue #1: Refresh Token Endpoint Inconsistency

**Severity:** HIGH

**Problem:**
- `/auth/refresh` expects token in request body instead of HttpOnly cookie
- Does NOT set HttpOnly cookies in response
- Does NOT preserve SSO scope and keyId

**Impact:**
- Breaks SSO flow after token refresh
- Other apps won't receive refreshed token
- Inter-tenant SSO may break after refresh

**Location:** `serverless/otp-auth-service/handlers/auth/session.ts:394-502`

**Recommendation:**
- Extract token from HttpOnly cookie first (like `/auth/me`)
- Set HttpOnly cookies in response (like `/auth/verify-otp`)
- Preserve `keyId` and `ssoScope` from original token

#### Issue #2: Authorization Header Support Inconsistency

**Severity:** MEDIUM

**Problem:**
- `/auth/me` ONLY checks HttpOnly cookie (no Authorization header fallback)
- Other services (customer-api, mods-api, access-service) support BOTH cookie and Authorization header
- Documentation mentions Authorization header support but `/auth/me` doesn't implement it

**Impact:**
- Service-to-service calls to `/auth/me` will fail
- Inconsistent behavior across endpoints

**Location:** `serverless/otp-auth-service/handlers/auth/session.ts:50-206`

**Current Implementation:**
```typescript
// ONLY checks cookie - no Authorization header
const cookieHeader = request.headers.get('Cookie');
if (!cookieHeader) {
    return new Response(JSON.stringify({ error: 'Authentication required (HttpOnly cookie)' }), {
        status: 401,
    });
}
```

**Other Services:**
```typescript
// PRIORITY 1: Check HttpOnly cookie
// PRIORITY 2: Check Authorization header
let token: string | null = null;
const cookieHeader = request.headers.get('Cookie');
if (cookieHeader) {
    // Extract from cookie
}
if (!token) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring('Bearer '.length).trim();
    }
}
```

**Recommendation:**
- Add Authorization header fallback to `/auth/me` for service-to-service compatibility
- Maintain cookie-first priority (SSO is primary use case)

### 5.2 Medium Issues

#### Issue #3: SSO Scope Not Preserved on Refresh

**Severity:** MEDIUM

**Problem:**
- `/auth/refresh` creates new token but doesn't preserve `ssoScope` and `keyId`
- May break inter-tenant SSO after refresh

**Location:** `serverless/otp-auth-service/handlers/auth/session.ts:445-452`

**Current Code:**
```typescript
const newTokenPayload = {
    sub: customerId,
    email: payload.email,
    customerId: customerId,
    csrf: newCsrfToken,
    exp: Math.floor(expiresAt.getTime() / 1000),
    iat: Math.floor(Date.now() / 1000),
    // MISSING: keyId, ssoScope
};
```

**Recommendation:**
```typescript
const newTokenPayload = {
    // ... existing fields ...
    keyId: payload.keyId || null, // PRESERVE
    ssoScope: payload.ssoScope || [], // PRESERVE
};
```

#### Issue #4: Cookie Domain Filtering Logic

**Severity:** LOW

**Problem:**
- Cookie domain filtering in `verify-otp.ts` and `logout.ts` is duplicated
- Logic is complex and could be extracted to utility function

**Location:**
- `serverless/otp-auth-service/handlers/auth/verify-otp.ts:394-421`
- `serverless/otp-auth-service/handlers/auth/session.ts:222-247`

**Recommendation:**
- Extract cookie domain filtering to `utils/cookie-domains.ts`
- Create `getCookieDomainsForRequest(request, env)` function

### 5.3 Low Issues

#### Issue #5: Documentation Inconsistencies

**Severity:** LOW

**Problem:**
- Some documentation mentions Authorization header support for `/auth/me`
- Refresh endpoint documentation says it "sets HttpOnly cookie" but doesn't
- SSO scope preservation not documented

**Recommendation:**
- Update documentation to match actual implementation
- Document refresh endpoint limitations
- Add migration guide for refresh endpoint changes

---

## 6. Architecture Compliance

### 6.1 Design Principles Adherence

✓ **Separation of Concerns**
- API keys correctly used for tenant identification only
- JWT correctly used for authentication only
- SSO config correctly used for authorization only

✓ **Security First**
- HttpOnly cookies implemented correctly
- JWT validation implemented correctly
- Token blacklisting implemented correctly
- Session expiration implemented correctly

✓ **Backwards Compatibility**
- Supports both cookie and Authorization header (except `/auth/me`)
- API keys optional
- Default SSO config enables global SSO

### 6.2 Code Quality

✓ **Type Safety**
- Proper TypeScript interfaces
- No `any` types in critical paths
- Proper error handling

✓ **Error Handling**
- RFC 7807 Problem Details format
- Proper HTTP status codes
- Fail-fast validation

✓ **Logging**
- Comprehensive logging for debugging
- Security event logging
- No sensitive data in logs (OTP email not logged)

---

## 7. Recommendations

### 7.1 Immediate Actions (High Priority)

1. **Fix Refresh Token Endpoint**
   - Extract token from HttpOnly cookie first
   - Set HttpOnly cookies in response
   - Preserve `keyId` and `ssoScope` from original token

2. **Add Authorization Header Support to `/auth/me`**
   - Add Authorization header fallback for service-to-service calls
   - Maintain cookie-first priority

### 7.2 Short-Term Improvements (Medium Priority)

3. **Extract Cookie Domain Logic**
   - Create utility function for cookie domain filtering
   - Reduce code duplication

4. **Update Documentation**
   - Document refresh endpoint behavior
   - Document SSO scope preservation
   - Update API documentation

### 7.3 Long-Term Enhancements (Low Priority)

5. **Add Refresh Token Tests**
   - Test SSO scope preservation
   - Test cookie setting on refresh
   - Test inter-tenant SSO after refresh

6. **Consider Refresh Token Rotation**
   - Implement refresh token rotation for enhanced security
   - Blacklist old tokens on refresh

---

## 8. Refresh Token Endpoint Analysis

### 8.1 Is the Refresh Token Endpoint Needed?

**Answer: NO - The refresh token endpoint is NOT needed for HttpOnly cookie-based SSO.**

**Evidence from mods-hub (working SSO implementation):**

1. **mods-hub does NOT use `/auth/refresh`**
   - All authentication relies on HttpOnly cookies
   - Uses `credentials: 'include'` on all fetch requests
   - Browser automatically sends cookies with every request

2. **How mods-hub handles SSO:**
   ```typescript
   // mods-hub/src/services/authConfig.ts
   export const sharedClientConfig = {
       credentials: 'include' as RequestCredentials, // Cookie sent automatically
       auth: {
           onTokenExpired: () => {
               // Just logout - no refresh attempt
               useAuthStore.getState().logout();
           },
       },
   };
   ```

3. **Authentication check:**
   ```typescript
   // packages/auth-store/core/api.ts
   export async function fetchCustomerInfo() {
       // Just calls /auth/me with credentials: 'include'
       // Cookie is sent automatically by browser
       const authResponse = await authClient.get('/auth/me', undefined, {
           credentials: 'include',
       });
   }
   ```

### 8.2 Why Refresh Endpoint Exists (Legacy)

The `/auth/refresh` endpoint appears to be **legacy code from when tokens were stored in localStorage**:

- **Old flow (localStorage):**
  1. Token stored in localStorage
  2. Token expires after 7 hours
  3. Need to call `/auth/refresh` to get new token
  4. Update localStorage with new token

- **New flow (HttpOnly cookies):**
  1. Token stored in HttpOnly cookie (set by `/auth/verify-otp`)
  2. Browser automatically sends cookie with every request
  3. Token expires after 7 hours
  4. When expired, user just logs in again (no refresh needed)

### 8.3 Recommendation

**Option 1: Remove Refresh Endpoint (Recommended)**
- Not used by any working SSO implementation (mods-hub)
- Adds complexity without benefit
- HttpOnly cookies don't need manual refresh
- When token expires, user logs in again (simple flow)

**Option 2: Fix Refresh Endpoint (If Needed for Service-to-Service)**
- Only needed if service-to-service calls need token refresh
- Should extract token from Authorization header (not body)
- Should preserve SSO scope and keyId
- Should set HttpOnly cookies if called from browser

**Current Status:** Refresh endpoint is **unused and unnecessary** for browser-based SSO.

---

## 9. Conclusion

The authentication and SSO architecture is **well-designed and secure**, with proper separation of concerns and comprehensive security measures. The HttpOnly cookie-based SSO implementation is correct, and the inter-tenant SSO scoping system is sophisticated and well-implemented.

**Key Strengths:**
- ✓ Secure token storage (HttpOnly cookies)
- ✓ Proper JWT validation
- ✓ Multi-tenant SSO scoping
- ✓ Customer isolation
- ✓ Comprehensive security measures
- ✓ **Working SSO implementation in mods-hub (proven)**

**Key Issues:**
- ⚠️ Refresh token endpoint is unused and unnecessary (legacy code)
- ⚠️ Authorization header support missing in `/auth/me` (for service-to-service)
- ⚠️ SSO scope not preserved on refresh (if refresh endpoint is kept)

**Overall Grade:** **A-** (Excellent architecture with minor inconsistencies)

The identified issues are fixable and don't represent fundamental architectural flaws. The system is production-ready with the recommended fixes applied.

**Key Finding:** The refresh token endpoint is **legacy code** and can be removed or deprecated. mods-hub (the only known working SSO instance) does NOT use it and relies entirely on HttpOnly cookies with automatic browser cookie handling.

---

**Report End**

**Next Steps:**
1. Review this audit report
2. **Consider removing or deprecating `/auth/refresh` endpoint** (not used by working SSO)
3. Add Authorization header support to `/auth/me` (for service-to-service compatibility)
4. Re-audit after fixes are applied
