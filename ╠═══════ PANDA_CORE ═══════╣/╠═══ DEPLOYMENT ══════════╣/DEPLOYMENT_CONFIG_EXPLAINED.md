# Deployment Configuration Explained

## When Workflows Run

### OTP Auth Service Workflow (`.github/workflows/deploy-otp-auth.yml`)

**Step 1: Deploy**
```bash
pnpm run deploy
```
This executes: `pnpm build && wrangler deploy` (from `package.json`)

**Which Configuration is Used?**
- **Command**: `wrangler deploy` (NO `--env` flag)
- **Result**: Uses **root/default configuration** from `wrangler.toml`

### Configuration Hierarchy

When `wrangler deploy` is run **without** `--env`:

1. **Uses Root/Default Section:**
   ```toml
   [vars]
   ENVIRONMENT = "production"
   CUSTOMER_API_URL = "https://customer-api.idling.app"
   
   [[kv_namespaces]]
   binding = "OTP_AUTH_KV"
   id = "680c9dbe86854c369dd23e278abb41f9"
   
   routes = [
     { pattern = "auth.idling.app/*", zone_name = "idling.app" }
   ]
   ```

2. **Does NOT Use:**
   - `[env.production]` section (only used with `--env production`)
   - `[env.development]` section (only used with `--env development`)

### What Gets Deployed

**Worker Name:** `otp-auth-service` (base name, no environment suffix)

**Bindings Available:**
- `env.OTP_AUTH_KV` - KV Namespace (from root `[[kv_namespaces]]`)
- `env.ENVIRONMENT` = `"production"` (from root `[vars]`)
- `env.CUSTOMER_API_URL` = `"https://customer-api.idling.app"` (from root `[vars]`)

**Routes:**
- Routes in `wrangler.toml` are **ignored** if routes are configured in Cloudflare Dashboard
- Dashboard routes take precedence
- Current dashboard route: `auth.idling.app/*`

### Secrets

**Step 2: Set Secrets**
```bash
wrangler secret put JWT_SECRET
wrangler secret put RESEND_API_KEY
# ... etc
```

**Current Issue:**
- Secrets are set **without** `--env=""` flag
- This causes warnings but still works (secrets go to base worker)
- **Should be:** `wrangler secret put JWT_SECRET --env=""` to explicitly target base environment

### Summary

**When workflow runs `pnpm run deploy`:**

| Configuration Source | Value Used |
|---------------------|------------|
| Worker Name | `otp-auth-service` (from root `name =`) |
| KV Bindings | Root `[[kv_namespaces]]` (default bindings) |
| Environment Vars | Root `[vars]` section |
| Routes | Cloudflare Dashboard (if configured) OR root `routes = [...]` |
| Secrets | Base worker (no environment suffix) |

**Key Point:** The default KV bindings we added ensure that when routes are configured in the Cloudflare Dashboard (not via `--env production`), the worker still has access to KV namespaces.

## Other Workers

All other workers follow the same pattern:
- `wrangler deploy` (no `--env`) ★ Uses root/default configuration
- Default KV/R2 bindings ensure they work with dashboard-configured routes
- Secrets should be set with `--env=""` to explicitly target base environment

## Development Deployments

For development deployments (E2E tests):
- Uses `wrangler deploy --env development`
- Uses `[env.development]` section
- Creates worker: `otp-auth-service-development` (with suffix)
- Uses development KV bindings from `[[env.development.kv_namespaces]]`
