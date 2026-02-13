# Worker Port Mapping for Local Development

This document defines the standard port mapping for all workers when running locally with `wrangler dev --port`.

## Standard Port Assignment

All workers use sequential ports starting from **8787**:

| Worker | Port | URL | Status |
|--------|------|-----|--------|
| **otp-auth-service** | 8787 | `http://localhost:8787` | ✅ No Conflict |
| **mods-api** | 8788 | `http://localhost:8788` | ✅ No Conflict |
| **twitch-api** | 8789 | `http://localhost:8789` | ✅ No Conflict |
| **customer-api** | 8790 | `http://localhost:8790` | ✅ No Conflict |
| **chat-signaling** | 8792 | `http://localhost:8792` | ✅ No Conflict |
| **url-shortener** | 8793 | `http://localhost:8793` | ✅ No Conflict |
| **game-api** | 8794 | `http://localhost:8794` | ✅ No Conflict |
| **access-service** | 8795 | `http://localhost:8795` | ✅ No Conflict |

> **Historical Note:** Access Service was originally set to port 8794, which conflicted with Game API.
> This was resolved by moving Access Service to port 8795. See the incident details below.

## Usage

### Running Individual Workers

Each worker's `package.json` includes a `dev` script with the correct port:

```bash
# From worker directory
cd serverless/otp-auth-service
pnpm dev  # Runs on port 8787

cd serverless/mods-api
pnpm dev  # Runs on port 8788

# etc...
```

### Running Multiple Workers

When running multiple workers concurrently, each uses its assigned port automatically:

```bash
# From mods-hub directory
cd mods-hub
pnpm dev:all  # Starts frontend + mods-api + otp-auth-service + customer-api

# All workers use their standard ports from package.json
```

### E2E Tests

E2E tests in `playwright.config.ts` use the same port mapping:

- BASE_PORT = 8787 (configurable via `E2E_LOCAL_WORKER_PORT`)
- Workers start on sequential ports: 8787, 8788, 8789, etc.

## Port Conflicts

If you need to change ports (e.g., port 8787 is already in use):

1. **Temporary override**: Use environment variable or command-line flag:
   ```bash
   wrangler dev --port 8887
   ```

2. **Permanent change**: Update the worker's `package.json` dev script and `playwright.config.ts`

## Verification

To verify all workers are using correct ports:

```bash
# Check all worker package.json files
grep -r '"dev":' serverless/*/package.json

# Should show:
# "dev": "wrangler dev --port 8787 --local"  (otp-auth-service)
# "dev": "wrangler dev --port 8788 --local"  (mods-api)
# "dev": "wrangler dev --port 8789 --local"  (twitch-api)
# etc...
```

## Troubleshooting

If you encounter issues with `wrangler dev`, see [TROUBLESHOOTING_WRANGLER.md](./TROUBLESHOOTING_WRANGLER.md) for common solutions.

**Note:** `wrangler dev --clear-cache` is not a valid command. To clear cache, delete `.wrangler` directories manually.

## Benefits

1. **Consistency**: All workers use predictable ports
2. **No Conflicts**: Sequential ports prevent collisions
3. **Easy Debugging**: Know exactly which port each worker uses
4. **Documentation**: Port mapping is explicit in package.json
5. **E2E Tests**: Tests can reliably find workers on expected ports

---

## Port Conflict Incident Log

### Access Service & Game API (Port 8794) — RESOLVED

**Issue:** When running `pnpm dev:turbo`, Game API and Access Service were both assigned port 8794.

**Root Cause:** Access Service was changed from 8791 to 8794 without realizing Game API already occupied 8794.

**Resolution:** Access Service moved to port **8795**.

**Files Updated (23 files):**

- **Configuration:** `serverless/access-service/package.json`, `serverless/access-service/wrangler.toml`, `access-hub/vite.config.ts`, `access-hub/src/App.tsx`, `scripts/show-dev-ports.js`
- **Tests:** `serverless/access-service/shared/test-helpers/miniflare-workers.ts`, `serverless/access-service/access-service.integration.test.ts`, `serverless/access-service/auto-provisioning.integration.test.ts`, `serverless/access-service/auto-initialization.integration.test.ts`, `serverless/access-service/utils/rate-limit.test.ts`, `serverless/access-service/utils/auth.test.ts`
- **Docs:** `serverless/ACCESS_SERVICE_USAGE_GUIDE.md`, `ACCESS_ARCHITECTURE_REFACTOR.md`, `ACCESS_HUB_SETUP_COMPLETE.md`, `access-hub/QUICK_START.md`, `ACCESS_URL_MIGRATION_COMPLETE.md`

**Additional Fix:** Chat Signaling was missing a `zod` dependency causing build failures — resolved with `pnpm install` in `serverless/chat-signaling`.

**Production URLs (unchanged):** Frontend: `https://access.idling.app` | Backend API: `https://access-api.idling.app`
