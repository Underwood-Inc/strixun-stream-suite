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
- `https://short.army/auth-api/*` → same-origin; worker proxies to `auth.idling.app` and forwards **only** upstream `Set-Cookie` whose `Domain=` matches the request host (×2 after verify-otp on short.army: auth + refresh for `.short.army` only).

Dual TLD SSO: `verify-otp` sets **both** `.idling.app` and `.short.army` in one completion (`serverless/otp-auth-service/utils/cookie-domains.ts` + verify handler). Opening `s.idling.app` uses `.idling.app`; `short.army` uses `.short.army`.

---

## 2. Request trace — short.army user journey

| Step | Method | URL | `credentials` | Cookie header expected |
|------|--------|-----|-----------------|------------------------|
| 1. Page load | GET | `https://short.army/` | default | Optional: prior `.short.army` session |
| 2. checkAuth | GET | `https://short.army/auth-api/auth/me` | `include` | **`auth_token` with `Domain=.short.army`** (via proxy to auth; cookie jar is short.army) |
| 3. request-otp | POST | `https://short.army/auth-api/auth/request-otp` | `include` | None required |
| 4. verify-otp | POST | `https://short.army/auth-api/auth/verify-otp` | `include` | None; response **Set-Cookie ×2** (`.short.army` only; proxy filters other domains) |
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
| 3–4. OTP | POST | `https://s.idling.app/auth-api/auth/request-otp`, `verify-otp` | `include` | verify sets **×2** `.idling.app` cookies via proxy (upstream emits both TLDs; proxy filters) |
| 5. List | GET | `https://s.idling.app/api/list` | `include` | `.idling.app` **or** host cookie sent to `s.idling.app` |

**Cross-TLD SSO:** Completing OTP on `short.army` does **not** set `.idling.app` cookies in the browser (no leak). Use OTP on `s.idling.app` (or another `*.idling.app` host) for a shared `.idling.app` session.

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
2. **Keep** credential proxy `forwardSetCookie: true` with **domain-scoped** forwarding (no cross-TLD `Set-Cookie` leak).
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
# Expect X-Proxy-Set-Cookie-Count: 2 on successful verify-otp via short.army/auth-api
```

**Client (2026-11-22):** `checkAuth` and OTP both use `getShortenerAuthApiUrl()` → `/auth-api`. `/api/list` stays **same-origin** on each host (reverted bd5d18c3 cross-origin `https://s.idling.app` API from short.army).

## 6. Proxy + deploy notes (2026-11-22)

**Root cause (prod):** `/auth-api/*` used the `AUTH_SERVICE` worker binding for upstream fetch. `verify-otp` returns **four** `Set-Cookie` headers (auth + refresh × `.idling.app` + `.short.army`). The binding path collapsed them, so the browser often got **zero** `.short.army` cookies — `X-Proxy-Cookie-Received: no` on `/auth-api/auth/me` after “login”, and `/api/list` 401.

**Fix:** Public `fetch` to `https://auth.idling.app` on short.army + domain-scoped `Set-Cookie` in `credential-proxy.ts`; SPA auth base pinned to `/auth-api`.

**After successful `POST /auth-api/auth/verify-otp` on short.army, browser receives two `Set-Cookie` lines (`.short.army` only).** Upstream auth still emits four; proxy filters by request host.

| Request host   | Forwarded `Set-Cookie` domains |
|----------------|--------------------------------|
| `short.army`   | `.short.army` (auth + refresh) |
| `s.idling.app` | `.idling.app` (auth + refresh) |

Proxy diagnostics: `X-Proxy-Set-Cookie-Count: 2` on successful verify-otp per host; `X-Proxy-Cookie-Received: yes` on `/auth-api/auth/me` when the browser sends `auth_token` for this host.

**Live deploy (PowerShell):**

- `strixun-url-shortener-production` version: `cdd5607b-e999-4ac6-9335-bc7365532e6f`
- `otp-auth-service` version: `cc3418b4-71bb-41de-b3aa-c425be639ae1` (`ALLOWED_ORIGINS` in `[vars]` includes `https://short.army`; no `ALLOWED_ORIGINS` secret override)

## 7. Cross-TLD SSO bridge (2026-11-22)

**Why separate login:** `.idling.app` HttpOnly cookies are never sent on `short.army` requests; the auth proxy forwards only `Domain=.short.army` `Set-Cookie` lines, so an idling-only session cannot satisfy `/auth-api/auth/me` on short.army.

**Bridge (no JWT in JS, no idling cookie leak to short.army client):**

| Step | Call | Credentials | Result |
|------|------|-------------|--------|
| 1 | `POST https://auth.idling.app/auth/session/bridge-code` body `{ target_host: "short.army" }` | `include` (sends `.idling.app` cookies) | `{ bridge_code }` opaque, 120s, single-use |
| 2 | `POST https://short.army/auth-api/auth/session/from-idling` body `{ bridge_code }` | `include` | Worker proxies; upstream sets **only** `.short.army` cookies (proxy filter) |
| 3 | `GET https://short.army/auth-api/auth/me` | `include` | 200; `/api/list` works same-origin |

SPA: `app/src/stores/auth.ts` `bootstrapShortArmySessionFromIdling()` runs after failed `checkAuth` on short.army only.

**Deploy (bridge):**

- `otp-auth-service` version: `111f7245-7f8f-4e9c-ae03-e394cb622af6` (`@strixun/otp-auth-service` 1.1.1)
- `strixun-url-shortener-production` version: `079aad65-cb37-4338-b7d5-0d0bd619f46b`