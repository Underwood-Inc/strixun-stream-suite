# Feature flag service

Cloudflare Worker on **8797** (local) / `flags-api.idling.app` (production).

**Operator steps (deploy, D1, secrets, smoke tests):** [`OPERATOR_RUNBOOK.md`](./OPERATOR_RUNBOOK.md)

## Local dev

| Service | Port |
|---------|------|
| feature-flag-service | 8797 |
| otp-auth (dashboard) | 8787 / Vite 5174 |
| access-service | 8795 |

```powershell
pnpm --filter @strixun/feature-flag-service dev
```

Apply local D1 schema:

```powershell
cd serverless/feature-flag-service
pnpm exec wrangler d1 migrations apply idling-feature-flags --local
```

## Grant super-admin rate-limit bypass (D1)

Requires global kill switch `auth.rate-limit.bypass-enabled` = `true` in `flag_state`, **and** per-customer override `auth.rate-limit.bypass` = `true`.

One-liner (replace `cust_YOUR_ID`):

```sql
INSERT INTO identity_override (flag_id, customer_id, environment, value_json, expires_at, reason, updated_at, updated_by)
VALUES ('auth.rate-limit.bypass', 'cust_YOUR_ID', 'production', 'true', NULL, 'super-admin bypass', datetime('now'), 'operator');
```

Enable the kill switch once per environment:

```sql
INSERT INTO flag_state (flag_id, environment, value_json, updated_at, updated_by, catalog_revision)
VALUES ('auth.rate-limit.bypass-enabled', 'production', 'true', datetime('now'), 'operator', '1')
ON CONFLICT(flag_id, environment) DO UPDATE SET value_json = excluded.value_json;
```

## Remote migrations

```powershell
pnpm exec wrangler whoami
pnpm exec wrangler d1 migrations apply idling-feature-flags --remote
```

If you see D1 error `7400` (invalid uuid), run `wrangler d1 list` and update `database_id` in all workers (`feature-flag-service`, `access-service`, `otp-auth-service`). Correct remote id: `6308b314-36c4-45c5-8f3c-d3f826bc7a6c`.

## Pages UI

`apps/flags-admin` builds to `dist/flags-admin` for **https://flags.idling.app** (`pnpm --filter @strixun/flags-admin deploy:prod`; CI: `.github/workflows/feature-flag-service.yml`).