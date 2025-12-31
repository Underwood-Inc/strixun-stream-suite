# Worker Port Mapping for Local Development

This document defines the standard port mapping for all workers when running locally with `wrangler dev --port`.

## Standard Port Assignment

All workers use sequential ports starting from **8787**:

| Worker | Port | Package.json Dev Script |
|--------|------|-------------------------|
| **otp-auth-service** | 8787 | `wrangler dev --port 8787` |
| **mods-api** | 8788 | `wrangler dev --port 8788` |
| **twitch-api** | 8789 | `wrangler dev --port 8789` |
| **customer-api** | 8790 | `wrangler dev --port 8790` |
| **game-api** | 8791 | `wrangler dev --port 8791` |
| **chat-signaling** | 8792 | `wrangler dev --port 8792` |
| **url-shortener** | 8793 | `wrangler dev --port 8793` |

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
