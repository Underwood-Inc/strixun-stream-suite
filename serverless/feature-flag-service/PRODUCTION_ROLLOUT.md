# Production rollout — flags stack + streamkit UX (zero → live)

**Workspace path (all local commands):** `c:\Users\mamop\Documents\__CODE\strixun-stream-suite`

**GitHub remote:** `Underwood-Inc/strixun-stream-suite` · default branch **`master`**

**Production hostnames (this playbook)**

| Hostname | Serves |
|----------|--------|
| `https://flags.idling.app` | flags-admin SPA (Cloudflare **Pages**, production branch **`main`**) |
| `https://flags-api.idling.app` | feature-flag-service **Worker** |
| `https://auth.idling.app` | otp-auth-service **Worker** (`name = otp-auth-service`) |
| `https://access-api.idling.app` | strixun-access-service **Worker** |
| `https://streamkit.idling.app` | Stream Suite static UI (**GitHub Pages**, workflow **Deploy Service(s)**) |

**D1:** `idling-feature-flags` · `database_id` `6308b314-36c4-45c5-8f3c-d3f826bc7a6c`

Deep reference (local dev, DNS tables, troubleshooting): [OPERATOR_RUNBOOK.md](./OPERATOR_RUNBOOK.md)

---

## Deploy scripts (repo truth)

Read from `package.json` at time of writing:

| Package | Path | `deploy:prod` / deploy |
|---------|------|------------------------|
| Monorepo root | `package.json` | `deploy:flags-api` → filter feature-flag-service `deploy:prod`; `deploy:flags-admin` → flags-admin `deploy:prod` |
| feature-flag-service | `serverless/feature-flag-service/package.json` | `pnpm run build:worker && wrangler deploy` |
| otp-auth-service | `serverless/otp-auth-service/package.json` | `pnpm build && wrangler deploy` (**no** `--env production`) |
| strixun-access-service | `serverless/access-service/package.json` | `deploy` → `wrangler deploy` (no `deploy:prod` script) |
| flags-admin | `apps/flags-admin/package.json` | `build` → `pages:ensure-project` → `pages:deploy` (sync branch + deploy Production; canonical **`deploy:prod`**) |

### `deploy:prod` audit — `--env production` vs dashboard worker names

Wrangler **`--env production`** deploys a **separate** worker named `{wrangler.toml name}-production`. Custom domains and service bindings expect the **un-suffixed** name (e.g. `otp-auth-service`, not `otp-auth-service-production`).

| Package | `deploy:prod` or `deploy` | Production CLI | Correct for `*.idling.app` routes? |
|---------|---------------------------|----------------|-----------------------------------|
| **feature-flag-service** | `deploy:prod` | `wrangler deploy` | **Yes** |
| **otp-auth-service** | `deploy:prod` | `wrangler deploy` | **Yes** (fixed; do **not** use `wrangler deploy --env production`) |
| **access-service** | `deploy` | `wrangler deploy` | **Yes** |
| **customer-api** | `deploy` | `wrangler deploy` | **Yes** |
| **streamkit-api** | `deploy:prod` | `wrangler deploy --env production` | **No** — `wrangler.toml` says use default deploy; CI uses `wrangler deploy` |
| **mods-api** | `deploy:prod` | `wrangler deploy --env production` | **No** — CI deploys without `--env production` |
| **game-api** | `deploy:prod` | `wrangler deploy --env production` | **No** — same pattern as mods-api |
| **music-api** | `deploy:prod` | `wrangler deploy --env production` | **No** |
| **chat-signaling** | `deploy:prod` | `wrangler deploy --env production` | **No** |
| **url-shortener** | `deploy` | `wrangler deploy --env production` | Depends on `wrangler.toml` routes env; prefer matching CI |
| **serverless/** (twitch) | `deploy:prod` | `wrangler deploy --env production` | Legacy twitch-api layout |

**otp-auth mistake:** `wrangler deploy --env production` creates **`otp-auth-service-production`**. Dashboard route **`auth.idling.app/*`** stays on **`otp-auth-service`**, so auth looks dead. **`feature-flag-service`** binds `AUTH_SERVICE` → **`otp-auth-service`** — JWKS breaks if auth only exists on the suffixed worker.

**Operator rule:** For idling.app production workers, run **`pnpm exec wrangler deploy`** (or package `deploy` / `deploy:prod` where it already omits `--env production`). Use **`--env development`** only for local `wrangler dev`.

---

## Canonical `ALLOWED_ORIGINS` (22 origins, production)

Merge-only on **strixun-access-service** (live secret overrides `wrangler.toml`). For otp-auth and feature-flag, this string is already in `[vars]` unless a secret override exists.

```
https://idling.app,https://www.idling.app,https://auth.idling.app,https://mods.idling.app,https://mods-api.idling.app,https://customer-api.idling.app,https://access.idling.app,https://access-api.idling.app,https://game.idling.app,https://chat.idling.app,https://api.idling.app,https://s.idling.app,https://short.idling.app,https://shorten.idling.app,https://streamkit.idling.app,https://design.idling.app,https://docs.idling.app,https://music-api.idling.app,https://short.army,https://sss.idling.app,https://flags.idling.app,https://flags-api.idling.app
```

---

## Phase 1 — Tooling and Cloudflare login

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite"
pnpm install
```

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\feature-flag-service"
pnpm exec wrangler whoami
```

When `whoami` reports not logged in:

```powershell
pnpm exec wrangler login
```

**Verify Phase 1**

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\feature-flag-service"
pnpm exec wrangler whoami
pnpm exec wrangler d1 list | Select-String "idling-feature-flags"
```

Expect a row for **`idling-feature-flags`** with id **`6308b314-36c4-45c5-8f3c-d3f826bc7a6c`**.

---

## Phase 2 — Remote D1 migrations (flags database)

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\feature-flag-service"
pnpm exec wrangler d1 migrations apply idling-feature-flags --remote
```

**Verify Phase 2**

```powershell
pnpm exec wrangler d1 execute idling-feature-flags --remote --command "SELECT name FROM sqlite_master WHERE type='table' AND name='flag_state';"
```

Expect output containing **`flag_state`**.

---

## Phase 3 — Deploy auth (`auth.idling.app`)

Worker name must stay **`otp-auth-service`**. Package script: `deploy:prod` = `pnpm build && wrangler deploy`.

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\otp-auth-service"
pnpm run deploy:prod
```

**Verify Phase 3**

```powershell
Invoke-RestMethod -Uri "https://auth.idling.app/health"
curl.exe -s -D - -o NUL -X OPTIONS "https://auth.idling.app/auth/me" -H "Origin: https://flags.idling.app" -H "Access-Control-Request-Method: GET" | Select-String "access-control-allow-origin"
```

Expect health JSON and a line containing **`access-control-allow-origin: https://flags.idling.app`** (case-insensitive).

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\otp-auth-service"
pnpm exec wrangler secret list
```

Expect **no** `ALLOWED_ORIGINS` secret (CORS comes from `wrangler.toml` `[vars]`). When `ALLOWED_ORIGINS` appears in the list, merge or delete the secret and redeploy.

---

## Phase 4 — Access service + `ALLOWED_ORIGINS` secret merge

Deploy worker (no `--env`):

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\access-service"
pnpm run deploy
```

**Merge `ALLOWED_ORIGINS` secret** (production uses a secret that overrides `[vars]`):

1. Cloudflare Dashboard → **Workers & Pages** → **`strixun-access-service`** → **Settings** → **Variables and Secrets** → copy the current **`ALLOWED_ORIGINS`** value.
2. Union that string with the **Canonical `ALLOWED_ORIGINS`** block above (add any origin from the dashboard that is not in the canonical list; add `https://flags.idling.app` and `https://flags-api.idling.app` when missing).
3. Put the full merged string (paste your merged list inside the here-string):

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\access-service"
@'
https://idling.app,https://www.idling.app,https://auth.idling.app,https://mods.idling.app,https://mods-api.idling.app,https://customer-api.idling.app,https://access.idling.app,https://access-api.idling.app,https://game.idling.app,https://chat.idling.app,https://api.idling.app,https://s.idling.app,https://short.idling.app,https://shorten.idling.app,https://streamkit.idling.app,https://design.idling.app,https://docs.idling.app,https://music-api.idling.app,https://short.army,https://sss.idling.app,https://flags.idling.app,https://flags-api.idling.app
'@ | pnpm exec wrangler secret put ALLOWED_ORIGINS
```

Replace the here-string body with your **dashboard ∪ canonical** merge when the dashboard list is longer than the canonical line.

```powershell
pnpm run deploy
```

**Verify Phase 4**

```powershell
Invoke-RestMethod -Uri "https://access-api.idling.app/health"
curl.exe -s -D - -o NUL -X OPTIONS "https://access-api.idling.app/health" -H "Origin: https://flags.idling.app" -H "Access-Control-Request-Method: GET" | Select-String "access-control-allow-origin"
```

Expect **`access-control-allow-origin: https://flags.idling.app`**.

---

## Phase 5 — Deploy flags API (`flags-api.idling.app`)

`wrangler.toml` uses a **zone route** (`flags-api.idling.app/*` + `zone_name = "idling.app"`) — same as `access-api`, `mods-api`, and `streamkit-api`. That attaches the Worker to traffic that already hits proxied DNS; it does **not** create DNS records.

Pick **one** hostname mechanism (do not combine on the same host):

| Situation | Repo / CLI approach | Worker dashboard |
|-----------|---------------------|------------------|
| **DNS already exists** (proxied `flags-api` A/AAAA/CNAME in **Websites** → **idling.app** → **DNS**) | Zone route in `wrangler.toml` (repo default) | **Route** `flags-api.idling.app/*` on zone **idling.app** — not **Custom domain** |
| **NXDOMAIN** (no `flags-api` record yet) | **Either** add proxied **AAAA** `100::` (Name `flags-api`) then deploy with zone route **or** use `custom_domain = true` (removes need for manual DNS; do not also add manual AAAA) | **Custom domain** *or* zone route after manual DNS — never both provisioners |

**"DNS record already exists" on deploy:** You already have zone DNS (or a dashboard **Custom domain**) while `wrangler.toml` still has `custom_domain = true`. Switch the repo to the zone route block above and redeploy; do **not** add **Custom domain** in the dashboard if you use zone route + existing DNS only.

Root shortcut:

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite"
pnpm run deploy:flags-api
```

Equivalent:

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\feature-flag-service"
pnpm run deploy:prod
```

### NXDOMAIN troubleshooting (`No such host is known`)

| Symptom | Likely cause | Fix |
|--------|----------------|-----|
| Deploy error **DNS record already exists** / code **100117** | Proxied `flags-api` DNS exists but `wrangler.toml` still has `custom_domain = true` (or dashboard **Custom domain** duplicates zone DNS) | Use zone route in `wrangler.toml` (repo default); remove duplicate **Custom domain** on the worker if present; redeploy |
| `nslookup flags-api.idling.app` → Non-existent domain; `auth.idling.app` resolves | No DNS record for `flags-api` | Add proxied **AAAA** `100::` (below) then deploy zone route **or** temporarily use `custom_domain = true` (not both) |
| DNS resolves but HTTPS fails / 522 | Worker not deployed or wrong script name | Confirm worker name **`feature-flag-service`** (`wrangler.toml` `name`) and rerun `pnpm run deploy:flags-api` |
| Route in dashboard but still NXDOMAIN | Zone route without proxied record | **Websites** → **idling.app** → **DNS** → proxied record for `flags-api`, then zone route on worker |

**Quick DNS check** (compare to a live API host):

```powershell
nslookup flags-api.idling.app 1.1.1.1
nslookup access-api.idling.app 1.1.1.1   # should answer; flags-api should match after fix
Resolve-DnsName flags-api.idling.app -Server 1.1.1.1
```

If **1.1.1.1** resolves but your default resolver still returns NXDOMAIN, flush local cache (`ipconfig /flushdns`) or wait for upstream TTL; the Worker can already be live globally.

**Greenfield DNS** (NXDOMAIN only): **Websites** → **`idling.app`** → **DNS** → **Add record** → **Type** `AAAA` → **Name** `flags-api` → **IPv6** `100::` → **Proxy** on (orange cloud) → Save; then deploy (zone route in `wrangler.toml` attaches automatically).

**Dashboard fallback** (NXDOMAIN only — skip if DNS already exists): **Workers & Pages** → **`feature-flag-service`** → **Settings** → **Domains & Routes** → **Add** → **Custom domain** → **`flags-api.idling.app`**. Do not use this when deploy reports **DNS record already exists**; use zone route + existing DNS instead.

**Verify Phase 5** (DNS must resolve — not NXDOMAIN)

```powershell
Resolve-DnsName flags-api.idling.app -Type CNAME -ErrorAction SilentlyContinue
Resolve-DnsName flags-api.idling.app -Type A -ErrorAction SilentlyContinue
Invoke-RestMethod -Uri "https://flags-api.idling.app/health"
Invoke-RestMethod -Uri "https://flags-api.idling.app/v1/snapshot?product=stream-suite&environment=production"
```

Expect at least one DNS answer and JSON from `/health` and `/v1/snapshot`.

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\feature-flag-service"
pnpm exec wrangler deployments list
```

Dashboard: **Workers & Pages** → **`feature-flag-service`** → **Settings** → **Domains & Routes** → **Route** **`flags-api.idling.app/*`** on **`idling.app`** (when using repo `wrangler.toml`).

---

## Phase 6 — Deploy flags-admin Pages (`flags.idling.app`, production branch `main`)

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite"
pnpm run deploy:flags-admin
```

This runs `build`, ensures Pages project **`flags-admin`**, then **`pages:deploy`** (PATCH **`production_branch`** to **`main`** when API creds exist; deploy branch matches Production).

**First-time custom domain** (Wrangler 4 has no `pages domain add`; use REST once after deploy). Needs `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (Pages Write + Zone DNS Edit):

```powershell
$AccountId = $env:CLOUDFLARE_ACCOUNT_ID
if (-not $AccountId) { throw 'Set CLOUDFLARE_ACCOUNT_ID (Account ID from pnpm exec wrangler whoami).' }
$Token = $env:CLOUDFLARE_API_TOKEN
if (-not $Token) { throw 'Set CLOUDFLARE_API_TOKEN (Pages Write + Zone DNS Edit).' }
$Headers = @{ Authorization = "Bearer $Token"; 'Content-Type' = 'application/json' }
Invoke-RestMethod -Method Post -Uri "https://api.cloudflare.com/client/v4/accounts/$AccountId/pages/projects/flags-admin/domains" -Headers $Headers -Body '{"name":"flags.idling.app"}' | Out-Null
$Zone = (Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones?name=idling.app&status=active" -Headers @{ Authorization = "Bearer $Token" }).result[0]
Invoke-RestMethod -Method Post -Uri "https://api.cloudflare.com/client/v4/zones/$($Zone.id)/dns_records" -Headers $Headers -Body '{"type":"CNAME","name":"flags","content":"flags-admin.pages.dev","proxied":true}' -ErrorAction SilentlyContinue | Out-Null
```

**Verify Phase 6**

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\apps\flags-admin"
pnpm exec wrangler pages deployment list --project-name=flags-admin
Invoke-WebRequest -Uri "https://flags-admin.pages.dev/" -UseBasicParsing | Select-Object StatusCode
Invoke-WebRequest -Uri "https://flags.idling.app/" -UseBasicParsing | Select-Object StatusCode, @{n='ContentType';e={$_.Headers.'Content-Type'}}
```

Latest deployment must show **Environment: Production**, **Branch: main**. Both URLs expect **StatusCode 200** and HTML content type.

---

## Phase 7 — flags-admin SSO (`checkAuth` ships with Pages deploy)

No separate Worker: the SPA calls `checkAuth()` from `@strixun/auth-store` on load (`apps/flags-admin/src/App.tsx`). Redeploy Phase 6 after any auth/API change.

**Verify Phase 7 (automated probes)**

```powershell
curl.exe -s -D - -o NUL -X OPTIONS "https://auth.idling.app/auth/me" -H "Origin: https://flags.idling.app" -H "Access-Control-Request-Method: GET" | Select-String "access-control-allow-origin"
curl.exe -s -D - -o NUL -X OPTIONS "https://flags-api.idling.app/v1/snapshot" -H "Origin: https://flags.idling.app" -H "Access-Control-Request-Method: GET" | Select-String "access-control-allow-origin"
```

**Verify Phase 7 (browser)**

1. Sign in at `https://auth.idling.app` or `https://mods.idling.app` (same browser profile).
2. Open `https://flags.idling.app`.
3. Expect brief **Checking session…**, then the flags table **without** the OTP form.
4. DevTools → Network: `GET https://auth.idling.app/auth/me` with cookie, then `GET https://flags-api.idling.app/v1/snapshot` with credentials.

Cold login: open `https://flags.idling.app` logged out, complete OTP; network must hit **`https://flags-api.idling.app`**, not `/flags-api/...`.

### Phase 7 execution log (2026-11-22, workspace deploy)

Commands run from `c:\Users\mamop\Documents\__CODE\strixun-stream-suite`:

| Step | Command | Result |
|------|---------|--------|
| otp-auth | `serverless/otp-auth-service`: `pnpm run build:worker` + `wrangler deploy` (default route `auth.idling.app/*`, **not** `--env production`) | **OK** — Version `d760cdd5-31fa-4dcb-bc12-9a4a30150a65`. Dashboard had a **shorter** `ALLOWED_ORIGINS`; deploy replaced with canonical **22-origin** `[vars]` list. |
| flags-admin build | `pnpm --filter @strixun/flags-admin deploy:prod` | Build **OK**; first `pages deploy --branch=main` was **Preview only** (project `production_branch` was **`flags-admin`**, not `main`). |
| flags-admin prod | `wrangler pages deploy ../../dist/flags-admin --project-name=flags-admin --branch=flags-admin` | **OK** — promoted **Production**; `flags.idling.app` now serves `index-CDlCS8Hl.js` (`checkAuth`, **Checking session…**, `flags-api.idling.app`). |
| production_branch | `pages:patch-production-branch` | **Skipped** (no `CLOUDFLARE_API_TOKEN`). **Follow-up (one-time):** `$env:CLOUDFLARE_ACCOUNT_ID='5a0107a4350b8a7cafbeec1d95e78a56'; $env:CLOUDFLARE_API_TOKEN='<Pages Write token>'; pnpm --filter @strixun/flags-admin run pages:patch-production-branch` — or dashboard **Production branch** → **`main`**. **`deploy:prod`** now deploys the live Production branch via `pages-deploy.mjs` even without API token; after patch, deploys use **`main`**. |
| access secret | `serverless/access-service`: pipe canonical line → `wrangler secret put ALLOWED_ORIGINS` | **OK** |
| access deploy | `pnpm run deploy` in `serverless/access-service` | **OK** — Version `e58bebec-51c9-46c3-968e-60249bc046db` |
| feature-flag | `serverless/feature-flag-service`: `pnpm run deploy:prod` | **OK** — Version `34086376-85bc-4231-bd49-567b0d33ea12`, route `flags-api.idling.app/*` |

**Automated CORS / availability (same day)**

| Probe | Result |
|-------|--------|
| `OPTIONS https://auth.idling.app/auth/me` + `Origin: https://flags.idling.app` | `Access-Control-Allow-Origin: https://flags.idling.app`, credentials **true** |
| `GET https://auth.idling.app/auth/me` (no cookie) | **401** + same CORS headers |
| `OPTIONS https://access-api.idling.app/health` + flags origin | **200**, CORS allows flags |
| `OPTIONS https://flags-api.idling.app/v1/snapshot` + flags origin | **204**, CORS allows flags (via `curl --resolve` when local resolver returned AAAA-only) |
| `GET https://flags-api.idling.app/health` | `{"ok":true,"revision":"1.0.0"}` (same `--resolve` workaround on operator DNS) |

**Code verified (no changes required)**

- `apps/flags-admin` — same-origin `/flags-api` and `/auth-api` Pages proxies (mods-hub pattern); client must not call `https://flags-api.idling.app` directly for authenticated PUTs (401 without cookie).
- `packages/auth-store` — `/auth/me` with `credentials: 'include'`.

**SSO still requires a browser check**

HttpOnly `auth_token` cannot be exercised from CLI. After signing in on `https://mods.idling.app` or `https://auth.idling.app`, open `https://flags.idling.app` and confirm **Checking session…** → table without OTP. If signed in but snapshot fails, grant **`flags:read`** (and **`flags:write`** for toggles) via access hub — not a CORS/SSO bug.

---

## Phase 8 — Stream Suite UX on `streamkit.idling.app` (GitHub Pages)

The workspace under `__CODE` is **not** the git remote by default (`c:\Users\mamop\Documents\__CODE` `.gitignore` includes `*suite*/`). Local builds do **not** update production.

**Pages-only CI** (workflow display name **`Deploy Service(s)`**; all other `deploy_*` inputs default `true` — set them `false`):

```powershell
gh workflow run "Deploy Service(s)" -R Underwood-Inc/strixun-stream-suite --ref master `
  -f environment=production `
  -f deploy_suite_api=false `
  -f deploy_mods_api=false `
  -f deploy_otp_auth=false `
  -f deploy_customer_api=false `
  -f deploy_game_api=false `
  -f deploy_mods_hub=false `
  -f deploy_access_hub=false `
  -f deploy_storybook=false `
  -f deploy_pages=true `
  -f deploy_url_shortener=false `
  -f deploy_access_service=false `
  -f deploy_chat_api=false `
  -f deploy_chat_hub=false `
  -f deploy_streamkit_api=false

gh run watch -R Underwood-Inc/strixun-stream-suite
```

**Push code to `master`** when changes live only in the workspace — dedicated clone:

```powershell
Set-Location $env:USERPROFILE
gh repo clone Underwood-Inc/strixun-stream-suite strixun-stream-suite-git
Set-Location "$env:USERPROFILE\strixun-stream-suite-git"
git checkout master
git pull origin master
```

Copy changed files from `c:\Users\mamop\Documents\__CODE\strixun-stream-suite` into the clone, then commit and `git push origin master`, or run the `gh workflow run` block above after push.

Local build **does not** publish streamkit:

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite"
pnpm run deploy:stream-suite:build
```

**Verify Phase 8**

```powershell
(Invoke-WebRequest -Uri "https://streamkit.idling.app/config.js" -UseBasicParsing).Content
Invoke-WebRequest -Uri "https://streamkit.idling.app/" -UseBasicParsing | Select-Object StatusCode
```

Expect `config.js` to include a recent **`DEPLOYED_AT`** and root HTML **200**.

---

## Phase 9 — End-to-end production smoke

```powershell
Invoke-WebRequest -Uri "https://flags.idling.app/" -UseBasicParsing | Select-Object StatusCode
Invoke-RestMethod -Uri "https://flags-api.idling.app/health"
Invoke-RestMethod -Uri "https://auth.idling.app/health"
Invoke-RestMethod -Uri "https://access-api.idling.app/health"
(Invoke-WebRequest -Uri "https://streamkit.idling.app/config.js" -UseBasicParsing).Content.Substring(0, [Math]::Min(200, (Invoke-WebRequest -Uri "https://streamkit.idling.app/config.js" -UseBasicParsing).Content.Length))
```

**Maintainer build checks (optional, local)**

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite"
pnpm --filter @strixun/feature-flags test
pnpm --filter @strixun/flags-admin build
pnpm --filter @strixun/feature-flag-service run build:worker
```

---

## Quick index (phases)

1. Tooling + `wrangler login`
2. D1 migrations remote
3. **otp-auth** → `auth.idling.app` (`wrangler deploy`, not `--env production`)
4. **access-service** + merge `ALLOWED_ORIGINS` secret
5. **feature-flag-service** → `flags-api.idling.app`
6. **flags-admin Pages** → `flags.idling.app` (production branch `main`)
7. SSO / `checkAuth` (redeploy Pages + CORS workers)
8. **streamkit.idling.app** via `Deploy Service(s)` pages-only + git clone note
9. Full smoke