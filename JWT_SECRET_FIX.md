# JWT Secret Mismatch - Fixed! 🔧

## Problem Summary

Your authentication was failing because **different services were using different JWT_SECRET values**:

- ✗ **otp-auth-service**: Was using `test-jwt-secret-for-integration-tests`
- ✓ **mods-api**: Was using `test-jwt-secret-for-local-development-12345678901234567890123456789012` (correct)
- ✗ **customer-api**: Was using `test-jwt-secret-for-integration-tests`

When tokens are created with one secret but verified with another, JWT signature verification fails, causing all authenticated requests to return `401 Unauthorized`.

## What Was Fixed

✓ Updated `serverless/otp-auth-service/.dev.vars` to use the correct JWT_SECRET  
✓ Updated `serverless/customer-api/.dev.vars` to use the correct JWT_SECRET  
✓ All services now use: `test-jwt-secret-for-local-development-12345678901234567890123456789012`

## Next Steps

**IMPORTANT**: You need to restart your development servers for the changes to take effect:

1. **Stop all running services** (Ctrl+C in each terminal)
2. **Restart them**:
   ```powershell
   # Terminal 1: OTP Auth Service
   cd serverless/otp-auth-service
   pnpm dev
   
   # Terminal 2: Mods API
   cd serverless/mods-api
   pnpm dev
   
   # Terminal 3: Customer API (if running)
   cd serverless/customer-api
   pnpm dev
   
   # Terminal 4: Mods Hub
   cd mods-hub
   pnpm dev
   ```

3. **Clear your browser's localStorage** (old tokens were created with the wrong secret):
   - Open browser DevTools (F12)
   - Go to Application/Storage tab
   - Clear `localStorage` for `localhost:3001`
   - Or manually delete the `auth-storage` key

4. **Log in again** - Your new tokens will be created with the correct secret

## Verification

You can verify the fix worked by running:
```powershell
node serverless/scripts/verify-jwt-secrets.js
```

All services should now show ✓ MATCHES.

## Why This Happened

The `.dev.vars` files had different JWT_SECRET values, likely from:
- Different setup scripts using different defaults
- Manual edits that weren't synchronized
- Copy-paste errors

## Prevention

The verification script (`serverless/scripts/verify-jwt-secrets.js`) can be run anytime to check that all services are using matching secrets. Consider adding it to your pre-commit hooks or CI pipeline.

---

**Note**: The browser extension errors (`runtime.lastError`, `polyfill.js`) are unrelated to this issue - they're from browser extensions trying to communicate and can be safely ignored.
