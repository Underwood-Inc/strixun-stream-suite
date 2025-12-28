# Shared Configuration

This directory contains centralized configuration that is shared across all applications in the workspace.

## SERVICE_ENCRYPTION_KEY

**File**: `otp-encryption.ts`

This is the **SINGLE SOURCE OF TRUTH** for retrieving the SERVICE_ENCRYPTION_KEY. All apps import from this file to ensure consistent key retrieval.

### [SECURITY] Security

**CRITICAL**: The encryption key is **NEVER** stored in:
- [ERROR] Source code (no hardcoded constants)
- [ERROR] localStorage/sessionStorage (browser storage)
- [ERROR] Version control (git)

The key **MUST** be provided via:
- [SUCCESS] Environment variables (`VITE_SERVICE_ENCRYPTION_KEY`)
- [SUCCESS] Build-time injection (CI/CD secrets)
- [SUCCESS] Runtime injection via `window.getOtpEncryptionKey()` (development only)

### To Configure the Encryption Key

1. **Create/update `.env` file** in each app directory:
   ```bash
   # mods-hub/.env
   VITE_SERVICE_ENCRYPTION_KEY=KEY_HERE
   
   # serverless/url-shortener/app/.env
   VITE_SERVICE_ENCRYPTION_KEY=KEY_HERE
   ```

2. **Update server-side secrets** to match:
   ```bash
   cd serverless/otp-auth-service
   wrangler secret put SERVICE_ENCRYPTION_KEY
   # Paste: KEY_HERE
   ```

3. **Never commit `.env` files** - Add to `.gitignore`

### Usage in Apps

```typescript
import { getOtpEncryptionKey } from '../../shared-config/otp-encryption';

const key = getOtpEncryptionKey();
if (!key) {
  throw new Error('SERVICE_ENCRYPTION_KEY not configured. Set VITE_SERVICE_ENCRYPTION_KEY in .env');
}
```

### Why This Approach?

- [SUCCESS] **Single source of truth** - One function, consistent behavior everywhere
- [SUCCESS] **Secure** - Key never stored in code or browser storage
- [SUCCESS] **Type-safe** - TypeScript ensures correct usage
- [SUCCESS] **Environment-based** - Uses standard Vite environment variables
- [SUCCESS] **Easy to update** - Change .env files, all apps get the update
- [SUCCESS] **Consistent** - Uses same SERVICE_ENCRYPTION_KEY as all other services

