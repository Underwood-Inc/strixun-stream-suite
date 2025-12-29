# Upload File Size Limits Configuration

> **Complete guide for configuring upload file size limits across all services**

**Date:** 2025-12-29

---

## Overview

All upload file size limits are now centralized in the **shared API framework** (`@strixun/api-framework`), providing:

- **Base default limit of 10 MB** for all uploads
- **Service-specific overrides** for services that need higher limits
- **Automatic validation utilities** available to all services
- **Consistent error handling** across all services

---

## Architecture

### Shared Framework (`serverless/shared/api/upload-limits.ts`)

The shared API framework provides:
- `BASE_UPLOAD_LIMIT`: **10 MB** - Default limit for all services
- `DEFAULT_UPLOAD_LIMITS`: Default limits for different upload types
- `getUploadLimits()`: Function to get limits with service-specific overrides
- `validateFileSize()`: Validation utility function
- `formatFileSize()`: Human-readable file size formatting

### Service-Specific Configuration

Each service can:
1. Use the base 10 MB limit (default)
2. Override specific limits for their use case
3. Import validation utilities from the shared framework

---

## Current Limits

### Mods API (`serverless/mods-api/utils/upload-limits.ts`)

- **MAX_MOD_FILE_SIZE**: `35 MB` (overrides base 10 MB limit)
  - Applied to: Mod file uploads in `handlers/mods/upload.ts`
  - Note: This is the encrypted file size as received from client

- **MAX_VERSION_FILE_SIZE**: `35 MB` (overrides base 10 MB limit)
  - Applied to: Version file uploads in `handlers/versions/upload.ts`
  - Note: This is the encrypted file size as received from client

- **MAX_THUMBNAIL_SIZE**: `1 MB` (uses default from shared framework)
  - Applied to: Thumbnail uploads in `handlers/mods/upload.ts` and `handlers/mods/update.ts`
  - Supported formats: PNG, WebP, GIF, JPEG

### OTP Auth Service (`serverless/otp-auth-service/utils/upload-limits.ts`)

- **MAX_PROFILE_PICTURE_SIZE**: `5 MB` (uses default from shared framework)
  - Applied to: Profile picture uploads in `handlers/user/profilePicture.ts`

### Twitch API (`serverless/twitch-api/utils/upload-limits.js`)

- **MAX_CLOUD_SAVE_SIZE**: `10 MB` (uses base limit from shared framework)
  - Applied to: Cloud save uploads in `handlers/cloud-storage.js`
  - Note: Cloudflare KV has a 25MB limit, but we use 10MB for safety
  - This applies to JSON stringified save data

---

## How to Change Limits

### Changing Service-Specific Limits

Edit the constant in the service's upload-limits file:

**Example: Change Mod Upload Limit to 50 MB**

Edit `serverless/mods-api/utils/upload-limits.ts`:

```typescript
// Change from:
export const MAX_MOD_FILE_SIZE = 35 * 1024 * 1024; // 35 MB

// To:
export const MAX_MOD_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
```

**Example: Change Thumbnail Limit to 2 MB**

Edit `serverless/mods-api/utils/upload-limits.ts`:

```typescript
// Change from:
export const MAX_THUMBNAIL_SIZE = DEFAULT_UPLOAD_LIMITS.maxThumbnailSize; // 1 MB

// To:
export const MAX_THUMBNAIL_SIZE = 2 * 1024 * 1024; // 2 MB
```

### Changing Base Limit (Affects All Services)

Edit `serverless/shared/api/upload-limits.ts`:

```typescript
// Change from:
export const BASE_UPLOAD_LIMIT = 10 * 1024 * 1024; // 10 MB

// To:
export const BASE_UPLOAD_LIMIT = 20 * 1024 * 1024; // 20 MB
```

**Note**: Changing the base limit affects all services that don't override it. Services with explicit overrides (like mods-api with 35 MB) are not affected.

### Adding a New Service with Custom Limits

1. Create `serverless/your-service/utils/upload-limits.ts`:

```typescript
import {
    BASE_UPLOAD_LIMIT,
    DEFAULT_UPLOAD_LIMITS,
    formatFileSize,
    validateFileSize,
} from '@strixun/api-framework';

// Override base limit for your service
export const MAX_YOUR_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// Use default thumbnail limit
export const MAX_THUMBNAIL_SIZE = DEFAULT_UPLOAD_LIMITS.maxThumbnailSize; // 1 MB

// Re-export utilities
export { formatFileSize, validateFileSize };
```

2. Use in your handlers:

```typescript
import { MAX_YOUR_FILE_SIZE, validateFileSize } from '../../utils/upload-limits.js';

// Validate file size
const sizeValidation = validateFileSize(file.size, MAX_YOUR_FILE_SIZE);
if (!sizeValidation.valid) {
    return new Response(JSON.stringify({ error: sizeValidation.error }), {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
    });
}
```

---

## Implementation Details

### Validation

All upload handlers use the `validateFileSize()` utility function from the shared framework, which:
- Checks if the file size exceeds the configured limit
- Returns a validation result with a human-readable error message
- Formats file sizes in a user-friendly format (B, KB, MB, GB)

### Error Responses

When a file exceeds the size limit, the API returns:
- **Status Code**: `413 Payload Too Large` (for mod/version uploads) or `400 Bad Request` (for thumbnails/profile pictures)
- **Error Format**: RFC 7807 Problem Details format (for mods API) or JSON error object (for other services)
- **Error Message**: Includes both the actual file size and the maximum allowed size in human-readable format

### File Size Formatting

The `formatFileSize()` utility function automatically formats file sizes:
- Bytes: `1024 B`
- Kilobytes: `512.5 KB`
- Megabytes: `100.0 MB`
- Gigabytes: `1.5 GB`

---

## Updated Handlers

The following handlers have been updated to use the configurable limits:

1. **Mods API**:
   - `handlers/mods/upload.ts` - Mod uploads (35 MB) and thumbnails (1 MB)
   - `handlers/versions/upload.ts` - Version uploads (35 MB)
   - `handlers/mods/update.ts` - Thumbnail updates (1 MB)

2. **OTP Auth Service**:
   - `handlers/user/profilePicture.ts` - Profile picture uploads (5 MB)

3. **Twitch API**:
   - `handlers/cloud-storage.js` - Cloud save uploads (10 MB)

---

## Thumbnail Format Support

Thumbnails support the following image formats:
- **PNG** (`.png`)
- **WebP** (`.webp`)
- **GIF** (`.gif`)
- **JPEG/JPG** (`.jpeg`, `.jpg`)

All thumbnail uploads are validated for:
- File size (max 1 MB)
- Image format (must be one of the supported formats)
- Image integrity (valid image headers)

---

## Notes

- Limits apply to the **encrypted file size** (as received from client) for mod/version uploads
- The actual decrypted file size may be slightly different due to encryption overhead
- Thumbnail and profile picture limits apply to the raw image file size
- Cloud save limits apply to the JSON stringified save data size
- The base 10 MB limit ensures that only services with explicit overrides (like mods-api) can exceed it

---

## TypeScript Note

If you see TypeScript errors about missing exports from `@strixun/api-framework` after adding new exports, you may need to:
1. Rebuild the TypeScript project
2. Restart your TypeScript language server
3. The runtime code will work correctly even if TypeScript shows errors until types are regenerated

---

## Testing

After modifying limits, test the following:
1. Upload a file that exceeds the limit - should return appropriate error
2. Upload a file that is exactly at the limit - should succeed
3. Upload a file that is below the limit - should succeed
4. Verify error messages display correct size information
5. Verify that services using base limit (10 MB) are enforced correctly
6. Verify that services with overrides (like mods-api with 35 MB) work correctly

---

**Last Updated**: 2025-12-29

