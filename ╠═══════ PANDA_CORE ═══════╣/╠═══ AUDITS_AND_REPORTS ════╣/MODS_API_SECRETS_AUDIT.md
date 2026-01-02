# Mods API - Secrets Audit

**Last Updated**: 2025-12-29

**Date:** 2025-01-XX  
**Service:** strixun-mods-api  
**Status:** ✓ Complete

## Required Secrets

### 1. `JWT_SECRET` ⚠ **REQUIRED**
- **Purpose:** JWT signing secret for token verification
- **Must Match:** OTP auth service JWT_SECRET
- **Set via:** `wrangler secret put JWT_SECRET`
- **Status:** ✓ Documented in wrangler.toml
- **Validation:** Throws error if missing (see `utils/auth.ts`)

### 2. `ALLOWED_EMAILS` ⚠ **REQUIRED** (NEW)
- **Purpose:** Comma-separated list of email addresses allowed to upload/manage mods
- **Format:** `email1@example.com,email2@example.com`
- **Set via:** `wrangler secret put ALLOWED_EMAILS`
- **Status:** ✓ Implemented in handlers
- **Behavior**: 
  - If unset: Allows all authenticated users (backward compatible)
  - If set: Only listed emails can upload/update/delete mods
- **Used in:**
  - `handlers/mods/upload.ts` - Upload new mods
  - `handlers/mods/update.ts` - Update mod metadata
  - `handlers/mods/delete.ts` - Delete mods
  - `handlers/versions/upload.ts` - Upload new versions

## Optional Secrets

### 3. `ALLOWED_ORIGINS` ⚠ **RECOMMENDED**
- **Purpose:** Comma-separated CORS origins (recommended for production)
- **Format:** `https://mods.idling.app,https://www.idling.app`
- **Set via:** `wrangler secret put ALLOWED_ORIGINS`
- **Status:** ✓ Documented and used throughout
- **Default:** `*` (allows all origins) if not set
- **Security:** Should be set in production to prevent CSRF attacks

### 4. `MODS_PUBLIC_URL` ⚠ **OPTIONAL**
- **Purpose:** Public URL for R2 bucket (if using custom domain)
- **Format:** `https://cdn.idling.app` or similar
- **Set via:** `wrangler secret put MODS_PUBLIC_URL`
- **Status:** ✓ Documented in wrangler.toml
- **Default:** Uses R2 public URL if not set
- **Used in:** File download URL generation

## Environment Variables (Non-Secrets)

### 5. `ENVIRONMENT`
- **Purpose:** Environment identifier (development/production)
- **Set via:** `wrangler.toml` [vars] section
- **Status:** ✓ Configured
- **Value:** `production`

## KV Namespaces

### 6. `MODS_KV` ⚠ **REQUIRED**
- **Purpose:** KV namespace for mod metadata storage
- **Binding:** `MODS_KV`
- **Status:** ✓ Configured in wrangler.toml
- **ID:** `0d3dafe0994046c6a47146c6bd082ad3`
- **Created via:** `wrangler kv namespace create "MODS_KV"`

## R2 Buckets

### 7. `MODS_R2` ⚠ **REQUIRED**
- **Purpose:** R2 bucket for mod file storage
- **Binding:** `MODS_R2`
- **Status:** ✓ Configured in wrangler.toml
- **Bucket Name:** `mods-storage`
- **Created via:** `wrangler r2 bucket create "mods-storage"`

## Setup Instructions

### 1. Set Required Secrets

```bash
cd serverless/mods-api

# Set JWT secret (must match OTP auth service)
wrangler secret put JWT_SECRET
# Enter the same secret used in otp-auth-service

# Set allowed emails (comma-separated)
wrangler secret put ALLOWED_EMAILS
# Enter: your-email@example.com,another-email@example.com

# Set CORS origins (recommended for production)
wrangler secret put ALLOWED_ORIGINS
# Enter: https://mods.idling.app,https://www.idling.app

# Set public URL for R2 (optional, if using custom domain)
wrangler secret put MODS_PUBLIC_URL
# Enter: https://cdn.idling.app (or leave empty to use R2 default)
```

### 2. Verify Secrets

```bash
# List all secrets
wrangler secret list

# Verify worker is running
curl https://mods-api.idling.app/health
```

## Security Notes

1. **JWT_SECRET**: Must match the OTP auth service secret exactly, or authentication will fail
2. **ALLOWED_EMAILS**: If not set, all authenticated users can upload/manage mods. Set this to restrict access.
3. **ALLOWED_ORIGINS**: Should be set in production to prevent CSRF attacks
4. **MODS_PUBLIC_URL**: Only needed if using a custom domain for R2 bucket access

## Migration Notes

- **Breaking Change:** None - `ALLOWED_EMAILS` is optional and defaults to allowing all authenticated users
- **New Feature:** Email whitelist for upload/management operations
- **Bug Fix:** Mods list now uses global public list (`mods_list_public`) instead of customer-scoped list

## Related Files

- `wrangler.toml` - Configuration file
- `utils/auth.ts` - Authentication and email whitelist logic
- `handlers/mods/upload.ts` - Upload handler with email check
- `handlers/mods/update.ts` - Update handler with email check
- `handlers/mods/delete.ts` - Delete handler with email check
- `handlers/versions/upload.ts` - Version upload handler with email check
