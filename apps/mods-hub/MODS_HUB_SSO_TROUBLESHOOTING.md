# Mods Hub SSO Troubleshooting: 401 on Authenticated Endpoints

**Symptom:** Mods Hub (mods.idling.app) returns 401 on authenticated endpoints such as `/mods/permissions/me` and `/admin/mods`. The admin panel cannot load.

---

## Same-Origin Proxy (Primary Fix)

Mods Hub now uses a **same-origin proxy** at `/api/*` that forwards to mods-api.idling.app. Requests go to `mods.idling.app/api/...` (same origin), so the browser sends the `auth_token` cookie reliably.

**Requirements:**
1. Cookie must have `Domain=.idling.app` (set by auth service at login)
2. Redeploy mods-hub so the proxy function is live (deploy workflow now defaults `VITE_MODS_API_URL` to `/api`)
3. Clear cookies and re-login if you have an old cookie from before the fix

**If `VITE_MODS_API_URL` is set in GitHub Secrets** to `https://mods-api.idling.app`, remove it or change to `/api` so the app uses the proxy instead of direct cross-origin calls.

---

## Root Cause (When Proxy Doesn't Help)

The auth service sets the `auth_token` cookie. For the browser to send it to `mods.idling.app` (including the proxy), the cookie **must** use `Domain=.idling.app`. That domain is derived from `ALLOWED_ORIGINS` in the auth service.

If `ALLOWED_ORIGINS` is wrong or missing, the cookie is scoped to `auth.idling.app` only. Result: 401.

---

## Fix Checklist

### 0. Deploy Order (for proxy fix)

1. **Auth service** – Must be deployed with cookie domain fix (`getCookieDomains` using `ALLOWED_ORIGINS` → `.idling.app`)
2. **Mods Hub** – Must be deployed so the proxy at `/api/mods/*` is live
3. **Re-login** – Clear cookies and log in again so a new cookie is set with `Domain=.idling.app`

### 1. Verify GitHub Secret `ALLOWED_ORIGINS`

**GitHub Secrets override wrangler vars.** If `ALLOWED_ORIGINS` is set in GitHub, that value is used for both the auth service (cookie domain) and mods-api (CORS).

**Required value** (must include `mods.idling.app`):

```
https://mods.idling.app,https://www.idling.app,https://idling.app,https://auth.idling.app
```

**Options:**

| Scenario | Action |
|----------|--------|
| Secret is set but omits `mods.idling.app` | Update the secret to include `https://mods.idling.app` |
| Secret has wrong format (extra spaces, newlines) | Fix the value; no leading/trailing whitespace |
| You prefer wrangler.toml defaults | **Remove** the `ALLOWED_ORIGINS` secret from GitHub so wrangler vars are used |

**Where:** GitHub → Your repo → Settings → Secrets and variables → Actions → `ALLOWED_ORIGINS`

---

### 2. Redeploy Auth Service

After changing the secret (or removing it), redeploy the auth service so the new config is applied:

- Trigger the deploy workflow (e.g. push to `main` or run the workflow manually)
- Or run locally: `cd serverless/otp-auth-service && pnpm exec wrangler deploy --env production`

---

### 3. Re-login

**Existing cookies keep the old domain.** Users must log out and log in again so a new cookie is set with `Domain=.idling.app`.

1. Go to mods.idling.app
2. Log out (or clear cookies for idling.app)
3. Log in again via auth.idling.app
4. Retry the admin panel or `/mods/permissions/me`

---

## How It Works

```mermaid
sequenceDiagram
    participant User
    participant ModsHub as mods.idling.app
    participant Auth as auth.idling.app
    participant ModsAPI as mods-api.idling.app

    Note over User,ModsAPI: Login flow
    User->>Auth: Log in (OTP)
    Auth->>Auth: getCookieDomains(ALLOWED_ORIGINS) → .idling.app
    Auth->>User: Set-Cookie: auth_token; Domain=.idling.app
    Note over User: Cookie stored for *.idling.app

    Note over User,ModsAPI: API call via same-origin proxy
    User->>ModsHub: Visit mods.idling.app
    User->>ModsHub: fetch /api/mods/permissions/me (same origin via /api/* proxy)
    Note over User: Browser sends auth_token (Domain=.idling.app matches mods.idling.app)
    ModsHub->>ModsAPI: Proxy forwards request with Cookie header
    ModsAPI->>Auth: Verify token via /auth/me
    Auth->>ModsAPI: customerId
    ModsAPI->>ModsHub: 200 OK
    ModsHub->>User: 200 OK
```

**If `Domain` is wrong** (e.g. `auth.idling.app` only):

- Cookie is not sent to `mods.idling.app` (or proxy)
- Mods API receives no token → 401

---

## Verification

1. **Check cookie domain (after login):**
   - DevTools → Application → Cookies → `https://mods.idling.app`
   - Look for `auth_token`; its Domain should be `.idling.app`

2. **Check network request (proxy flow):**
   - DevTools → Network → select a request to `mods.idling.app/api/...`
   - Request Headers should include `Cookie: auth_token=...`
   - If you still see requests to `mods-api.idling.app` directly, the app may not be using the proxy (check `API_BASE_URL` in modsApi.ts - should be `/api`)

3. **Check CORS (if 401 persists):**
   - Response headers should include `Access-Control-Allow-Origin: https://mods.idling.app`
   - If you see `*` or a different origin, mods-api `ALLOWED_ORIGINS` is wrong

---

## Related Files

| File | Purpose |
|------|---------|
| `apps/mods-hub/functions/api/[[path]].ts` | Same-origin proxy: `/api/*` → mods-api.idling.app |
| `apps/mods-hub/src/services/mods/modsApi.ts` | `API_BASE_URL` (uses `/api` in prod) |
| `serverless/otp-auth-service/wrangler.toml` | `ALLOWED_ORIGINS` in `[vars]` and `[env.production.vars]` |
| `serverless/otp-auth-service/utils/cookie-domains.ts` | Derives cookie domain from `ALLOWED_ORIGINS` |
| `serverless/otp-auth-service/handlers/auth/verify-otp.ts` | Sets cookie with domain from `getCookieDomains()` |
| `serverless/mods-api/wrangler.toml` | `ALLOWED_ORIGINS` for CORS (must include mods.idling.app) |
| `apps/mods-hub/src/services/authConfig.ts` | `credentials: 'include'` for cookie-based auth |
