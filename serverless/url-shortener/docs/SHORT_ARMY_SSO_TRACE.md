# short.army SSO — cookie model, request traces, fix

## 1. Cookie model

Browsers attach cookies by **request host** (URL host), not by where JavaScript runs. `Domain=` on `Set-Cookie` must match the site you call.

| Cookie name   | Typical `Domain=` | Sent on request host |
|---------------|-------------------|----------------------|
| `auth_token`  | `.idling.app`     | `auth.idling.app`, `s.idling.app`, `mods.idling.app`, … **not** `short.army` |
| `refresh_token` | `.idling.app`   | Same as `auth_token` on `*.idling.app` |
| `auth_token`  | `.short.army`     | `short.army`, `*.short.army` **not** `*.idling.app` |
| `refresh_token` | `.short.army`   | Same as `auth_token` on `*.short.army` |
| `auth_token` (dev) | `localhost` or host-only | Matching dev origin only |

**Invariants**

- `https://short.army/api/*` → browser sends **only** `Domain=.short.army` (or host-only) cookies.
- `https://auth.idling.app/*` → browser sends `Domain=.idling.app` cookies (cross-origin XHR from short.army with `credentials: 'include'` still **does not** send `.idling.app` cookies to `short.army` paths; it sends them **to** `auth.idling.app`).
- `https://short.army/auth-api/*` → same-origin; worker proxies to `auth.idling.app` and **replays all** upstream `Set-Cookie` (four cookies after verify-otp: auth + refresh × two roots).

Dual TLD SSO: `verify-otp` sets **both** `.idling.app` and `.short.army` in one completion (`serverless/otp-auth-service/utils/cookie-domains.ts` + verify handler). Opening `s.idling.app` uses `.idling.app`; `short.army` uses `.short.army`.

---

## 2. Request trace — short.army user journey

| Step | Method | URL | `credentials` | Cookie header expected |
|------|--------|-----|-----------------|------------------------|
| 1. Page load | GET | `https://short.army/` | default | Optional: prior `.short.army` session |
| 2. checkAuth | GET | `https://short.army/auth-api/auth/me` | `include` | **`auth_token` with `Domain=.short.army`** (via proxy to auth; cookie jar is short.army) |
| 3. request-otp | POST | `https://short.army/auth-api/auth/request-otp` | `include` | None required |
| 4. verify-otp | POST | `https://short.army/auth-api/auth/verify-otp` | `include` | None; response **Set-Cookie ×4** (both domains) |
| 5. checkAuth (post-OTP) | GET | `https://short.army/auth-api/auth/me` | `include` | `.short.army` `auth_token` |
| 6. List URLs | GET | `https://short.army/api/list` | `include` | **Same** `.short.army` `auth_token` only |

**Choice documented:** `checkAuth` on short.army **must** use `/auth-api/auth/me` (same origin). Using `https://auth.idling.app/auth/me` alone can return 200 with an `.idling.app` cookie while **`/api/list` on short.army never receives that cookie** — UI shows “signed in” but list 401s (SSO break).

Worker proxy: `serverless/url-shortener/router/routes.ts` (`/auth-api/*` → `proxyRequestWithCredentials` with `forwardSetCookie: true`). Set-Cookie forwarding: `packages/api-framework/credential-proxy.ts`.

---

## 3. Request trace — s.idling.app (shared `.idling.app`)

| Step | Method | URL | `credentials` | Cookie header expected |
|------|--------|-----|-----------------|------------------------|
| 1. Page load | GET | `https://s.idling.app/` | default | Optional `.idling.app` session |
| 2. checkAuth | GET | `https://s.idling.app/auth-api/auth/me` | `include` | `.idling.app` `auth_token` |
| 3–4. OTP | POST | `https://s.idling.app/auth-api/auth/request-otp`, `verify-otp` | `include` | verify sets dual-domain cookies |
| 5. List | GET | `https://s.idling.app/api/list` | `include` | `.idling.app` **or** host cookie sent to `s.idling.app` |

After SSO on short.army, visiting s.idling.app can reuse `.idling.app` cookies without re-OTP if still valid.

---

## 4. Root cause (list / SSO break)

**False “authenticated” on short.army:** `useAuthStore` was wired with `getDefaultAuthConfig()` → production `https://auth.idling.app` for `checkAuth`, while OTP used `getShortenerAuthApiUrl()` → `/auth-api`.

```28:29:serverless/url-shortener/app/src/stores/auth.ts
// BEFORE FIX: checkAuth targeted auth.idling.app; OTP used /auth-api
export const useAuthStore = createAuthStore(getDefaultAuthConfig());
```

`checkAuth` succeeded cross-origin to `auth.idling.app` (`.idling.app` cookie present). `GET https://short.army/api/list` is same-origin on **short.army** and does **not** receive `.idling.app` cookies → 401 or empty list / error state.

**Secondary:** `/api/list` router could return a 200 body without an `auth_token` cookie in the encryption path (unencrypted fallback). Guard now returns 401 if the host cookie is missing after handler success.

```217:224:serverless/url-shortener/router/routes.ts
// Returns 401 when auth passed Authorization but no auth_token cookie on this host
```

Introduced regression: commit `c8c36dab` (“restore auth.idling.app checkAuth on short.army”) re-separated OTP and session URLs.

---

## 5. Fix design

1. **One auth base URL** for OTP, `checkAuth`, `logout`, `refresh`: `getShortenerAuthApiUrl()` → production `/auth-api` on all url-shortener hosts (worker proxy already present).
2. **Keep** credential proxy `forwardSetCookie: true` for verify-otp (dual `Set-Cookie`).
3. **No revert** of same-origin `/api/list` or worker list handler — align client session with host cookies only.
4. **Post-OTP refresh:** `urlsRefreshKey` in `App.tsx` reloads list after cookies are set.

---

## 6. Implementation + proof curls

After `pnpm deploy:prod` from `serverless/url-shortener`:

```powershell
# Health
curl.exe -sS -o NUL -w "%{http_code}" https://short.army/health

# checkAuth without cookie (expect 401)
curl.exe -sS -w "\n%{http_code}\n" https://short.army/auth-api/auth/me

# Proxy diagnostics on auth path (no cookie)
curl.exe -sS -D - -o NUL https://short.army/auth-api/auth/me | findstr /I "X-Proxy HTTP"

# /api/list without cookie (expect 401)
curl.exe -sS -w "\n%{http_code}\n" https://short.army/api/list

# After browser OTP login, repeat with cookie jar file:
# curl.exe -sS -b cookies.txt -c cookies.txt https://short.army/auth-api/auth/me
# curl.exe -sS -b cookies.txt https://short.army/api/list
```

verify-otp Set-Cookie count header (when testing login through proxy):

```powershell
# Expect X-Proxy-Set-Cookie-Count: 4 on successful verify-otp via short.army/auth-api
```

**Client fix (2026-11-22):** `checkAuth` via `getDefaultAuthConfig()` → `https://auth.idling.app`; OTP stays `getShortenerAuthApiUrl()` → `/auth-api`. On short.army, `/api/list` targets `https://s.idling.app` so `.idling.app` `auth_token` is sent (CORS `Origin: https://short.army`).

## 6. Proxy + deploy notes (2026-11-22)

**Root cause (prod):** `/auth-api/*` used the `AUTH_SERVICE` worker binding for upstream fetch. `verify-otp` returns **four** `Set-Cookie` headers (auth + refresh × `.idling.app` + `.short.army`). The binding path collapsed them, so the browser often got **zero** `.short.army` cookies — `X-Proxy-Cookie-Received: no` on `/auth-api/auth/me` after “login”, and `/api/list` 401.

**Fix:** Public `fetch` to `https://auth.idling.app` + `appendAllSetCookies` in `credential-proxy.ts`; SPA auth base pinned to `/auth-api` at build time (no baked-in `auth.idling.app` for `checkAuth`).

**After successful `POST /auth-api/auth/verify-otp` (via short.army), expect four `Set-Cookie` lines:**

| Cookie        | Domain        | Attributes (production)                          |
|---------------|---------------|--------------------------------------------------|
| `refresh_token` | `.idling.app` | `HttpOnly; Secure; SameSite=None; Path=/; Max-Age=…` |
| `auth_token`    | `.idling.app` | same                                             |
| `refresh_token` | `.short.army` | `HttpOnly; Secure; SameSite=None; Path=/; Max-Age=…` |
| `auth_token`    | `.short.army` | same                                             |

Proxy diagnostics on auth responses: `X-Proxy-Set-Cookie-Count: 4` on successful verify-otp; `X-Proxy-Cookie-Received: yes` on `/auth-api/auth/me` when the browser sends `auth_token` for this host.

**Live deploy (PowerShell):**

- `strixun-url-shortener-production` version: `cdd5607b-e999-4ac6-9335-bc7365532e6f`
- `otp-auth-service` version: `cc3418b4-71bb-41de-b3aa-c425be639ae1` (`ALLOWED_ORIGINS` in `[vars]` includes `https://short.army`; no `ALLOWED_ORIGINS` secret override)