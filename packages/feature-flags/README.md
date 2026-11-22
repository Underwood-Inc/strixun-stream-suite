# @strixun/feature-flags

Canonical catalog, D1 evaluation, and **suite-wide response piggyback** helpers.

## Response envelope (all JSON API workers)

Workers attach product-scoped flags to every JSON response via `@strixun/api-framework`:

```json
{
  "ok": true,
  "_featureFlags": {
    "product": "mods-hub",
    "environment": "production",
    "revision": "1.0.0:production:abc",
    "flags": { "stream-suite.route.chat": true }
  }
}
```

| Header | Purpose |
|--------|---------|
| `X-Feature-Flags-Revision` | Same value as `_featureFlags.revision` |
| `X-Feature-Flags-Product` | Canon product key for the caller |
| `X-Feature-Flags` | Non-JSON bodies: compact `flags` object |

## Shared APIs

- `resolveProductForRequest(request, auth?, explicitProduct?)` — host/path/header → canon product
- `sliceSnapshotForCaller(flags, auth, product)` — RBAC + cross-product isolation
- `mergeFlagsFromResponse(body, headers?)` — browser SDK (`@strixun/api-framework/client`)

## Product → worker matrix

| Product | Primary workers | Frontends |
|---------|------------------|-----------|
| `stream-suite` | suite-api, streamkit-api, customer-api, music-api, game-api | streamkit SPA |
| `mods-hub` | mods-api | mods-hub |
| `chat-hub` | chat-signaling | chat-hub |
| `access` | access-service | access-hub |
| `url-shortener` | url-shortener (`/api`) | url-shortener SPA |
| `auth` | otp-auth-service | control-panel |
| `flags-admin` | feature-flag-service | flags-admin |

## Client migration

Replace polling (`GET /v1/snapshot` timers, legacy `refreshUiFeatureFlags` intervals) with:

1. `installFeatureFlagsFetchHook()` or API client automatic merge
2. `bootstrapUiFeatureFlags()` once on load (canon defaults until first API traffic)