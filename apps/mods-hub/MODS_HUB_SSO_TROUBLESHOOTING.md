# Mods Hub SSO Troubleshooting: 401 on Authenticated Endpoints

**Symptom:** Mods Hub (mods.idling.app) returns 401 on authenticated endpoints such as `/mods/permissions/me` and `/admin/mods`. The admin panel cannot load because the auth cookie is not sent to mods-api.idling.app.

---

## Root Cause

The auth service sets the `auth_token` cookie. For the browser to send it to `mods-api.idling.app`, the cookie **must** use `Domain=.idling.app`. That domain is derived from `ALLOWED_ORIGINS` in the auth service.

If `ALLOWED_ORIGINS` is wrong or missing, the cookie is scoped to `auth.idling.app` only and is **never** sent to `mods-api.idling.app`. Result: 401.

---

## Fix Checklist

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

    Note over User,ModsAPI: API call from Mods Hub
    User->>ModsHub: Visit mods.idling.app
    ModsHub->>ModsAPI: fetch /mods/permissions/me (credentials: include)
    Note over User: Browser sends auth_token (Domain=.idling.app matches)
    ModsAPI->>Auth: Verify token via /auth/me
    Auth->>ModsAPI: customerId
    ModsAPI->>ModsHub: 200 OK
```

**If `Domain` is wrong** (e.g. `auth.idling.app` only):

- Cookie is not sent to `mods-api.idling.app`
- Mods API receives no token → 401

---

## Verification

1. **Check cookie domain (after login):**
   - DevTools → Application → Cookies → `https://mods.idling.app`
   - Look for `auth_token`; its Domain should be `.idling.app`

2. **Check network request:**
   - DevTools → Network → select a request to `mods-api.idling.app`
   - Request Headers should include `Cookie: auth_token=...`

3. **Check CORS (if 401 persists):**
   - Response headers should include `Access-Control-Allow-Origin: https://mods.idling.app`
   - If you see `*` or a different origin, mods-api `ALLOWED_ORIGINS` is wrong

---

## Related Files

| File | Purpose |
|------|---------|
| `serverless/otp-auth-service/wrangler.toml` | `ALLOWED_ORIGINS` in `[vars]` and `[env.production.vars]` |
| `serverless/otp-auth-service/utils/cookie-domains.ts` | Derives cookie domain from `ALLOWED_ORIGINS` |
| `serverless/otp-auth-service/handlers/auth/verify-otp.ts` | Sets cookie with domain from `getCookieDomains()` |
| `serverless/mods-api/wrangler.toml` | `ALLOWED_ORIGINS` for CORS (must include mods.idling.app) |
| `apps/mods-hub/src/services/authConfig.ts` | `credentials: 'include'` for cookie-based auth |
