# URL Shortener Troubleshooting Guide

> **Common issues and solutions for URL Shortener**

**Date:** 2025-12-29

---

## Common Issues

### Issue: "JWT_SECRET environment variable is required"

**Symptoms:** Worker fails to start or authentication fails

**Solutions:**
1. Set the JWT_SECRET secret:
   ```bash
   cd serverless/url-shortener
   wrangler secret put JWT_SECRET
   ```
2. Ensure it matches your OTP auth service's JWT_SECRET exactly
3. Redeploy the worker after setting the secret

---

### Issue: KV Namespace Not Found

**Symptoms:** Worker errors about missing KV namespace

**Solutions:**
1. Verify the namespace IDs in `wrangler.toml` are correct
2. Check namespace exists: `wrangler kv namespace list`
3. If missing, create it:
   ```bash
   wrangler kv namespace create "URL_SHORTENER_KV"
   wrangler kv namespace create "URL_SHORTENER_ANALYTICS"
   ```
4. Update `wrangler.toml` with the correct namespace IDs

---

### Issue: CORS Errors

**Symptoms:** Browser console shows CORS errors when making API requests

**Solutions:**
1. Set `ALLOWED_ORIGINS` secret:
   ```bash
   wrangler secret put ALLOWED_ORIGINS
   # Enter: https://s.idling.app,https://idling.app,https://www.idling.app
   ```
2. Include your frontend domain in the comma-separated list
3. Ensure no trailing slashes in origins
4. Redeploy after setting the secret

---

### Issue: Custom Domain Not Working

**Symptoms:** `s.idling.app` doesn't resolve or returns errors

**Solutions:**
1. Check DNS records in Cloudflare Dashboard
2. Verify route is configured: Dashboard → Workers → strixun-url-shortener → Routes
3. Wait a few minutes for DNS propagation
4. Check SSL certificate is active: Dashboard → SSL/TLS → Overview
5. Test workers.dev URL first: `https://strixun-url-shortener.YOUR_SUBDOMAIN.workers.dev/health`

---

### Issue: Authentication Fails

**Symptoms:** OTP login doesn't work, returns 401 errors

**Solutions:**
1. Verify `JWT_SECRET` matches between URL shortener and OTP auth service
2. Check that `auth.idling.app` is configured and working
3. Verify JWT token is valid and not expired
4. Check browser console for detailed error messages
5. Check worker logs: `wrangler tail`

---

### Issue: Encryption Key Not Found

**Symptoms:** "OTP encryption key is required" error in browser console

**Solutions:**
1. Check `.env` file exists in `serverless/url-shortener/app/`
2. Verify key starts with `VITE_` prefix: `VITE_SERVICE_ENCRYPTION_KEY`
3. Rebuild the app: `pnpm build:app`
4. Check browser console for errors
5. Verify key is at least 32 characters

---

### Issue: Short URL Redirect Not Working

**Symptoms:** Clicking short URL doesn't redirect

**Solutions:**
1. Check that the short code exists in KV
2. Verify the URL hasn't expired
3. Check worker logs: `wrangler tail`
4. Test the redirect endpoint directly:
   ```bash
   curl -I https://s.idling.app/YOUR_SHORT_CODE
   ```

---

### Issue: App Not Loading

**Symptoms:** Blank page or JavaScript errors

**Solutions:**
1. Check browser console for errors
2. Verify the app was built: `pnpm build:app`
3. Check worker logs: `wrangler tail`
4. Verify route is configured correctly
5. Clear browser cache and try again

---

## Debugging Commands

### Check Worker Status

```bash
cd serverless/url-shortener
wrangler tail
```

### Check Secrets

```bash
wrangler secret list
```

### Check KV Namespaces

```bash
wrangler kv namespace list
```

### Test Health Endpoint

```bash
curl https://s.idling.app/health
# Or
curl https://strixun-url-shortener.YOUR_SUBDOMAIN.workers.dev/health
```

### Test API Endpoint

```bash
curl -X POST https://s.idling.app/api/create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

---

## Getting Help

If you're still experiencing issues:

1. Check worker logs: `wrangler tail`
2. Check browser console for client-side errors
3. Verify all secrets are set correctly
4. Verify DNS and routes are configured
5. Review [URL Shortener README](../07_SERVICES/URL_SHORTENER_README.md) for complete documentation

---

**Last Updated**: 2025-12-29

