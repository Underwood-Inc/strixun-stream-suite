# URL Shortener Deployment Guide

**Last Updated:** 2025-12-29

## Quick Deploy

Since you already have `s.idling.app` configured and the worker set up, you just need to deploy:

```bash
cd serverless/url-shortener
wrangler deploy
```

That's it! ✓

## What This Does

1. **Deploys the worker** with the Svelte app
2. **Serves the UI** at `https://s.idling.app/` (root path)
3. **Keeps the API** working at `https://s.idling.app/api/*`
4. **Keeps redirects** working at `https://s.idling.app/:shortCode`
5. **Health check** still available at `https://s.idling.app/health`

## After Deployment

Users can now:
- Visit `https://s.idling.app/` to access the full URL shortener interface
- Authenticate with OTP (no main app required)
- Create, view, and manage short URLs
- All functionality works standalone!

## Verification

After deploying, test it:

```bash
# Check health
curl https://s.idling.app/health

# Visit in browser
open https://s.idling.app
```

## Notes

- The Svelte app is built and bundled into the worker assets
- No additional configuration needed - your existing `s.idling.app` route handles everything
- The HTML uses your existing API URLs (`auth.idling.app` and `s.idling.app`)
- Token persistence works via localStorage

## Troubleshooting

If the page doesn't load:
1. Check that the worker deployed successfully: `wrangler tail`
2. Verify the route is configured: Cloudflare Dashboard -> Workers -> strixun-url-shortener -> Routes
3. Check browser console for any JavaScript errors

