# OTP Auth Service - JWT Encryption Analysis

**Date:** 2025-01-XX  
**Purpose:** Analyze which public endpoints can require JWT encryption vs. which must remain unencrypted for authentication flow

---

## 🔴 CRITICAL: Chicken-and-Egg Problem

**The Problem:** Authentication endpoints that **GENERATE** JWT tokens cannot require a JWT token to call them. This is a fundamental architectural constraint.

**Example:**
- User calls `/auth/verify-otp` with OTP code
- Server verifies OTP and **generates a JWT token**
- Server returns JWT token in response: `{ access_token: "jwt_token_here", ... }`
- **If we encrypt this response with JWT, user needs a JWT to decrypt it... but they don't have one yet!**

---

## Endpoint Analysis

### ✅ **MUST REMAIN PUBLIC (No JWT Encryption Required)**

These endpoints are part of the authentication flow and **generate JWT tokens**. They cannot require JWT encryption.

#### 1. `/auth/request-otp` (POST)
- **Purpose:** Request OTP code to be sent to email
- **Returns:** `{ success: true, expiresIn: 600, remaining: 2 }`
- **JWT in Response:** ❌ No
- **Can Require JWT?** ❌ **NO** - User doesn't have JWT yet
- **Recommendation:** Keep public, but encrypt response if JWT is provided (optional encryption)

#### 2. `/auth/verify-otp` (POST) ⚠️ **CRITICAL**
- **Purpose:** Verify OTP code and **GENERATE JWT token**
- **Returns:** 
  ```json
  {
    "access_token": "eyJhbGc...",  // ← JWT TOKEN HERE!
    "token": "eyJhbGc...",          // ← JWT TOKEN HERE!
    "token_type": "Bearer",
    "expires_in": 25200,
    "userId": "user_abc123",
    "email": "user@example.com"
  }
  ```
- **JWT in Response:** ✅ **YES - THIS IS THE PROBLEM!**
- **Can Require JWT?** ❌ **NO - CHICKEN-AND-EGG PROBLEM**
- **Recommendation:** **MUST remain unencrypted. Use `requireJWT: false` option.**

#### 3. `/auth/restore-session` (POST)
- **Purpose:** Restore session from IP address (SSO feature)
- **Returns:** May return JWT token if session found
- **JWT in Response:** ✅ Possibly
- **Can Require JWT?** ❌ **NO** - User may not have JWT yet
- **Recommendation:** Keep public, use `requireJWT: false`

#### 4. `/signup` (POST)
- **Purpose:** Initiate signup process, sends OTP
- **Returns:** `{ success: true, message: "Check your email for OTP" }`
- **JWT in Response:** ❌ No
- **Can Require JWT?** ❌ **NO** - User doesn't have account yet
- **Recommendation:** Keep public, but encrypt response if JWT is provided (optional encryption)

#### 5. `/signup/verify` (POST)
- **Purpose:** Verify signup OTP and create account
- **Returns:** May return JWT token or redirect to login
- **JWT in Response:** ✅ Possibly
- **Can Require JWT?** ❌ **NO** - User doesn't have account yet
- **Recommendation:** Keep public, use `requireJWT: false` if JWT is returned

---

### 🟡 **CAN REQUIRE JWT (But May Need Special Handling)**

These endpoints don't generate JWTs, but may be called before user has JWT.

#### 6. `/health`, `/health/ready`, `/health/live` (GET)
- **Purpose:** Health checks for monitoring
- **Returns:** Service status
- **JWT in Response:** ❌ No
- **Can Require JWT?** ✅ **YES** - But monitoring tools may not have JWT
- **Recommendation:** 
  - **Option A:** Require JWT (consistent with other services)
  - **Option B:** Allow without JWT for monitoring tools (use `requireJWT: false`)
  - **My Recommendation:** **Option A** - Monitoring tools can use a service JWT

#### 7. `/openapi.json` (GET)
- **Purpose:** API documentation
- **Returns:** OpenAPI specification JSON
- **JWT in Response:** ❌ No
- **Can Require JWT?** ✅ **YES** - Documentation can require JWT
- **Recommendation:** Require JWT encryption

#### 8. `/track/email-open` (GET)
- **Purpose:** Email tracking pixel (1x1 image)
- **Returns:** 1x1 transparent PNG/GIF
- **JWT in Response:** ❌ No
- **Can Require JWT?** ⚠️ **PROBLEMATIC** - Email clients can't send JWT headers
- **Recommendation:** **MUST remain public** - Email tracking pixels cannot include auth headers

---

### 🟢 **SHOULD REQUIRE JWT (Static Assets)**

These endpoints serve static assets. They can require JWT, but clients need to decrypt binary responses.

#### 9. `/` (Landing Page) (GET)
- **Purpose:** Serve landing page HTML
- **Returns:** HTML content
- **JWT in Response:** ❌ No
- **Can Require JWT?** ✅ **YES** - But first-time visitors won't have JWT
- **Recommendation:** 
  - **Option A:** Require JWT (consistent with security hardening)
  - **Option B:** Allow without JWT for first-time visitors (use `requireJWT: false`)
  - **My Recommendation:** **Option B** - Landing page should be accessible to new users

#### 10. `/dashboard` (GET)
- **Purpose:** Serve dashboard SPA HTML
- **Returns:** HTML content
- **JWT in Response:** ❌ No
- **Can Require JWT?** ✅ **YES** - Dashboard is for authenticated users
- **Recommendation:** Require JWT encryption (binary encryption for HTML)

#### 11. `/assets/**` (GET)
- **Purpose:** Serve static assets (JS, CSS, images)
- **Returns:** Binary assets
- **JWT in Response:** ❌ No
- **Can Require JWT?** ✅ **YES** - But assets are loaded by HTML pages
- **Recommendation:** 
  - **Option A:** Require JWT (consistent with security hardening)
  - **Option B:** Allow without JWT if referenced from authenticated pages
  - **My Recommendation:** **Option A** - Assets should be encrypted if they're part of authenticated dashboard

---

## Recommended Implementation Strategy

### Phase 1: Authentication Endpoints (MUST Remain Public)

```typescript
// These endpoints MUST use requireJWT: false
const AUTH_ENDPOINTS_NO_JWT = [
  '/auth/request-otp',
  '/auth/verify-otp',      // ⚠️ CRITICAL - Returns JWT token
  '/auth/restore-session',
  '/signup',
  '/signup/verify'
];

// In router or middleware:
if (AUTH_ENDPOINTS_NO_JWT.includes(path)) {
  return await wrapWithEncryption(response, auth, request, env, { 
    requireJWT: false  // ⚠️ Exception for auth endpoints
  });
}
```

### Phase 2: Special Cases

```typescript
// Email tracking - MUST remain public (email clients can't send headers)
if (path === '/track/email-open') {
  return response; // No encryption, no JWT required
}

// Landing page - Allow without JWT for first-time visitors
if (path === '/' || path === '') {
  return await wrapWithEncryption(response, auth, request, env, { 
    requireJWT: false  // Allow first-time visitors
  });
}
```

### Phase 3: Standard Endpoints (Require JWT)

```typescript
// All other endpoints require JWT encryption
// Health checks, OpenAPI, dashboard, assets
return await wrapWithEncryption(response, auth, request, env);
// Default: requireJWT: true
```

---

## Summary Table

| Endpoint | Method | JWT in Response | Can Require JWT? | Recommendation |
|----------|--------|-----------------|------------------|----------------|
| `/auth/request-otp` | POST | ❌ No | ❌ **NO** | `requireJWT: false` |
| `/auth/verify-otp` | POST | ✅ **YES** | ❌ **NO** ⚠️ | `requireJWT: false` **CRITICAL** |
| `/auth/restore-session` | POST | ✅ Possibly | ❌ **NO** | `requireJWT: false` |
| `/signup` | POST | ❌ No | ❌ **NO** | `requireJWT: false` |
| `/signup/verify` | POST | ✅ Possibly | ❌ **NO** | `requireJWT: false` |
| `/health` | GET | ❌ No | ✅ Yes | `requireJWT: true` (or false for monitoring) |
| `/health/ready` | GET | ❌ No | ✅ Yes | `requireJWT: true` (or false for monitoring) |
| `/health/live` | GET | ❌ No | ✅ Yes | `requireJWT: true` (or false for monitoring) |
| `/openapi.json` | GET | ❌ No | ✅ Yes | `requireJWT: true` |
| `/track/email-open` | GET | ❌ No | ❌ **NO** ⚠️ | **No encryption** (email clients) |
| `/` (landing) | GET | ❌ No | ⚠️ Maybe | `requireJWT: false` (first-time visitors) |
| `/dashboard` | GET | ❌ No | ✅ Yes | `requireJWT: true` (binary encryption) |
| `/assets/**` | GET | ❌ No | ✅ Yes | `requireJWT: true` (binary encryption) |

---

## Security Considerations

### ✅ **Safe to Encrypt (Even Without JWT)**
- Responses that don't contain sensitive data
- Responses that don't contain JWT tokens
- Static assets (if we handle binary encryption properly)

### ❌ **MUST NOT Require JWT**
- Endpoints that **generate** JWT tokens (`/auth/verify-otp`)
- Endpoints called by email clients (`/track/email-open`)
- Endpoints for first-time visitors (`/`, `/signup`)

### ⚠️ **Special Cases**
- Health checks: Can require JWT, but monitoring tools may need exception
- Landing page: Should be accessible to new users
- Assets: Can require JWT if loaded by authenticated pages

---

## Implementation Notes

1. **Use `requireJWT: false` option** for authentication endpoints that generate JWTs
2. **Email tracking pixel** must remain completely public (no encryption, no JWT)
3. **Landing page** can use `requireJWT: false` to allow first-time visitors
4. **Dashboard and assets** should require JWT (users are authenticated by this point)
5. **Health checks** can require JWT (monitoring tools can use service JWT)

---

## Conclusion

**5 endpoints MUST remain public (no JWT required):**
1. `/auth/request-otp` - Part of auth flow
2. `/auth/verify-otp` - **CRITICAL** - Generates JWT token
3. `/auth/restore-session` - May return JWT
4. `/signup` - Part of signup flow
5. `/signup/verify` - May return JWT
6. `/track/email-open` - Email clients can't send headers

**All other endpoints can and should require JWT encryption.**
