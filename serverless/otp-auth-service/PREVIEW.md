# Testing Production Build Locally [EMOJI]

## Quick Start

To test the production build locally (simulating what GitHub Actions does):

```bash
cd serverless/otp-auth-service
pnpm preview
```

This will:
1. [OK] Build the dashboard with Vite (`pnpm build` in dashboard/)
2. [OK] Generate `dashboard-assets.js` with embedded files
3. [OK] Start wrangler dev in production mode
4. [OK] Serve the built dashboard from the worker (not Vite dev server)

## Watch Mode (Recommended for Development)

For automatic rebuilds when you make changes:

```bash
cd serverless/otp-auth-service
pnpm preview:watch
```

This will:
1. [OK] Build the dashboard initially
2. [OK] Start wrangler dev in production mode
3. [OK] **Watch for changes** in:
   - Dashboard source files (`dashboard/src/**/*`)
   - Dashboard config files (`vite.config.ts`, `tsconfig.json`)
   - Landing page (`landing.html`)
   - Worker (`worker.js`)
4. [OK] **Automatically rebuild** dashboard when source files change
5. [OK] Wrangler automatically reloads when `worker.js` or `landing.html` changes

**No more manual rebuilds!** Just edit your files and see changes automatically.

## What This Tests

- [OK] Production build process (Vite  dist/  dashboard-assets.js)
- [OK] Worker serving embedded dashboard files
- [OK] SPA routing (all `/dashboard/*` routes serve index.html)
- [OK] Asset serving (JS, CSS, images, fonts)
- [OK] Landing page + Dashboard integration

## Commands

- `pnpm preview` - Build and preview production build (uses remote KV)
- `pnpm preview:local` - Build and preview with local KV (faster, no network)

## Development vs Production

**Development (`pnpm dev:all`):**
- Landing page: Worker (localhost:8787)
- Dashboard: Vite dev server (localhost:5174) with hot reload
- Worker proxies `/dashboard` to Vite

**Production Preview (`pnpm preview`):**
- Landing page: Worker (localhost:8787)
- Dashboard: Built files embedded in worker
- Worker serves embedded files from `dashboard-assets.js`
- No hot reload (static files)

## Troubleshooting

**Dashboard not loading?**
- Make sure `pnpm build` completed successfully
- Check that `dashboard-assets.js` exists
- Verify worker logs for errors

**Assets 404?**
- Check that Vite build output includes all assets
- Verify file paths in `dashboard-assets.js`
- Check browser console for failed requests

**Build fails?**
- Make sure dashboard dependencies are installed: `cd dashboard && pnpm install`
- Check for TypeScript errors: `cd dashboard && pnpm check`
- Verify Vite config is correct

