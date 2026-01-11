# Testing Production Build Locally ★ ## Quick Start

To test the production build locally (simulating what GitHub Actions does):

```bash
cd serverless/otp-auth-service
pnpm preview
```

This will:
1. ✓ Build the dashboard with Vite (`pnpm build`)
2. ✓ Generate `landing-page-assets.js` with embedded files (includes dashboard and landing page)
3. ✓ Start wrangler dev in production mode
4. ✓ Serve the built dashboard from the worker (not Vite dev server)

## Watch Mode (Recommended for Development)

For automatic rebuilds when you make changes:

```bash
cd serverless/otp-auth-service
pnpm preview:watch
```

This will:
1. ✓ Build the dashboard initially
2. ✓ Start wrangler dev in production mode
3. ✓ **Watch for changes** in:
   - Dashboard source files (`dashboard/src/**/*`)
   - Dashboard config files (`vite.config.ts`, `tsconfig.json`)
   - Landing page (`landing.html`)
   - Worker (`worker.js`)
4. ✓ **Automatically rebuild** dashboard when source files change
5. ✓ Wrangler automatically reloads when `worker.js` or `landing.html` changes

**No more manual rebuilds!** Just edit your files and see changes automatically.

## What This Tests

- ✓ Production build process (Vite → dist/ → landing-page-assets.js)
- ✓ Worker serving embedded dashboard files
- ✓ SPA routing (all `/dashboard/*` routes serve index.html)
- ✓ Asset serving (JS, CSS, images, fonts)
- ✓ Landing page + Dashboard integration

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
- Worker serves embedded files from `landing-page-assets.js`
- No hot reload (static files)

## Troubleshooting

**Dashboard not loading?**
- Make sure `pnpm build` completed successfully
- Check that `landing-page-assets.js` exists
- Verify worker logs for errors

**Assets 404?**
- Check that Vite build output includes all assets
- Verify file paths in `landing-page-assets.js`
- Check browser console for failed requests

**Build fails?**
- Make sure dashboard dependencies are installed: `cd dashboard && pnpm install`
- Check for TypeScript errors: `cd dashboard && pnpm check`
- Verify Vite config is correct

