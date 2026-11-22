# OBS integration notes (Stream Suite)

Research snapshot for OBS Studio **28+** with bundled **obs-websocket v5**. Updated November 2026.

## WebSocket protocol (v5)

- **Default port:** `4455` (configurable in OBS → Tools → obs-websocket Settings).
- **Bundled:** obs-websocket ships inside OBS Studio 28.0.0+; no separate plugin install for current OBS.
- **Protocol:** JSON text frames by default (`obswebsocket.json` subprotocol). Opcodes: `0` Hello → `1` Identify → `2` Identified, then requests (`op: 6`) and events (`op: 5`).
- **Authentication:** When enabled, Hello includes `authentication.challenge` and `authentication.salt`. Client sends Identify with `rpcVersion: 1` and `authentication` = Base64(SHA256(Base64(SHA256(password + salt)) + challenge)) per [protocol.md](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md).
- **Stream Suite alignment:** `src/modules/websocket.ts` implements the same challenge flow and subscribes to all standard events (`eventSubscriptions: 2047`) so `BroadcastCustomEvent` and storage sync work.

References:

- [obs-websocket repository](https://github.com/obsproject/obs-websocket/)
- [obs-websocket 5.0.0 release notes](https://github.com/obsproject/obs-websocket/releases/tag/5.0.0)
- [Generated protocol reference](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md)

## Persistent data (profile machine storage)

- **API:** `GetPersistentData` / `SetPersistentData` with `realm: OBS_WEBSOCKET_DATA_REALM_GLOBAL` and a `slotName` string; `slotValue` is a string blob (we store JSON).
- **Scope:** Data lives on the **OBS host machine**, not in OBS scene collections or profiles JSON; shared across clients connected to that obs-websocket instance.
- **Stream Suite:** `src/modules/obs-storage.ts` uses master slot `strixun_storage_master` and migrates legacy `strixun_configs`.

## Browser source / dock constraints

- Custom browser docks and browser sources run in **CEF** (Chromium Embedded Framework).
- **localStorage** may be cleared or restricted when OBS clears site data; **IndexedDB** + obs-websocket persistent data are the durable layers in `src/modules/storage.ts`.
- **Hash vs query routes:** OBS sometimes drops URL fragments; text cycler display URLs prefer `?display=text-cycler&id=…` (see `src/stores/text-cycler.ts`).
- **Clipboard, permissions, and third-party cookies** follow normal browser rules inside CEF—features degrade gracefully when APIs are blocked.

## Credential storage security (this app)

| Layer | What is stored | Notes |
|--------|----------------|-------|
| Local (IDB / localStorage / OBS slot) | Host, port, remember flag, optional password | Password only when user enables **Remember credentials**; `obs_*` keys stored as **raw strings** (not JSON-parsed) to avoid type coercion bugs. |
| Cloud (`/obs-credentials/*` on Worker API) | Encrypted password + host/port | Requires SSO; **7-hour** TTL tied to session (see Setup page copy). |
| Session memory | `storedPassword` for display routes | Cleared on explicit forget/clear. |

**Browser reality:** Any secret persisted locally in a web panel can be read by whoever controls the browser profile or OBS host. Cloud storage reduces exposure on shared machines only when the user is signed in; it is not a substitute for a strong obs-websocket password and OS account security.

## Streamkit cloud config sync (`/configs/*`)

Aligned types: `text-cyclers`, `swaps`, `layouts` (notes API exists in `streamkit-api-client.ts` but is not wired through `cloud-storage.ts` yet). Each config row must have a stable `id` for upsert/delete sync (`cloud-storage.ts` → `streamkit-api-client.ts`).

UI state, opacity presets, scripts, and full backup slots use **OBS persistent data**, **storage-sync**, and **cloud-save** modules—not the per-item `/configs/*` API.