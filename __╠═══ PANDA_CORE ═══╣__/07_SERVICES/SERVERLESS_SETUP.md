# Strixun Twitch API Proxy - Setup Guide

> **Complete setup guide for Twitch API proxy Cloudflare Worker**

**Date:** 2025-12-29

---

## Prerequisites

1. **Cloudflare Account** (free tier works fine)
   - Sign up at https://cloudflare.com

2. **Twitch Developer Application**
   - Go to https://dev.twitch.tv/console/apps
   - Click "Register Your Application"
   - Name: `Strixun Stream Suite` (or your preferred name)
   - OAuth Redirect URLs: `http://localhost` (for testing)
   - Category: `Broadcasting Software`
   - Save your **Client ID** and generate a **Client Secret**

3. **Wrangler CLI** (Cloudflare's CLI tool)
   ```bash
   npm install -g wrangler
   ```

---

## Local Setup

1. **Login to Cloudflare:**
   ```bash
   wrangler login
   ```

2. **Create KV Namespace for caching:**
   ```bash
   cd serverless
   wrangler kv namespace create "TWITCH_CACHE"
   ```
   
   > **Note:** Older wrangler versions used `kv:namespace` (with colon), newer versions use `kv namespace` (with space).
   
   Copy the returned `id` value and update `wrangler.toml`:
   ```toml
   [[kv_namespaces]]
   binding = "TWITCH_CACHE"
   id = "YOUR_RETURNED_ID_HERE"
   ```

3. **Set secrets (Twitch credentials):**
   ```bash
   wrangler secret put TWITCH_CLIENT_ID
   # Enter your Twitch Client ID when prompted
   
   wrangler secret put TWITCH_CLIENT_SECRET
   # Enter your Twitch Client Secret when prompted
   ```

4. **Deploy:**
   ```bash
   wrangler deploy
   ```

5. **Note your Worker URL:**
   After deployment, you'll see something like:
   ```
   Published strixun-twitch-api (1.23 sec)
     https://strixun-twitch-api.YOUR_SUBDOMAIN.workers.dev
   ```
   
   This is your **API Server URL** to use in the clips player configuration.

---

## GitHub Secrets Setup (for CI/CD)

If using GitHub Actions for automated deployment, add these secrets to your repository:

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `CF_API_TOKEN` | Cloudflare API token | Cloudflare Dashboard ★ API Tokens ★ Create Token ★ "Edit Workers" template |
| `CF_ACCOUNT_ID` | Your Cloudflare account ID | Cloudflare Dashboard ★ Workers ★ Overview (right sidebar) |
| `TWITCH_CLIENT_ID` | Twitch app client ID | dev.twitch.tv/console/apps ★ Your App ★ Client ID |
| `TWITCH_CLIENT_SECRET` | Twitch app client secret | dev.twitch.tv/console/apps ★ Your App ★ New Secret |

---

## API Endpoints

Once deployed, these endpoints are available:

| Endpoint | Description | Parameters |
|----------|-------------|------------|
| `GET /clips` | Fetch clips for a channel | `channel`, `limit`, `shuffle`, `start_date`, `end_date`, `prefer_featured` |
| `GET /following` | Get followed channels | `channel`, `limit`, `ref` (base64 user token), `after` (pagination) |
| `GET /game` | Get game info by ID | `id` |
| `GET /user` | Get user info | `login` |
| `GET /health` | Health check | none |

---

## Testing

```bash
# Test health endpoint
curl https://strixun-twitch-api.YOUR_SUBDOMAIN.workers.dev/health

# Test clips endpoint
curl "https://strixun-twitch-api.YOUR_SUBDOMAIN.workers.dev/clips?channel=shroud&limit=5"
```

---

## Troubleshooting

**"Failed to get app access token"**
- Verify your Twitch Client ID and Secret are correct
- Regenerate the secret on Twitch if needed
- Re-run `wrangler secret put` commands

**"User not found"**
- Channel name must be the login name, not display name
- Check capitalization (should be lowercase)

**CORS errors**
- The worker includes CORS headers for all origins
- If issues persist, check browser developer tools for specific error

---

## Costs

Cloudflare Workers free tier includes:
- 100,000 requests per day
- 10ms CPU time per request
- 1GB KV storage

This is more than sufficient for personal streaming use.

---

## See Also

- [Serverless README](./SERVERLESS_README.md) - Complete API documentation
- [Cloud Storage Guide](../10_GUIDES_AND_TUTORIALS/CLOUD_STORAGE_GUIDE.md) - Cloud storage integration

---

**Last Updated**: 2025-12-29

