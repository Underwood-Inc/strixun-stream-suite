# [LOCK] Security Guide - URL Shortener Encryption

**Last Updated:** 2025-12-29

## Encryption Key Management

**Current Implementation**: Encryption keys are managed via build-time injection only.

### Key Management Approach

- [SUCCESS] Keys must be provided at **BUILD TIME** via `VITE_SERVICE_ENCRYPTION_KEY`
- [SUCCESS] Keys are bundled into JavaScript during build
- [SUCCESS] No runtime key injection

---

## [LOCK] Current Encryption Architecture

### How It Works Now

1. **Build Time**: Set `VITE_SERVICE_ENCRYPTION_KEY` in `.env` file
2. **Build**: Vite bundles the key into the JavaScript bundle
3. **Runtime**: Client uses the bundled key to encrypt OTP requests
4. **Server**: Decrypts using `SERVICE_ENCRYPTION_KEY` from Cloudflare Workers secrets

### Security Trade-offs

**Current Approach (Build-time injection):**
- [SUCCESS] Better than runtime injection (not in plain HTML)
- [WARNING] Key is still in the JavaScript bundle (can be extracted)
- [WARNING] Symmetric key exposed to clients (fundamental security issue)

**Why This Is Still Problematic:**
- Anyone can extract the key from the JavaScript bundle
- They can decrypt intercepted encrypted requests
- They can create valid encrypted requests
- Symmetric encryption keys should **NEVER** be exposed to clients

---

## Recommended Solutions

### Option 1: Remove Client-Side Encryption (RECOMMENDED)

**Best Practice**: Rely on HTTPS/TLS, which already encrypts all traffic in transit.

**Why:**
- HTTPS/TLS provides end-to-end encryption
- No key management complexity
- Industry standard approach
- No client-side key exposure

**Implementation:**
1. Remove client-side encryption from OTP login component
2. Send plain JSON requests over HTTPS
3. Server validates requests normally
4. HTTPS encrypts everything in transit

### Option 2: Use Asymmetric Encryption

**If client-side encryption is required for compliance:**

- **Client**: Encrypts with **public key** (safe to expose)
- **Server**: Decrypts with **private key** (never exposed)

**Implementation:**
1. Generate RSA key pair (2048-bit or higher)
2. Bundle public key in client app (safe to expose)
3. Keep private key on server only
4. Client encrypts with public key, server decrypts with private key

### Option 3: Keep Current Approach (NOT RECOMMENDED)

**If you must use symmetric encryption:**

- [SUCCESS] Use build-time injection only (`VITE_SERVICE_ENCRYPTION_KEY`)
- [SUCCESS] Rotate keys frequently (monthly or more)
- [SUCCESS] Document the security trade-off
- [SUCCESS] Monitor for key extraction attempts
- [ERROR] Never use runtime injection

---

## Configuration

### Build-Time Key Injection

**1. Set environment variable:**

```bash
# serverless/url-shortener/app/.env
VITE_SERVICE_ENCRYPTION_KEY=your-32-character-minimum-key-here
```

**2. Build the app:**

```bash
cd serverless/url-shortener
pnpm build:app
```

**3. Deploy:**

The key is now bundled into the JavaScript. It will be accessible in the bundle, but not in plain HTML.

### Server-Side Key

**Set Cloudflare Workers secret:**

```bash
cd serverless/url-shortener
wrangler secret put SERVICE_ENCRYPTION_KEY
# Paste the same key used in VITE_SERVICE_ENCRYPTION_KEY
```

---

## Security Checklist

- [x] Removed runtime key injection
- [x] Using build-time injection only
- [ ] Documented security trade-offs
- [ ] Considered removing client-side encryption
- [ ] Considered asymmetric encryption
- [ ] Key rotation plan in place
- [ ] Monitoring for key extraction

---

## Related Documentation

- `shared-config/otp-encryption.ts` - Key retrieval function
- `shared-config/README.md` - Configuration guide
- `SECURITY_AUDIT_REPORT.md` - Full security audit
- `serverless/shared/encryption/` - Encryption utilities

---

## Important Notes

1. **Never commit `.env` files** with real keys to version control
2. **Rotate keys** if they're ever exposed or compromised
3. **Monitor** for unusual activity that might indicate key extraction
4. **Consider** removing client-side encryption entirely (HTTPS is sufficient)
5. **Document** any security trade-offs in your security policy

---

## Migration Path

If you want to remove client-side encryption:

1. Update OTP login component to send plain JSON
2. Remove encryption key configuration
3. Update server handlers to accept plain JSON (backward compatible)
4. Test thoroughly
5. Deploy

The server already supports both encrypted and plain requests (backward compatibility), so migration is straightforward.

