# E2E Test Fix - Working Document

**Date Started:** 2025-01-XX  
**Last Updated:** 2025-01-XX  
**Goal:** Ensure ALL e2e tests pass with three consecutive successful runs  
**Status:** In Progress

---

## Context

### Security Protocol - JWT Encryption Requirements

**CRITICAL:** JWT encryption is now mandatory for ALL endpoints. The security architecture requires:
- **Layer 1 (Base):** JWT Encryption/Decryption (MANDATORY)
- **Layer 2:** CORS (Origin restrictions)
- **Layer 3:** Authentication (JWT verification)
- **Layer 4:** Authorization (Author checks, Admin checks)

### Recent Changes Made

1. **Playwright Configuration:**
   - ✅ Updated to use Chromium only (removed Firefox, WebKit, Mobile)
   - ✅ Faster test execution for development

2. **API Framework - Binary Decryption Support:**
   - ✅ Added binary decryption to `packages/api-framework/src/utils/response-handler.ts`
   - ✅ Client now automatically decrypts binary responses when `X-Encrypted: true` header is present
   - ✅ Required for encrypted downloads (mod files, thumbnails, badges, OG images)

3. **Public Browsing Endpoints (Optional JWT - Encrypted if JWT provided):**
   - `GET /mods` - Mod list (uses `requireJWT: false`)
   - `GET /mods/:slug` - Mod detail (uses `requireJWT: false`)
   - `GET /mods/:slug/ratings` - Ratings (uses `requireJWT: false`)
   - `GET /mods/:slug/thumbnail` - Thumbnail images (binary encryption if JWT provided)
   - `GET /mods/:slug/og-image` - OG images (binary encryption if JWT provided)
   - `GET /mods/:slug/versions/:versionId/badge` - Integrity badges (binary encryption if JWT provided)

4. **Protected Endpoints (JWT Required):**
   - All download endpoints (`/mods/:slug/versions/:versionId/download`) - **MUST have JWT**
   - All upload/update/delete endpoints - **MUST have JWT**
   - All admin endpoints - **MUST have JWT**

5. **OTP Auth Endpoints (Special Case - `requireJWT: false`):**
   - `POST /auth/request-otp` - Part of auth flow (chicken-and-egg problem)
   - `POST /auth/verify-otp` - **CRITICAL** - Returns JWT token (cannot require JWT to get JWT)
   - `POST /auth/restore-session` - May return JWT

6. **Handler Updates:**
   - `serverless/mods-api/handlers/mods/thumbnail.ts` - Uses binary encryption with JWT
   - `serverless/mods-api/handlers/versions/badge.ts` - Uses binary encryption with JWT
   - `serverless/mods-api/handlers/mods/og-image.ts` - Uses binary encryption with JWT

7. **Router Updates:**
   - `serverless/mods-api/router/mod-routes.ts` - Uses `requireJWT: false` for public browsing endpoints
   - `serverless/otp-auth-service/router/auth-routes.ts` - Uses `requireJWT: false` for auth endpoints that generate JWTs

---

## Test Files Updated

### Frontend Tests (mods-hub)
- `mods-hub/src/pages/mod-list.e2e.spec.ts` - Updated to test public browsing
- `mods-hub/src/pages/mod-detail.e2e.spec.ts` - Updated to test JWT requirement for downloads
- `mods-hub/src/pages/mod-slug-uniqueness.e2e.spec.ts` - Fixed encryption removal

### Backend Tests (serverless)
- `serverless/mods-api/handlers/versions/download.e2e.spec.ts` - Updated download tests to require JWT, badge tests to allow public access

---

## Test Run History

### Run 1: [PENDING]
- **Status:** Not yet run
- **Passed:** TBD
- **Failed:** TBD
- **Skipped:** TBD
- **Notes:** TBD

### Run 2: [PENDING]
- **Status:** Not yet run
- **Passed:** TBD
- **Failed:** TBD
- **Skipped:** TBD
- **Notes:** TBD

### Run 3: [PENDING]
- **Status:** Not yet run
- **Passed:** TBD
- **Failed:** TBD
- **Skipped:** TBD
- **Notes:** TBD

---

## Known Issues & Fixes

### Issue 1: Syntax Errors in mod-slug-uniqueness.e2e.spec.ts
- **Status:** FIXED
- **Problem:** Duplicate code and leftover references
- **Fix:** Removed duplicate code blocks

### Issue 2: await import in non-async context (ModDetailPage.tsx)
- **Status:** FIXED
- **Problem:** `await import` used in render function
- **Fix:** Moved import to top level

### Issue 3: Download tests expecting public access
- **Status:** FIXED
- **Problem:** Tests expected downloads to work without JWT
- **Fix:** Updated tests to require JWT for downloads

### Issue 4: Badge tests expecting JWT requirement
- **Status:** FIXED
- **Problem:** Tests expected badges to require JWT
- **Fix:** Updated tests to allow public access to badges

### Issue 5: Download test setup not encrypting files
- **Status:** ✅ FIXED
- **Problem:** `createTestMod` in download.e2e.spec.ts not encrypting files before upload
- **Fix:** Already fixed - file encryption with JWT is implemented (lines 161-163)

### Issue 6: Middleware contentType undefined when requireJWT: false
- **Status:** ✅ FIXED
- **Problem:** `contentType` variable not defined in scope when requireJWT is false
- **Fix:** Already fixed - contentType is properly defined before use (line 333 in middleware.ts)

### Issue 7: Download tests expecting public access without JWT
- **Status:** ✅ FIXED
- **Problem:** Multiple tests expected downloads to work without JWT token
- **Fix:** Updated all download tests to require JWT authentication:
  - `should download public mod by modId without authentication` → `should require JWT token for downloads even when using modId`
  - `should include CORS headers for public downloads` → `should include CORS headers for authenticated downloads`
  - `should include file integrity hash headers` → Now requires JWT
  - `should set content-disposition header for file download` → Now requires JWT
  - `should handle decryption errors gracefully` → Now requires JWT and verifies decryption

### Issue 8: Binary responses not being decrypted by API client
- **Status:** ✅ FIXED
- **Problem:** API framework response handler only decrypted JSON responses, not binary
- **Fix:** Added binary decryption support to `packages/api-framework/src/utils/response-handler.ts`
- **Impact:** Downloads, thumbnails, badges, and OG images now properly decrypt when `X-Encrypted: true` header is present

---

## Files That May Need Updates

### Potential Issues to Check:
1. `mods-hub/src/pages/mod-thumbnail.e2e.spec.ts` - May need updates for public thumbnail access
2. `mods-hub/src/pages/mod-upload.e2e.spec.ts` - Should already require JWT
3. Any other e2e tests that call public endpoints

---

## Key Test Patterns

### Public Browsing Test Pattern:
```typescript
// Should work without JWT
const response = await fetch(`${WORKER_URLS.MODS_API}/mods`);
expect(response.ok).toBe(true);
```

### Protected Endpoint Test Pattern:
```typescript
// Should fail without JWT
const response = await fetch(`${WORKER_URLS.MODS_API}/mods/${slug}/versions/${versionId}/download`);
expect(response.status).toBe(401);

// Should succeed with JWT
const token = await getAuthToken(TEST_EMAIL);
const authResponse = await fetch(url, {
  headers: { 'Authorization': `Bearer ${token}` }
});
expect(authResponse.ok).toBe(true);
```

---

## Next Steps

1. ✅ Updated Playwright config to Chromium only
2. ✅ Added binary decryption support to API framework
3. ✅ Fixed download tests to require JWT authentication
4. ✅ Aligned documentation with current security requirements
5. ✅ Removed all encryption code from upload handler
6. ✅ Fixed test JWT tokens to include customerId
7. ✅ Fixed login e2e tests to handle fancy screen and use correct selectors
8. **TODO:** Run e2e tests (Chromium only) to verify all fixes
9. **TODO:** Identify any remaining failing tests
10. **TODO:** Fix any remaining issues
11. **TODO:** Re-run until three consecutive passes
12. **TODO:** Document all fixes

---

## Commands

```bash
# Run e2e tests (Chromium only)
cd "c:\Users\mamop\Documents\source fade script plugin"
pnpm test:e2e --project=chromium
```

---

## Environment Variables

- `E2E_TEST_EMAIL` - Test email for authentication
- `E2E_TEST_OTP_CODE` - Pre-generated OTP code for testing
- `E2E_TEST_JWT_TOKEN` - Pre-generated JWT token for testing
- `E2E_MODS_HUB_URL` - Mods Hub URL (default: http://localhost:3001)
- `E2E_MODS_API_URL` - Mods API URL (default: http://localhost:8788)

---

## Important Notes

- ✅ **Encryption uses JWT only**
- ✅ **All file uploads use JWT encryption only**
- ✅ **Public browsing endpoints use `requireJWT: false`** - responses are encrypted if JWT is provided, but JWT is not required
- ✅ **Binary responses (downloads, images, badges) are encrypted with JWT** and automatically decrypted by API client
- ✅ **API framework now handles binary decryption** - no manual decryption needed in client code
- ✅ **Downloads ALWAYS require JWT authentication**
- ✅ **OTP auth endpoints use `requireJWT: false`** - chicken-and-egg problem (can't require JWT to get JWT)
- ✅ **Playwright config updated to Chromium only** - faster test execution

## Security Architecture

```
┌─────────────────────────────────────────────────────────┐
│              SECURITY LAYER STACK                        │
├─────────────────────────────────────────────────────────┤
│ Layer 4: Authorization (Author checks, Admin checks)    │
│ Layer 3: Authentication (JWT verification)                │
│ Layer 2: CORS (Origin restrictions)                     │
│ Layer 1: JWT ENCRYPTION/DECRYPTION (MANDATORY BASE) ⚠️ │
└─────────────────────────────────────────────────────────┘
```

**Key Principles:**
1. ✅ ALL endpoints encrypt responses with JWT when JWT is provided
2. ✅ Public browsing endpoints allow access without JWT (`requireJWT: false`)
3. ✅ Protected endpoints (downloads, uploads, admin) require JWT (`requireJWT: true` default)
4. ✅ Binary files (images, downloads, scripts) use JWT binary encryption
5. ✅ JWT is the only encryption method
6. ✅ Client automatically decrypts all encrypted responses (JSON and binary)
