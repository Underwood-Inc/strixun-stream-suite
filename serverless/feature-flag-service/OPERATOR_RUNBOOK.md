# Feature flags — operator runbook (Windows PowerShell)

**End-to-end production (zero → live):** [PRODUCTION_ROLLOUT.md](./PRODUCTION_ROLLOUT.md) — phased playbook for `flags.idling.app`, `flags-api.idling.app`, `auth.idling.app`, access CORS merge, flags-admin SSO, and `streamkit.idling.app`.

Copy-paste commands assume repo root:

`c:\Users\mamop\Documents\__CODE\strixun-stream-suite`

| Component | Local port |
|-----------|------------|
| feature-flag-service (flags API) | **8797** |
| otp-auth worker + dashboard Vite | **8787** / **5174** |
| access-service | **8795** |
| flags-admin (standalone UI) | **5179** |
| Stream Suite app (root Vite) | **5173** |

Production hostnames: API **`flags-api.idling.app`**, UI **`flags.idling.app`**.

D1 database name: **`idling-feature-flags`** (`database_id`: `6308b314-36c4-45c5-8f3c-d3f826bc7a6c`).

---

## Commands that work from your machine

Verified on this Windows host (2026-11-22):

| Path | Role |
|------|------|
| `c:\Users\mamop\Documents\__CODE\strixun-stream-suite` | **Workspace copy** — use for `pnpm install`, Wrangler deploys, local builds, tests. **No `.git` directory** (not a git repo). |
| `c:\Users\mamop\Documents\__CODE` | Parent monorepo git root. **Ignores** this suite folder: `.gitignore` line `*suite*/` → `strixun-stream-suite` is never tracked. **`git push` from the workspace folder does not deploy anything.** |
| GitHub remote | **`Underwood-Inc/strixun-stream-suite`**, default branch **`master`**. |

### What updates `streamkit.idling.app`

The **Stream Suite static UI** (root Vite app) ships through **GitHub Pages**, not Cloudflare Pages:

1. Workflow file: `.github/workflows/deploy-manager.yml`
2. **Workflow display name (use exactly with `gh`):** `Deploy Service(s)`
3. Jobs: `deploy_pages_build` (build + write `dist/CNAME` = `streamkit.idling.app` + inject `config.js`) → `deploy_pages` (`actions/deploy-pages` → environment `github-pages`)

**Do not confuse** with input **`deploy_streamkit_api`** — that deploys the **Worker** at **`streamkit-api.idling.app`**, not the browser UI on `streamkit.idling.app`.

`sss.idling.app` is DNS (alias to the same GitHub Pages site); CI does not build a second app.

### Workflows on GitHub right now (`gh workflow list -R Underwood-Inc/strixun-stream-suite`)

| Name | File | Notes |
|------|------|--------|
| **Deploy Service(s)** | `deploy-manager.yml` | Stream Suite UI → enable input **`deploy_pages`** |
| Deploy ASCIImoji CDN | `deploy-asciimoji-cdn.yml` | |
| PR Health Check | `pr-health-check.yml` | |
| Release | `release.yml` | |
| Sync Documentation to Wiki | `sync-wiki.yml` | |
| Update Version Badge | `update-version-badge.yml` | |
| CodeQL | (GitHub default) | |

**Local-only (not on GitHub yet):** `.github/workflows/feature-flag-service.yml` (`name: Feature flag service`) — use §5 Wrangler on this machine until that file is on `master`.

### CI: deploy Stream Suite UI only (no local git required)

`gh` can trigger the workflow from **any directory** if you pass **`-R Underwood-Inc/strixun-stream-suite`**.

**Important:** every `deploy_*` input in the workflow defaults to **`true`**. Setting only `deploy_pages=true` still deploys **all** workers and Pages apps. For a **pages-only** run, set the rest to **`false`**:

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

Push to **`master`** also runs the same workflow (markdown-only commits are skipped via `paths-ignore`).

### Local commands (workspace path — builds do **not** publish streamkit)

Repo root package scripts (`c:\Users\mamop\Documents\__CODE\strixun-stream-suite\package.json`):

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite"
pnpm install
pnpm run deploy:stream-suite:build    # build packages + root Vite app (local dist only)
pnpm run deploy:flags-api              # @strixun/feature-flag-service → wrangler (flags-api.idling.app)
pnpm run deploy:flags-admin              # flags.idling.app Pages (needs wrangler login + token)
```

Feature-flag worker from its package (same as `deploy:flags-api`):

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\feature-flag-service"
pnpm run deploy
```

### When you need `git push` (not just `gh workflow run`)

The workspace folder is **not** a clone. Pick **one** strategy:

**A — Dedicated clone (recommended)**

```powershell
Set-Location $env:USERPROFILE
gh repo clone Underwood-Inc/strixun-stream-suite strixun-stream-suite-git
Set-Location "$env:USERPROFILE\strixun-stream-suite-git"
git checkout master
git pull
# copy or cherry-pick changes from workspace, then:
git add -A
git commit -m "your message"
git push origin master
```

**B — Init git inside workspace (only if you accept nested repo / parent still ignores suite)**

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite"
git init
git remote add origin https://github.com/Underwood-Inc/strixun-stream-suite.git
git fetch origin
git checkout -B master origin/master
# commit and git push origin master
```

**C — Push from another machine or GitHub web UI** — same remote, no local git required for UI-only fixes if you use workflow_dispatch above.

---

## 1. Prerequisites (Cloudflare login)

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\feature-flag-service"
pnpm exec wrangler whoami
```

If not logged in:

```powershell
pnpm exec wrangler login
```

List D1 databases (confirm `idling-feature-flags` and UUID):

```powershell
pnpm exec wrangler d1 list
```

---

## 2. One-time: install dependencies

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite"
pnpm install
```

---

## 3. Local dev (four terminals)

Run **access** and **flags API** before auth/dashboard if you need rate budgets or flag writes.

### Terminal A — feature-flag-service (8797)

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\feature-flag-service"
pnpm exec wrangler d1 migrations apply idling-feature-flags --local
pnpm dev
```

Equivalent from repo root (uses `wrangler dev --env development` for localhost CORS + JWKS):

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite"
pnpm --filter @strixun/feature-flag-service dev
```

### Terminal B — access-service (8795)

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\access-service"
pnpm dev
```

### Terminal C — otp-auth dashboard (8787 worker + 5174 Vite)

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\otp-auth-service"
pnpm dev
```

Open dashboard: `http://localhost:5174` (Feature Flags tab calls **`/flags-api`** via Vite proxy → 8797).

### Terminal D — flags-admin only (5179, optional)

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite"
pnpm --filter @strixun/flags-admin dev
```

### Terminal E — Stream Suite app (5173, optional)

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite"
pnpm dev
```

---

## 4. Remote D1 migrations

From `serverless/feature-flag-service` (where `migrations_dir` is configured):

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\feature-flag-service"
pnpm exec wrangler whoami
pnpm exec wrangler d1 migrations apply idling-feature-flags --remote
```

If you see D1 error **7400** (invalid UUID), run `pnpm exec wrangler d1 list` and set `database_id` to the listed UUID in:

- `serverless/feature-flag-service/wrangler.toml`
- `serverless/access-service/wrangler.toml`
- `serverless/otp-auth-service/wrangler.toml` (`env.development` + `env.production` D1 blocks)

---

## 5. Deploy feature-flag worker (production)

Default `wrangler.toml` is production (`flags-api.idling.app/*` zone route on `idling.app`, same as `access-api`). No `--env` flag.

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\feature-flag-service"
pnpm run deploy
```

(`pnpm run deploy` = `build:worker` + `wrangler deploy`.)

CI equivalent (after that workflow file is on `master`): `.github/workflows/feature-flag-service.yml` job `deploy-worker`. As of verification, that workflow is **not** registered on GitHub yet — use the Wrangler commands above.

---

## 6. Worker configuration: vars vs secrets

### Plaintext vars in `wrangler.toml` (edit file → redeploy)

| Var | Purpose |
|-----|---------|
| `ENVIRONMENT` | `production` / `development` |
| `JWT_ISSUER` | JWKS issuer URL (e.g. `https://auth.idling.app`) |
| `ACCESS_SERVICE_URL` | Permission checks: `GET /access/:id/permissions` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins |

`ALLOWED_ORIGINS` is **not** a secret by default on **feature-flag-service** or **otp-auth-service** (verified: `wrangler secret list` has **no** `ALLOWED_ORIGINS` on those workers). **strixun-access-service** **does** have an `ALLOWED_ORIGINS` secret — it **overrides** `wrangler.toml` and Wrangler **cannot** read secret values back; merge in the dashboard.

### Merge `ALLOWED_ORIGINS` (never blind replace)

1. **Inventory:** `pnpm exec wrangler secret list` in each worker directory.
2. **If no secret:** edit `wrangler.toml` and **append** comma-separated origins that are missing; redeploy.
3. **If secret exists (access-service today):** Cloudflare Dashboard → **Workers & Pages** → **`strixun-access-service`** → **Settings** → **Variables and Secrets** → copy the **current** `ALLOWED_ORIGINS` value (decrypt/view). Append only missing entries (e.g. `https://flags.idling.app`, `https://flags-api.idling.app`). **Do not** paste `wrangler.toml` alone if the live secret is longer.
4. **Put merged string** (PowerShell — paste **your** full merged list, not a short default):

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\access-service"
@'
PASTE_FULL_MERGED_COMMA_SEPARATED_LIST_HERE
'@ | pnpm exec wrangler secret put ALLOWED_ORIGINS
```

5. **CORS smoke** (must echo `Access-Control-Allow-Origin: https://flags.idling.app`):

```powershell
curl.exe -s -D - -o NUL -X OPTIONS "https://access-api.idling.app/health" -H "Origin: https://flags.idling.app" -H "Access-Control-Request-Method: GET"
```

6. To drop a secret override and use `wrangler.toml` `[vars]` only (only if you accept the file list as complete):

```powershell
pnpm exec wrangler secret delete ALLOWED_ORIGINS
pnpm run deploy
```

### Canonical ALLOWED_ORIGINS (production)

**Source of truth:** operator-maintained production list (merge-only; never shorten). Deduplicated order below. User paste contained **20 duplicate entries** (a repeated block of the first 20 origins); those duplicates were removed.

**Added:** `https://flags-api.idling.app` was not in the saved paste but is required on **feature-flag-service** and recommended on **otp-auth** / **access-service** so credentialed browser calls from **`https://flags.idling.app`** to **`https://flags-api.idling.app`** receive `Access-Control-Allow-Origin` (the browser `Origin` is always `https://flags.idling.app`; `flags-api` is kept for parity with prior deploys and tooling).

One-line string for `wrangler secret put ALLOWED_ORIGINS` on **otp-auth-service** and **feature-flag-service** (and merge into **strixun-access-service** if its secret is longer):

```
https://idling.app,https://www.idling.app,https://auth.idling.app,https://mods.idling.app,https://mods-api.idling.app,https://customer-api.idling.app,https://access.idling.app,https://access-api.idling.app,https://game.idling.app,https://chat.idling.app,https://api.idling.app,https://s.idling.app,https://short.idling.app,https://shorten.idling.app,https://streamkit.idling.app,https://design.idling.app,https://docs.idling.app,https://music-api.idling.app,https://short.army,https://sss.idling.app,https://flags.idling.app,https://flags-api.idling.app
```

Production `[vars]` in `serverless/otp-auth-service/wrangler.toml` (`[vars]` + `[env.production.vars]`), `serverless/feature-flag-service/wrangler.toml`, and `serverless/access-service/wrangler.toml` `[vars]` match this string. **strixun-access-service** may still override via secret — merge, do not blind-replace.

### Secrets (`wrangler secret put`)

Referenced in `utils/auth.ts` / worker env:

| Name | Required? | Purpose |
|------|-----------|---------|
| `SERVICE_API_KEY` | Optional | `X-Service-Key` header → full read/write as service caller |
| `JWT_SECRET` | **Not used** for JWT verification | RS256 uses JWKS via `JWT_ISSUER` + `AUTH_SERVICE` binding |
| `JWT_ISSUER` | Set in **vars**, not secret | JWKS URL base |
| `ACCESS_SERVICE_URL` | Set in **vars** | HTTP fallback for permissions |
| `AUTH_SERVICE` | **Service binding** in `wrangler.toml` | Internal fetch to `otp-auth-service` for JWKS |

Set production service key (replace placeholder at prompt):

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\feature-flag-service"
pnpm exec wrangler secret put SERVICE_API_KEY
```

When prompted, paste: `YOUR_SERVICE_API_KEY` (must match access/otp `SERVICE_API_KEY` if you use the same key).

List secrets:

```powershell
pnpm exec wrangler secret list
```

---

## 7. Grant super-admin auth rate-limit bypass (D1)

Bypass needs **both**:

1. Global kill switch: flag `auth.rate-limit.bypass-enabled` = `true` in `flag_state`
2. Per-customer grant: `auth.rate-limit.bypass` = `true` in `identity_override`

Replace `cust_YOUR_CUSTOMER_ID` with a real customer id (e.g. from auth dashboard).

**Remote (one command block):**

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\feature-flag-service"
pnpm exec wrangler d1 execute idling-feature-flags --remote --command "INSERT INTO flag_state (flag_id, environment, value_json, updated_at, updated_by, catalog_revision) VALUES ('auth.rate-limit.bypass-enabled', 'production', 'true', datetime('now'), 'operator', '1') ON CONFLICT(flag_id, environment) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at;"
pnpm exec wrangler d1 execute idling-feature-flags --remote --command "INSERT INTO identity_override (flag_id, customer_id, environment, value_json, expires_at, reason, updated_at, updated_by) VALUES ('auth.rate-limit.bypass', 'cust_YOUR_CUSTOMER_ID', 'production', 'true', NULL, 'super-admin bypass', datetime('now'), 'operator');"
```

**Local D1 (same SQL, `--local`):**

```powershell
pnpm exec wrangler d1 execute idling-feature-flags --local --command "INSERT INTO flag_state (flag_id, environment, value_json, updated_at, updated_by, catalog_revision) VALUES ('auth.rate-limit.bypass-enabled', 'production', 'true', datetime('now'), 'operator', '1') ON CONFLICT(flag_id, environment) DO UPDATE SET value_json = excluded.value_json;"
pnpm exec wrangler d1 execute idling-feature-flags --local --command "INSERT INTO identity_override (flag_id, customer_id, environment, value_json, expires_at, reason, updated_at, updated_by) VALUES ('auth.rate-limit.bypass', 'cust_YOUR_CUSTOMER_ID', 'production', 'true', NULL, 'super-admin bypass', datetime('now'), 'operator');"
```

Table/column names match `migrations/0001_init.sql`: `flag_state`, `identity_override`, `value_json`, etc.

---

## 8. Deploy flags-admin (Cloudflare Pages)

**Production URL (operators):** **`https://flags.idling.app`** — not `*.pages.dev`.

### One command (local PowerShell)

**Canonical production deploy for `flags.idling.app`:** `pnpm --filter @strixun/flags-admin deploy:prod` (from repo root) or `pnpm run deploy:prod` in `apps/flags-admin`.

Requires prior `wrangler login` / `CLOUDFLARE_API_TOKEN` with **Pages Edit** (and **Zone DNS Edit** on `idling.app` if you run the one-time domain step below).

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite"
pnpm --filter @strixun/flags-admin deploy:prod
```

That runs `build` → `wrangler pages project create flags-admin --production-branch main` (ignored if the project exists) → **`pages:deploy`** (`scripts/pages-deploy.mjs`: PATCH `production_branch` to **`main`** when API credentials are set, else deploy on the current Production branch from `wrangler pages deployment list` so `flags.idling.app` updates).

**Production branch vs deploy branch:** Wrangler marks a deploy as **Production** only when `--branch` equals the project's configured **`production_branch`**. Direct Upload projects **do not** update `production_branch` on `pages project create` if the project already exists. Mismatch → every CI/local deploy is **Preview** only; **`flags.idling.app`** and **`flags-admin.pages.dev`** stay empty (**"Nothing is here yet"** / 404) while **`https://main.flags-admin.pages.dev`** may return 200.

**Wrangler tell after deploy:** Production ends with only a deployment URL (no **"Deployment alias URL"** line). Preview adds **Deployment alias URL: `https://<branch>.flags-admin.pages.dev`**.

**Wrangler typo guard:** always deploy project **`flags-admin`** with a **space** before `--branch=main`. Never paste project name `flags-admin--branch=main` (missing space merges flags into the project name). Delete any stray Pages project with that typo name in the dashboard.

### Cloudflare said "Preview mode" (custom domain empty)

Support is correct: **`flags.idling.app` only serves the Production environment**, not Preview URLs like `main.flags-admin.pages.dev`. If **`wrangler pages deployment list`** shows your latest upload as **Preview** while **Production** is old or missing, the custom domain will show **Nothing is here yet** or stale content even though branch previews work.

**Fix order:** (1) set **Production branch** to **`main`** (dashboard or API below), (2) redeploy with `--branch=main`, (3) confirm **Environment: Production** on the new deployment, (4) optional **Promote to production** on an existing preview only after step 1.

### "Nothing is here yet" / custom domain 404 (ranked causes)

| Likelihood | Cause | Fix |
|------------|-------|-----|
| **1 (most common)** | Deploys are **Preview** because **`production_branch` ≠ `--branch main`** (e.g. branch set to project name **`flags-admin`**, or `master` while deploying `main`) | **Workers & Pages** → **`flags-admin`** → **Settings** → **Builds & deployments** → **Production branch** → **`main`** → Save. Then redeploy (below). In **Deployments**, latest upload must show **Environment: Production**, **Branch: main** — not **Preview** / **`flags-admin`**. |
| 2 | **Zero Production deployments** (custom domain bound, assets never promoted) | Same as above; or **Deployments** → **⋯** on latest preview → **Promote to production** after fixing production branch. |
| 3 | Custom domain on wrong project / Worker instead of Pages | **Custom domains** on **`flags-admin`** only; remove **`flags.idling.app`** from Workers. |
| 4 | DNS `flags` CNAME wrong target | CNAME **`flags`** → **`flags-admin.pages.dev`**, proxied (orange cloud). |
| 5 | Wrong Pages project name | Project must be **`flags-admin`**, not a typo project. |

**Verify (PowerShell, from repo):**

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\apps\flags-admin"
pnpm exec wrangler pages deployment list --project-name=flags-admin
# Need at least one row: Environment = Production, Branch = main

Invoke-WebRequest -Uri "https://flags-admin.pages.dev/" -UseBasicParsing | Select-Object StatusCode   # expect 200 HTML
Invoke-WebRequest -Uri "https://flags.idling.app/" -UseBasicParsing | Select-Object StatusCode       # expect 200 HTML
# Compare: https://main.flags-admin.pages.dev may work while production hostname 404s if only Preview deploys exist
```

**One-time sync `production_branch` via API** (needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`; CI runs this automatically):

```powershell
$env:CLOUDFLARE_ACCOUNT_ID = "5a0107a4350b8a7cafbeec1d95e78a56"  # or from: pnpm exec wrangler whoami
pnpm --filter @strixun/flags-admin run pages:patch-production-branch
```

**CI:** `.github/workflows/feature-flag-service.yml` job `deploy-flags-admin-pages` PATCHes `production_branch`, deploys assets, then binds **`flags.idling.app`** via the **official Pages REST API** and ensures a proxied **CNAME** `flags` → `flags-admin.pages.dev` when the zone is on the account.

### Wrangler 4 has no `wrangler pages domain add`

Verified on Wrangler **4.56**: `wrangler pages` subcommands are `dev`, `functions`, `project`, `deployment`, `deploy`, `secret`, `download` only. Do **not** add a failing `wrangler pages domain add` step — it is not a real command.

**First local deploy before CI** (or if custom domain is stuck **Pending**): run this once after `deploy:prod` (needs token with **Pages Write** + **Zone DNS Edit**; same token as `wrangler login` OAuth may lack DNS edit — use a scoped API token if needed):

```powershell
$AccountId = $env:CLOUDFLARE_ACCOUNT_ID
if (-not $AccountId) { throw 'Set CLOUDFLARE_ACCOUNT_ID (Account ID column from pnpm exec wrangler whoami).' }
$Token = $env:CLOUDFLARE_API_TOKEN
if (-not $Token) { throw 'Set CLOUDFLARE_API_TOKEN (scoped token with Pages Write + Zone DNS Edit — wrangler OAuth often lacks DNS edit).' }
$Headers = @{ Authorization = "Bearer $Token"; 'Content-Type' = 'application/json' }
Invoke-RestMethod -Method Post -Uri "https://api.cloudflare.com/client/v4/accounts/$AccountId/pages/projects/flags-admin/domains" -Headers $Headers -Body '{"name":"flags.idling.app"}' | Out-Null
$Zone = (Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones?name=idling.app&status=active" -Headers @{ Authorization = "Bearer $Token" }).result[0]
Invoke-RestMethod -Method Post -Uri "https://api.cloudflare.com/client/v4/zones/$($Zone.id)/dns_records" -Headers $Headers -Body '{"type":"CNAME","name":"flags","content":"flags-admin.pages.dev","proxied":true}' -ErrorAction SilentlyContinue | Out-Null
```

After **Active** custom domain + SSL (often 5–15 minutes), smoke test: `Invoke-WebRequest -Uri "https://flags.idling.app/" -UseBasicParsing`.

See **§ Cloudflare setup (complete)** for DNS/SSL troubleshooting. Minimum project: name **`flags-admin`**, production branch **`main`**, assets **`dist/flags-admin`**.

---

## Cloudflare setup (complete)

Use this when production DNS feels wrong, SSO fails after deploy, or you need to verify Worker vs Pages hostnames.

### Two hostnames (do not swap)

| Hostname | Product | What serves it |
|----------|---------|----------------|
| **`flags-api.idling.app`** | **Worker** | `feature-flag-service` (D1 + KV, CORS, JWT via `auth.idling.app`) |
| **`flags.idling.app`** | **Pages** | Static SPA from **`flags-admin`** (`dist/flags-admin`) |

Common mistake: pointing **`flags.idling.app`** at the Worker route, or pointing **`flags-api.idling.app`** at Pages. The UI hostname must never be the API route pattern in `wrangler.toml`.

### A. Feature-flag Worker (`flags-api.idling.app`)

#### Deploy (CLI — same as CI `deploy-worker`)

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\feature-flag-service"
pnpm run deploy
```

#### Verify route in dashboard

1. Log in at [https://dash.cloudflare.com](https://dash.cloudflare.com) → pick the account that owns **`idling.app`**.
2. **Workers & Pages** (left rail).
3. Open worker **`feature-flag-service`** (name from `wrangler.toml` `name = "feature-flag-service"`).
4. **Settings** → **Triggers** → **Routes** (or **Domains & Routes** on newer UI).
5. Confirm **Route** **`flags-api.idling.app/*`** on zone **`idling.app`** (not a separate **Custom domain** row) on worker **`feature-flag-service`**. Repo `wrangler.toml` matches `access-api`: zone route only; DNS must already be proxied under **Websites** → **`idling.app`** → **DNS** (`flags-api`).
6. **If deploy fails with "DNS record already exists" (100117):** DNS is already in the zone but `wrangler.toml` or the dashboard still uses **Custom domain** / `custom_domain = true`. Use zone route in repo config only; remove duplicate **Custom domain** on the worker; redeploy.
7. **If NXDOMAIN after deploy:** add proxied **AAAA** `100::` for Name `flags-api` in zone DNS, then redeploy — or greenfield-only: **Add** → **Custom domain** (never both custom domain and manual AAAA for the same host).

#### Worker vars (repo defaults — redeploy after edit)

From `serverless/feature-flag-service/wrangler.toml` `[vars]`:

| Var | Production value |
|-----|------------------|
| `ENVIRONMENT` | `production` |
| `JWT_ISSUER` | `https://auth.idling.app` |
| `ACCESS_SERVICE_URL` | `https://access-api.idling.app` |
| `ALLOWED_ORIGINS` | Matches § **Canonical ALLOWED_ORIGINS** (22 origins after dedupe + `flags-api`) |

Optional secrets: **`SERVICE_API_KEY`** (`wrangler secret put SERVICE_API_KEY`). **`ALLOWED_ORIGINS`** can be overridden with `wrangler secret put ALLOWED_ORIGINS` (secret wins over `wrangler.toml`).

Dashboard check: **Workers & Pages** → **`feature-flag-service`** → **Settings** → **Variables and Secrets** → **Environment variables** (plaintext vars mirror deploy).

### B. Flags-admin Pages (`flags.idling.app`)

#### Attach `flags.idling.app`

**Preferred:** merge to `main` / run CI job `deploy-flags-admin-pages` (API + DNS steps). **Local:** § 8 one-time REST block after `deploy:prod`.

**Dashboard fallback** (if API steps warn or domain stays **Pending**). Use after at least one successful `pages deploy` to project **`flags-admin`**.

1. Open [https://dash.cloudflare.com](https://dash.cloudflare.com) and select the account that owns **`idling.app`**.
2. Left rail: **Workers & Pages**.
3. Open the **Pages** project **`flags-admin`** (not worker `feature-flag-service`).
4. Tab **Custom domains** → **Set up a custom domain** (or **Add domain**).
5. Enter **`flags.idling.app`** → **Continue**.
6. If the zone **`idling.app`** is on this account, choose **Activate domain** / **Continue** and let Cloudflare add DNS automatically.
7. **Websites** (left rail) → zone **`idling.app`** → **DNS** → **Records**:
   - Confirm a **`flags`** record (usually **CNAME** → `flags-admin.pages.dev` or the exact target shown in step 4–6), **Proxied** (orange cloud).
   - Remove conflicting **A/AAAA** records for the same name if present.
8. Return to **Workers & Pages** → **`flags-admin`** → **Custom domains**: status for **`flags.idling.app`** should become **Active** (not stuck **Initializing**). First SSL can take 5–15 minutes after DNS is correct.
9. Smoke test: `https://flags.idling.app/` returns HTML 200 for the flags-admin SPA.

#### How assets get there

| Method | What happens |
|--------|----------------|
| **CI** (`.github/workflows/feature-flag-service.yml` → `deploy-flags-admin-pages`) | `pnpm --filter @strixun/flags-admin build`, PATCH `production_branch=main`, `wrangler pages deploy ../../dist/flags-admin --project-name=flags-admin --branch=main`, then Pages API domain + DNS CNAME |
| **Local PowerShell** (§ 8) | `pnpm --filter @strixun/flags-admin deploy:prod` |
| **Git-connected Pages** | Not required if you use wrangler upload; if you connect Git, you must mirror build command and output dir below |

There is **no** `apps/flags-admin/functions/` and **no** `_redirects` — single-page app, no client router. Pages only serves static files from **`dist/flags-admin`**.

#### Create or find the Pages project

1. **Workers & Pages** → filter **Pages**.
2. Project **`flags-admin`**. If absent: **Create** → **Pages** → **Connect to Git** *or* skip Git and use CLI deploy only (CLI creates the project on first `pages deploy`).
3. **Settings** → **Builds & deployments**:
   - **Production branch:** `main` (matches `--branch=main` in workflow).
   - If using Git (optional): **Build command** `pnpm install && pnpm --filter @strixun/flags-admin build` (from monorepo root); **Build output directory** `dist/flags-admin`.
   - If using **wrangler pages deploy only:** build settings in dashboard are ignored; each upload replaces production assets for branch `main`.

#### Pages environment variables (Production)

Vite bakes `import.meta.env.VITE_*` at **build time**. `wrangler pages deploy` does **not** inject dashboard env vars into an already-built `dist/` folder — variables only apply to **dashboard/CI builds**.

| Variable | Recommended value | Required? |
|----------|-------------------|-----------|
| `VITE_FLAGS_API_URL` | `https://flags-api.idling.app` | Optional — production build defaults to this in `apps/flags-admin/src/App.tsx` when not in dev |
| `VITE_AUTH_API_URL` | `https://auth.idling.app` | Optional — same default for auth |

To set anyway (Git-connected builds): **Workers & Pages** → **`flags-admin`** → **Settings** → **Environment variables** → **Production** → Add each name/value → redeploy so a new build runs.

Local override example:

```powershell
$env:VITE_FLAGS_API_URL = "https://flags-api.idling.app"
$env:VITE_AUTH_API_URL = "https://auth.idling.app"
pnpm --filter @strixun/flags-admin build
```

**Never** set production to `/flags-api` or `/auth-api` — those paths exist only on the Vite dev server proxy (`apps/flags-admin/vite.config.ts`).

### C. Custom domain DNS — path A (recommended: zone `idling.app` on Cloudflare)

1. **Workers & Pages** → **`flags-admin`** (Pages, not the Worker).
2. **Custom domains** → **Set up a custom domain**.
3. Enter **`flags.idling.app`** → Continue.
4. If **`idling.app`** is on this account, choose **Activate domain** / automatic DNS (wording varies).
5. Open **Websites** → **`idling.app`** → **DNS** → **Records**. You should see a record for **`flags`** (often **CNAME** → something like **`flags-admin.pages.dev`** or a branch-specific `*.flags-admin.pages.dev`, **Proxied** orange cloud).
6. **Custom domains** tab on the Pages project should show **`flags.idling.app`** as **Active** (not **Initializing** forever).

#### What “scuffed” DNS looks like

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Browser hits wrong site or 522/525 | **`flags`** CNAME points at **`flags-api`** Worker target, or an old A record to a VPS IP | Delete conflicting **A/AAAA** for `flags`; one **CNAME** to Pages target from step B5 |
| Two records named `flags` | Duplicate **A** + **CNAME** | Remove the wrong one; keep Pages CNAME |
| Custom domain stuck **Pending** | SSL not issued yet or wrong record | Wait 5–15 min; confirm orange-cloud proxy on CNAME; zone SSL mode **Full** (see below) |
| `flags.idling.app` opens Worker JSON/errors | Domain attached to **Worker** route instead of **Pages** | Remove Worker custom domain on `flags.idling.app`; attach only on **flags-admin** Pages |
| **"Nothing is here yet"** or **404** on `flags.idling.app` / `flags-admin.pages.dev`, but `main.flags-admin.pages.dev` returns SPA | **Preview-only** deploys (`production_branch` mismatch) | § 8 **"Nothing is here yet"** — set production branch **`main`**, redeploy `deploy:prod` |
| Site loads but login/API 404 on `/flags-api` | Built bundle still using relative `/flags-api` (old build) | Rebuild with current `App.tsx` or set `VITE_*` at build time; redeploy `dist/flags-admin` |

### D. Custom domain DNS — path B (manual CNAME)

Use when the zone is external or you refuse automatic DNS.

1. **Workers & Pages** → **`flags-admin`** → **Custom domains** — add **`flags.idling.app`**; note the **exact** target hostname Cloudflare shows (copy from UI).
2. Typical shapes:
   - **`flags-admin.pages.dev`** (production), or
   - **`<hash>.flags-admin.pages.dev`** (some accounts show a hash for the production alias — use the string from the dashboard, not a guess).
3. At your DNS provider, create **only**:

   - **Type:** CNAME  
   - **Name:** `flags` (or `flags.idling.app` depending on provider)  
   - **Target:** paste from step 1  
   - **TTL:** Auto  

4. Do **not** CNAME `flags` to `flags-api.idling.app`.

Finding target again: **flags-admin** project → **Custom domains** → click **`flags.idling.app`** → **DNS records** / setup panel shows the required CNAME value.

### E. SSL/TLS

1. **Websites** → **`idling.app`** → **SSL/TLS** → **Overview**.
2. Set encryption mode to **Full** or **Full (strict)** — **not Flexible** (Flexible + Pages/Workers often causes redirect loops or certificate errors).
3. After adding the Pages custom domain, **Edge Certificates** may show **`flags.idling.app`** as **Pending** briefly; refresh after DNS propagates.
4. Worker **`flags-api.idling.app`** uses Universal SSL on the zone when the route exists; no separate Pages cert.

### F. SSO / cookies / CORS

- Auth cookies are scoped for **`*.idling.app`** SSO (see comments in `serverless/otp-auth-service/wrangler.toml`). Login from **`https://flags.idling.app`** calls **`https://auth.idling.app`** directly; cookies are sent on cross-subdomain XHR when `credentials: 'include'` and CORS allow the origin.
- **`https://flags.idling.app`** must appear in **`ALLOWED_ORIGINS`** on:
  - **`otp-auth-service`** — in `wrangler.toml` already; **no** `ALLOWED_ORIGINS` secret (2026-11-22 `wrangler secret list`). Live CORS **OK** (`OPTIONS https://auth.idling.app/auth/me` → `Access-Control-Allow-Origin: https://flags.idling.app`).
  - **`feature-flag-service`** — in `wrangler.toml` already; **no** `ALLOWED_ORIGINS` secret. Production route/DNS: zone route + proxied **`flags-api`** record (§A); redeploy with `pnpm run deploy:prod` from `serverless/feature-flag-service`.
  - **`strixun-access-service`** — **`ALLOWED_ORIGINS` secret present**; CORS for flags **failed** on 2026-11-22 (`Origin: https://flags.idling.app` → no `Access-Control-Allow-Origin`; `Origin: https://mods.idling.app` → allowed). **Merge** flags origins into the **existing** secret (§6), do **not** replace with toml-only.

**If `flags.idling.app` is already in the canonical list (§6) but SSO/CORS still fails:** treat missing origins in git as ruled out. Most likely causes are **stale worker deploy** (`otp-auth-service` / `feature-flag-service` not redeployed after `wrangler.toml` changes), a **shorter `ALLOWED_ORIGINS` secret** still bound on a worker, **access-service secret** not merged for `https://flags.idling.app`, or **flags-admin Pages** not on Production (old SPA calling `/flags-api` instead of `https://flags-api.idling.app`). Redeploy workers + `pnpm run deploy:flags-admin` from repo root after fixing secrets.

Redeploy after `wrangler.toml` edits:

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\otp-auth-service"
pnpm run build:worker

Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\feature-flag-service"
pnpm run build:worker

Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\access-service"
pnpm run build:worker
```

Deploy (operator token):

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\otp-auth-service"
pnpm exec wrangler deploy

Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\feature-flag-service"
pnpm exec wrangler deploy

Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\access-service"
pnpm exec wrangler deploy
```

**access-service secret merge example** (copy live dashboard value first; union with § **Canonical ALLOWED_ORIGINS** — never replace with a shorter list):

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\access-service"
@'
YOUR_EXISTING_ORIGINS_COMMA_LIST,https://flags.idling.app,https://flags-api.idling.app
'@ | pnpm exec wrangler secret put ALLOWED_ORIGINS
# Or, if dashboard value is already a superset of the canonical line, paste the full merged string from § Canonical ALLOWED_ORIGINS.
```

Re-test flags permissions after login (`GET /v1/snapshot` may call access-api for `flags:read`).

### G. Environment variables — where each setting lives

| Name | Pages build env | Worker `wrangler.toml` [vars] | Worker secret |
|------|-----------------|-------------------------------|---------------|
| `VITE_FLAGS_API_URL` | Optional (Git/CI build) | — | — |
| `VITE_AUTH_API_URL` | Optional (Git/CI build) | — | — |
| `ALLOWED_ORIGINS` | — | feature-flag + otp-auth | Optional override both |
| `JWT_ISSUER` | — | Both workers | Rarely secret |
| `SERVICE_API_KEY` | — | — | feature-flag (optional) |
| `ENVIRONMENT` | — | Both workers | — |

### H. After DNS — smoke tests (PowerShell)

```powershell
# Pages UI — expect HTML (200), not JSON API
Invoke-WebRequest -Uri "https://flags.idling.app/" -UseBasicParsing | Select-Object StatusCode, @{n='ContentType';e={$_.Headers.'Content-Type'}}

# Flags API Worker
Invoke-RestMethod -Uri "https://flags-api.idling.app/health"
Invoke-RestMethod -Uri "https://flags-api.idling.app/v1/snapshot?product=stream-suite&environment=production"

# Auth (login backend)
Invoke-RestMethod -Uri "https://auth.idling.app/health" -ErrorAction SilentlyContinue
```

**SSO manual test (skip login when already signed in):**

1. Sign in on **`https://auth.idling.app`** or **`https://mods.idling.app`** (existing `*.idling.app` HttpOnly session cookie).
2. Open **`https://flags.idling.app`** in the same browser profile (no private/incognito split).
3. Expect a brief **Checking session…** state, then the flags table **without** the OTP form.
4. Network tab: **`GET https://auth.idling.app/auth/me`** (or equivalent) with cookie, then **`GET https://flags-api.idling.app/v1/snapshot`** with `credentials: include`.
5. If you see the login form despite step 1, check CORS **`ALLOWED_ORIGINS`** on otp-auth and feature-flag workers (secret may override `wrangler.toml`).
6. If you are signed in but see **flags:read** / 403, grant that permission — authentication succeeded; authorization did not.

Cold login: open **`https://flags.idling.app`** logged out, complete OTP, confirm the flags table loads (network tab should call **`https://flags-api.idling.app/v1/snapshot`**, not `/flags-api/...`).

---

## 9. Smoke tests

### Local (worker on 8797)

```powershell
Invoke-RestMethod -Uri "http://localhost:8797/health"
Invoke-RestMethod -Uri "http://localhost:8797/v1/snapshot?product=stream-suite&environment=production"
```

Optional catalog:

```powershell
Invoke-RestMethod -Uri "http://localhost:8797/v1/flags?product=auth"
```

### Production

```powershell
Invoke-RestMethod -Uri "https://flags-api.idling.app/health"
Invoke-RestMethod -Uri "https://flags-api.idling.app/v1/snapshot?product=stream-suite&environment=production"
```

### Auth dashboard proxy (Vite 5174)

```powershell
Invoke-RestMethod -Uri "http://localhost:5174/flags-api/health"
```

---

## 10. Deploy Stream Suite UI (`streamkit.idling.app` / `sss.idling.app`)

**Same Vite app, two hostnames.** GitHub Pages ships the root Stream Suite build; `dist/CNAME` is `streamkit.idling.app`. `sss.idling.app` is usually a separate DNS alias to the same Pages site — not a second frontend.

| Symptom on prod | Likely cause |
|-----------------|--------------|
| Looks unchanged after local UX work | **GitHub Pages artifact is old** — check `config.js` → `DEPLOYED_AT` on prod |
| No command palette / log drawer / compact header in `main.js` | **GitHub `master` behind workspace** — e.g. missing `src/stores/ui-feature-flags.ts` on remote; CI builds old tree |
| Flags fetch fails silently | **`flags-api.idling.app` not live** (DNS/worker) — UI still uses canon defaults |

**Noticeable UX with canon defaults (no D1 overrides):** compact header, log drawer button, Ctrl/Cmd+K command palette = **on**; sidebar and bottom activity log = **off**.

### CI (recommended)

Workflow: `.github/workflows/deploy-manager.yml`, name **`Deploy Service(s)`**. Jobs **`deploy_pages_build`** then **`deploy_pages`**. Triggers: push to **`master`** (non-markdown paths) or `workflow_dispatch`.

See **Commands that work from your machine** for the pages-only `gh workflow run` block (must set other `deploy_*` inputs to `false`).

Production UX must exist on **`master`** at `Underwood-Inc/strixun-stream-suite` before CI can ship it — the workspace under `__CODE` is not that git remote unless you use § clone strategy A/B.

### Local build only (does not update streamkit)

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite"
pnpm run deploy:stream-suite:build
```

Smoke after CI:

```powershell
$cfg = (Invoke-WebRequest -Uri "https://streamkit.idling.app/config.js" -UseBasicParsing).Content
if ($cfg -match "DEPLOYED_AT:\s*'([^']+)'") { "DEPLOYED_AT: $($matches[1])" }
$main = (Invoke-WebRequest -Uri "https://streamkit.idling.app/assets/js/main.js" -UseBasicParsing).Content
@('LogDrawer','CommandPalette','flags-api.idling.app') | ForEach-Object { "$_`: $($main.Contains($_))" }
```

Expect **`DEPLOYED_AT`** fresh and **`CommandPalette`** / **`LogDrawer`** = **True** after UX code is on **`master`**.

---

## 11. Verification commands (maintainers)

```powershell
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite"
pnpm --filter @strixun/feature-flags test
pnpm --filter @strixun/feature-flags build
pnpm --filter @strixun/feature-flag-service run build:worker
pnpm --filter @strixun/flags-admin build
Set-Location "c:\Users\mamop\Documents\__CODE\strixun-stream-suite\serverless\access-service"
pnpm exec vitest run utils/rate-limit.test.ts
```

---

## 12. short.army URL shortener SSO (cross-TLD)

**Symptom:** User signs in on **`https://short.army`** but **`/api/list`** is empty or differs from **`https://shorten.idling.app`** / **`https://s.idling.app`** for the same account.

**Root cause (typical):** Login runs against **`https://auth.idling.app`** (cross-site). OTP verify sets **`auth_token`** on **each root domain** parsed from otp-auth **`ALLOWED_ORIGINS`** (see `serverless/otp-auth-service/utils/cookie-domains.ts` → `.idling.app` and `.short.army`). The shortener UI calls **`window.location.origin`** for API (`serverless/url-shortener/app/src/lib/api-client.ts`), so **`https://short.army/api/list`** only receives cookies whose **`Domain=`** includes **`short.army`**. A session that only set **`Domain=.idling.app`** looks “logged in” on auth checks but **cannot list URLs on short.army**.

**Checks (PowerShell):**

```powershell
# After OTP on short.army — DevTools → Application → Cookies:
# Expect auth_token on BOTH https://short.army AND https://auth.idling.app (and usually .idling.app hosts).

# CORS on shortener worker (must include short.army):
# serverless/url-shortener/wrangler.toml → ALLOWED_ORIGINS

# Live otp-auth secret must include https://short.army (merge-only; do not shorten):
# Workers → otp-auth-service → ALLOWED_ORIGINS
```

**Deploy checklist:**

1. Merge **`https://short.army`** into otp-auth **`ALLOWED_ORIGINS`** (Dashboard secret if it overrides `wrangler.toml`); redeploy **`deploy_otp_auth=true`** once.
2. Update **`serverless/url-shortener/wrangler.toml`** `ALLOWED_ORIGINS` (repo includes `short.army`, `short.idling.app`, `shorten.idling.app`, `auth.idling.app`); redeploy **`deploy_url_shortener=true`**.
3. User re-login on **`short.army`** (or clear site cookies) so dual **`Set-Cookie`** runs with the updated origin list.

**Not fixable with a single cookie domain:** `.idling.app` and `.short.army` are different registrable domains — SSO requires **dual cookies** or a shared token strategy, not one `Domain=` for both.

### Session bridge (cross-TLD without leaking idling cookies to short.army JS)

When a user already has a valid **`*.idling.app`** session and opens **`https://short.army`**, OTP is not required if the SPA runs the bridge flow:

| Step | Endpoint | Notes |
|------|----------|--------|
| 1 | `POST https://auth.idling.app/auth/session/bridge-code` body `{ "target_host": "short.army" }` | Credentialed (`credentials: 'include'`). Validates idling session server-side; returns opaque single-use `bridge_code` (~120s). |
| 2 | `POST https://short.army/auth-api/auth/session/from-idling` body `{ "bridge_code": "…" }` | Same-origin on short.army; worker proxies to otp-auth. Response `Set-Cookie` filtered to **`.short.army` only**. |

**Trace doc (request tables, proxy invariants):** [`serverless/url-shortener/docs/SHORT_ARMY_SSO_TRACE.md`](../url-shortener/docs/SHORT_ARMY_SSO_TRACE.md)

### `ALLOWED_ORIGINS` (otp-auth, url-shortener, access)

Merge **never replace** — all three must include at least:

- `https://short.army`
- `https://s.idling.app`, `https://short.idling.app`, `https://shorten.idling.app`
- `https://auth.idling.app` (OTP / bridge / verify)

**otp-auth:** prefer `[vars]` in `serverless/otp-auth-service/wrangler.toml` when `wrangler secret list` shows **no** `ALLOWED_ORIGINS` secret.  
**url-shortener:** `serverless/url-shortener/wrangler.toml` `[vars]`.  
**access-service:** often has an `ALLOWED_ORIGINS` **secret** — decrypt in dashboard and append missing hosts (§6).

### Domain-scoped `Set-Cookie` proxy

Shared helper: `packages/api-framework/credential-proxy.ts` (`proxyRequestWithCredentials`, `forwardSetCookie: true` on auth proxies).

- Forwards **only** upstream `Set-Cookie` lines whose `Domain=` matches the **browser request host** (e.g. `short.army` → `.short.army`; `flags.idling.app` → `.idling.app`).
- Prevents cross-TLD cookie leak and fixes collapsed multi-cookie responses from worker service bindings (see SHORT_ARMY_SSO_TRACE §6).

**flags.idling.app:** Pages functions `apps/flags-admin/functions/auth-api/[[path]].ts` and `flags-api/[[path]].ts` use the same helper. Production SPA must call **`/auth-api`** and **`/flags-api`** (baked in `apps/flags-admin/.env.production`), not direct `auth.idling.app` / `flags-api.idling.app`, or toggle `PUT /v1/flags/.../state` returns **401 Authentication required** while `/v1/snapshot` still loads (snapshot is unauthenticated).

**Super-admin toggle smoke (after OTP on flags.idling.app):**

```powershell
# DevTools → Network: Toggle must hit https://flags.idling.app/flags-api/v1/flags/.../state (not flags-api.idling.app).
# Response headers should include X-Proxy-Cookie-Received: yes
```

### Deploy notes (short.army + SSO)

1. **Order:** deploy **otp-auth-service** and **url-shortener** after any `ALLOWED_ORIGINS` or bridge-handler change; users may need re-login on **`short.army`**.
2. **Never** `wrangler deploy --env production` on **otp-auth** without matching secrets — that targets a different worker name and leaves live custom domains on the default deploy.
3. Use default `pnpm run deploy` from each package directory (same as deploy-manager `deploy_otp_auth` / `deploy_url_shortener`).

### Deploy log (2026-11-22, task 78673cb2 follow-up)

| Worker | Command | Version ID | Notes |
|--------|---------|------------|-------|
| **url-shortener** (`strixun-url-shortener-production`) | `serverless/url-shortener`: **`pnpm run deploy:prod`** (`wrangler deploy`, no `--env`; matches otp-auth / deploy-manager) | **`f27bc51f-b215-4d1d-9f19-16fa4368f47d`** | Custom domains (`short.army`, `s.idling.app`, …) route to the **top-level** worker name, not `…-production-production`. Default deploy includes `AUTH_SERVICE` binding. Legacy `pnpm run deploy:production-env` (`--env production`) only updates **`2bbee351-6bf4-4994-ab5a-6a85548d3c43`** on `…-production-production.workers.dev`. |
| **otp-auth-service** | `serverless/otp-auth-service`: `pnpm run deploy` (`wrangler deploy`, **not** `--env production`) | **`6b907860-d600-4010-a4ab-7882fbbe9c28`** | Live bindings: canonical **22-origin** `[vars]` `ALLOWED_ORIGINS` (includes `https://short.army`). **`wrangler secret list`:** no `ALLOWED_ORIGINS` secret. |

**Live CORS (after url-shortener default deploy):**

```text
OPTIONS https://short.army/health  Origin: https://short.army → 204, Access-Control-Allow-Origin: https://short.army
OPTIONS https://short.army/api/list Origin: https://short.army → 204, Access-Control-Allow-Origin: https://short.army
OPTIONS https://auth.idling.app/auth/me Origin: https://short.army → 200, Access-Control-Allow-Origin: https://short.army
```

**Cookie code (no change required):** `serverless/otp-auth-service/utils/cookie-domains.ts` derives `.idling.app` + `.short.army`; `handlers/auth/verify-otp.ts` emits **two** `Set-Cookie` pairs per root domain (`auth_token` + `refresh_token`). Users with pre-deploy sessions must **re-login on short.army** (or clear cookies) for `Domain=.short.army` cookies.

---

## 13. FLAGS_DB bindings (must match)

These workers bind the **same** D1 `idling-feature-flags` / `6308b314-36c4-45c5-8f3c-d3f826bc7a6c`:

- `serverless/feature-flag-service/wrangler.toml` → `FLAGS_DB`
- `serverless/access-service/wrangler.toml` → `FLAGS_DB`
- `serverless/otp-auth-service/wrangler.toml` → `FLAGS_DB` (development + production sections)