# Build Verification Guide

This document describes how to verify that the OTP Login library is properly built and ready for CDN distribution.

## Building the Library

```bash
cd shared-components/otp-login
pnpm build
```

This will:
1. Bundle `core.ts` into `dist/otp-core.js` (dev) and `dist/otp-core.min.js` (prod)
2. Bundle Svelte component into `dist/otp-login-svelte.js` (prod, minified)

## Verifying Dependencies Are Bundled

### Core Library (otp-core.js)

The core library should include:
- ✓ `OtpLoginCore` class
- ✓ `shared-config/otp-config.ts` (OTP_LENGTH, OTP_PATTERN, etc.)
- ✓ All encryption logic (no external dependencies)

**Verification Steps:**

1. **Check bundle size:**
   ```bash
   ls -lh shared-components/otp-login/dist/otp-core*.js
   ```
   - Development bundle should be ~50-100KB (unminified)
   - Production bundle should be ~20-40KB (minified)

2. **Check bundle contents:**
   ```bash
   grep -i "OTP_LENGTH" shared-components/otp-login/dist/otp-core.js
   ```
   Should find references to OTP_LENGTH (value: 9)

3. **Check for external dependencies:**
   ```bash
   grep -i "import\|require\|from" shared-components/otp-login/dist/otp-core.min.js | head -20
   ```
   Should only show internal references, no external npm packages

4. **Test in browser:**
   ```html
   <!DOCTYPE html>
   <html>
   <head>
     <script src="./dist/otp-core.min.js"></script>
   </head>
   <body>
     <script>
       // Should be available globally
       console.log(typeof window.OtpLoginCore); // Should be "function"
       
       // Test instantiation
       const login = new window.OtpLoginCore({
         apiUrl: 'https://auth.example.com',
         otpEncryptionKey: 'a'.repeat(32),
         onSuccess: (data) => console.log('Success:', data),
       });
       
       console.log('✓ Core library loaded successfully');
     </script>
   </body>
   </html>
   ```

### Svelte Component (otp-login-svelte.js)

The Svelte component bundle should include:
- ✓ Svelte runtime
- ✓ OtpLoginCore (or reference to it)
- ✓ All component styles (CSS)
- ✓ All child components (EmailForm, OtpForm, ErrorDisplay)

**Verification Steps:**

1. **Check bundle size:**
   ```bash
   ls -lh shared-components/otp-login/dist/otp-login-svelte.js
   ```
   Should be ~100-200KB (includes Svelte runtime)

2. **Check for Svelte runtime:**
   ```bash
   grep -i "svelte" shared-components/otp-login/dist/otp-login-svelte.js | head -5
   ```
   Should find Svelte-related code

3. **Test in browser:**
   ```html
   <!DOCTYPE html>
   <html>
   <head>
     <script src="./dist/otp-login-svelte.js"></script>
     <style>
       :root {
         --accent: #007bff;
         --text: #333;
         --card: #fff;
         /* ... other CSS variables ... */
       }
     </style>
   </head>
   <body>
     <div id="login-container"></div>
     <script>
       // Should be available globally
       console.log(typeof window.OtpLoginSvelte); // Should be "object"
       console.log(typeof window.OtpLoginSvelte.mountOtpLogin); // Should be "function"
       
       // Test mounting
       const component = window.OtpLoginSvelte.mountOtpLogin({
         target: document.getElementById('login-container'),
         apiUrl: 'https://auth.example.com',
         otpEncryptionKey: 'a'.repeat(32),
         onSuccess: (data) => console.log('Success:', data),
       });
       
       console.log('✓ Svelte component loaded successfully');
     </script>
   </body>
   </html>
   ```

## Common Issues

### Issue: "OTP_LENGTH is not defined"

**Cause:** `shared-config/otp-config.ts` not bundled correctly

**Solution:**
1. Check that `core.ts` imports from `../../shared-config/otp-config.js`
2. Verify the path resolves correctly from `shared-components/otp-login/core.ts`
3. Rebuild: `pnpm build`

### Issue: "OtpLoginCore is not a function"

**Cause:** Bundle wrapper not exposing correctly

**Solution:**
1. Check `bundle-core.js` wrapper code
2. Verify `globalName: 'OtpLoginCoreLib'` matches wrapper
3. Rebuild: `pnpm build`

### Issue: "Cannot find module 'shared-config'"

**Cause:** esbuild not resolving relative paths

**Solution:**
1. Ensure imports use relative paths: `../../shared-config/otp-config.js`
2. Check that `shared-config` directory exists at project root
3. Rebuild: `pnpm build`

## Testing the Build

Run the test suite to ensure everything works:

```bash
# From project root
pnpm test shared-components/otp-login

# With coverage
pnpm test shared-components/otp-login -- --coverage
```

## CDN Deployment Checklist

Before deploying to CDN:

- [ ] Build completes without errors
- [ ] Bundle sizes are reasonable (< 200KB for Svelte, < 50KB for core)
- [ ] All dependencies are bundled (no external imports)
- [ ] Browser test passes (loads and instantiates correctly)
- [ ] TypeScript definitions included (`otp-login.d.ts`)
- [ ] Documentation updated (`CDN_USAGE.md`)
- [ ] Version number updated in `package.json`
- [ ] Tests pass with 100% (or close) coverage

## Next Steps

After verification:

1. **Deploy to CDN** (e.g., Cloudflare, AWS CloudFront, etc.)
2. **Update documentation** with actual CDN URLs
3. **Create example HTML files** in `examples/` directory
4. **Test in production** with real API endpoints
5. **Monitor** bundle size and performance

