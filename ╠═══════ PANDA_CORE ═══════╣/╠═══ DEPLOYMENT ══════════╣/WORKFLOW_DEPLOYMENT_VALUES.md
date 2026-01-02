# What Happens When Workflows Deploy

## OTP Auth Service Workflow

### Step 1: Deploy Command
```bash
pnpm run deploy
```
Which executes: `pnpm build && wrangler deploy` (NO `--env` flag)

### Values Used (Root/Default Configuration)

**Worker Name:**
- `otp-auth-service` (from root `name = "otp-auth-service"`)

**KV Bindings:**
- `env.OTP_AUTH_KV` = `680c9dbe86854c369dd23e278abb41f9`
  - Source: Root `[[kv_namespaces]]` section

**Environment Variables:**
- `env.ENVIRONMENT` = `"production"`
  - Source: Root `[vars]` section
- `env.CUSTOMER_API_URL` = `"https://customer-api.idling.app"`
  - Source: Root `[vars]` section

**Routes:**
- Uses routes configured in **Cloudflare Dashboard** (if present)
- Falls back to root `routes = [...]` if dashboard has none
- Current: `auth.idling.app/*` (from dashboard)

**Secrets:**
- Set to **base worker** (`otp-auth-service`, no environment suffix)
- Uses `--env=""` to explicitly target root environment
- Secrets available: `JWT_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ALLOWED_ORIGINS`, `SUPER_ADMIN_API_KEY`, `SERVICE_ENCRYPTION_KEY`, `NETWORK_INTEGRITY_KEYPHRASE`

### What is NOT Used

- `[env.production]` section - Only used with `wrangler deploy --env production`
- `[env.development]` section - Only used with `wrangler deploy --env development`
- `[[env.production.kv_namespaces]]` - Only used with `--env production`
- `[[env.production.routes]]` - Only used with `--env production`

## Configuration Hierarchy

When `wrangler deploy` runs **without** `--env`:

```
Root Configuration (Used)
├── name = "otp-auth-service"
├── [vars]
│   ├── ENVIRONMENT = "production"
│   └── CUSTOMER_API_URL = "https://customer-api.idling.app"
├── [[kv_namespaces]]
│   └── OTP_AUTH_KV (680c9dbe86854c369dd23e278abb41f9)
└── routes = [...] (ignored if dashboard has routes)

Environment Sections (NOT Used)
├── [env.production] ✗
└── [env.development] ✗
```

## Why Default KV Bindings Matter

**Problem Before:**
- Routes configured in Cloudflare Dashboard
- Worker deployed with `wrangler deploy` (no `--env`)
- Uses root configuration
- Root had NO KV bindings
- Result: `env.OTP_AUTH_KV` was `undefined` ★ `Cannot read properties of undefined (reading 'get')`

**Solution Now:**
- Root `[[kv_namespaces]]` provides default bindings
- Worker deployed with `wrangler deploy` (no `--env`)
- Uses root configuration
- Root HAS KV bindings
- Result: `env.OTP_AUTH_KV` is available ★ Works correctly

## All Workers Follow Same Pattern

| Worker | Deploy Command | KV Bindings Used | R2 Bindings Used |
|--------|---------------|------------------|------------------|
| otp-auth-service | `wrangler deploy` | `OTP_AUTH_KV` | - |
| mods-api | `wrangler deploy` | `MODS_KV`, `OTP_AUTH_KV` | `MODS_R2` |
| customer-api | `wrangler deploy` | `CUSTOMER_KV` | - |
| game-api | `wrangler deploy` | `GAME_KV` | - |
| twitch-api | `wrangler deploy` | `TWITCH_CACHE` | - |
| url-shortener | `wrangler deploy --env production` | `URL_KV`, `ANALYTICS_KV` | - |
| chat-signaling | `wrangler deploy` | `CHAT_KV` | - |

**Note:** `url-shortener` uses `--env production` in its package.json, so it uses `[env.production]` section instead of root.
