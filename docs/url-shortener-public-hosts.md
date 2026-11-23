# URL shortener public hosts

## Canon vs CORS

| Config | Purpose |
|--------|---------|
| `SHORTENER_PUBLIC_HOSTS` | Comma-separated **https** origins for **link appearance** and redirect host-key analytics. Projected by `@strixun/url-shortener-core` → `GET /api/public-hosts`. |
| `ALLOWED_ORIGINS` | **CORS superset** for Stream Suite, mods, auth, marketing sites, etc. **Do not** use it as the public-host allowlist. |

Production default (five hosts): `short.army`, `s.idling.app`, `short.idling.app`, `shorten.idling.app`, `sss.idling.app`.

## Display preference

- Browser key: `ui_shortener_public_host` stores catalog **`hostKey`** (`id`), not raw hostname.
- Stream Suite API base remains `https://s.idling.app` from `config.js`; copy/list UI uses the preferred host via `composePublicShortUrl`.

## Analytics

- **KV aggregates** on `url_{shortCode}` and `user_urls_{userId}`: `clickCount`, `lastViewedAt`, `viewsByHostKey` (sparse by `hostKey`).
- **Analytics Engine** dataset `url_shortener_link_view` (binding `ANALYTICS_ENGINE`): one `writeDataPoint` per redirect in `waitUntil`.
- Legacy `ANALYTICS_KV` keys `analytics_{code}_{ts}` are **no longer written** on redirect.

## Manual deploy checklist

1. Ensure `SHORTENER_PUBLIC_HOSTS` is set on the production worker (wrangler `[vars]` or dashboard).
2. Create/bind Analytics Engine dataset `url_shortener_link_view` (see `serverless/url-shortener/wrangler.toml`).
3. Custom domain routes for all five hosts must point at `strixun-url-shortener-production`.

## Suite icon audit (★ placeholders)

Shortener surfaces now use `@strixun/mappy-icons` (`action.copy`, `action.delete`, `action.refresh`, `action.link`).

| File | Glyph | Suggested follow-up |
|------|-------|---------------------|
| `src/lib/components/Navigation.svelte` | ★ WIP flair | Status icon via `status-flair` / mappy alias |
| `src/lib/components/SearchBox.svelte` | ★ search | `action.search` (future alias) |
| `src/lib/components/Sidebar.svelte` | ★ quick actions | Per-action Lucide |
| `src/pages/Login.svelte`, `AuthScreen.svelte` | ★ brand | Brand asset / shield alias |
| `src/pages/Dashboard.svelte`, `Setup.svelte`, etc. | ★ section tips | Rowan/status copy or real icons |
| `src/modules/*.ts` innerHTML | ★ delete/hints | Out of shortener scope |

Implemented in this effort: `src/pages/UrlShortener.svelte`, `serverless/url-shortener/app/src/pages/UrlManager.tsx`.