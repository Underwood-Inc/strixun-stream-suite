## A2 Encryption Architecture Working Plan (Living Doc)

### Status

This document is intentionally updated continuously as implementation progresses.

### Goal

Adhere to the A2 architecture:

- Single Sign-On (SSO) uses HttpOnly cookies across apps.
- Client encryption at rest is enabled by default, but is unlocked only when authenticated.
- Encryption uses per-customer key material that is NOT the JWT string and is NOT shipped in frontend env/config.
- No offline decrypt: if the auth cookie is expired/invalid, encryption cannot be unlocked.
- No write queueing: all writes that require encryption must hard-block and prompt re-auth.
- Remain compatible with:
  - Client opt-in double encryption (existing second layer, e.g. password-protected items).
  - Server-side two-stage / multi-party encryption patterns already documented and implemented.

Non-goals:

- Adding new user burden or new UX flows beyond existing re-auth prompts.
- Shipping long-lived secrets to the browser (VITE_* service keys, server keys, etc.).

### Constraints / Security Notes

- Public crypto parameters (PBKDF2 iterations, salt/IV sizes, algorithm names) are not secrets and may remain in code.
- Client-side encryption protects primarily against at-rest exfiltration of local data, not against an active XSS attacker.
- Any key material usable for decrypt must be gated by authenticated session and never stored long-term in plaintext.

### Current Observations (Audit)

Known current mismatch:

- Stream Suite currently has modules that import a JS-readable `token` store for encryption key derivation. This conflicts with HttpOnly-cookie SSO (no JS-readable JWT).
- Build failures in `pnpm dev:turbo` are caused by these stale imports and mismatched exports (e.g. `token`, `encryptionEnabled`).

### Target Architecture: Key Flows

#### Client at-rest encryption (A2)

- A per-customer Data Encryption Key (DEK) exists on the server.
- The server stores this DEK encrypted/wrapped at rest using server-side secrets.
- When the browser has a valid auth cookie, the client can request a session-scoped unlock and receive key material needed to perform client at-rest encryption for the duration of the session.
- The DEK is held in memory only (or stored only in wrapped form if needed). For A2 with no offline decrypt, simplest is memory-only.

#### Cookie expiry behavior

- If cookie expires or `/auth/me` returns 401/403:
  - In-memory DEK is cleared immediately.
  - Decrypt operations fail fast.
  - Writes that require encryption hard-block and prompt re-auth (no queueing).

### Implementation Plan (Phased)

#### Phase 1: Audit and compilation fixes (no security regressions)

- Identify and remove all imports/usages of JS-readable auth token in Stream Suite client.
- Ensure a single owner for "encryption enabled" state (the encryption module) and remove mismatched imports.
- Restore `pnpm dev:turbo` startup to a clean baseline.

#### Phase 2: Server DEK endpoints (OTP Auth Service)

Add cookie-authenticated endpoints (exact route names TBD):

- Get or create per-customer DEK (server storage is encrypted/wrapped).
- Unlock endpoint that returns session-scoped key material to the authenticated browser.
- Ensure CORS/credentials alignment for local dev via proxies.

Key properties:

- Requires valid HttpOnly cookie session (no API key bypass).
- Does not return JWT.
- Uses existing server secrets for at-rest key storage.

#### Phase 3: Client unlock integration

- Add an "unlock encryption" path in client encryption service.
- Replace "token-based key derivation" with "DEK-based encryption".
- Keep optional second-layer (double encryption) behavior compatible.

#### Phase 4: Hard-block writes on lock

- Any storage write that would encrypt data must verify:
  - encryption enabled AND
  - encryption unlocked AND
  - authenticated session valid
- If not valid:
  - block write
  - prompt re-auth
  - do not queue

### Progress Log

- 2026-01-14: Created this working plan doc.
- 2026-01-14: Removed remaining Stream Suite imports that assumed a JS-readable auth token in `src/pages/UrlShortener.svelte`.
- 2026-01-14: Fixed Stream Suite auth/encryption wiring so `encryptionEnabled` is a dedicated store set during bootstrap (no longer imported from `src/modules/storage.ts`).
- 2026-01-14: Fixed bootstrap logic that referenced an undefined `authToken` variable; now uses `isAuthenticated` store state.
- 2026-01-14: Added OTP Auth Service endpoint `GET /auth/encryption/dek` to return a per-customer DEK to authenticated cookie sessions; DEK is stored encrypted at rest in `OTP_AUTH_KV`.
- 2026-01-14: Removed all remaining Stream Suite imports of a JS-readable auth `token` store; client encryption now fetches session key material (DEK) via cookie-auth on demand.
- 2026-01-14: Implemented A2 lock handling: DEK fetch emits `auth:required`, bootstrap clears auth to force re-auth UI, and encrypted writes now hard-block (no fallback writes).
- 2026-01-14: Fixed dev SSO pathing across apps by normalizing `/auth-api/*` to `/auth/*` inside the OTP auth worker router (prevents false 401s when apps call `/auth-api/auth/me`).
- 2026-01-14: Normalized additional dev proxy prefixes in workers to prevent cross-app false 404/401: `/customer-api/*`, `/mods-api/*`, `/game-api/*`, `/twitch-api/*`.

