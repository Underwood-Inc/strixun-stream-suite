# Access Service Architecture Refactor

## Overview

Refactored the Access Service to follow the same cognitive pattern as Mods Hub, separating frontend and backend into distinct services with aligned naming.

## New Architecture

### Before (Problematic)
- `access.idling.app` → Backend API (Worker) ❌
- No frontend UI ❌
- Missing `/*` in route pattern causing path matching issues ❌
- Used `custom_domain = true` causing manual re-enabling issues ❌

### After (Aligned)
- `access.idling.app` → Frontend UI (Cloudflare Pages) ✅
- `access-api.idling.app` → Backend API (Worker) ✅
- Follows same pattern as Mods Hub ✅
- Uses standard routing with `/*` wildcard ✅

## Pattern Alignment

Now matches the Mods Hub architecture:

| Service | Frontend | Backend API |
|---------|----------|-------------|
| **Mods** | `mods.idling.app` | `mods-api.idling.app` |
| **Access** | `access.idling.app` | `access-api.idling.app` |

## Changes Made

### 1. Backend API (Access Service Worker)

**File:** `serverless/access-service/wrangler.toml`

```toml
# Before
[[routes]]
pattern = "access.idling.app"
zone_name = "idling.app"
custom_domain = true

# After
[[routes]]
pattern = "access-api.idling.app/*"
zone_name = "idling.app"
```

**Benefits:**
- ✅ Matches all API paths with `/*` wildcard
- ✅ Removes problematic `custom_domain = true` flag
- ✅ Follows same pattern as other working services

### 2. URL References Updated

Updated all references from `https://access.idling.app` to `https://access-api.idling.app`:

- ✅ `serverless/otp-auth-service/wrangler.toml` (2 occurrences)
- ✅ `serverless/mods-api/wrangler.toml`
- ✅ `serverless/otp-auth-service/src/dashboard/lib/access-api-client.ts`
- ✅ `serverless/shared/access-client.ts`
- ✅ `serverless/access-service/scripts/migrate-existing-customers.ts`
- ✅ `.github/workflows/deploy-manager.yml`
- ✅ `.github/workflows/deploy-access-service.yml`

### 3. Mods API Route Fix

**File:** `serverless/mods-api/wrangler.toml`

```toml
# Before
[[routes]]
pattern = "mods-api.idling.app"
zone_name = "idling.app"
custom_domain = true

# After
[[routes]]
pattern = "mods-api.idling.app/*"
zone_name = "idling.app"
```

### 4. Frontend UI Created

**New Directory:** `access-hub/`

Created a minimal React + Vite frontend application with:
- ✅ Simple, clean UI
- ✅ Displays all system roles
- ✅ Displays all permissions
- ✅ Direct API integration with `access-api.idling.app`
- ✅ Same build pattern as Mods Hub

**Key Files:**
- `access-hub/package.json` - Dependencies and scripts
- `access-hub/src/App.tsx` - Main UI component
- `access-hub/vite.config.ts` - Build configuration
- `access-hub/README.md` - Documentation

### 5. Deployment Workflows

**New Workflow:** `.github/workflows/deploy-access-hub.yml`
- Deploys frontend to Cloudflare Pages at `access.idling.app`

**Updated Workflow:** `.github/workflows/deploy-manager.yml`
- Added Access Hub deployment option
- Updated ALLOWED_ORIGINS to include both:
  - `https://access.idling.app` (frontend)
  - `https://access-api.idling.app` (backend)

### 6. CORS Configuration

Updated default ALLOWED_ORIGINS in all workflows to include:

**Production:**
```
https://mods.idling.app
https://auth.idling.app
https://access.idling.app          ← NEW (frontend)
https://access-api.idling.app      ← NEW (backend)
https://api.idling.app
https://customer.idling.app
https://game.idling.app
https://s.idling.app
https://chat.idling.app
https://idling.app
https://www.idling.app
```

**Development:** (adds localhost ports including `5175` for Access Hub)

## DNS Requirements

### Cloudflare DNS Records Needed

1. **Access Hub Frontend:**
   - **Type:** AAAA
   - **Name:** `access`
   - **Content:** `100::` (Cloudflare Workers/Pages placeholder)
   - **Proxy:** ✅ Proxied (orange cloud)

2. **Access API Backend:**
   - **Type:** AAAA
   - **Name:** `access-api`
   - **Content:** `100::` (Cloudflare Workers placeholder)
   - **Proxy:** ✅ Proxied (orange cloud)

3. **Mods API Backend:** (if not already exists)
   - **Type:** AAAA
   - **Name:** `mods-api`
   - **Content:** `100::` (Cloudflare Workers placeholder)
   - **Proxy:** ✅ Proxied (orange cloud)

## GitHub Secrets Required

Update the `ALLOWED_ORIGINS` secret to include the new domains:

**Value:**
```
https://mods.idling.app,https://auth.idling.app,https://access.idling.app,https://access-api.idling.app,https://api.idling.app,https://customer.idling.app,https://game.idling.app,https://s.idling.app,https://chat.idling.app,https://idling.app,https://www.idling.app
```

## Deployment Instructions

### Initial Setup (One-Time)

1. **Create DNS Records** (in Cloudflare Dashboard)
   - Add `access` → `100::` (AAAA, Proxied)
   - Add `access-api` → `100::` (AAAA, Proxied)

2. **Update GitHub Secret**
   - Go to: Repo → Settings → Secrets → Actions
   - Update `ALLOWED_ORIGINS` with the new value above

3. **Install Dependencies**
   ```bash
   pnpm install
   ```

### Deploy Access Service

```bash
# Deploy backend API
cd serverless/access-service
pnpm exec wrangler deploy

# Or use GitHub Actions
# Go to: Actions → Deploy Service(s) → Run workflow
# Check: Deploy Access Service
```

### Deploy Access Hub

```bash
# Deploy frontend UI
cd access-hub
pnpm build
pnpm exec wrangler pages deploy ../dist/access-hub --project-name=access-hub

# Or use GitHub Actions
# Go to: Actions → Deploy Service(s) → Run workflow
# Check: Deploy Access Hub
```

## Testing

### Local Development

**Option A: Run Both Together (Recommended)**
```bash
# From access-hub directory - runs both frontend and backend
cd access-hub
pnpm dev:all
# Visit: http://localhost:5178
```

**Option B: Run Separately**
```bash
# Terminal 1: Access API (backend)
cd serverless/access-service
pnpm dev
# Runs on: http://localhost:8795

# Terminal 2: Access Hub (frontend)
cd access-hub
pnpm dev
# Visit: http://localhost:5178
```

**Option C: Run Everything with Turbo**
```bash
# From root - runs ALL services
pnpm dev:turbo
# Then check ports:
pnpm dev:ports
# Access Hub will be at: http://localhost:5178
```

### Production

- **Frontend:** https://access.idling.app
- **Backend API:** https://access-api.idling.app
- **Health Check:** https://access-api.idling.app/health
- **Roles List:** https://access-api.idling.app/access/roles
- **Permissions List:** https://access-api.idling.app/access/permissions

## Benefits

1. ✅ **Cognitive Alignment** - Frontend and backend URLs match the pattern
2. ✅ **No Manual Re-enabling** - Removed `custom_domain = true` flag
3. ✅ **Proper Path Matching** - Added `/*` wildcard to routes
4. ✅ **CORS Issues Resolved** - Updated ALLOWED_ORIGINS everywhere
5. ✅ **User Interface** - Clean, minimal UI for viewing roles/permissions
6. ✅ **Consistent Architecture** - Matches Mods Hub pattern exactly

## Migration Notes

- **Old URL:** `https://access.idling.app` → Will redirect to frontend UI
- **New API URL:** `https://access-api.idling.app` → Backend API
- All internal service references have been updated
- External integrations will need to update to new API URL

## Rollback Plan

If issues occur:

1. Revert `wrangler.toml` changes
2. Revert workflow updates
3. Update GitHub secret back to old value
4. Delete DNS records for `access` and `access-api`
5. Re-enable custom domain in Cloudflare dashboard

## Next Steps

1. ✅ Push changes to repository
2. ⏳ Deploy Access API to `access-api.idling.app`
3. ⏳ Deploy Access Hub to `access.idling.app`
4. ⏳ Verify DNS propagation
5. ⏳ Test CORS from frontend
6. ⏳ Update any external integrations using the Access Service
