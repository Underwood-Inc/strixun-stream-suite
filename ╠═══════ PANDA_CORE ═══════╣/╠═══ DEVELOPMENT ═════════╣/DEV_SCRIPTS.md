# Development Scripts Reference 🚀

**Ahoy, ye developer!** This here be yer complete guide to runnin' all the frontend applications in development mode. Each app has its own dev server with hot reload and proper port configuration.

## Frontend Applications

### 1. **Stream Suite (Root App)** - Svelte
**Location:** Root directory  
**Port:** `5173`  
**Framework:** Svelte + TypeScript

```bash
# From root directory
pnpm dev
```

**URL:** http://localhost:5173

**Notes:**
- Main OBS Studio toolkit application
- Outputs to `dist/stream-suite/` when built
- Uses Vite dev server with HMR

---

### 2. **Mods Hub** - React
**Location:** `mods-hub/`  
**Port:** `3001`  
**Framework:** React + TypeScript

```bash
# From root directory
pnpm --filter @strixun/mods-hub dev

# Or from mods-hub directory
cd mods-hub
pnpm dev
```

**URL:** http://localhost:3001

**Additional Commands:**
```bash
# Dev with all backend services (mods-api, auth, customer-api)
pnpm --filter @strixun/mods-hub dev:all

# Dev with just mods-api
pnpm --filter @strixun/mods-hub dev:api

# Dev with just auth service
pnpm --filter @strixun/mods-hub dev:auth

# Dev with just customer-api
pnpm --filter @strixun/mods-hub dev:customer
```

**Notes:**
- Requires OTP login package to be built first (`predev` handles this)
- Proxies API requests to:
  - `/auth/*` → `http://localhost:8787` (OTP Auth Service)
  - `/api/*` → `http://localhost:8788` (Mods API)

---

### 3. **Control Panel** - React (Single File)
**Location:** `control-panel/`  
**Port:** `5175`  
**Framework:** React + TypeScript

```bash
# From root directory
pnpm --filter @strixun/control-panel dev

# Or from control-panel directory
cd control-panel
pnpm dev
```

**URL:** http://localhost:5175

**Notes:**
- Single-file React app (bundled into one HTML file)
- Uses `vite-plugin-singlefile` for OBS dock compatibility

---

### 4. **OTP Auth Service Dashboard** - Svelte
**Location:** `serverless/otp-auth-service/dashboard/`  
**Port:** `5174`  
**Framework:** Svelte + TypeScript

```bash
# From root directory
pnpm --filter otp-auth-dashboard dev

# Or from dashboard directory
cd serverless/otp-auth-service/dashboard
pnpm dev
```

**URL:** http://localhost:5174

**Additional Commands:**
```bash
# Dev with worker and dashboard together
cd serverless/otp-auth-service
pnpm dev:all

# Just the dashboard
pnpm dev:app
```

**Notes:**
- Proxies API requests to:
  - `/auth/*` → `http://localhost:8787` (OTP Auth Worker)
  - `/admin/*` → `http://localhost:8787` (OTP Auth Worker)
- Worker runs on port `8787` (separate command)

---

### 5. **URL Shortener App** - React
**Location:** `serverless/url-shortener/app/`  
**Port:** `5176`  
**Framework:** React + TypeScript

```bash
# From root directory
pnpm --filter @strixun/url-shortener-app dev

# Or from app directory
cd serverless/url-shortener/app
pnpm dev
```

**URL:** http://localhost:5176

**Additional Commands:**
```bash
# Dev with worker, watch, and browser-sync
cd serverless/url-shortener
pnpm dev:all

# Just the worker
pnpm dev

# Watch mode for app rebuilds
pnpm dev:watch

# Browser sync (auto-refresh)
pnpm dev:sync
```

**Notes:**
- Worker runs on port `8793` (separate command)
- Requires OTP login to be built first

---

## Backend Services (Workers)

These are Cloudflare Workers that run alongside the frontends:

| Service | Port | Command |
|---------|------|---------|
| **OTP Auth Service** | 8787 | `cd serverless/otp-auth-service && pnpm dev` |
| **Mods API** | 8788 | `cd serverless/mods-api && pnpm dev` |
| **Twitch API** | 8789 | `cd serverless/twitch-api && pnpm dev` |
| **Customer API** | 8790 | `cd serverless/customer-api && pnpm dev` |
| **Game API** | 8791 | `cd serverless/game-api && pnpm dev` |
| **Chat Signaling** | 8792 | `cd serverless/chat-signaling && pnpm dev` |
| **URL Shortener** | 8793 | `cd serverless/url-shortener && pnpm dev` |

---

## Turborepo Dev Commands

Run all dev servers at once using Turborepo - all ports are configured to be unique, so everything works together:

```bash
# Run all dev servers (all packages that have a 'dev' script)
pnpm dev:turbo

# Or using turbo directly with concurrency setting
pnpm turbo run dev --concurrency=15

# Show a clean summary of all running services and ports
pnpm dev:ports
```

**Note:** This will start all frontend apps and backend workers simultaneously. All ports are pre-configured to avoid conflicts, so you can run everything together for full-stack local development. The `--concurrency=15` flag ensures all 14+ services can run in parallel.

**Tip:** After starting all services, run `pnpm dev:ports` in another terminal to see a clean summary of all running services, their ports, and frontend URLs.

---

## Port Summary

| Application | Port | Type |
|-------------|------|------|
| Stream Suite (Root) | 5173 | Frontend (Vite) |
| Mods Hub | 3001 | Frontend (Vite) |
| Control Panel | 5175 | Frontend (Vite) |
| OTP Auth Dashboard | 5174 | Frontend (Vite) |
| URL Shortener App | 5176 | Frontend (Vite) |
| OTP Auth Worker | 8787 | Backend (Wrangler) |
| Mods API Worker | 8788 | Backend (Wrangler) |
| Twitch API Worker | 8789 | Backend (Wrangler) |
| Customer API Worker | 8790 | Backend (Wrangler) |
| Game API Worker | 8791 | Backend (Wrangler) |
| Chat Signaling Worker | 8792 | Backend (Wrangler) |
| URL Shortener Worker | 8793 | Backend (Wrangler) |

**All ports are uniquely configured** - you can run everything together with `pnpm dev:turbo` without conflicts!

---

## Common Development Workflows

### Full Stack Development (Mods Hub)

```bash
# Terminal 1: Start OTP Auth Service
cd serverless/otp-auth-service
pnpm dev

# Terminal 2: Start Mods API
cd serverless/mods-api
pnpm dev

# Terminal 3: Start Mods Hub
cd mods-hub
pnpm dev
```

### OTP Auth Service with Dashboard

```bash
# Terminal 1: Start Worker
cd serverless/otp-auth-service
pnpm dev

# Terminal 2: Start Dashboard
cd serverless/otp-auth-service/dashboard
pnpm dev
```

### URL Shortener Full Stack

```bash
# Terminal 1: Start Worker + Watch + Sync
cd serverless/url-shortener
pnpm dev:all
```

---

## Troubleshooting

### Port Already in Use

If a port is already in use, Vite will automatically try the next available port. For Wrangler workers, you'll need to either:
1. Stop the process using that port
2. Change the port in the package.json script

### Build Dependencies

Some apps require packages to be built first:
- **Mods Hub**: Requires `@strixun/otp-login` (handled by `predev`)
- **URL Shortener**: Requires OTP login (handled by `predev`)

### Import Path Issues

All imports use relative paths or workspace aliases. If you see import errors:
1. Ensure the package is built: `pnpm build:packages`
2. Check that workspace dependencies are properly linked: `pnpm install`

---

## Quick Reference Card

```bash
# Root Stream Suite
pnpm dev                                    # Port 5173

# Mods Hub
pnpm --filter @strixun/mods-hub dev         # Port 3001

# Control Panel
pnpm --filter @strixun/control-panel dev    # Port 5175

# OTP Auth Dashboard
pnpm --filter otp-auth-dashboard dev        # Port 5174

# URL Shortener App
pnpm --filter @strixun/url-shortener-app dev # Port 5176

# All dev servers (Turborepo)
pnpm dev:turbo
```

**Happy coding, ye scallywag!** ⚓️
