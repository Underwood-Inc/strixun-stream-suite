# Global Cache Prevention Strategy

This document explains our global cache prevention strategy and what should/shouldn't be cached.

## Philosophy

**Default: No Caching** - All network requests are fetched fresh from the server by default.

**Opt-In Caching** - Only specific resources that are explicitly safe to cache are cached.

## What Should NOT Be Cached (Default)

### API Calls
- [SUCCESS] All API endpoints (`/api/*`, `/auth/*`, `/admin/*`, etc.)
- [SUCCESS] All POST/PUT/DELETE requests
- [SUCCESS] All dynamic data
- [SUCCESS] User-specific data
- [SUCCESS] Authentication tokens (stored in localStorage, never HTTP cache)
- [SUCCESS] OTP codes and verification
- [SUCCESS] Session data
- [SUCCESS] Real-time data

**Implementation:**
- Service worker uses `NetworkOnly` for all API patterns
- API client has `cache.enabled: false` by default
- Default strategy is `network-only`

### Why?
- Prevents stale data after deployments
- Ensures fresh data for users
- Prevents security issues with cached auth data
- Avoids cache invalidation complexity

## What SHOULD Be Cached (Explicit Opt-In)

### Static Assets
- [SUCCESS] Images (`.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.ico`)
- [SUCCESS] Fonts (`.woff`, `.woff2`, `.ttf`, `.eot`, `.otf`)
- [SUCCESS] CSS/JS bundles (with versioning/hashing)

**Cache Strategy:** `CacheFirst` with 1 year expiration
**Why:** Static assets are immutable and don't change

### CDN Resources
- [SUCCESS] External CDN assets (e.g., `cdn.jsdelivr.net`)
- [SUCCESS] Profile pictures from R2/CDN (immutable URLs)

**Cache Strategy:** `CacheFirst` with 1 year expiration
**Why:** CDN resources are versioned and immutable

## Implementation Details

### Service Worker (Workbox)

**Default Pattern:** `NetworkOnly` for all API calls
```javascript
{
  urlPattern: /^https:\/\/.*\/(api|auth|admin|mods|customer|user|game|chat|url).*$/i,
  handler: 'NetworkOnly', // Always fetch from network
}
```

**Cached Patterns:**
- Static assets (images, fonts)
- CDN resources
- Profile pictures

### API Client

**Default Configuration:**
```typescript
cache: {
  enabled: false, // Disabled by default
  defaultStrategy: 'network-only', // Never cache by default
  defaultTTL: 0, // No TTL by default
}
```

**Opt-In Caching:**
```typescript
// Only if you explicitly need caching:
const response = await api.getCached('/some-endpoint', params, {
  enabled: true,
  defaultStrategy: 'stale-while-revalidate',
  defaultTTL: 5 * 60 * 1000, // 5 minutes
});
```

### Auth Tokens

**Storage:** localStorage only (never HTTP cache)
- [SUCCESS] Tokens stored in `localStorage.getItem('auth_token')`
- [SUCCESS] User data stored in `localStorage.getItem('auth_user')`
- [ERROR] Never cached in HTTP cache
- [ERROR] Never cached in service worker
- [ERROR] Never cached in browser cache

## Verification

### Check API Calls Are Not Cached

```bash
# Make API call
curl -I https://api.idling.app/api/some-endpoint

# Should see:
# Cache-Control: no-store, no-cache, must-revalidate, private
# (or no Cache-Control header, which means no caching)
```

### Check Service Worker

1. Open DevTools [EMOJI] Application [EMOJI] Service Workers
2. Check Network tab [EMOJI] Make API call
3. Verify request goes to "Network" (not "Cache")

### Check Static Assets Are Cached

```bash
# Request static asset
curl -I https://yourdomain.com/assets/image.png

# Should see:
# Cache-Control: public, max-age=31536000, immutable
```

## Migration Guide

### If You Need Caching for a Specific Endpoint

**Option 1: Use `getCached()` method**
```typescript
const response = await api.getCached('/endpoint', params, {
  enabled: true,
  defaultStrategy: 'stale-while-revalidate',
  defaultTTL: 5 * 60 * 1000,
});
```

**Option 2: Explicitly enable cache for request**
```typescript
const response = await api.get('/endpoint', params, {
  cache: {
    enabled: true,
    strategy: 'network-first',
    ttl: 5 * 60 * 1000,
  }
});
```

### If You Need to Disable Caching for Static Assets

Add to service worker config:
```javascript
{
  urlPattern: /^https:\/\/.*\/specific-asset\.png$/i,
  handler: 'NetworkOnly', // Override default CacheFirst
}
```

## Benefits

[SUCCESS] **No Stale Data** - Users always get fresh data  
[SUCCESS] **No Cache Invalidation** - Don't need to worry about cache invalidation  
[SUCCESS] **Deployment Safety** - New code works immediately  
[SUCCESS] **Security** - Auth data never cached  
[SUCCESS] **Simplicity** - No complex cache strategies  

## Trade-offs

[WARNING] **More Network Requests** - Every API call goes to network  
[WARNING] **Slower Offline** - No offline fallback for API calls  
[WARNING] **Higher Bandwidth** - No cache means more data transfer  

**Mitigation:**
- Static assets are still cached (images, fonts, etc.)
- CDN resources are cached
- Only dynamic API calls are not cached

## Summary

| Resource Type | Cached? | Strategy | TTL |
|--------------|---------|----------|-----|
| API Calls | [ERROR] No | NetworkOnly | N/A |
| Auth Endpoints | [ERROR] No | NetworkOnly | N/A |
| Static Assets | [SUCCESS] Yes | CacheFirst | 1 year |
| CDN Resources | [SUCCESS] Yes | CacheFirst | 1 year |
| Profile Pictures | [SUCCESS] Yes | CacheFirst | 1 year |
| Auth Tokens | [ERROR] No | localStorage only | N/A |

**Result:** Fresh data by default, cached only where safe and beneficial.

