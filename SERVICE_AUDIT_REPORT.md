# Service Configuration Audit Report
**Date:** 2026-01-11
**Issue:** Customer API not returning integrity headers; URL shortener not getting display names

---

## CRITICAL FINDINGS

### 1. **Customer API - BROKEN INTEGRITY HEADERS**

**Issue:** Customer API router uses `wrapWithEncryption` which dynamically imports `wrapResponseWithIntegrity` from `@strixun/service-client`, but when wrangler deploys raw TypeScript (`worker.ts`), the dynamic import fails at runtime.

**Configuration:**
- ✅ `wrangler.toml`: `main = "dist/worker.js"` (CORRECT - uses built worker)
- ✅ `package.json`: Has `@strixun/service-client` dependency
- ✅ `package.json`: Has `build:worker` script
- ✅ `package.json`: Has `predeploy` script to auto-build

**Root Cause:** Even though the config is correct NOW, the **deployed version was built WITHOUT `@strixun/service-client` in package.json**. The workflow added the build step, but it built the old code before I added the dependency back.

**Status:** ❌ **NEEDS REDEPLOY** after dependency was added

---

### 2. **URL Shortener - MISSING SERVICE-CLIENT DEPENDENCY**

**Issue:** URL shortener uses `fetchDisplayNameByCustomerId` from `@strixun/api-framework`, which internally calls Customer API. Customer API requires service calls to have integrity headers, but URL shortener can't add them without `@strixun/service-client`.

**Configuration:**
- ❌ `wrangler.toml`: `main = "worker.ts"` (uses raw TypeScript)
- ❌ `package.json`: **MISSING** `@strixun/service-client` dependency
- ❌ `package.json`: No `build:worker` script
- ❌ Uses `fetchDisplayNameByCustomerId` which needs service-client

**Root Cause:** `fetchDisplayNameByCustomerId` in `@strixun/api-framework` must internally use `createServiceClient` to call Customer API, but URL shortener doesn't have the dependency.

**Status:** ❌ **BROKEN** - Can't get display names because Customer API rejects requests without integrity headers

---

### 3. **Mods API - MISSING BUILD CONFIGURATION**

**Issue:** Mods API calls Customer API using `@strixun/service-client` (for admin customer list), but deploys raw TypeScript without bundling dependencies.

**Configuration:**
- ❌ `wrangler.toml`: `main = "worker.ts"` (uses raw TypeScript)
- ✅ `package.json`: Has `@strixun/service-client` dependency
- ❌ `package.json`: No `build:worker` script
- ❌ Uses `createServiceClient` directly in `handlers/admin/customers.ts`

**Root Cause:** Wrangler's internal bundler at deploy time handles this, BUT it's inconsistent with Customer API's approach and may have issues with dynamic imports.

**Status:** ⚠️ **WORKING BUT FRAGILE** - Relies on wrangler's internal bundling

---

### 4. **OTP Auth Service - MISSING BUILD CONFIGURATION**

**Issue:** OTP Auth Service calls Customer API for display names and customer creation, but deploys raw TypeScript.

**Configuration:**
- ❌ `wrangler.toml`: `main = "worker.ts"` (uses raw TypeScript)
- ✅ `package.json`: Has `@strixun/service-client` dependency
- ✅ `package.json`: Has `build:worker` script (for tests only)
- ❌ No `predeploy` script

**Root Cause:** Same as Mods API - relies on wrangler's internal bundling.

**Status:** ⚠️ **WORKING BUT FRAGILE**

---

### 5. **Access Service - MISSING BUILD CONFIGURATION**

**Issue:** Access Service doesn't call Customer API directly, but test setup uses service-client.

**Configuration:**
- ❌ `wrangler.toml`: `main = "worker.ts"` (uses raw TypeScript)
- ❌ `package.json`: **MISSING** `@strixun/service-client` dependency
- ✅ `package.json`: Has `build:test` script (test builds)
- ❌ No `predeploy` script

**Root Cause:** Access Service may need service-client for future features or testing.

**Status:** ⚠️ **POTENTIALLY BROKEN** - Tests may fail due to missing dependency

---

### 6. **Game API, Twitch API, Chat Signaling - NOT AUDITED**

**Configuration:**
- All use `main = "worker.ts"` (raw TypeScript)
- None have `@strixun/service-client`
- May or may not need Customer API integration

**Status:** ⚠️ **UNKNOWN** - Need to check if they call Customer API

---

## ARCHITECTURE PROBLEMS

### Problem 1: Inconsistent Build Strategy

**Current State:**
- Customer API: Builds to `dist/worker.js`, deploys built file
- All others: Deploy raw `worker.ts`, rely on wrangler's internal bundling

**Impact:**
- Customer API approach is explicit and reliable
- Other services are implicit and may fail with dynamic imports

**Recommendation:** ALL services should use the Customer API pattern:
1. `wrangler.toml`: `main = "dist/worker.js"`
2. `package.json`: `build:worker` script with esbuild
3. `package.json`: `predeploy` script to auto-build
4. Workflows: Explicit build step before deploy

---

### Problem 2: Dynamic Import Failures

**Current State:**
- `wrapWithEncryption` (in `@strixun/api-framework`) dynamically imports `wrapResponseWithIntegrity` from `@strixun/service-client`
- If `@strixun/service-client` isn't bundled, import fails at runtime

**Impact:**
- Customer API can't add integrity headers
- Service-to-service calls fail with "Missing X-Strixun-Response-Integrity header"

**Recommendation:** Either:
1. All services that use `wrapWithEncryption` MUST have `@strixun/service-client` as a dependency, OR
2. Move integrity logic into `@strixun/api-framework` to avoid dynamic imports

---

### Problem 3: Missing Dependencies

**Services using Customer API but missing `@strixun/service-client`:**
1. URL Shortener (uses `fetchDisplayNameByCustomerId`)
2. Access Service (tests may use it)
3. Any service using `wrapWithEncryption` (needs it for integrity headers)

**Impact:**
- URL shortener can't get display names (fallback to "User")
- Service-to-service calls fail
- Tests fail

**Recommendation:** Audit ALL services that:
- Call Customer API (directly or via helpers like `fetchDisplayNameByCustomerId`)
- Use `wrapWithEncryption` from `@strixun/api-framework`
- Need to respond to service-to-service calls with integrity headers

ALL of these need `@strixun/service-client` as a dependency.

---

## IMMEDIATE FIXES REQUIRED

### Priority 1: Customer API (BLOCKING ALL SERVICES)
1. ✅ `package.json` has `@strixun/service-client` 
2. ✅ Workflow builds before deploy
3. ❌ **NEEDS REDEPLOY** - Current deployed version doesn't have service-client bundled

### Priority 2: URL Shortener (USER-FACING ISSUE)
1. ❌ Add `@strixun/service-client` to dependencies
2. ❌ Add `build:worker` script
3. ❌ Add `predeploy` script
4. ❌ Update `wrangler.toml` to `main = "dist/worker.js"`
5. ❌ Update workflow to build before deploy

### Priority 3: Standardize All Services
1. ❌ Mods API: Add build configuration
2. ❌ OTP Auth Service: Add predeploy script
3. ❌ Access Service: Add service-client dependency
4. ❌ Update all workflows to build before deploy

---

## ROOT CAUSE ANALYSIS

### Why Customer API is STILL Broken After 7 Deploys:

1. **Deploy 1-6:** Built without `@strixun/service-client` in package.json
2. **Deploy 7:** I added `@strixun/service-client` back, but the workflow was already building the OLD dependencies
3. **Current:** The workflow NOW has the build step AND the dependency, but hasn't been deployed yet

### Why URL Shortener Shows "User" Instead of Display Names:

1. URL shortener calls `fetchDisplayNameByCustomerId` from `@strixun/api-framework`
2. That function internally calls Customer API
3. Customer API requires integrity headers for service-to-service calls
4. URL shortener doesn't have `@strixun/service-client` so can't add integrity headers
5. Customer API rejects the request → fallback to "User"

---

## RECOMMENDED ACTIONS

### Immediate (Today):
1. **Redeploy Customer API** - The code is now correct, just needs to deploy
2. **Fix URL Shortener** - Add service-client dependency and build configuration

### Short-term (This Week):
1. **Standardize Build Process** - All services use explicit build step
2. **Audit Dependencies** - Ensure all services that need service-client have it
3. **Update Workflows** - All deploy workflows build before deploying

### Long-term (Next Sprint):
1. **Move Integrity Logic** - Consider moving it into `@strixun/api-framework` to avoid dynamic imports
2. **Integration Tests** - Add tests that verify service-to-service calls work
3. **Documentation** - Document which services need which dependencies and why

---

## FILES THAT NEED CHANGES

### URL Shortener:
- `serverless/url-shortener/package.json` - Add `@strixun/service-client`, add build scripts
- `serverless/url-shortener/wrangler.toml` - Change `main` to `dist/worker.js`
- `.github/workflows/deploy-url-shortener.yml` - Add build step (if exists)

### Mods API:
- `serverless/mods-api/package.json` - Add build scripts and predeploy
- `serverless/mods-api/wrangler.toml` - Change `main` to `dist/worker.js`
- `.github/workflows/deploy-mods-api.yml` - Add build step

### OTP Auth Service:
- `serverless/otp-auth-service/package.json` - Add predeploy script
- `serverless/otp-auth-service/wrangler.toml` - Change `main` to `dist/worker.js`
- `.github/workflows/deploy-otp-auth.yml` - Add build step

### Access Service:
- `serverless/access-service/package.json` - Add `@strixun/service-client`, add predeploy
- `serverless/access-service/wrangler.toml` - Change `main` to `dist/worker.js`
- `.github/workflows/deploy-access-service.yml` - Add build step

---

## CONCLUSION

**The core issue:** Wrangler deploys raw TypeScript files, which get bundled at deploy time. Dynamic imports in `wrapWithEncryption` fail when `@strixun/service-client` isn't available at runtime.

**The solution:** ALL services that use `wrapWithEncryption` or call Customer API MUST:
1. Have `@strixun/service-client` as a dependency
2. Build to `dist/worker.js` before deploying
3. Deploy the built file, not raw TypeScript

**The immediate blocker:** Customer API needs ONE MORE DEPLOY with the correct dependencies bundled.
