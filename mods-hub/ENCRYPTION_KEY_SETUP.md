# Encryption Key Setup for Mods Hub

**CRITICAL**: The frontend (`mods-hub`) must have `VITE_SERVICE_ENCRYPTION_KEY` that matches the backend worker's `SERVICE_ENCRYPTION_KEY` for login to work.

## Quick Setup

### Option 1: Automatic (Recommended)

Run the setup script before starting dev:

```bash
cd mods-hub
pnpm setup:env
pnpm dev:all
```

The `predev` and `predev:all` hooks will automatically run `setup:env` before starting.

### Option 2: Manual

1. **Get the encryption key from worker .dev.vars:**
   ```bash
   cd serverless/otp-auth-service
   # Check if .dev.vars exists, if not run:
   pnpm setup:test-secrets
   ```

2. **Find the SERVICE_ENCRYPTION_KEY value:**
   ```bash
   # Windows PowerShell
   Select-String -Path .dev.vars -Pattern "SERVICE_ENCRYPTION_KEY="
   ```

3. **Create mods-hub/.env file:**
   ```bash
   cd ../../mods-hub
   echo "VITE_SERVICE_ENCRYPTION_KEY=<value-from-step-2>" > .env
   ```

## Test Key (Default)

If using test secrets (from `setup-test-secrets.js`), the default key is:

```
test-service-encryption-key-for-local-development-12345678901234567890123456789012
```

Create `mods-hub/.env` with:
```
VITE_SERVICE_ENCRYPTION_KEY=test-service-encryption-key-for-local-development-12345678901234567890123456789012
```

## Verification

After creating `.env`, restart the dev server:

```bash
cd mods-hub
pnpm dev:all
```

The login should now work without encryption key mismatch errors.

## Troubleshooting

**Error: "SERVICE_ENCRYPTION_KEY mismatch"**
- Ensure `mods-hub/.env` has `VITE_SERVICE_ENCRYPTION_KEY`
- Ensure it matches `SERVICE_ENCRYPTION_KEY` in `serverless/otp-auth-service/.dev.vars`
- Restart Vite dev server after creating/updating `.env`

**Error: "VITE_SERVICE_ENCRYPTION_KEY not found"**
- Create `mods-hub/.env` file
- Add `VITE_SERVICE_ENCRYPTION_KEY=...` line
- Restart Vite dev server

## Why Two Different Names?

- **Frontend**: Uses `VITE_SERVICE_ENCRYPTION_KEY` (Vite requires `VITE_` prefix)
- **Backend**: Uses `SERVICE_ENCRYPTION_KEY` (Workers don't use `VITE_` prefix)
- **Both must have the SAME VALUE** for encryption to work

