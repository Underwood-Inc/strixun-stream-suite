# Suite API - Cloudflare Worker

Cloudflare Worker for the Stream Suite backend: cloud storage, notes, OBS credentials, scrollbar CDN, and legacy auth.

## Overview

This service provides the main API for Stream Suite: cloud save/load, notes, OBS credentials storage, scrollbar CDN scripts, and legacy OTP auth endpoints (new auth uses otp-auth-service).

## Features

- **Cloud Storage** - Save/load/list/delete user data (cloud-save and cloud endpoints)
- **Notes** - Notebook save/load/list/delete
- **OBS Credentials** - Encrypted OBS credentials per user
- **Scrollbar CDN** - Serve scrollbar and customizer scripts
- **Legacy Auth** - Request OTP, verify OTP, /auth/me, logout, refresh (JWT from otp-auth-service)
- **Health** - `GET /health` and `GET /`

## Setup

### Prerequisites

- Cloudflare account
- Wrangler CLI installed
- Node.js 18+
- pnpm package manager

### Installation

```bash
cd serverless/suite-api
pnpm install
```

### Configuration

1. **Set Secrets:**
```bash
wrangler secret put JWT_SECRET    # REQUIRED: must match otp-auth-service
wrangler secret put ALLOWED_ORIGINS   # OPTIONAL: CORS origins (comma-separated)
```

2. Copy `.dev.vars.example` to `.dev.vars` and fill in `JWT_SECRET` (and optional `ALLOWED_ORIGINS`) for local dev.

### Development

```bash
pnpm dev
```

The dev server runs on `http://localhost:8789`. Use path prefix `/suite-api/` when calling from apps (e.g. `/suite-api/health`).

### Deployment

```bash
pnpm deploy
pnpm run deploy:prod   # production
```

### Custom domain (api.idling.app)

The worker is configured in `wrangler.toml` with a **dedicated API route**:

- **Production:** `pattern = "api.idling.app/*"` with `zone_name = "idling.app"`.

So the Cloud API is **not** tied to a dev workers.dev URL in production—it’s served at **https://api.idling.app** when you deploy with that route.

**DNS:** If **idling.app** is on Cloudflare (same account), deploying with the above route usually lets Cloudflare create the DNS record for `api.idling.app` (Custom Domains / Workers Routes). You typically don’t need to add a CNAME by hand. If idling.app is on another DNS provider, add the custom domain in the Worker (Cloudflare Dashboard → Workers → strixun-suite-api → Settings → Domains & Routes); Cloudflare will show the target (e.g. a CNAME) to add at your DNS host.

The main app (`config.js`) already prefers `https://api.idling.app` when the app runs on an idling.app host, so no extra config is needed there.

## API Endpoints

- **Cloud** – `/cloud/save`, `/cloud/load`, `/cloud/list`, `/cloud/delete` (and `/cloud-save/*` aliases)
- **Notes** – `/notes/save`, `/notes/load`, `/notes/list`, `/notes/delete`
- **OBS Credentials** – `/obs-credentials/save`, `/obs-credentials/load`, `/obs-credentials/delete`
- **CDN** – `/cdn/scrollbar.js`, `/cdn/scrollbar-customizer.js`, `/cdn/scrollbar-compensation.js`
- **Auth (legacy)** – `/auth/request-otp`, `/auth/verify-otp`, `/auth/me`, `/auth/logout`, `/auth/refresh`
- **Health** – `GET /health` or `GET /`

## Tech Stack

- **Cloudflare Workers** - Edge runtime
- **TypeScript** - Worker entry and utils
- **@strixun/api-framework** - Shared API framework and encryption
- **KV (SUITE_CACHE)** - Migrations / general cache binding

## License

Private - Part of Strixun Stream Suite
