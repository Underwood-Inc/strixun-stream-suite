# Encryption Setup Guide - URL Shortener

**Last Updated:** 2025-12-29

## How End-to-End Encryption Works

### Flow Overview

1. **Build Time**: Vite reads `VITE_SERVICE_ENCRYPTION_KEY` from `.env` and injects it into the bundle
2. **Client Runtime**: App reads key from `import.meta.env.VITE_SERVICE_ENCRYPTION_KEY`
3. **Client Encryption**: OTP login component encrypts request body using the key
4. **Server Decryption**: Server decrypts using `SERVICE_ENCRYPTION_KEY` from Cloudflare Workers secrets

### Critical Requirement

**The client key and server key MUST match exactly.**

- Client: `VITE_SERVICE_ENCRYPTION_KEY` (in `.env` file)
- Server: `SERVICE_ENCRYPTION_KEY` (Cloudflare Workers secret)

---

## Setup Steps

### Step 1: Generate or Get the Encryption Key

If you don't have a key yet, generate one:

```bash
# Generate a strong 32+ character key
openssl rand -hex 32
```

Or use an existing key from your OTP auth service:

```bash
cd serverless/otp-auth-service
wrangler secret list
# Look for SERVICE_ENCRYPTION_KEY
```

### Step 2: Set Client-Side Key (Build Time)

Create `.env` file in the app directory:

```bash
# serverless/url-shortener/app/.env
VITE_SERVICE_ENCRYPTION_KEY=your-key-here-must-be-32-chars-minimum
```

**Important**: 
- Key must be at least 32 characters
- Never commit `.env` files to git
- Vite only exposes env vars starting with `VITE_` to the client

### Step 3: Set Server-Side Key (Runtime)

Set the same key in Cloudflare Workers secrets:

```bash
cd serverless/url-shortener
wrangler secret put SERVICE_ENCRYPTION_KEY
# Paste the SAME key you used in VITE_SERVICE_ENCRYPTION_KEY
```

### Step 4: Build the App

```bash
cd serverless/url-shortener
pnpm build:app
```

This will:
1. Read `VITE_SERVICE_ENCRYPTION_KEY` from `.env`
2. Bundle it into the JavaScript via `import.meta.env.VITE_SERVICE_ENCRYPTION_KEY`
3. Create `app-assets.ts` with the built files

### Step 5: Verify It Works

1. **Check client-side key retrieval**:
   - Open browser console
   - The app should be able to read the key from `import.meta.env.VITE_SERVICE_ENCRYPTION_KEY`
   - If missing, you'll see: "OTP encryption key is required"

2. **Test encryption/decryption**:
   - Try logging in with OTP
   - Check network tab - request body should be encrypted JSON
   - Server should successfully decrypt it

---

## How It Works Technically

### Client-Side (Browser)

```typescript
// 1. App.svelte gets key
import { getOtpEncryptionKey } from '../../../../shared-config/otp-encryption';
const key = getOtpEncryptionKey(); // Reads from import.meta.env.VITE_SERVICE_ENCRYPTION_KEY

// 2. Passes to OtpLogin component
<OtpLogin otpEncryptionKey={key} />

// 3. OtpLoginCore encrypts request
await encryptRequestBody({ email: "user@example.com" });
// Uses: PBKDF2 + AES-GCM-256 encryption
// Output: { version: 3, encrypted: true, algorithm: "AES-GCM-256", ... }
```

### Server-Side (Cloudflare Worker)

```typescript
// 1. Receives encrypted request body
const body = await request.json(); // { encrypted: true, ... }

// 2. Decrypts using SERVICE_ENCRYPTION_KEY
const serviceKey = env.SERVICE_ENCRYPTION_KEY; // From Workers secrets
const decrypted = await decryptWithServiceKey(body, serviceKey);
// Returns: { email: "user@example.com" }
```

---

## Troubleshooting

### "OTP encryption key is required"

**Problem**: Client can't find the encryption key.

**Solutions**:
1. Check `.env` file exists in `serverless/url-shortener/app/`
2. Verify key starts with `VITE_` prefix
3. Rebuild the app: `pnpm build:app`
4. Check browser console for errors

### "SERVICE_ENCRYPTION_KEY mismatch"

**Problem**: Client and server keys don't match.

**Solutions**:
1. Verify `.env` file has the same key as Workers secret
2. Check for extra spaces or newlines in the key
3. Rebuild app after changing `.env`
4. Redeploy worker after changing secret

### "Failed to decrypt OTP request"

**Problem**: Server can't decrypt the request.

**Solutions**:
1. Verify `SERVICE_ENCRYPTION_KEY` is set in Workers secrets
2. Check key length (must be 32+ characters)
3. Verify client and server keys match exactly
4. Check server logs for detailed error messages

---

## Security Notes

- [SUCCESS] Keys are bundled at build time (not in source code)
- [WARNING] Keys are still accessible in the JavaScript bundle
- [WARNING] Symmetric keys exposed to clients is a security trade-off
- [INFO] Consider removing client-side encryption (HTTPS is sufficient)
- [INFO] Consider asymmetric encryption (public key for client)

---

## Development vs Production

### Development

For local development, you can use the `.env` file:

```bash
# serverless/url-shortener/app/.env
VITE_SERVICE_ENCRYPTION_KEY=dev-key-here-32-chars-minimum
```

### Production

For production builds:

1. Set `VITE_SERVICE_ENCRYPTION_KEY` in your CI/CD environment
2. Build: `pnpm build:app`
3. Deploy: The key is bundled into the JavaScript
4. Set `SERVICE_ENCRYPTION_KEY` in Cloudflare Workers secrets

---

## Related Files

- `shared-config/otp-encryption.ts` - Key retrieval function
- `shared-components/otp-login/core.ts` - Encryption implementation
- `serverless/otp-auth-service/handlers/auth/request-otp.ts` - Server decryption
- `serverless/url-shortener/app/src/App.svelte` - Client usage
