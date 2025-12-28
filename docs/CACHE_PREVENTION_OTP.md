# OTP Cache Prevention Configuration

This document explains how we prevent caching of OTP-related requests to avoid deployment issues and ensure fresh data.

## Problem

Caching of OTP authentication requests can cause:
- Stale OTP codes being accepted
- Old authentication tokens being reused
- Deployment issues where cached responses prevent new code from working
- Security issues where sensitive auth data is cached

## Solution

We've implemented comprehensive cache prevention at multiple levels:

### 1. HTTP Cache Headers (Server-Side)

All OTP endpoints now return these headers:

```
Cache-Control: no-store, no-cache, must-revalidate, private
Pragma: no-cache
Expires: 0
Surrogate-Control: no-store
```

**Implementation:** `serverless/otp-auth-service/utils/cache-headers.ts`

**Applied to:**
- `/auth/request-otp` - OTP code requests
- `/auth/verify-otp` - OTP verification
- `/auth/restore-session` - Session restoration
- `/auth/session` - Session management
- `/auth/session-by-ip` - IP-based session lookup
- `/auth/logout` - Logout
- `/auth/refresh` - Token refresh
- `/auth/me` - User info

### 2. Cloudflare Cache Bypass

**How it works:**
- Cloudflare Workers don't cache by default
- The `Cache-Control: no-store` header tells Cloudflare to never cache the response
- Cloudflare will set `CF-Cache-Status: DYNAMIC` automatically for these responses

**No additional Cloudflare configuration needed** - the headers are sufficient.

**If you need to verify:**
1. Check response headers in browser DevTools
2. Look for `CF-Cache-Status: DYNAMIC` or `BYPASS`
3. Verify `Cache-Control: no-store` is present

### 3. Service Worker Cache Bypass

**Implementation:** `vite.config.ts` - Workbox runtime caching

**Configuration:**
```javascript
{
  urlPattern: /^https:\/\/.*\/auth\/(request-otp|verify-otp|restore-session|session|session-by-ip|logout|refresh|me).*$/i,
  handler: 'NetworkOnly', // Always fetch from network, never use cache
}
```

**What this does:**
- Service worker intercepts OTP requests
- Uses `NetworkOnly` strategy = always goes to network
- Never checks cache, never stores in cache

### 4. Browser Cache Prevention

The HTTP headers prevent browser caching:
- `Cache-Control: no-store` - Don't store in any cache
- `Pragma: no-cache` - Legacy browser support
- `Expires: 0` - Immediate expiration

## Verification

### Check Response Headers

```bash
# Request OTP
curl -I https://auth.idling.app/auth/request-otp \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Should see:
# Cache-Control: no-store, no-cache, must-revalidate, private
# Pragma: no-cache
# Expires: 0
```

### Check Service Worker

1. Open browser DevTools [EMOJI] Application [EMOJI] Service Workers
2. Check that service worker is active
3. Open Network tab [EMOJI] Check "Disable cache" is NOT needed (cache is already bypassed)
4. Make OTP request [EMOJI] Verify it goes to network (not cache)

### Check Cloudflare Cache Status

In browser DevTools [EMOJI] Network tab:
- Look for `CF-Cache-Status` header in response
- Should be `DYNAMIC` or `BYPASS` (not `HIT` or `MISS`)

## Additional Cloudflare Settings (Optional)

If you want to be extra sure, you can configure Cloudflare Page Rules:

**Page Rule (if needed):**
- URL Pattern: `auth.idling.app/auth/*`
- Settings:
  - Cache Level: Bypass
  - Edge Cache TTL: Bypass

**Note:** This is usually not needed because Workers don't cache by default and our headers prevent caching.

## Troubleshooting

### Issue: Still seeing cached responses

1. **Check headers are present:**
   ```bash
   curl -I https://auth.idling.app/auth/request-otp
   ```

2. **Clear service worker cache:**
   - DevTools [EMOJI] Application [EMOJI] Service Workers [EMOJI] Unregister
   - Or: DevTools [EMOJI] Application [EMOJI] Clear storage [EMOJI] Clear site data

3. **Hard refresh browser:**
   - Ctrl+Shift+R (Windows/Linux)
   - Cmd+Shift+R (Mac)

4. **Check Cloudflare dashboard:**
   - Workers & Pages [EMOJI] otp-auth-service [EMOJI] Settings
   - Verify no cache rules are configured

### Issue: Deployment still shows old code

1. **Verify new headers are deployed:**
   ```bash
   curl -I https://auth.idling.app/auth/request-otp
   ```

2. **Check service worker is updated:**
   - Service worker version should increment on each build
   - Check `dist/sw.js` has new cache rules

3. **Force service worker update:**
   - Unregister old service worker
   - Hard refresh to register new one

## Summary

[SUCCESS] **Server-side:** All OTP endpoints return `Cache-Control: no-store`  
[SUCCESS] **Cloudflare:** Headers prevent Cloudflare from caching  
[SUCCESS] **Service Worker:** `NetworkOnly` strategy bypasses cache  
[SUCCESS] **Browser:** Headers prevent browser caching  

**Result:** OTP requests always go to the server, never use cached responses.

