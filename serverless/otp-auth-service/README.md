# OTP Auth Service 🔐

Multi-tenant OTP authentication service built on Cloudflare Workers.

## Quick Start

### Development

**Run both worker and dashboard together:**
```bash
pnpm install
pnpm dev:all
```

This starts:
- **Worker API**: http://localhost:8787
- **Dashboard**: http://localhost:5174

**Or run separately:**
```bash
# Terminal 1 - Worker
pnpm dev

# Terminal 2 - Dashboard
pnpm dev:dashboard
```

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
