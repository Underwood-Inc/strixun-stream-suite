# Route Setup for s.idling.app

## Quick Fix - Configure Route in Cloudflare Dashboard

The route in `wrangler.toml` might not have been applied. Do this:

### Step 1: Add Route in Cloudflare Dashboard

1. Go to **Cloudflare Dashboard** [EMOJI] **Workers & Pages**
2. Click on **strixun-url-shortener**
3. Go to **Settings** [EMOJI] **Triggers** [EMOJI] **Routes**
4. Click **Add Route**
5. Enter: `s.idling.app/*`
6. Click **Save**

### Step 2: Verify DNS Record

1. Go to **Cloudflare Dashboard** [EMOJI] **DNS** [EMOJI] **Records**
2. Look for a CNAME record for `s` pointing to `strixun-url-shortener.strixuns-script-suite.workers.dev`
3. If it doesn't exist, Cloudflare should create it automatically when you add the route
4. If it still doesn't exist after a few minutes, create it manually:
   - Type: `CNAME`
   - Name: `s`
   - Target: `strixun-url-shortener.strixuns-script-suite.workers.dev`
   - Proxy status: Proxied (orange cloud)

### Step 3: Wait for Propagation

- DNS changes: 1-5 minutes
- SSL certificate: 1-2 minutes (automatic)

### Step 4: Test

```bash
# Test the custom domain
curl https://s.idling.app/health

# Or visit in browser
https://s.idling.app/
```

## Alternative: Fix wrangler.toml Route

If you prefer to use `wrangler.toml` instead of the dashboard, the route syntax should be at the top level, not inside environment sections. The current config looks correct, but the warning suggests it might not be parsing correctly.

Try moving the routes outside of any environment block (it's already there, so this might not be the issue).

## Troubleshooting

### Route Not Working After Adding in Dashboard

1. **Check route is active**: Dashboard [EMOJI] Workers [EMOJI] strixun-url-shortener [EMOJI] Settings [EMOJI] Triggers [EMOJI] Routes
2. **Check DNS**: Dashboard [EMOJI] DNS [EMOJI] Records (should see `s` CNAME)
3. **Check SSL**: Dashboard [EMOJI] SSL/TLS [EMOJI] Overview (should show "Active Certificate")
4. **Test workers.dev URL**: `https://strixun-url-shortener.strixuns-script-suite.workers.dev/health` (should work)
5. **Check worker logs**: `wrangler tail` to see if requests are reaching the worker

### Still Not Working?

1. Clear browser cache
2. Try incognito/private mode
3. Check if other subdomains work (e.g., `auth.idling.app`)
4. Verify the worker is actually deployed: `wrangler deployments list`

