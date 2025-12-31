# Dashboard Setup Guide

## [OK] Completed

1. **OpenAPI 3.1.0 Specification** - Created at `openapi.json`
2. **Swagger UI Integration** - Added to landing page API Endpoints section
3. **Svelte + TypeScript Dashboard** - Complete component structure created
4. **Worker Routes** - OpenAPI spec route added, dashboard placeholder added

## [EMOJI] Remaining Steps

### Step 1: Build the Dashboard

```bash
cd serverless/otp-auth-service/dashboard
pnpm build
```

This will create the built dashboard in `dashboard/dist/`

### Step 2: Embed Dashboard in Worker

After building, you need to embed the dashboard files in the worker. Options:

**Option A: Embed as module (like landing page)**
1. Create `dashboard-html.js` from `dashboard/dist/index.html`
2. Import and serve in worker

**Option B: Use Cloudflare Pages/Workers Assets**
1. Deploy dashboard to Cloudflare Pages
2. Route `/dashboard` to Pages deployment

**Option C: Serve from CDN**
1. Upload `dashboard/dist/*` to a CDN
2. Update worker to proxy requests

### Step 3: Update Worker Routes

The worker currently has:
- [OK] `/openapi.json` - Serves OpenAPI spec
- [WARNING] `/dashboard` - Placeholder (needs built files)

Update `worker.js` to serve the built dashboard files after building.

## [EMOJI] What's Ready

- [OK] OpenAPI 3.1.0 spec with all endpoints documented
- [OK] Swagger UI integrated in landing page
- [OK] Complete Svelte + TypeScript dashboard structure
- [OK] All page components (Dashboard, API Keys, Audit Logs, Analytics)
- [OK] Type-safe API client
- [OK] Composable component architecture
- [OK] Follows Strixun design system

## [EMOJI] Notes

- The dashboard uses Svelte 5 with runes
- All components follow repo CSS rules (explicit selectors, no nested BEM)
- TypeScript types are complete for all API responses
- The dashboard is a SPA - all routes should serve `index.html`

