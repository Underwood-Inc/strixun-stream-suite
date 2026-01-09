# Mods Hub User Association and Image Loading Audit

**Date:** 2025-12-29  
**Status:** ⚠ Multiple issues identified and fixes required

---

## Executive Summary

This audit identifies and addresses four critical issues in the Mods Hub:

1. **Mod Editing Support** - Exists but may not be discoverable
2. **User Association Defect** - "Unknown User" appearing on mod uploads
3. **Image Loading Failure** - Thumbnails failing to load/decrypt
4. **Auth /auth/me 401 Error** - Authorization header not being added

---

## Issue 1: Mod Editing Support

### Status: ✓ Feature Exists

**Finding:**
- Mod editing functionality exists at route `/manage/:slug`
- Component: `ModManagePage.tsx`
- Handler: `serverless/mods-api/handlers/mods/update.ts`
- API endpoint: `PUT /mods/:slug`

**Current Implementation:**
- Users can edit mods they own via `/manage/:slug`
- Edit link exists in `DraftsPage.tsx` (line 194)
- No visible "Edit" or "Manage" button on public mod detail pages

**Recommendation:**
- Add "Manage" button to mod detail page for mod owners
- Add link in navigation for "My Mods" section

---

## Issue 2: User Association Defect - "Unknown User"

### Status: ✗ Critical Defect

**Root Cause Analysis:**

1. **During Upload (`serverless/mods-api/handlers/mods/upload.ts:504-562`):**
   - Code attempts to fetch `displayName` from `/auth/me` endpoint
   - Request includes Authorization header with JWT token
   - **Problem:** Auth API returns 522 (timeout) - see logs line 803-808
   - When fetch fails, `authorDisplayName` is stored as `null`
   - Comment at line 565: "If displayName is null, UI will show 'Unknown User'"

2. **During Display (`serverless/mods-api/handlers/mods/detail.ts:245-252`):**
   - Code attempts to fetch displayName from `/auth/user/:customerId` endpoint
   - **Problem:** This endpoint also returns 522 (timeout) - see logs line 799-808
   - Falls back to stored `authorDisplayName` value (which is `null` from upload)
   - Result: "Unknown User" is displayed

3. **Why Display Name Works in Navigation:**
   - Navigation uses `fetchUserInfo()` in `mods-hub/src/stores/auth.ts:141`
   - This calls `/auth/me` with proper auth middleware
   - Works because it's a client-side call with full auth context

**Evidence from Logs:**
```
[DisplayName] Response status: { customerId: 'user_15ab01d57e08', status: 522, ok: false }
[DisplayName] Unexpected response status: { customerId: 'user_15ab01d57e08', status: 522, url: 'https://auth.idling.app/auth/user/user_15ab01d57e08' }
```

**Fix Strategy:**
1. Add timeout handling and retry logic for display name fetches
2. Use stored displayName as primary source, only refresh if available
3. Add fallback to fetch from `/auth/me` during upload if `/auth/user/:customerId` fails
4. Improve error handling to not fail silently

---

## Issue 3: Image Loading Failure

### Status: ✗ Images Not Loading

**Root Cause Analysis:**

1. **Server-Side (`serverless/mods-api/handlers/mods/thumbnail.ts`):**
   - Thumbnails are served with integrity headers: `x-strixun-response-integrity`
   - Images are NOT encrypted (only JSON responses are encrypted)
   - Headers set correctly: `Content-Type: image/png`, `Cache-Control: public, max-age=31536000`

2. **Client-Side (`mods-hub/src/pages/ModDetailPage.tsx:208-222`):**
   - Images loaded via standard `<img src={mod.thumbnailUrl}>` tag
   - Error handler shows "⚠ Thumbnail unavailable - Image failed to load"

3. **Potential Issues:**
   - **Integrity Header Verification:** Client might be trying to verify integrity headers on images
   - **CORS Issues:** Images might be blocked by CORS policy
   - **Service Worker:** Service worker might be interfering with image requests
   - **Decryption Attempt:** Response handler might be trying to decrypt images (should only decrypt JSON)

**Evidence:**
- Browser shows image load failure
- Server logs show successful thumbnail serving (line 862-867 in terminal)
- Integrity headers are added (line 926-928 in terminal)

**Fix Strategy:**
1. Ensure response handler skips decryption for image content types
2. Verify CORS headers are correct for image responses
3. Check service worker isn't intercepting image requests
4. Add client-side integrity verification only for JSON responses, not images

---

## Issue 4: Auth /auth/me 401 Error

### Status: ✗ Authorization Header Missing

**Root Cause Analysis:**

1. **Browser Error:**
   ```
   GET https://auth.idling.app/auth/me 401 (Unauthorized)
   APIError: Authorization header required
   ```

2. **Code Analysis:**
   - `mods-hub/src/stores/auth.ts:141-198` - `fetchUserInfo()` function
   - Creates API client with `auth.tokenGetter: () => token`
   - Auth middleware should add Authorization header (see `packages/api-framework/src/middleware/auth.ts:27-38`)

3. **Potential Issues:**
   - Token might be null/undefined when `tokenGetter()` is called
   - Auth middleware might not be applied correctly
   - Request might be made before auth is initialized
   - Token might be expired/invalid

**Evidence:**
- Error occurs in browser console
- Stack trace shows it's coming from API framework client
- Error message: "Authorization header required"

**Fix Strategy:**
1. Add null check for token before making request
2. Ensure auth middleware is properly configured
3. Add retry logic with token refresh
4. Improve error logging to identify when/why token is missing

---

## Fixes Required

### Fix 1: Improve Display Name Fetching with Timeout Handling

**File:** `serverless/mods-api/utils/displayName.ts`

**Changes:**
- Add timeout to fetch requests (5 seconds)
- Add retry logic (1 retry on timeout)
- Improve error handling to not fail silently
- Use stored displayName as primary source

### Fix 2: Fix Upload Display Name Fetching

**File:** `serverless/mods-api/handlers/mods/upload.ts`

**Changes:**
- Add timeout handling for `/auth/me` fetch
- Add fallback to use stored displayName if fetch fails
- Improve error logging

### Fix 3: Ensure Images Are Not Decrypted

**File:** `packages/api-framework/src/utils/response-handler.ts`

**Changes:**
- Skip decryption for non-JSON content types (images, etc.)
- Only attempt decryption for `application/json` responses
- Add explicit check for image content types

### Fix 4: Fix Auth Middleware Token Injection

**File:** `mods-hub/src/stores/auth.ts`

**Changes:**
- Add null check for token before creating API client
- Ensure token is available before calling `/auth/me`
- Add better error handling for missing tokens

### Fix 5: Add Mod Management Link to Detail Page

**File:** `mods-hub/src/pages/ModDetailPage.tsx`

**Changes:**
- Add "Manage" button for mod owners
- Link to `/manage/:slug` route
- Only show for authenticated users who own the mod

---

## Testing Checklist

- [ ] Upload new mod and verify display name is stored correctly
- [ ] View mod detail page and verify author name displays (not "Unknown User")
- [ ] Verify thumbnail images load correctly
- [ ] Verify `/auth/me` endpoint works without 401 errors
- [ ] Test mod editing via `/manage/:slug` route
- [ ] Verify "Manage" button appears for mod owners
- [ ] Test with previously uploaded mods (backward compatibility)

---

## Backward Compatibility

**Critical:** Previously uploaded mods have `authorDisplayName: null` stored in KV.

**Solution:**
- Display name fetching during mod retrieval will attempt to fetch fresh displayName
- Falls back to stored value if fetch fails
- For old mods with null displayName, will show "Unknown User" until displayName can be fetched
- Consider adding migration script to backfill displayNames for existing mods

---

## Related Files

- `serverless/mods-api/handlers/mods/upload.ts` - Upload handler
- `serverless/mods-api/handlers/mods/detail.ts` - Mod detail handler
- `serverless/mods-api/utils/displayName.ts` - Display name utility
- `serverless/mods-api/handlers/mods/thumbnail.ts` - Thumbnail handler
- `mods-hub/src/stores/auth.ts` - Auth store
- `mods-hub/src/pages/ModDetailPage.tsx` - Mod detail page
- `mods-hub/src/pages/ModManagePage.tsx` - Mod management page
- `packages/api-framework/src/utils/response-handler.ts` - Response handler
- `packages/api-framework/src/middleware/auth.ts` - Auth middleware

---

## Next Steps

1. Implement fixes for all four issues
2. Test thoroughly with new and existing mods
3. Deploy fixes to production
4. Monitor logs for display name fetch failures
5. Consider adding migration script for existing mods

