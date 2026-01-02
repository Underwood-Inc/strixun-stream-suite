# Local Development Guide

**Last Updated:** 2025-12-29

## Quick Start

### 1. Install Dependencies
```bash
cd serverless/otp-auth-service/dashboard
pnpm install
```

### 2. Start Development Server
```bash
pnpm dev
```

The dashboard will be available at **http://localhost:5174**

### 3. Configure API Endpoint (if needed)

The API client in `src/lib/api-client.ts` needs to point to your local worker or production API.

**For local testing with `wrangler dev`:**
- The worker runs on `http://localhost:8787` (or another port)
- Update the `API_BASE_URL` in `src/lib/api-client.ts` to match

**For production testing:**
- Default is `https://auth.idling.app`
- No changes needed

## Development Workflow

1. **Terminal 1 - Start the Worker:**
   ```bash
   cd serverless/otp-auth-service
   wrangler dev
   ```

2. **Terminal 2 - Start the Dashboard:**
   ```bash
   cd serverless/otp-auth-service/dashboard
   pnpm dev
   ```

3. **Open Browser:**
   - Dashboard: http://localhost:5174
   - Worker API: http://localhost:8787

## Building for Production

```bash
cd serverless/otp-auth-service/dashboard
pnpm build
```

This creates `dist/` with the built files that need to be embedded in the worker.

## Project Structure

```
dashboard/
├── src/
│   ├── App.svelte          # Main app component
│   ├── main.ts             # Entry point
│   ├── components/         # Reusable components
│   │   ├── Card.svelte
│   │   ├── Header.svelte
│   │   ├── Login.svelte
│   │   └── Navigation.svelte
│   ├── pages/              # Page components
│   │   ├── Dashboard.svelte
│   │   ├── ApiKeys.svelte
│   │   ├── AuditLogs.svelte
│   │   └── Analytics.svelte
│   └── lib/                 # Utilities
│       ├── api-client.ts    # API client
│       └── types.ts         # TypeScript types
├── index.html
├── vite.config.ts
└── package.json
```

## Features

- ✓ Svelte 5 with runes
- ✓ TypeScript
- ✓ Vite for fast HMR
- ✓ Path aliases (`$lib`, `$components`)
- ✓ Composable component architecture
- ✓ Follows Strixun design system

## Troubleshooting

**Port already in use?**
- Change port in `vite.config.ts` -> `server.port`

**API calls failing?**
- Check `API_BASE_URL` in `api-client.ts`
- Make sure worker is running
- Check browser console for CORS errors

**Type errors?**
- Run `pnpm check` to verify TypeScript
- Make sure all dependencies are installed
