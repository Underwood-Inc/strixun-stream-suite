# OTP Auth Dashboard

**Last Updated:** 2025-12-29

Svelte 5 + TypeScript developer dashboard for managing your OTP Auth API.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start dev server (with hot reload)
pnpm dev

# Or run both worker + dashboard together (from parent directory)
cd ..
pnpm dev:all

# Build for production
pnpm build

# Type check
pnpm check
```

## Local Development

### Option 1: Run Both Together (Recommended)

From the `serverless/otp-auth-service` directory:

```bash
pnpm install  # Install concurrently if needed
pnpm dev:all
```

This runs both:
- **Worker** on `http://localhost:8787` (yellow output)
- **Dashboard** on `http://localhost:5174` (cyan output)

Open **http://localhost:5174** in your browser. The Vite proxy forwards API requests to the worker.

### Option 2: Run Separately

1. **Terminal 1 - Start the Worker:**
   ```bash
   cd serverless/otp-auth-service
   pnpm dev
   # Worker runs on http://localhost:8787
   ```

2. **Terminal 2 - Start the Dashboard:**
   ```bash
   cd serverless/otp-auth-service/dashboard
   pnpm dev
   # Dashboard runs on http://localhost:5174
   ```

### Option 3: Build & Serve via Worker

1. Build the dashboard:
   ```bash
   pnpm build
   ```

2. Embed `dist/` files in worker (see `DASHBOARD_SETUP.md`)

3. Access at `http://localhost:8787/dashboard`

## Features

- [SUCCESS] OTP-based authentication
- [SUCCESS] API key management (create, revoke, rotate)
- [SUCCESS] Audit log viewer with filtering
- [SUCCESS] Analytics dashboard
- [SUCCESS] Strixun design system
- [SUCCESS] Svelte 5 with runes
- [SUCCESS] Full TypeScript support

## Project Structure

```
src/
├── App.svelte              # Main app with routing
├── main.ts                 # Entry point
├── components/             # Reusable components
│   ├── Card.svelte
│   ├── Header.svelte
│   ├── Login.svelte
│   └── Navigation.svelte
├── pages/                  # Page components
│   ├── Dashboard.svelte
│   ├── ApiKeys.svelte
│   ├── AuditLogs.svelte
│   └── Analytics.svelte
└── lib/                    # Utilities
    ├── api-client.ts       # Type-safe API client
    └── types.ts           # TypeScript types
```

## API Client

The `apiClient` in `src/lib/api-client.ts` handles all API communication:

- Automatic token management (localStorage)
- Type-safe request/response handling
- Error handling with automatic logout on 401
- CORS support via Vite proxy in dev

## Configuration

### API Endpoint

The API client uses `window.location.origin` by default:
- **Dev**: Vite proxy forwards requests to worker
- **Production**: Same origin (dashboard served from worker)

To change the API endpoint, modify `API_BASE_URL` in `src/lib/api-client.ts`.

### OTP Encryption Key (CRITICAL)

**The dashboard REQUIRES `VITE_SERVICE_ENCRYPTION_KEY` to be set at build time.**

Without this key, the login form will not work - the "Send OTP Code" button will be disabled.

#### Setup Steps

1. **Get the encryption key from the OTP auth service:**
   ```bash
   cd serverless/otp-auth-service
   wrangler secret list
   # Look for SERVICE_ENCRYPTION_KEY
   ```

2. **Create a `.env` file in the dashboard directory:**
   ```bash
   cd serverless/otp-auth-service/dashboard
   echo "VITE_SERVICE_ENCRYPTION_KEY=your-key-here-must-be-32-chars-minimum" > .env
   ```

3. **Rebuild the dashboard:**
   ```bash
   pnpm build
   ```

**Important Notes:**
- The key must be at least 32 characters long
- The key must match the `SERVICE_ENCRYPTION_KEY` set in the Cloudflare Worker secrets
- Never commit `.env` files to version control
- Vite only exposes env vars starting with `VITE_` to the client

**For Production:**
- Set `VITE_SERVICE_ENCRYPTION_KEY` in your CI/CD environment variables
- The key will be bundled into the JavaScript at build time

See `serverless/url-shortener/ENCRYPTION_SETUP.md` for detailed encryption setup documentation.

## Building for Production

```bash
pnpm build
```

Outputs to `dist/` directory. Files need to be embedded in the worker or served statically.

## Tech Stack

- **Svelte 5** - Modern reactive framework
- **TypeScript** - Type safety
- **Vite** - Fast build tool & dev server
- **Sass** - CSS preprocessing (if needed)

## Development Notes

- Uses Svelte 5 runes (`$state`, `$derived`, etc.)
- Path aliases: `$lib` and `$components`
- Follows repo CSS rules (explicit selectors, no nested BEM)
- Composable component architecture
