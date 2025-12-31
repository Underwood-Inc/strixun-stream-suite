# Cache Prevention - Projects Coverage

This document lists which projects have been updated with global cache prevention.

## [OK] Projects Updated

### 1. **Main Application** (`src/`)
**Status:** [OK] **Fully Updated**

**Files Changed:**
- `src/core/api/factory.ts` - Default cache disabled
- `src/core/api/client.ts` - Default cache disabled
- `src/core/api/enhanced-client.ts` - Cache manager default disabled
- `src/core/api/cache/strategies.ts` - Default strategy to `network-only`
- `vite.config.ts` - Service worker: `NetworkOnly` for all API calls

**Coverage:**
- [OK] All API calls use `createAPIClient()` with disabled cache by default
- [OK] Service worker configured to never cache API calls
- [OK] Static assets still cached (images, fonts, CDN resources)

**Impact:** All API requests in the main app will never be cached.

---

### 2. **Mods Hub** (`mods-hub/`)
**Status:** [OK] **Fully Updated**

**Files Changed:**
- `mods-hub/src/services/api.ts` - Explicitly disabled cache
- `mods-hub/src/stores/auth.ts` - Uses `createAPIClient()` (inherits defaults)

**Coverage:**
- [OK] Main API client has cache explicitly disabled
- [OK] Auth store uses `createAPIClient()` which inherits disabled cache defaults
- [OK] Download endpoint allows caching (versioned, immutable files - backend returns `Cache-Control: public, max-age=31536000`)
- [OK] No service worker (not needed - uses API framework defaults)

**Impact:** All API requests in mods-hub will never be cached, except versioned downloads which are safely cached.

---

### 3. **OTP Auth Service Dashboard** (`serverless/otp-auth-service/dashboard/` and `serverless/otp-auth-service/src/dashboard/`)
**Status:** [OK] **Covered (Inherits Defaults)**

**Files:**
- `serverless/otp-auth-service/dashboard/src/lib/api-client.ts` - Uses `createAPIClient()` without cache config
- `serverless/otp-auth-service/src/dashboard/lib/api-client.ts` - Uses `createAPIClient()` without cache config

**Coverage:**
- [OK] Uses `createAPIClient()` from `@strixun/api-framework/client`
- [OK] Inherits disabled cache defaults from the framework
- [OK] No explicit cache config = uses framework defaults (disabled)

**Impact:** All API requests in OTP dashboard will never be cached (inherits framework defaults).

---

### 4. **OTP Auth Service Backend** (`serverless/otp-auth-service/`)
**Status:** [OK] **Fully Updated**

**Files Changed:**
- `serverless/otp-auth-service/utils/cache-headers.ts` - Created cache prevention utility
- `serverless/otp-auth-service/handlers/auth/request-otp.ts` - Added cache headers
- `serverless/otp-auth-service/handlers/auth/verify-otp.ts` - Added cache headers
- `serverless/otp-auth-service/handlers/auth/restore-session.ts` - Added cache headers
- `serverless/otp-auth-service/handlers/auth/session.ts` - Added cache headers
- `serverless/otp-auth-service/handlers/auth/session-by-ip.ts` - Added cache headers

**Coverage:**
- [OK] All OTP endpoints return `Cache-Control: no-store`
- [OK] Cloudflare will not cache these responses
- [OK] Browsers will not cache these responses

**Impact:** All OTP/auth endpoints return cache prevention headers.

---

### 5. **URL Shortener App** (`serverless/url-shortener/app/`)
**Status:** [OK] **Fully Updated**

**Files Changed:**
- `serverless/url-shortener/app/src/lib/api-client.ts` - Added `cache: 'no-store'` to fetch options

**Coverage:**
- [OK] All fetch calls now include `cache: 'no-store'`
- [OK] Prevents browser and service worker caching
- [WARNING] Still uses manual `fetch()` instead of API framework (could be migrated later)

**Impact:** URL shortener API calls will never be cached.

---

### 6. **Mods API Backend** (`serverless/mods-api/`)
**Status:** [OK] **Fully Updated**

**Files Changed:**
- `serverless/mods-api/handlers/admin/users.ts` - Added `cache: 'no-store'` to service-to-service fetch
- `serverless/mods-api/handlers/admin/triage.ts` - Added `cache: 'no-store'` to service-to-service fetch calls

**Coverage:**
- [OK] All service-to-service API calls include `cache: 'no-store'`
- [OK] Prevents caching of auth service responses
- [OK] Ensures fresh user data in admin operations

**Impact:** All service-to-service API calls will never be cached.

---

### 7. **Main App Direct Fetch Calls** (`src/`)
**Status:** [OK] **Fully Updated**

**Files Changed:**
- `src/modules/version.ts` - Already had `cache: 'no-store'` [OK]
- `src/lib/components/ModrinthProductCarousel.svelte` - Added `cache: 'no-store'` to Modrinth API fetch
- `src/services/profilePicture.ts` - Added `cache: 'no-store'` to all profile picture API calls (upload, get, delete)

**Coverage:**
- [OK] All direct fetch calls include `cache: 'no-store'`
- [OK] Prevents caching of external API calls and user-specific data

**Impact:** All direct fetch calls will never be cached.

---

### 8. **Mods Hub Direct Fetch Calls** (`mods-hub/src/`)
**Status:** [OK] **Fully Updated**

**Files Changed:**
- `mods-hub/src/services/api.ts` - Added `cache: 'no-store'` to download endpoint fetch

**Coverage:**
- [OK] Download endpoint fetch includes `cache: 'no-store'`
- [OK] Prevents caching of encrypted file downloads

**Impact:** File download requests will never be cached.

---

### 9. **Control Panel** (`control-panel/`)
**Status:** [OK] **No API Calls (Not Applicable)**

**Files Checked:**
- No `api-client.ts` found
- No `createAPIClient` usage found
- No `fetch()` calls found
- Only uses `window.getWorkerApiUrl()` for configuration

**Coverage:**
- [OK] No API calls made from control panel
- [OK] Not applicable for cache prevention

**Impact:** N/A - control panel doesn't make API calls.

---

## [EMOJI] Summary

| Project | Status | Cache Prevention | Notes |
|---------|--------|------------------|-------|
| **Main App** (`src/`) | [OK] Complete | [OK] Yes | Framework defaults + service worker + direct fetch calls |
| **Mods Hub** | [OK] Complete | [OK] Yes | Explicit config + inherits defaults + direct fetch calls (downloads cached - versioned) |
| **OTP Dashboard** | [OK] Covered | [OK] Yes | Inherits framework defaults |
| **OTP Backend** | [OK] Complete | [OK] Yes | Cache headers on all endpoints |
| **URL Shortener** | [OK] Complete | [OK] Yes | Manual fetch with cache: 'no-store' |
| **Mods API Backend** | [OK] Complete | [OK] Yes | Service-to-service fetch with cache: 'no-store' |
| **Control Panel** | [OK] N/A | [OK] N/A | No API calls made |

---

## [EMOJI] How Projects Inherit Cache Prevention

### Projects Using `createAPIClient()` (Automatic)

These projects automatically get cache prevention because they use the shared API framework:

1. **Main App** - Uses `src/core/api/factory.ts`  `createAPIClient()`
2. **Mods Hub** - Uses `@strixun/api-framework/client`  `createAPIClient()`
3. **OTP Dashboard** - Uses `@strixun/api-framework/client`  `createAPIClient()`

**How it works:**
- `createAPIClient()` has `cache.enabled: false` by default
- Projects that don't set cache config inherit this default
- Projects that explicitly set cache config can override (but shouldn't for API calls)

### Projects Using Manual Fetch (Need Manual Updates)

These projects need manual cache prevention:

1. **URL Shortener** - Uses manual `fetch()`  Needs migration or manual headers

---

## [OK] Verification Checklist

- [x] Main app API client defaults updated
- [x] Main app service worker configured
- [x] Main app direct fetch calls updated (version, Modrinth, profile pictures)
- [x] Mods hub API client updated
- [x] Mods hub direct fetch calls updated (download endpoint - allows caching for versioned downloads)
- [x] OTP dashboard inherits defaults (verified)
- [x] OTP backend endpoints have cache headers
- [x] URL shortener has cache prevention (manual fetch with cache: 'no-store')
- [x] Mods API backend service-to-service calls updated
- [x] Control panel verified (no API calls)

---

## [EMOJI] Next Steps

1. **Migrate URL Shortener** to use `createAPIClient()` from API framework
2. **Audit Control Panel** to see if it needs cache prevention
3. **Test all projects** to verify cache prevention is working

---

## [EMOJI] Notes

- **Service Workers:** Only the main app has a service worker configured. Other projects rely on the API framework's cache prevention.
- **Backend Headers:** OTP backend returns cache prevention headers, which work regardless of client implementation.
- **Framework Defaults:** All projects using `createAPIClient()` automatically get cache prevention unless they explicitly override it.

