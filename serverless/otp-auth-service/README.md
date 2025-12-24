# OTP Auth Service 🔐

Multi-tenant OTP authentication service built on Cloudflare Workers.

## Quick Start

### 🚀 Local Development (Recommended)

**1. Install dependencies:**
```bash
pnpm install
```

**2. Configure email service (required for OTP to work):**
```bash
# Copy the example env file
cp .dev.vars.example .dev.vars

# Edit .dev.vars and add your Resend API key and from email
# Get your API key from: https://resend.com/api-keys
```

**3. Start all services:**
```bash
pnpm dev:all
```

This starts all services concurrently:
- **Worker API**: http://localhost:8787 (proxies landing page and dashboard to Vite)
- **Landing Page & Dashboard**: http://localhost:5175 (Svelte app via Vite)

**Access points:**
- Landing page: http://localhost:8787/ (proxied through worker) or http://localhost:5175/ (direct Vite)
- Dashboard: http://localhost:8787/dashboard (proxied through worker) or http://localhost:5175/dashboard (direct Vite)
- API endpoints: http://localhost:8787/auth/*

**Note:** The dashboard is now part of the main app and runs on the same Vite server as the landing page.

**Or run services separately:**
```bash
# Terminal 1 - Worker (includes landing page and dashboard proxy)
pnpm dev

# Terminal 2 - Landing Page & Dashboard (standalone Svelte dev)
pnpm dev:app
```

**Important:** Make sure you have created `.dev.vars` with your `RESEND_API_KEY` and `RESEND_FROM_EMAIL` before starting the worker, otherwise OTP requests will fail with a 500 error.

### Production

```bash
# Deploy worker
pnpm deploy

# Build dashboard (then embed in worker)
cd dashboard
pnpm build
```

## Project Structure

```
otp-auth-service/
├── worker.js              # Main Cloudflare Worker
├── landing.html           # Landing page (embedded)
├── openapi.json           # OpenAPI 3.1.0 spec
├── services/              # Business logic
│   ├── api-key.js
│   ├── analytics.js
│   ├── customer.js
│   └── security.js
├── utils/                 # Utilities
│   ├── cors.js
│   ├── crypto.js
│   └── email.js
└── dashboard/             # Svelte 5 + TypeScript dashboard
    ├── src/
    │   ├── App.svelte
    │   ├── components/
    │   ├── pages/
    │   └── lib/
    └── vite.config.ts
```

## Scripts

- `pnpm dev` - Start worker dev server
- `pnpm dev:dashboard` - Start dashboard dev server
- `pnpm dev:all` - Start both worker and dashboard together
- `pnpm deploy` - Deploy worker to Cloudflare
- `pnpm tail` - Tail worker logs

## Features

- ✅ Passwordless OTP authentication
- ✅ JWT token management
- ✅ API key management (multi-tenant)
- ✅ Audit logging
- ✅ Analytics dashboard
- ✅ OpenAPI 3.1.0 spec
- ✅ Swagger UI integration
- ✅ Developer dashboard (Svelte 5 + TypeScript)

## Documentation

- [Dashboard README](./dashboard/README.md) - Dashboard development
- [API Standards](./API_STANDARDS.md) - API documentation
- [Local Testing](./LOCAL_TESTING.md) - Testing guide
