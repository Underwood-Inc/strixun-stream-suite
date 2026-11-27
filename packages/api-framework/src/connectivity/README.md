# Offline Connectivity Engine (OCE)

Framework-agnostic fetch observation that publishes a best-effort `unavailable` hint. Full product guide (recipes, gotchas, MDN `navigator.onLine` policy): **Docusaurus** `guides/offline-connectivity-engine/index` on idling.app.

## Quick attach

```ts
import { getPageConnectivityEngine } from '@strixun/api-framework/connectivity';

const engine = getPageConnectivityEngine({ healthCheckUrl: '/health' });
const fetchWithOce = engine.attachFetch(globalThis.fetch.bind(globalThis));
```

`secureFetch` in this package already wraps HTTPS enforcement with `attachFetch`.

## Rules (short)

- Any `Response` → available (no second probe).
- Transport failures streak toward `failureThreshold` (default 2), then one shared health probe.
- `AbortError` ignored; `TimeoutError` counts.
- Never block UI or skip user fetches when `unavailable` is true.

## Export

`@strixun/api-framework/connectivity` — engine, presets, `classifyFetchOutcome`, page singleton.