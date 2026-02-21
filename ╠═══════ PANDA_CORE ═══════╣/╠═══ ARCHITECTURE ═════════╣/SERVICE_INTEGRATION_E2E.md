# End-to-End Service Integration Architecture

> How every service in the Strixun platform authenticates, communicates, and trusts each other.

This document is the bridge between the [OIDC Architecture](./OIDC_ARCHITECTURE.md) (which covers the Identity Provider in depth) and the individual service READMEs. It shows the **full picture** -- from a user typing their email to a resource server responding with data.

---

## Table of Contents

- [Who Is This For?](#who-is-this-for)
- [The Cast of Characters](#the-cast-of-characters)
- [The Big Picture](#the-big-picture)
- [Authentication: User → Platform](#authentication-user--platform)
  - [Login Flow (End-to-End)](#login-flow-end-to-end)
  - [Silent Refresh Flow](#silent-refresh-flow)
  - [Logout Flow](#logout-flow)
- [Authorization: Service → Service](#authorization-service--service)
  - [How Resource Servers Verify JWTs](#how-resource-servers-verify-jwts)
  - [Service-to-Service Calls](#service-to-service-calls)
  - [Admin Route Protection](#admin-route-protection)
- [The Trust Model](#the-trust-model)
- [Every Service at a Glance](#every-service-at-a-glance)
  - [OTP Auth Service](#otp-auth-service)
  - [Customer API](#customer-api)
  - [Access Service](#access-service)
  - [Streamkit API](#streamkit-api)
  - [Other Services](#other-services)
- [Cross-Service Communication Map](#cross-service-communication-map)
- [Environment Variables That Wire It All Together](#environment-variables-that-wire-it-all-together)
- [Privacy Architecture](#privacy-architecture)
- [What Happens When Things Go Wrong](#what-happens-when-things-go-wrong)
- [Developer Quick Reference](#developer-quick-reference)
- [Glossary](#glossary)

---

## Who Is This For?

| If you are... | Read these sections |
|---------------|-------------------|
| A developer integrating with the API | [Authentication](#authentication-user--platform), [Developer Quick Reference](#developer-quick-reference) |
| A platform engineer adding a new service | [How Resource Servers Verify JWTs](#how-resource-servers-verify-jwts), [Environment Variables](#environment-variables-that-wire-it-all-together) |
| A security reviewer | [The Trust Model](#the-trust-model), [Privacy Architecture](#privacy-architecture) |
| Someone who wants the full E2E picture | Read top to bottom |

---

## The Cast of Characters

Every Strixun service is a **Cloudflare Worker** -- a small, serverless function that runs at the edge of Cloudflare's global network. They communicate over HTTPS and trust each other via cryptographic tokens.

```mermaid
graph TB
    subgraph "Identity Layer"
        AUTH["<b>OTP Auth Service</b><br/>auth.idling.app<br/><i>Identity Provider</i>"]
        ACCESS["<b>Access Service</b><br/>access.idling.app<br/><i>Roles & Permissions</i>"]
    end

    subgraph "Data Layer"
        CUST["<b>Customer API</b><br/>customer-api.idling.app<br/><i>Customer Data</i>"]
    end

    subgraph "Application Layer"
        STREAM["<b>Streamkit API</b><br/>streamkit-api.idling.app<br/><i>Stream Overlays</i>"]
        MODS["<b>Mods API</b><br/>mods-api.idling.app<br/><i>Mod Management</i>"]
        CHAT["<b>Chat Signaling</b><br/>chat.idling.app<br/><i>WebRTC Signaling</i>"]
        URL["<b>URL Shortener</b><br/>s.idling.app<br/><i>Short Links</i>"]
    end

    subgraph "Client"
        BROWSER["<b>Browser / Control Panel</b>"]
    end

    BROWSER -->|"auth_token cookie"| AUTH
    BROWSER -->|"auth_token cookie"| CUST
    BROWSER -->|"auth_token cookie"| STREAM
    BROWSER -->|"auth_token cookie"| MODS
    BROWSER -->|"auth_token cookie"| CHAT

    AUTH -->|"X-Service-Key"| CUST
    AUTH -->|"X-Service-Key"| ACCESS
    CUST -->|"X-Service-Key"| ACCESS
    ACCESS -->|"X-Service-Key"| CUST

    STREAM -.->|"JWKS (cached)"| AUTH
    MODS -.->|"JWKS (cached)"| AUTH
    CHAT -.->|"JWKS (cached)"| AUTH
    URL -.->|"JWKS (cached)"| AUTH
    CUST -.->|"JWKS (cached)"| AUTH

    style AUTH fill:#edae49,stroke:#c68214,stroke-width:3px,color:#1a1611
    style ACCESS fill:#6495ed,stroke:#252017,stroke-width:2px,color:#f9f9f9
    style CUST fill:#28a745,stroke:#252017,stroke-width:2px,color:#f9f9f9
    style STREAM fill:#f9df74,stroke:#c68214,stroke-width:1px,color:#1a1611
    style MODS fill:#f9df74,stroke:#c68214,stroke-width:1px,color:#1a1611
    style CHAT fill:#f9df74,stroke:#c68214,stroke-width:1px,color:#1a1611
    style URL fill:#f9df74,stroke:#c68214,stroke-width:1px,color:#1a1611
    style BROWSER fill:#1a1611,stroke:#edae49,stroke-width:2px,color:#f9f9f9
```

**Solid arrows** = direct API calls (HTTP requests with credentials).
**Dashed arrows** = JWKS fetches (public key retrieval for JWT verification, cached for 10 minutes).

---

## The Big Picture

Think of the platform like a building with a security desk:

1. **The Security Desk** (OTP Auth Service) checks your ID and gives you a badge (JWT).
2. **The Badge** has your `customerId` on it, is signed with the building's stamp (RS256 private key), and expires in 15 minutes.
3. **Every Office** (Streamkit, Customer API, Mods, etc.) can verify the stamp using the building's public key (JWKS). They never need to call the security desk to check -- they verify independently.
4. **If your badge expires**, you have a special renewal slip (refresh token) that lets the security desk give you a new badge without showing your ID again. This works for up to 7 days.
5. **The HR Department** (Customer API) holds all your personal information, looked up by the `customerId` on your badge.
6. **The Permissions Office** (Access Service) knows what rooms you're allowed to enter, also looked up by `customerId`.

```mermaid
flowchart LR
    subgraph "User Proves Identity Once"
        A["Email + OTP"] --> B["OTP Auth Service"]
    end

    B --> C["JWT (customerId)"]
    C --> D["Any Service"]
    D --> E["Verify signature via JWKS"]
    E --> F["Use customerId for everything"]

    style A fill:#ea2b1f,stroke:#252017,color:#f9f9f9
    style B fill:#edae49,stroke:#c68214,color:#1a1611
    style C fill:#28a745,stroke:#252017,color:#f9f9f9
    style D fill:#6495ed,stroke:#252017,color:#f9f9f9
    style E fill:#f9df74,stroke:#c68214,color:#1a1611
    style F fill:#28a745,stroke:#252017,color:#f9f9f9
```

---

## Authentication: User → Platform

### Login Flow (End-to-End)

This is the complete sequence from "I want to log in" to "I can use any service."

```mermaid
sequenceDiagram
    actor User
    participant Browser as Control Panel<br/>(Browser)
    participant Auth as OTP Auth Service<br/>(auth.idling.app)
    participant KV as Cloudflare KV
    participant CustAPI as Customer API
    participant Access as Access Service

    Note over User,Access: PHASE 1 -- OTP Authentication

    User->>Browser: 1. Enter email address
    Browser->>Auth: 2. POST /auth/request-otp {email}
    Auth->>Auth: 3. Generate 9-digit OTP
    Auth->>KV: 4. Store OTP (encrypted, 10-min TTL)
    Auth-->>Browser: 5. {success: true}
    Note over Auth: OTP sent to email via configured provider

    User->>Browser: 6. Enter 9-digit code
    Browser->>Auth: 7. POST /auth/verify-otp {email, otp}
    Auth->>KV: 8. Retrieve + verify OTP
    Auth->>KV: 9. Look up or create customer record

    Note over Auth,Access: PHASE 2 -- Provisioning & Token Creation

    Auth->>Access: 10. ensureCustomerAccess(customerId)
    Note over Access: Idempotent: creates default roles<br/>if customer is new
    Auth->>Auth: 11. Check super admin status
    Auth->>Auth: 12. Create Access Token (RS256, 15 min)
    Auth->>Auth: 13. Create ID Token (RS256)
    Auth->>Auth: 14. Create Refresh Token (opaque, 7d max)
    Auth->>KV: 15. Store session (7h TTL) + refresh token hash

    Note over Auth,Browser: PHASE 3 -- Delivery

    Auth->>CustAPI: 16. POST /internal/sync-last-login
    Auth-->>Browser: 17. Token response + Set-Cookie headers
    Note over Browser: Cookies set:<br/>auth_token (HttpOnly, 15m)<br/>refresh_token (HttpOnly, 7d)

    Note over Browser,CustAPI: PHASE 4 -- Using Services

    Browser->>CustAPI: 18. GET /customer/me (auth_token cookie)
    CustAPI->>Auth: 19. Fetch JWKS (cached 10m)
    CustAPI->>CustAPI: 20. Verify RS256 signature
    CustAPI->>CustAPI: 21. Extract customerId from sub claim
    CustAPI-->>Browser: 22. Customer profile data
```

**Key points:**
- The email is used ONLY in Phase 1 (OTP delivery). After that, `customerId` is the sole identifier.
- Phase 2 happens entirely server-side. The browser never sees the email again.
- Phase 4 can happen with ANY service -- Streamkit, Mods, Chat, etc. They all verify the same JWT the same way.

### Silent Refresh Flow

Access tokens expire every 15 minutes. The client-side auth stores (`@strixun/auth-store`) handle this automatically:

```mermaid
sequenceDiagram
    participant Store as Auth Store<br/>(Browser)
    participant Service as Any Resource Server
    participant Auth as OTP Auth Service

    Store->>Service: 1. GET /some-data (auth_token cookie)
    Service-->>Store: 2. 401 Unauthorized (token expired)

    Store->>Auth: 3. POST /auth/refresh (refresh_token cookie)
    Auth->>Auth: 4. Validate refresh token in KV
    Auth->>Auth: 5. Check 7-day absolute expiry
    Auth->>Auth: 6. Rotate: delete old, create new refresh token
    Auth->>Auth: 7. Issue new access token (RS256, 15 min)
    Auth-->>Store: 8. New tokens + Set-Cookie headers

    Store->>Service: 9. Retry GET /some-data (new auth_token cookie)
    Service-->>Store: 10. Data returned successfully

    Note over Store: This happens silently.<br/>The user sees no interruption.
```

The auth store implementations (`zustand.ts` for React, `svelte.ts` for Svelte) use **both** proactive and reactive refresh:

**1. Proactive refresh (prevents logouts while the app is open)**  
While the tab is **visible** and the user is logged in, the client calls `POST /auth/refresh` every **14 minutes** (1 minute before the 15-minute access token expires). The access token is renewed before it expires, so the user does not see 401s or logouts as long as the tab stays active. When the tab is hidden, the timer is stopped; when the user brings the tab back, the 14-minute timer is rescheduled. This is the early session refresh that keeps the session alive when the application is still open/active.

**2. Reactive refresh (fallback when a request gets 401)**  
If any request returns 401 (e.g. tab was in background past 15 min, or first load after expiry), the store calls `refreshAuth()`, then retries the original call. If refresh fails (e.g. 7-day max reached), the user is logged out.

Example with tab kept visible:

```
[page load]     GET  /auth/me           → 200  (you're logged in)
[user action]   GET  /some-api          → 200
                ... 14 min, tab still visible ...
[proactive]     POST /auth/refresh      → 200  (new tokens; no user action)
                ... 14 min ...
[proactive]     POST /auth/refresh      → 200
                ... continues for up to 7 days from login ...
```

The `auth_token` HttpOnly cookie is sent automatically with every request. Refresh is deduped (one in-flight refresh shared by concurrent callers) and retried once on transient failure. If refresh fails and the user must request an OTP again, the server allows one OTP request without counting toward the rate limit when that email had a successful login or refresh in the last 30 minutes (recovery pass). See [OIDC_ARCHITECTURE.md](./OIDC_ARCHITECTURE.md) "Critical: Refresh reliability and OTP rate limiting."

### Logout Flow

```mermaid
sequenceDiagram
    participant Browser as Browser
    participant Auth as OTP Auth Service
    participant KV as Cloudflare KV

    Browser->>Auth: POST /auth/logout (both cookies sent)
    Auth->>Auth: 1. Extract auth_token from cookie
    Auth->>KV: 2. Add JWT ID to deny-list (7h TTL)
    Auth->>Auth: 3. Extract refresh_token from cookie
    Auth->>KV: 4. Delete refresh token from KV
    Auth->>KV: 5. Delete session from KV
    Auth-->>Browser: 6. Clear both cookies (Max-Age=0)
    Note over Browser: auth_token + refresh_token<br/>cookies cleared across all domains
```

---

## Authorization: Service → Service

### How Resource Servers Verify JWTs

Every Strixun service that receives user requests uses the **shared `@strixun/api-framework`** package for JWT verification. This package provides a unified auth extraction pipeline:

```mermaid
flowchart TD
    REQ["Incoming Request"] --> COOK{"auth_token<br/>cookie present?"}
    COOK -->|Yes| TOKEN["Extract token from cookie"]
    COOK -->|No| BEAR{"Authorization:<br/>Bearer header?"}
    BEAR -->|Yes| TOKEN2["Extract token from header"]
    BEAR -->|No| FAIL["Return: not authenticated"]

    TOKEN --> DECODE["Decode JWT header"]
    TOKEN2 --> DECODE

    DECODE --> ALG{"alg = ?"}
    ALG -->|RS256| JWKS["Fetch JWKS from<br/>{JWT_ISSUER}/.well-known/jwks.json<br/>(cached 10 min)"]
    JWKS --> MATCH["Find key by kid"]
    MATCH --> VERIFY_RS["Verify RS256 signature<br/>(Web Crypto API)"]
    VERIFY_RS --> CHECK["Check exp claim"]

    ALG -->|HS256| LEGACY["Verify with JWT_SECRET<br/>(legacy, migration period)"]
    LEGACY --> CHECK

    CHECK -->|Valid| RESULT["Return: {customerId, jwtToken}"]
    CHECK -->|Expired/Invalid| FAIL

    style REQ fill:#edae49,stroke:#c68214,color:#1a1611
    style RESULT fill:#28a745,stroke:#252017,color:#f9f9f9
    style FAIL fill:#ea2b1f,stroke:#252017,color:#f9f9f9
    style JWKS fill:#6495ed,stroke:#252017,color:#f9f9f9
```

**The auth result contains ONLY `customerId` and `jwtToken`.** No email, no display name, no permissions. If a service needs customer data, it calls the Customer API. If it needs permissions, it calls the Access Service.

### Service-to-Service Calls

Services communicate with each other using two authentication mechanisms:

```mermaid
graph TB
    subgraph "User-Facing Auth"
        U1["HttpOnly cookie<br/>(auth_token)"]
        U2["Authorization: Bearer JWT"]
    end

    subgraph "Service-to-Service Auth"
        S1["X-Service-Key header<br/>(shared secret per environment)"]
        S2["ServiceClient<br/>(Bearer with service API key)"]
    end

    U1 --> |"Browser → Service"| V["JWT Verification<br/>(JWKS / RS256)"]
    U2 --> |"Service → Service<br/>(forwarding user context)"| V

    S1 --> |"Service → Service<br/>(internal operations)"| T["Direct trust<br/>(key comparison)"]
    S2 --> |"Service → Service<br/>(with customer context)"| T

    style U1 fill:#edae49,stroke:#c68214,color:#1a1611
    style U2 fill:#edae49,stroke:#c68214,color:#1a1611
    style S1 fill:#6495ed,stroke:#252017,color:#f9f9f9
    style S2 fill:#6495ed,stroke:#252017,color:#f9f9f9
    style V fill:#28a745,stroke:#252017,color:#f9f9f9
    style T fill:#28a745,stroke:#252017,color:#f9f9f9
```

| Auth Method | When It's Used | Example |
|-------------|---------------|---------|
| **HttpOnly cookie** | Browser → any service | User visits the Control Panel, cookie sent automatically |
| **Bearer JWT** | Service forwarding user context | OTP Auth proxying `/customer/*` requests to Customer API |
| **X-Service-Key** | Internal operations (no user context) | OTP Auth calling `POST /internal/sync-last-login` on Customer API |
| **ServiceClient** | Service acting on behalf of platform | API Framework checking customer roles via Access Service |

### Admin Route Protection

Admin routes require both a valid JWT AND verified admin/super-admin role from the Access Service:

```mermaid
sequenceDiagram
    participant Admin as Admin User
    participant Service as Any Service
    participant FW as api-framework<br/>(protectAdminRoute)
    participant Access as Access Service

    Admin->>Service: GET /admin/customers (auth_token cookie)
    Service->>FW: protectAdminRoute(request, env, 'super-admin')
    FW->>FW: 1. Extract + verify JWT
    FW->>FW: 2. Get customerId from sub
    FW->>Access: 3. GET /access/{customerId}/roles (X-Service-Key)
    Access-->>FW: 4. ["admin", "super-admin"]
    FW-->>Service: 5. {allowed: true, level: 'super-admin'}
    Service-->>Admin: 6. Admin data
```

---

## The Trust Model

```mermaid
graph TB
    subgraph "Trust Anchors"
        PK["RS256 Private Key<br/>(only Auth Service has this)"]
        SK["X-Service-Key<br/>(shared across internal services)"]
    end

    subgraph "What Each Proves"
        PK --> JWT_TRUST["JWT is authentic and unaltered"]
        SK --> SVC_TRUST["Caller is a legitimate Strixun service"]
    end

    subgraph "Verification"
        JWT_TRUST --> JWKS_V["Any service can verify via JWKS<br/>(public keys, no shared secrets)"]
        SVC_TRUST --> KEY_V["Direct key comparison<br/>(constant-time)"]
    end

    style PK fill:#edae49,stroke:#c68214,color:#1a1611
    style SK fill:#6495ed,stroke:#252017,color:#f9f9f9
    style JWKS_V fill:#28a745,stroke:#252017,color:#f9f9f9
    style KEY_V fill:#28a745,stroke:#252017,color:#f9f9f9
```

| Trust Anchor | Scope | Compromise Impact |
|-------------|-------|-------------------|
| **OIDC_SIGNING_KEY** (RS256 private key) | Token issuance | Attacker can forge JWTs. Rotate key immediately, all services pick up new JWKS automatically. |
| **X-Service-Key** | Internal service calls | Attacker can impersonate services. Rotate in all `wrangler.toml` files and redeploy. |
| **JWKS cache (10 min)** | Token verification | If a key is rotated, services may accept tokens signed with the old key for up to 10 minutes. |

---

## Every Service at a Glance

### OTP Auth Service

**Domain:** `auth.idling.app` | **Role:** Identity Provider (IdP)

The only service that handles email, OTP codes, JWT issuance, and session management. All other services trust it implicitly via its RS256 signatures.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/auth/request-otp` | POST | API Key (optional) | Request a 9-digit OTP code |
| `/auth/verify-otp` | POST | API Key (optional) | Exchange email+OTP for tokens |
| `/auth/refresh` | POST | refresh_token cookie | Rotate tokens (silent refresh) |
| `/auth/me` | GET | JWT (cookie/Bearer) | UserInfo (OIDC) |
| `/auth/logout` | POST | JWT (cookie/Bearer) | Revoke tokens, clear cookies |
| `/auth/introspect` | POST | API Key | Token introspection (RFC 7662) |
| `/.well-known/openid-configuration` | GET | None | OIDC Discovery |
| `/.well-known/jwks.json` | GET | None | Public signing keys |
| `/customer/*` | Various | JWT | Proxied to Customer API |

**Outbound calls:**
- Customer API: `POST /internal/sync-last-login` (X-Service-Key)
- Customer API: `GET /customer/{id}` (ServiceClient Bearer)
- Access Service: super admin checks (X-Service-Key)

---

### Customer API

**Domain:** `customer-api.idling.app` | **Role:** Customer Data Store

Owns all customer profile data: display name, company, subscription, preferences, flairs. Identified exclusively by `customerId`.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/customer/me` | GET | JWT | Current customer profile |
| `/customer/me` | PUT | JWT | Update current customer |
| `/customer/{id}` | GET/PUT | JWT or X-Service-Key | Customer by ID |
| `/customer/{id}/preferences` | GET/PUT | JWT | Customer preferences |
| `/customer/{id}/display-name` | PUT | JWT | Update display name |
| `/admin/customers` | GET | JWT + super-admin | List all customers |
| `/internal/sync-last-login` | POST | X-Service-Key only | Internal last-login sync |

**Outbound calls:**
- Access Service: role checks for admin routes (X-Service-Key / JWT)

---

### Access Service

**Domain:** `access.idling.app` | **Role:** Authorization (Roles, Permissions, Quotas)

Manages what each customer is allowed to do. Called by other services to check permissions.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/access/{customerId}` | GET | X-Service-Key or JWT | Full access record |
| `/access/{customerId}/roles` | GET/PUT | Auth required | Customer roles |
| `/access/{customerId}/permissions` | GET/PUT | Auth required | Customer permissions |
| `/access/{customerId}/quotas` | GET/PUT | Auth required | Usage quotas |
| `/access/check-permission` | POST | Auth required | Permission check |
| `/access/roles` | GET/PUT | Super-admin or X-Service-Key | Role definitions |

**Outbound calls:**
- Customer API: `GET /customer/by-email/{email}` (X-Service-Key, for super-admin bootstrap only)

---

### Streamkit API

**Domain:** `streamkit-api.idling.app` | **Role:** Stream Overlay Configurations

Manages overlay configurations and scene activity tracking. Pure resource server -- no outbound service calls.

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/configs/{type}` | GET/POST | JWT | List/create configs |
| `/configs/{type}/{id}` | GET/PUT/DELETE | JWT | Config CRUD |
| `/scene-activity/record` | POST | JWT | Record scene switch |
| `/scene-activity/top` | GET | JWT | Top scenes |

---

### Other Services

| Service | Domain | Auth Method | Notes |
|---------|--------|-------------|-------|
| **Mods API** | mods-api.idling.app | JWT (cookie/Bearer) | Mod file management, integrity checks |
| **Chat Signaling** | chat.idling.app | JWT (cookie/Bearer) | WebRTC signaling, Durable Objects |
| **URL Shortener** | s.idling.app | JWT (cookie/Bearer) | Short link creation + redirect |

All follow the same pattern: verify JWT via JWKS, extract `customerId`, serve the request.

---

## Cross-Service Communication Map

```mermaid
graph LR
    subgraph "Identity Layer"
        AUTH["OTP Auth"]
        ACCESS["Access"]
    end

    subgraph "Data Layer"
        CUST["Customer API"]
    end

    subgraph "App Layer"
        STREAM["Streamkit"]
        MODS["Mods"]
        CHAT["Chat"]
        URL["URL Short"]
    end

    AUTH -- "sync-last-login<br/>(X-Service-Key)" --> CUST
    AUTH -- "fetch display name<br/>(ServiceClient)" --> CUST
    AUTH -- "proxy /customer/*<br/>(forward cookie)" --> CUST
    AUTH -- "super admin check<br/>(X-Service-Key)" --> ACCESS

    CUST -- "role checks<br/>(X-Service-Key)" --> ACCESS

    ACCESS -- "bootstrap lookup<br/>(X-Service-Key)" --> CUST

    STREAM -. "JWKS" .-> AUTH
    MODS -. "JWKS" .-> AUTH
    CHAT -. "JWKS" .-> AUTH
    URL -. "JWKS" .-> AUTH
    CUST -. "JWKS" .-> AUTH

    style AUTH fill:#edae49,stroke:#c68214,stroke-width:3px,color:#1a1611
    style ACCESS fill:#6495ed,stroke:#252017,stroke-width:2px,color:#f9f9f9
    style CUST fill:#28a745,stroke:#252017,stroke-width:2px,color:#f9f9f9
    style STREAM fill:#f9df74,stroke:#c68214,color:#1a1611
    style MODS fill:#f9df74,stroke:#c68214,color:#1a1611
    style CHAT fill:#f9df74,stroke:#c68214,color:#1a1611
    style URL fill:#f9df74,stroke:#c68214,color:#1a1611
```

| Caller | → Target | Method | Auth | Endpoint | Purpose |
|--------|----------|--------|------|----------|---------|
| OTP Auth | Customer API | POST | X-Service-Key | `/internal/sync-last-login` | Sync last login timestamp after OTP verification |
| OTP Auth | Customer API | GET | ServiceClient Bearer | `/customer/{id}` | Fetch display name for token response |
| OTP Auth | Customer API | * | Forward cookie | `/customer/*` | Proxy unhandled customer routes |
| OTP Auth | Access Service | GET | X-Service-Key | `/access/{id}/roles` | Super admin check during token creation |
| Customer API | Access Service | GET | X-Service-Key | `/access/{id}/roles` | Admin route protection |
| Access Service | Customer API | GET | X-Service-Key | `/customer/by-email/{email}` | Bootstrap super-admin on first deploy |
| All services | OTP Auth | GET | None | `/.well-known/jwks.json` | Public key fetch for JWT verification |

---

## Environment Variables That Wire It All Together

Every service needs specific environment variables to participate in the trust network. These are set in each service's `wrangler.toml`.

| Variable | Set In | Purpose | Example (local dev) |
|----------|--------|---------|-------------------|
| `JWT_ISSUER` | All resource servers | Base URL for JWKS fetching and `iss` claim validation | `http://localhost:8787` |
| `AUTH_SERVICE_URL` | Fallback for JWT_ISSUER | Same as above (legacy name) | `http://localhost:8787` |
| `JWT_SECRET` | All services | HS256 signing key (legacy, migration period) | `dev-secret` |
| `OIDC_SIGNING_KEY` | OTP Auth only | RS256 private key (JWK format) for token signing | `{"kty":"RSA",...}` |
| `SERVICE_API_KEY` | All serverless services | X-Service-Key for internal service-to-service calls | `dev-service-key` |
| `CUSTOMER_API_URL` | OTP Auth, Access, api-framework | Customer API base URL | `http://localhost:8788` |
| `ACCESS_SERVICE_URL` | Customer API, OTP Auth, Mods API | Access Service base URL | `http://localhost:8790` |
| `NETWORK_INTEGRITY_KEYPHRASE` | ServiceClient, encryption wrapper | Additional integrity header for service calls | `dev-keyphrase` |
| `ALLOWED_ORIGINS` | All services | CORS allowed origins (comma-separated) | `http://localhost:5173` |

```mermaid
graph TB
    subgraph "OTP Auth Service"
        A1["OIDC_SIGNING_KEY ★"]
        A2["JWT_ISSUER"]
        A3["CUSTOMER_API_URL"]
        A4["ACCESS_SERVICE_URL"]
        A5["SERVICE_API_KEY"]
    end

    subgraph "Customer API"
        B1["JWT_ISSUER"]
        B2["JWT_SECRET"]
        B3["ACCESS_SERVICE_URL"]
        B4["SERVICE_API_KEY"]
    end

    subgraph "Streamkit / Mods / Chat / URL"
        C1["JWT_ISSUER"]
        C2["JWT_SECRET"]
    end

    A1 -.- |"Signs JWTs"| JWKS["JWKS Endpoint<br/>/.well-known/jwks.json"]
    JWKS -.- |"Provides public key"| B1
    JWKS -.- |"Provides public key"| C1

    style A1 fill:#ea2b1f,stroke:#252017,stroke-width:2px,color:#f9f9f9
    style JWKS fill:#edae49,stroke:#c68214,stroke-width:2px,color:#1a1611
```

**★ The `OIDC_SIGNING_KEY` is the crown jewel.** Only the OTP Auth Service has it. It's a full RSA private key in JWK format. See [OIDC Architecture: Production Key Generation](./OIDC_ARCHITECTURE.md#token-signing-decision) for how to generate and deploy it.

---

## Privacy Architecture

A core design principle: **email addresses never leave the auth service.**

```mermaid
graph TB
    subgraph "Server-Side Only (KV)"
        KV1["Session Data<br/>{customerId, email, token hash, ...}"]
        KV2["Refresh Token Data<br/>{customerId, email, expiry, ...}"]
        KV3["Customer Record<br/>{customerId, email, displayName, ...}"]
    end

    subgraph "Client-Visible (Tokens + Responses)"
        JWT["JWT Payload<br/>{sub: customerId, iss, aud, exp,<br/>email_verified: true, scope, ...}"]
        RESP["API Responses<br/>{customerId, displayName, ...}"]
    end

    KV1 -.->|"email stays here"| KV1
    KV2 -.->|"email stays here"| KV2
    KV3 -.->|"email stays here"| KV3
    JWT -->|"NO email"| BROWSER["Browser"]
    RESP -->|"NO email"| BROWSER

    style KV1 fill:#28a745,stroke:#252017,color:#f9f9f9
    style KV2 fill:#28a745,stroke:#252017,color:#f9f9f9
    style KV3 fill:#28a745,stroke:#252017,color:#f9f9f9
    style JWT fill:#edae49,stroke:#c68214,color:#1a1611
    style RESP fill:#edae49,stroke:#c68214,color:#1a1611
    style BROWSER fill:#1a1611,stroke:#edae49,stroke-width:2px,color:#f9f9f9
```

| Data | Where it lives | Who can see it |
|------|---------------|---------------|
| **Email** | OTP Auth KV only (session, refresh token, customer records) | Auth service server-side code only |
| **customerId** | JWT `sub` claim, all API responses | Every service, every client |
| **displayName** | Customer API, JWT response body | Every service, every client |
| **email_verified** | JWT payload (boolean only) | Every service -- confirms OTP was verified, reveals nothing |

---

## What Happens When Things Go Wrong

```mermaid
flowchart TD
    A["Problem"] --> B{"What kind?"}
    
    B -->|"Access token expired"| C["Client calls POST /auth/refresh<br/>(automatic via auth store)"]
    C --> D{"Refresh succeeds?"}
    D -->|"Yes"| E["New tokens issued, continue"]
    D -->|"No (7d max)"| F["User must re-authenticate via OTP"]
    
    B -->|"JWKS fetch fails"| G["Service uses cached JWKS<br/>(up to 10 min old)"]
    G --> H{"Cache available?"}
    H -->|"Yes"| I["Verify with cached key"]
    H -->|"No"| J["Return 500 -- Auth Service unreachable"]
    
    B -->|"Refresh token stolen"| K["Attacker uses it once"]
    K --> L["Legitimate user's next refresh fails<br/>(old token already rotated)"]
    L --> M["User re-authenticates via OTP<br/>(attacker's token also expires)"]
    
    B -->|"Private key compromised"| N["Rotate OIDC_SIGNING_KEY<br/>in OTP Auth Service"]
    N --> O["JWKS endpoint serves new key"]
    O --> P["All services pick up new key<br/>within 10 min (cache TTL)"]
    
    style A fill:#ea2b1f,stroke:#252017,color:#f9f9f9
    style E fill:#28a745,stroke:#252017,color:#f9f9f9
    style F fill:#edae49,stroke:#c68214,color:#1a1611
    style I fill:#28a745,stroke:#252017,color:#f9f9f9
    style J fill:#ea2b1f,stroke:#252017,color:#f9f9f9
    style M fill:#edae49,stroke:#c68214,color:#1a1611
    style P fill:#28a745,stroke:#252017,color:#f9f9f9
```

---

## Developer Quick Reference

### Adding JWT verification to a new service

1. Install the shared package: `@strixun/api-framework`
2. Add to your `wrangler.toml`:
   ```toml
   [env.development.vars]
   JWT_ISSUER = "http://localhost:8787"
   JWT_SECRET = "your-dev-secret"
   ```
3. In your request handler:
   ```typescript
   import { extractAuth } from '@strixun/api-framework/route-protection';
   import { verifyJWT } from '@strixun/api-framework/jwt';

   const auth = await extractAuth(request, env, verifyJWT);
   if (!auth) return new Response('Unauthorized', { status: 401 });
   
   const customerId = auth.customerId; // This is all you need
   ```

### Testing with the dev portal

1. Generate a test HTML snippet: `GET /api-key/test-snippet?apiKey=YOUR_KEY`
2. Open the downloaded HTML in a browser
3. Walk through the 5-step flow: Request OTP → Verify → Refresh → Get User Info → Logout
4. The OIDC section lets you inspect Discovery, JWKS, and Introspection

### Cookie properties at a glance

| Cookie | Max-Age | HttpOnly | SameSite | Secure | Domain |
|--------|---------|----------|----------|--------|--------|
| `auth_token` | 900 (15 min) | Yes | Lax | Production only | Root domain |
| `refresh_token` | ≤604800 (7 days) | Yes | Lax | Production only | Root domain |

---

## Glossary

| Term | Definition |
|------|-----------|
| **Resource Server** | Any service that verifies JWTs and serves protected data (Streamkit, Customer API, Mods, etc.). |
| **Identity Provider (IdP)** | The OTP Auth Service -- it authenticates users and issues tokens. |
| **JWKS** | JSON Web Key Set -- the public keys published by the Auth Service that resource servers use to verify token signatures. |
| **X-Service-Key** | A shared secret used for service-to-service calls that don't carry user context. |
| **ServiceClient** | A helper from `@strixun/api-framework` that makes authenticated service-to-service HTTP calls. |
| **Token Rotation** | Each use of a refresh token invalidates the old one and issues a new one. Limits the damage of a stolen token. |
| **Deny-List** | A KV store of revoked JWT IDs, checked during introspection and (optionally) by services during logout. |

---

**Related Documentation:**
- [OIDC Architecture (deep dive)](./OIDC_ARCHITECTURE.md) -- Token signing, OIDC Discovery, refresh tokens, session management
- [OTP Auth Service README](../╠═══ SERVICES  ═══════════╣/OTP_AUTH_SERVICE_README.md) -- Service-specific setup and endpoints
- [API Framework Enhanced Architecture](./API_FRAMEWORK_ENHANCED_ARCHITECTURE.md) -- The shared framework internals
- [Multi-Stage Encryption Diagram](./MULTI_STAGE_ENCRYPTION_DIAGRAM.md) -- E2E encryption layer
- [Authentication Methods](../╠═══ SECURITY  ═══════════╣/AUTHENTICATION_METHODS.md) -- All auth methods across the platform

---

**Last Updated**: 2026-02-19
**Version**: 1.0.0
**Status**: Complete
