# Environment Variable Setup Guide ★ ## Where to Put .env Files

You need to create `.env` files in **3 locations**:

### 1. Main App (Root)
**Location**: `.env` (in the root directory, same level as `package.json`)

```bash
# Root directory .env
VITE_SERVICE_ENCRYPTION_KEY=KEY_HERE
VITE_AUTH_API_URL=https://auth.idling.app
```

### 2. Mods Hub
**Location**: `mods-hub/.env` (inside the mods-hub directory)

```bash
# mods-hub/.env
VITE_SERVICE_ENCRYPTION_KEY=KEY_HERE
VITE_AUTH_API_URL=https://auth.idling.app
```

### 3. URL Shortener App
**Location**: `serverless/url-shortener/app/.env` (inside the url-shortener app directory)

```bash
# serverless/url-shortener/app/.env
VITE_SERVICE_ENCRYPTION_KEY=KEY_HERE
VITE_AUTH_API_URL=https://auth.idling.app
```

## Quick Setup Commands

```bash
# 1. Root directory
echo "VITE_SERVICE_ENCRYPTION_KEY=KEY_HERE" > .env
echo "VITE_AUTH_API_URL=https://auth.idling.app" >> .env

# 2. Mods Hub
echo "VITE_SERVICE_ENCRYPTION_KEY=KEY_HERE" > mods-hub/.env
echo "VITE_AUTH_API_URL=https://auth.idling.app" >> mods-hub/.env

# 3. URL Shortener App
echo "VITE_SERVICE_ENCRYPTION_KEY=KEY_HERE" > serverless/url-shortener/app/.env
echo "VITE_AUTH_API_URL=https://auth.idling.app" >> serverless/url-shortener/app/.env
```

## File Structure

```
.
├── .env                           CREATE THIS (root)
├── package.json
├── mods-hub/
│   ├── .env                       CREATE THIS
│   └── package.json
└── serverless/
    └── url-shortener/
        └── app/
            ├── .env               CREATE THIS
            └── package.json
```

## Verification

After creating the files, verify they exist:

```bash
# Check if files exist
ls -la .env
ls -la mods-hub/.env
ls -la serverless/url-shortener/app/.env
```

## Security Notes

- ✓ `.env` files are already in `.gitignore` (won't be committed)
- ✓ Never commit `.env` files to git
- ✓ Use the same key in all 3 locations
- ✓ Key must match server-side `SERVICE_ENCRYPTION_KEY` secret (same key as all other services)

## Frontend vs Backend Naming Convention

**IMPORTANT**: Frontend and backend use different variable names for the same encryption key:

### Frontend (Vite Applications)
- **Variable Name**: `VITE_SERVICE_ENCRYPTION_KEY`
- **Location**: `.env` files in frontend app directories
- **Why**: Vite requires the `VITE_` prefix for environment variables to be exposed to the client
- **Example**: `VITE_SERVICE_ENCRYPTION_KEY=your-key-here`

### Backend (Cloudflare Workers)
- **Variable Name**: `SERVICE_ENCRYPTION_KEY`
- **Location**: Cloudflare Worker secrets (set via `wrangler secret put`)
- **Why**: Workers don't use the `VITE_` prefix (that's only for Vite)
- **Example**: `wrangler secret put SERVICE_ENCRYPTION_KEY`

**CRITICAL**: Both must have the **SAME VALUE**, but different names for their respective environments. The frontend `VITE_SERVICE_ENCRYPTION_KEY` value must match the backend `SERVICE_ENCRYPTION_KEY` value.

## Current SERVICE_ENCRYPTION_KEY

```
KEY_HERE
```

**This is the same key used by ALL services** - no separate OTP key needed!

