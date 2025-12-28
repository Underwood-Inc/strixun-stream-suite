# Troubleshooting s.idling.app Not Working

## Step 1: Test workers.dev URL First

Before troubleshooting the custom domain, verify the worker itself works:

```bash
# Test the workers.dev URL (should work)
curl https://strixun-url-shortener.strixuns-script-suite.workers.dev/health
```

**Expected response:**
```json
{"status":"ok","service":"url-shortener","timestamp":"..."}
```

If this doesn't work, the worker itself has an issue.

## Step 2: Verify Route in Cloudflare Dashboard

1. Go to **Cloudflare Dashboard** [EMOJI] **Workers & Pages**
2. Click **strixun-url-shortener**
3. Go to **Settings** [EMOJI] **Triggers** [EMOJI] **Routes**
4. Verify you see: `s.idling.app/*`
5. Check that it shows as **Active** (not pending or error)

## Step 3: Verify DNS Record

1. Go to **Cloudflare Dashboard** [EMOJI] **DNS** [EMOJI] **Records**
2. Look for a CNAME record:
   - **Type**: CNAME
   - **Name**: `s`
   - **Target**: `strixun-url-shortener.strixuns-script-suite.workers.dev`
   - **Proxy status**: Proxied (orange cloud) [SUCCESS]

If the DNS record doesn't exist:
1. Click **Add record**
2. Type: `CNAME`
3. Name: `s`
4. Target: `strixun-url-shortener.strixuns-script-suite.workers.dev`
5. Proxy status: **Proxied** (orange cloud)
6. Click **Save**

## Step 4: Check SSL Certificate

1. Go to **Cloudflare Dashboard** [EMOJI] **SSL/TLS** [EMOJI] **Overview**
2. Verify SSL/TLS encryption mode is set to **Full** or **Full (strict)**
3. Wait 1-2 minutes for SSL certificate to provision (automatic)

## Step 5: Test DNS Resolution

```bash
# Check if DNS resolves
nslookup s.idling.app

# Should return Cloudflare IPs (not the workers.dev domain)
```

## Step 6: Check Worker Logs

```bash
cd serverless/url-shortener
wrangler tail
```

Then try accessing `https://s.idling.app/health` in another terminal/browser.

**Look for:**
- Any error messages
- Whether requests are reaching the worker
- Response status codes

## Step 7: Common Issues

### Issue: "Connection timeout" or "DNS_PROBE_FINISHED_NXDOMAIN"
- **Cause**: DNS record not created or not proxied
- **Fix**: Create CNAME record with proxy enabled (orange cloud)

### Issue: "502 Bad Gateway" or "Worker not responding"
- **Cause**: Route not active or worker error
- **Fix**: Check route is active in dashboard, check worker logs

### Issue: "SSL Certificate Error"
- **Cause**: SSL not provisioned yet
- **Fix**: Wait 1-2 minutes, check SSL/TLS settings

### Issue: Works on workers.dev but not custom domain
- **Cause**: Route or DNS misconfiguration
- **Fix**: Verify route pattern matches exactly: `s.idling.app/*` (with the `/*`)

## Step 8: Verify Route Pattern

The route pattern must be **exactly**: `s.idling.app/*`

Common mistakes:
- [ERROR] `s.idling.app` (missing `/*`)
- [ERROR] `s.idling.app/` (missing `*`)
- [SUCCESS] `s.idling.app/*` (correct)

## Step 9: Force Route Update

If route exists but not working:

1. **Remove the route** in dashboard
2. Wait 30 seconds
3. **Add it back**: `s.idling.app/*`
4. Wait 1-2 minutes
5. Test again

## Step 10: Check Browser Console

Open browser DevTools (F12) [EMOJI] Console tab, then visit `https://s.idling.app/health`

Look for:
- Network errors
- CORS errors
- SSL errors
- Any JavaScript errors

## Still Not Working?

1. **Clear browser cache** and try again
2. **Try incognito/private mode**
3. **Test from different network** (mobile data, different WiFi)
4. **Check if other subdomains work** (e.g., `auth.idling.app`)
5. **Verify worker deployment**: `wrangler deployments list`

