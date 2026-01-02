# Mods API Endpoint Audit

**Date:** 2025-01-XX  
**Status:** ✓ Complete Audit  
**Security Level:** 🔒 **HARDENED** - JWT Encryption/Decryption Required for ALL Endpoints

---

## ⚠️ CRITICAL SECURITY REQUIREMENT

**JWT ENCRYPTION/DECRYPTION IS NOW MANDATORY FOR ALL ENDPOINTS**

By default, the API framework **MUST** require JWT encryption/decryption as a base requirement for **EVERYTHING**. All other security layers (CORS, authentication checks, authorization) are layered on top of this fundamental requirement.

### Security Architecture

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
1. ✅ **ALL endpoints require JWT for encryption/decryption** (even `/health`)
2. ✅ **Binary files (images, downloads) must use JWT encryption/decryption**
3. ✅ **No service key fallback** - JWT is mandatory
4. ✅ **CORS and auth checks are layered on top** - they don't replace encryption

---

## Quick Reference: JWT Encryption Requirement Status

| Endpoint | Current State | Required State | Status |
|----------|--------------|----------------|--------|
| `GET /health` | ❌ No JWT required | ✅ JWT encryption required | ⚠️ **NEEDS UPDATE** |
| `GET /mods` | ⚠️ Optional JWT | ✅ JWT encryption required | ⚠️ **NEEDS UPDATE** |
| `GET /mods/:slug` | ⚠️ Optional JWT | ✅ JWT encryption required | ⚠️ **NEEDS UPDATE** |
| `GET /mods/:slug/thumbnail` | ⚠️ Service key fallback | ✅ JWT binary encryption required | ⚠️ **NEEDS UPDATE** |
| `GET /mods/:slug/og-image` | ⚠️ Optional JWT | ✅ JWT binary encryption required | ⚠️ **NEEDS UPDATE** |
| `GET /mods/:slug/ratings` | ⚠️ Optional JWT | ✅ JWT encryption required | ⚠️ **NEEDS UPDATE** |
| `GET /mods/:slug/versions/:versionId/download` | ⚠️ Service key fallback | ✅ JWT binary encryption required | ⚠️ **NEEDS UPDATE** |
| `GET /mods/:slug/variants/:variantId/download` | ⚠️ Service key fallback | ✅ JWT binary encryption required | ⚠️ **NEEDS UPDATE** |
| `GET /mods/:slug/versions/:versionId/badge` | ⚠️ Optional JWT | ✅ JWT binary encryption required | ⚠️ **NEEDS UPDATE** |
| `POST /mods` | ✅ JWT required | ✅ JWT encryption required | ✅ **OK** |
| `PUT /mods/:slug` | ✅ JWT required | ✅ JWT encryption required | ✅ **OK** |
| `DELETE /mods/:slug` | ✅ JWT required | ✅ JWT encryption required | ✅ **OK** |
| `POST /mods/:slug/ratings` | ✅ JWT required | ✅ JWT encryption required | ✅ **OK** |
| `POST /mods/:slug/versions` | ✅ JWT required | ✅ JWT encryption required | ✅ **OK** |
| `GET /mods/:slug/versions/:versionId/verify` | ✅ JWT required | ✅ JWT encryption required | ✅ **OK** |
| All `/admin/*` routes | ✅ JWT required | ✅ JWT encryption required | ✅ **OK** |

**Legend:**
- ✅ **OK** - Already requires JWT encryption
- ⚠️ **NEEDS UPDATE** - Must be updated to require JWT encryption

---

## Executive Summary

This document provides a comprehensive audit of all mods-api endpoints, categorizing them by:
1. **JWT Encryption Requirement** - ALL endpoints require JWT encryption/decryption
2. **Public in mods-hub context** - Endpoints accessible from the mods-hub application window (subject to CORS)
3. **Truly public** - Endpoints accessible from anywhere (but still require JWT encryption)
4. **Authentication requirements** - Which endpoints require JWT tokens for authorization
5. **CORS configuration** - How CORS affects endpoint accessibility

---

## CORS Configuration Overview

### How CORS Works in mods-api

1. **CORS Headers**: All endpoints return CORS headers via `createCORSHeaders()` from `@strixun/api-framework/enhanced`
2. **ALLOWED_ORIGINS**: Controlled by `ALLOWED_ORIGINS` environment variable (comma-separated list)
3. **Default Behavior**: 
   - If `ALLOWED_ORIGINS` is not set → allows all origins (`*`) - **development only**
   - If `ALLOWED_ORIGINS` is set → only listed origins are allowed
4. **Localhost Exception**: Localhost origins are always allowed for development (even in production mode)
5. **OPTIONS Preflight**: All OPTIONS requests are handled at the worker level before routing

### Current CORS Configuration

Based on `docs/services/mods-api/cors-audit.md`, the following origins should be in `ALLOWED_ORIGINS`:
- `https://mods.idling.app` (primary frontend)
- `https://auth.idling.app`
- `https://api.idling.app`
- `https://customer.idling.app`
- `https://game.idling.app`
- `https://s.idling.app`
- `https://chat.idling.app`
- `https://idling.app`
- `https://www.idling.app`
- `http://localhost:5173` (dev)
- `http://localhost:3000` (dev)

---

## Endpoint Categories

### Category 1: Truly Public (No Auth, No CORS Restrictions)

These endpoints can be called from **anywhere** without authentication or CORS restrictions.

#### `GET /health`
- **Purpose**: Health check endpoint
- **Auth Required**: ❌ No
- **CORS**: ✅ Returns CORS headers but accepts requests from any origin
- **Access**: Truly public - can be called from anywhere
- **Response**: JSON with service status, timestamp, environment
- **Notes**: 
  - Handled directly in `worker.ts` before routing
  - Always returns CORS headers
  - No authentication check
  - No data access restrictions

---

### Category 2: Public in Mods-Hub Context (JWT Encryption Required, Subject to CORS)

These endpoints are **public** (no authentication required for authorization) but are **subject to CORS restrictions** and **MUST require JWT encryption/decryption**. They can only be called from origins listed in `ALLOWED_ORIGINS` (or any origin if not configured).

#### `GET /mods` or `GET /`
- **Purpose**: List all public mods with filtering, pagination, and search
- **JWT Encryption Required**: ✅ **YES** (MANDATORY)
- **Auth Required**: ❌ No (for authorization - but JWT required for encryption)
- **CORS**: ✅ Required (must be from allowed origin)
- **Access**: Public browsing - shows only approved mods with `visibility='public'` and `status='approved'`
- **Data Filtering**: 
  - Non-authenticated users: Only see public, approved mods
  - Authenticated users: Can see their own mods regardless of status
  - Super admins: Can see all mods when using `visibility=all` query param
- **Notes**: 
  - **MUST encrypt response with JWT token from request**
  - **MUST return 401 if no JWT token provided**
  - Uses `wrapWithEncryption()` but currently only encrypts if JWT present
  - **STATUS**: ⚠️ **NEEDS UPDATE** - Must enforce JWT encryption requirement

#### `GET /mods/:slug` or `GET /:slug`
- **Purpose**: Get mod detail with versions
- **Auth Required**: ❌ No (authentication is optional)
- **CORS**: ✅ Required (must be from allowed origin)
- **Access**: Public mods only - filters by visibility and status
- **Data Filtering**:
  - Non-authenticated users: Only see public, published/approved mods
  - Authenticated users: Can see their own mods regardless of status
  - Super admins: Can see all mods (except private mods they don't own)
- **Notes**: 
  - Slug is resolved to modId before handler call
  - Returns 404 for non-public mods (not 403) to prevent enumeration

#### `GET /mods/:slug/thumbnail` or `GET /:slug/thumbnail`
- **Purpose**: Get mod thumbnail image
- **Auth Required**: ❌ No (authentication is optional)
- **CORS**: ✅ Required (must be from allowed origin)
- **Access**: Public mods only - filters by visibility and status
- **Data Filtering**:
  - Non-authenticated users: Only see thumbnails for public, published/approved mods (or public pending mods)
  - Authenticated users: Can see thumbnails for their own mods regardless of status
  - Draft mods: Only visible to author/admin
- **Notes**: 
  - Often loaded as `<img>` tags without auth headers
  - Returns image binary data (PNG/JPG/WebP)
  - More permissive than detail endpoint (allows public pending mods)

#### `GET /mods/:slug/og-image` or `GET /:slug/og-image`
- **Purpose**: Generate Open Graph preview image (SVG)
- **Auth Required**: ❌ No (authentication is optional)
- **CORS**: ✅ Required (must be from allowed origin)
- **Access**: Public mods only - filters by visibility
- **Data Filtering**:
  - Non-authenticated users: Only see OG images for public mods
  - Authenticated users: Can see OG images for their own private mods
- **Notes**: 
  - Returns SVG image
  - Used for social media previews
  - Checks visibility but not status (more permissive)

#### `GET /mods/:slug/ratings` or `GET /:slug/ratings`
- **Purpose**: Get ratings for a mod
- **Auth Required**: ❌ No (authentication is optional)
- **CORS**: ✅ Required (must be from allowed origin)
- **Access**: Public, published/approved mods only
- **Data Filtering**:
  - Non-authenticated users: Only see ratings for public, published/approved mods
  - Authenticated users: Can see ratings for their own mods regardless of status
- **Notes**: 
  - Returns ratings list with average rating
  - Filters by mod visibility and status

#### `GET /mods/:slug/versions/:versionId/download` or `GET /:slug/versions/:versionId/download`
- **Purpose**: Download mod version file
- **JWT Encryption Required**: ✅ **YES** (MANDATORY for binary encryption)
- **Auth Required**: ❌ No (for authorization - but JWT required for encryption)
- **CORS**: ✅ Required (must be from allowed origin)
- **Access**: Public mods only - filters by visibility and status
- **Data Filtering**:
  - Non-authenticated users: Can download public, published/approved mods (with JWT encryption)
  - Authenticated users: Can download their own mods regardless of status
  - Draft mods: Only downloadable by author/admin
- **Decryption**:
  - **MUST use JWT for decryption** - no service key fallback
  - **MUST return 401 if no JWT token provided**
  - **MUST decrypt using `decryptBinaryWithJWT()`**
  - Legacy files: Must be re-encrypted with JWT or rejected
- **Notes**: 
  - Returns binary file data (encrypted with JWT)
  - File is decrypted on-the-fly using JWT
  - Increments download count
  - Returns integrity hash headers
  - **STATUS**: ⚠️ **NEEDS UPDATE** - Currently has service key fallback - MUST REMOVE

#### `GET /mods/:slug/variants/:variantId/download` or `GET /:slug/variants/:variantId/download`
- **Purpose**: Download mod variant file
- **Auth Required**: ⚠️ Conditional (depends on encryption)
- **CORS**: ✅ Required (must be from allowed origin)
- **Access**: Same as version download
- **Notes**: Similar to version download but for variants

#### `GET /mods/:slug/versions/:versionId/badge` or `GET /:slug/versions/:versionId/badge`
- **Purpose**: Get integrity verification badge (SVG)
- **Auth Required**: ❌ No (authentication is optional)
- **CORS**: ✅ Required (must be from allowed origin)
- **Access**: Public mods only - filters by visibility and status
- **Data Filtering**:
  - Non-authenticated users: Only see badges for public, published/approved mods (or public pending mods)
  - Authenticated users: Can see badges for their own mods regardless of status
  - Draft mods: Only visible to author/admin
- **Notes**: 
  - Returns SVG badge image
  - Often loaded as `<img>` tags without auth headers
  - More permissive than detail endpoint (allows public pending mods)

---

### Category 3: Authenticated Endpoints (Require JWT)

These endpoints **require authentication** (JWT token) and are **subject to CORS restrictions**.

#### `POST /mods` or `POST /`
- **Purpose**: Upload new mod
- **Auth Required**: ✅ Yes (JWT token required)
- **CORS**: ✅ Required (must be from allowed origin)
- **Access**: Authenticated users only
- **Notes**: 
  - Returns 401 if no auth
  - Checks `ALLOWED_EMAILS` for upload permission
  - Creates mod in customer scope

#### `PUT /mods/:slug` or `PATCH /mods/:slug` or `PUT /:slug` or `PATCH /:slug`
- **Purpose**: Update mod metadata
- **Auth Required**: ✅ Yes (JWT token required)
- **CORS**: ✅ Required (must be from allowed origin)
- **Access**: Author only (or super admin)
- **Notes**: 
  - Returns 401 if no auth
  - Checks author ownership
  - Updates mod in customer scope

#### `DELETE /mods/:slug` or `DELETE /:slug`
- **Purpose**: Delete mod
- **Auth Required**: ✅ Yes (JWT token required)
- **CORS**: ✅ Required (must be from allowed origin)
- **Access**: Author only (or super admin)
- **Notes**: 
  - Returns 401 if no auth
  - Checks author ownership
  - Deletes mod and all versions

#### `POST /mods/:slug/ratings` or `POST /:slug/ratings`
- **Purpose**: Submit a rating for a mod
- **Auth Required**: ✅ Yes (JWT token required)
- **CORS**: ✅ Required (must be from allowed origin)
- **Access**: Authenticated users only
- **Notes**: 
  - Returns 401 if no auth
  - Requires `customerId` in auth
  - Only published/approved mods can be rated (except by author)
  - Updates existing rating if user already rated

#### `POST /mods/:slug/versions` or `POST /:slug/versions`
- **Purpose**: Upload new version
- **Auth Required**: ✅ Yes (JWT token required)
- **CORS**: ✅ Required (must be from allowed origin)
- **Access**: Author only (or super admin)
- **Notes**: 
  - Returns 401 if no auth
  - Checks author ownership
  - Creates version in customer scope

#### `GET /mods/permissions/me` or `GET /permissions/me`
- **Purpose**: Get current user's upload permissions
- **Auth Required**: ✅ Yes (JWT token required)
- **CORS**: ✅ Required (must be from allowed origin)
- **Access**: Authenticated users only
- **Notes**: 
  - Returns 401 if no auth
  - Returns upload permission status

#### `GET /mods/:slug/review` or `GET /:slug/review`
- **Purpose**: Get mod review page (admin/uploader only)
- **Auth Required**: ✅ Yes (JWT token required)
- **CORS**: ✅ Required (must be from allowed origin)
- **Access**: Author or super admin only
- **Notes**: 
  - Returns 401 if no auth
  - Shows review status and comments

#### `GET /mods/:slug/snapshots` or `GET /:slug/snapshots`
- **Purpose**: List snapshots for a mod
- **Auth Required**: ✅ Yes (JWT token required)
- **CORS**: ✅ Required (must be from allowed origin)
- **Access**: Authenticated users only
- **Notes**: 
  - Returns 401 if no auth
  - Shows version history snapshots

#### `GET /mods/:slug/snapshots/:snapshotId` or `GET /:slug/snapshots/:snapshotId`
- **Purpose**: Load a specific snapshot
- **Auth Required**: ✅ Yes (JWT token required)
- **CORS**: ✅ Required (must be from allowed origin)
- **Access**: Authenticated users only
- **Notes**: 
  - Returns 401 if no auth
  - Returns snapshot data

#### `GET /mods/:slug/versions/:versionId/verify` or `GET /:slug/versions/:versionId/verify`
- **Purpose**: Verify file integrity using SHA-256 hash
- **Auth Required**: ✅ Yes (JWT token required for decryption)
- **CORS**: ✅ Required (must be from allowed origin)
- **Access**: Public mods only, but requires JWT for decryption
- **Notes**: 
  - Returns 401 if no auth (needs JWT to decrypt file)
  - Verifies file hash matches stored hash
  - Must decrypt file to calculate hash

#### `POST /mods/:slug/versions/:versionId/validate` or `POST /:slug/versions/:versionId/validate`
- **Purpose**: Validate file against uploaded version
- **Auth Required**: ✅ Yes (JWT token required)
- **CORS**: ✅ Required (must be from allowed origin)
- **Access**: Authenticated users only
- **Notes**: 
  - Returns 401 if no auth
  - Validates uploaded file against version

---

### Category 4: Admin Endpoints (Require Super-Admin)

All admin endpoints require **super-admin authentication** and are **subject to CORS restrictions**.

#### All `/admin/*` Routes
- **Auth Required**: ✅ Yes (super-admin JWT token required)
- **CORS**: ✅ Required (must be from allowed origin)
- **Access**: Super admin only
- **Protection**: Uses `protectAdminRoute()` from `@strixun/api-framework`
- **Endpoints**:
  - `GET /admin/mods` - List all mods (for triage)
  - `PUT /admin/mods/:modId/status` - Update mod status
  - `POST /admin/mods/:modId/comments` - Add review comment
  - `GET /admin/approvals` - List approved uploaders
  - `POST /admin/approvals/:userId` - Approve user for uploads
  - `DELETE /admin/approvals/:userId` - Revoke user upload permission
  - `DELETE /admin/mods/:modId` - Delete mod (admin only)
  - `GET /admin/r2/files` - List all R2 files
  - `GET /admin/r2/duplicates` - Detect duplicate and orphaned files
  - `DELETE /admin/r2/files/:key` - Delete single R2 file
  - `POST /admin/r2/files/delete` - Bulk delete R2 files
  - `POST /admin/r2/cleanup` - Manually trigger cleanup job
  - `PUT /admin/r2/files/:key/timestamp` - Set deletion timestamp
  - `GET /admin/users` - List all users
  - `GET /admin/users/:userId` - Get user details
  - `PUT /admin/users/:userId` - Update user
  - `GET /admin/users/:userId/mods` - Get user's mods
  - `GET /admin/settings` - Get admin settings
  - `PUT /admin/settings` - Update admin settings

---

## Summary Tables

### Public Endpoints (No Auth Required)

| Endpoint | Method | CORS Required | Truly Public | Notes |
|----------|--------|---------------|--------------|-------|
| `/health` | GET | ❌ No | ✅ Yes | Health check - truly public |
| `/mods` | GET | ✅ Yes | ❌ No | List mods - subject to CORS |
| `/mods/:slug` | GET | ✅ Yes | ❌ No | Mod detail - subject to CORS |
| `/mods/:slug/thumbnail` | GET | ✅ Yes | ❌ No | Thumbnail - subject to CORS |
| `/mods/:slug/og-image` | GET | ✅ Yes | ❌ No | OG image - subject to CORS |
| `/mods/:slug/ratings` | GET | ✅ Yes | ❌ No | Ratings - subject to CORS |
| `/mods/:slug/versions/:versionId/download` | GET | ✅ Yes | ❌ No | Download - subject to CORS, may need JWT for decryption |
| `/mods/:slug/variants/:variantId/download` | GET | ✅ Yes | ❌ No | Variant download - subject to CORS |
| `/mods/:slug/versions/:versionId/badge` | GET | ✅ Yes | ❌ No | Badge - subject to CORS |

### Authenticated Endpoints (JWT Required)

| Endpoint | Method | CORS Required | Access Level | Notes |
|----------|--------|---------------|--------------|-------|
| `/mods` | POST | ✅ Yes | Authenticated | Upload mod |
| `/mods/:slug` | PUT/PATCH | ✅ Yes | Author only | Update mod |
| `/mods/:slug` | DELETE | ✅ Yes | Author only | Delete mod |
| `/mods/:slug/ratings` | POST | ✅ Yes | Authenticated | Submit rating |
| `/mods/:slug/versions` | POST | ✅ Yes | Author only | Upload version |
| `/mods/permissions/me` | GET | ✅ Yes | Authenticated | Get permissions |
| `/mods/:slug/review` | GET | ✅ Yes | Author/Admin | Review page |
| `/mods/:slug/snapshots` | GET | ✅ Yes | Authenticated | List snapshots |
| `/mods/:slug/snapshots/:snapshotId` | GET | ✅ Yes | Authenticated | Load snapshot |
| `/mods/:slug/versions/:versionId/verify` | GET | ✅ Yes | Authenticated | Verify file (needs JWT for decryption) |
| `/mods/:slug/versions/:versionId/validate` | POST | ✅ Yes | Authenticated | Validate file |

### Admin Endpoints (Super-Admin Required)

| Endpoint | Method | CORS Required | Access Level | Notes |
|----------|--------|---------------|--------------|-------|
| `/admin/*` | Various | ✅ Yes | Super Admin | All admin routes |

---

## Security Considerations

### CORS Protection

1. **Production**: `ALLOWED_ORIGINS` should be configured with specific origins
2. **Development**: If `ALLOWED_ORIGINS` is not set, all origins are allowed (development only)
3. **Localhost**: Always allowed for development (even in production mode)

### Authentication

1. **JWT Verification**: All authenticated endpoints verify JWT tokens
2. **Email Whitelist**: Upload endpoints check `ALLOWED_EMAILS` for permission
3. **Author Checks**: Update/delete endpoints verify author ownership
4. **Admin Checks**: Admin endpoints verify super-admin status

### Data Filtering

1. **Visibility**: Public endpoints filter by `visibility` field (public/unlisted/private)
2. **Status**: Public endpoints filter by `status` field (approved/published/pending/draft)
3. **Author Override**: Authors can always see their own mods regardless of visibility/status
4. **Admin Override**: Super admins can see all mods (with some restrictions for private mods)

### Encryption

1. **File Encryption**: All uploaded files are encrypted at rest in R2
2. **Decryption Keys**: 
   - Public mods: Try service key first, fall back to JWT
   - Private mods: Require JWT
3. **Legacy Files**: May not be encrypted (handled gracefully)

---

## Recommendations

### For Truly Public Endpoints

1. ✅ `/health` is correctly configured as truly public
2. ⚠️ Consider if any other endpoints should be truly public (currently none)

### For CORS-Protected Public Endpoints

1. ✅ All public endpoints correctly require CORS
2. ⚠️ Ensure `ALLOWED_ORIGINS` is configured in production
3. ⚠️ Consider rate limiting for public endpoints

### For Authenticated Endpoints

1. ✅ All authenticated endpoints correctly require JWT
2. ✅ Author checks are properly implemented
3. ⚠️ Consider adding rate limiting per user

### For Admin Endpoints

1. ✅ All admin endpoints correctly require super-admin
2. ✅ Route protection is implemented at API level
3. ⚠️ Consider audit logging for admin actions

---

## Testing Recommendations

1. **CORS Testing**: Test all endpoints from different origins
2. **Auth Testing**: Test authenticated endpoints with/without JWT
3. **Visibility Testing**: Test public endpoints with different visibility/status combinations
4. **Admin Testing**: Test admin endpoints with different permission levels

---

## ⚠️ REQUIRED CHANGES FOR SECURITY HARDENING

### 1. Update `/health` Endpoint
- **Current**: No JWT encryption required
- **Required**: MUST require JWT token and encrypt response
- **Action**: Update `handleHealth()` in `worker.ts` to require JWT and use `wrapWithEncryption()`

### 2. Update All Public Endpoints
- **Current**: Optional JWT encryption (only if token present)
- **Required**: MUST require JWT token and encrypt all responses
- **Action**: Update all handlers to:
  - Check for JWT token in request
  - Return 401 if no JWT token
  - Use `wrapWithEncryption()` with mandatory encryption

### 3. Update Image Endpoints (Thumbnails, OG Images, Badges)
- **Current**: May use service key fallback or no encryption
- **Required**: MUST use JWT binary encryption
- **Action**: 
  - Use `encryptBinaryWithJWT()` for all image responses
  - Return 401 if no JWT token
  - Remove service key fallback
  - Update client to decrypt using `decryptBinaryWithJWT()`

### 4. Update Download Endpoints
- **Current**: Service key fallback for public mods
- **Required**: MUST use JWT binary encryption only
- **Action**:
  - Remove service key fallback logic
  - Require JWT token for all downloads
  - Use `decryptBinaryWithJWT()` with JWT only
  - Re-encrypt legacy files with JWT or reject them

### 5. Update API Framework Default Behavior
- **Current**: `wrapWithEncryption()` only encrypts if JWT present
- **Required**: `wrapWithEncryption()` MUST require JWT and fail if not present
- **Action**: 
  - Add `requireJWT: true` option to `wrapWithEncryption()` in `packages/api-framework/encryption/middleware.ts`
  - Make it the default behavior
  - Update all call sites in mods-api

### 6. Update Client-Side Decryption
- **Current**: Client may not decrypt all responses
- **Required**: Client MUST decrypt all encrypted responses
- **Action**:
  - Update mods-hub client to always decrypt responses with `X-Encrypted: true` header
  - Use `decryptBinaryWithJWT()` for binary responses (images, downloads)
  - Use `decryptWithJWT()` for JSON responses
  - Handle 401 errors when JWT is missing

### 7. Migration Strategy
1. **Phase 1**: Update API framework to require JWT by default
2. **Phase 2**: Update all mods-api endpoints to enforce JWT requirement
3. **Phase 3**: Update client-side to handle mandatory JWT encryption
4. **Phase 4**: Remove service key fallback code
5. **Phase 5**: Re-encrypt or reject legacy files

---

## Conclusion

The mods-api has a well-structured endpoint architecture, but **requires security hardening** to enforce JWT encryption/decryption as the mandatory base requirement:

- ⚠️ **Current State**: JWT encryption is optional for public endpoints
- ✅ **Required State**: JWT encryption is MANDATORY for ALL endpoints
- ✅ **Architecture**: CORS and auth checks are properly layered
- ⚠️ **Action Required**: Update all endpoints to enforce JWT encryption requirement

**Security Principle**: JWT encryption/decryption is the foundation. All other security layers (CORS, authentication, authorization) are built on top of this mandatory requirement.
