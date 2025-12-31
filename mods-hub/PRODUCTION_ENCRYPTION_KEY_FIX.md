# Production Mod Upload Fix - Service Key Mismatch

## Problem

Mod uploads fail in production with the error:
```
Decryption Failed: Failed to decrypt uploaded file. Please ensure the file was encrypted with either the service key (for public mods) or your JWT token (for private mods).
```

The root cause is a **service key mismatch** between the frontend build and the backend worker.

## Root Cause

1. **Frontend (mods-hub)**: Encrypts files using `VITE_SERVICE_ENCRYPTION_KEY` set at **build time** (from GitHub secrets)
2. **Backend (mods-api)**: Decrypts files using `SERVICE_ENCRYPTION_KEY` from **Cloudflare Worker secrets**
3. **These keys must match exactly** - if they don't, decryption fails

## Error Flow

1. User uploads a public mod on `mods.idling.app`
2. Frontend encrypts file with `VITE_SERVICE_ENCRYPTION_KEY` (from build)
3. Backend receives encrypted file and tries to decrypt with `SERVICE_ENCRYPTION_KEY` (from Cloudflare secret)
4. Key hash mismatch → Decryption fails → Upload fails

## Solution

### Step 1: Verify GitHub Secret

Check that `VITE_SERVICE_ENCRYPTION_KEY` is set in GitHub Secrets:
1. Go to repository Settings → Secrets and variables → Actions
2. Verify `VITE_SERVICE_ENCRYPTION_KEY` exists
3. Note the value (or check if it's set correctly)

### Step 2: Verify Cloudflare Worker Secret

Check that `SERVICE_ENCRYPTION_KEY` is set in Cloudflare:
```bash
cd serverless/mods-api
pnpm exec wrangler secret list
```

Look for `SERVICE_ENCRYPTION_KEY` in the list.

### Step 3: Ensure Keys Match

**CRITICAL**: Both keys must have the **exact same value**.

1. **Get the Cloudflare Worker secret value:**
   ```bash
   cd serverless/mods-api
   # The secret value is not directly readable, but you can verify it matches
   ```

2. **Update GitHub secret to match:**
   - Go to repository Settings → Secrets and variables → Actions
   - Edit `VITE_SERVICE_ENCRYPTION_KEY`
   - Set it to the same value as the Cloudflare `SERVICE_ENCRYPTION_KEY`
   - Save

3. **Rebuild and redeploy:**
   - The next deployment will use the updated GitHub secret
   - Or trigger a manual deployment to rebuild immediately

### Step 4: Verify Fix

After redeployment:
1. Try uploading a public mod on `mods.idling.app`
2. Upload should succeed
3. Check browser console - no encryption key errors

## Alternative: Update Cloudflare Secret

If you prefer to update the Cloudflare secret instead:

```bash
cd serverless/mods-api
pnpm exec wrangler secret put SERVICE_ENCRYPTION_KEY
# Paste the value from GitHub secret VITE_SERVICE_ENCRYPTION_KEY
```

**Note**: This requires redeploying the worker for the change to take effect.

## Verification Commands

### Check if keys are set (GitHub):
- Repository Settings → Secrets and variables → Actions
- Look for `VITE_SERVICE_ENCRYPTION_KEY`

### Check if keys are set (Cloudflare):
```bash
cd serverless/mods-api
pnpm exec wrangler secret list | grep SERVICE_ENCRYPTION_KEY
```

### Test locally (keys should match):
```bash
# Check local .dev.vars
cd serverless/otp-auth-service
cat .dev.vars | grep SERVICE_ENCRYPTION_KEY

# Check mods-hub .env
cd ../../mods-hub
cat .env | grep VITE_SERVICE_ENCRYPTION_KEY
```

Both should show the same value.

## Why E2E Tests Pass

E2E tests pass because:
1. Tests use local workers with `.dev.vars` files
2. Playwright config sets `VITE_SERVICE_ENCRYPTION_KEY` from `.dev.vars` (line 182 in `playwright.config.ts`)
3. Local workers use `SERVICE_ENCRYPTION_KEY` from `.dev.vars`
4. Both come from the same source, so they always match

Production fails because:
1. Frontend build uses GitHub secret `VITE_SERVICE_ENCRYPTION_KEY`
2. Backend uses Cloudflare secret `SERVICE_ENCRYPTION_KEY`
3. These are separate secrets that can get out of sync

## Prevention

To prevent this issue in the future:

1. **Documentation**: Keep this file updated
2. **Automation**: Consider a script that syncs secrets
3. **Validation**: Add a deployment check that verifies keys match (if possible)
4. **Monitoring**: Add error alerts for decryption failures

## Related Files

- `.github/workflows/deploy-mods-hub.yml` - Sets `VITE_SERVICE_ENCRYPTION_KEY` during build (line 154)
- `mods-hub/src/services/api.ts` - Uses `getOtpEncryptionKey()` to encrypt files
- `serverless/mods-api/handlers/mods/upload.ts` - Decrypts files with `env.SERVICE_ENCRYPTION_KEY`
- `shared-config/otp-encryption.ts` - Centralized key retrieval function
