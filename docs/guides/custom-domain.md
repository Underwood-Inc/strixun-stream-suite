# Custom Domain Setup Guide - idling.app

This guide covers setting up custom domains for all Cloudflare Workers using `idling.app`.

## [TARGET] Domain Configuration

All workers are configured to use the following subdomains:

| Service | Subdomain | Purpose | Type |
|---------|-----------|---------|------|
| Main API | `api.idling.app` | Twitch API proxy, OTP auth, OBS credentials | Worker |
| Auth Service | `auth.idling.app` | Standalone OTP auth service (optional) | Worker |
| URL Shortener | `s.idling.app` | URL shortening service | Worker |
| Chat Signaling | `chat.idling.app` | WebRTC signaling service | Worker |
| Mods API | `mods.idling.app` | Mod hosting and version control API | Worker |
| Mods Hub | `mods.idling.app` | Mod hosting frontend (React) | Pages |
| Storybook | `design.idling.app` | Component library documentation | Pages |

## [CLIPBOARD] Setup Steps

### 1. Deploy Workers with Custom Routes

The `wrangler.toml` files have been updated with custom domain routes. Deploy each worker:

```bash
# Main API Worker (Twitch API)
cd serverless/twitch-api
wrangler deploy

# OTP Auth Service (if using standalone)
cd serverless/otp-auth-service
wrangler deploy

# URL Shortener
cd serverless/url-shortener
wrangler deploy

# Chat Signaling
cd serverless/chat-signaling
wrangler deploy
```

### 2. Verify Routes in Cloudflare Dashboard

After deployment, verify routes are active:

1. Go to **Cloudflare Dashboard** [EMOJI] **Workers & Pages**
2. Select each worker
3. Go to **Settings** [EMOJI] **Triggers** [EMOJI] **Routes**
4. Verify the custom domain routes are listed:
   - `api.idling.app/*`
   - `auth.idling.app/*` (if using standalone auth service)
   - `s.idling.app/*`
   - `chat.idling.app/*`

### 3. DNS Configuration

Cloudflare automatically manages DNS records for custom domains. Verify in:

1. **Cloudflare Dashboard** [EMOJI] **DNS** [EMOJI] **Records**
2. Look for CNAME records:
   - `api` [EMOJI] `strixun-twitch-api.strixuns-script-suite.workers.dev`
   - `auth` [EMOJI] `otp-auth-service.strixuns-script-suite.workers.dev`
   - `s` [EMOJI] `strixun-url-shortener.strixuns-script-suite.workers.dev`
   - `chat` [EMOJI] `strixun-chat-signaling.strixuns-script-suite.workers.dev`

**Note:** DNS records are automatically created by Cloudflare when you deploy with routes configured.

### 4. Update CORS Settings (Optional)

If you want to restrict CORS to your domain only, set the `ALLOWED_ORIGINS` secret:

```bash
# For main API worker
cd serverless
wrangler secret put ALLOWED_ORIGINS
# Enter: https://idling.app,https://www.idling.app,http://localhost:5173

# For URL shortener
cd serverless/url-shortener
wrangler secret put ALLOWED_ORIGINS
# Enter: https://idling.app,https://www.idling.app,http://localhost:5173

# For chat signaling
cd serverless/chat-signaling
wrangler secret put ALLOWED_ORIGINS
# Enter: https://idling.app,https://www.idling.app,http://localhost:5173
```

### 5. Test Endpoints

Test each custom domain:

```bash
# Main API
curl https://api.idling.app/health

# Auth Service (if using standalone)
curl https://auth.idling.app/health

# URL Shortener
curl https://s.idling.app/health

# Chat Signaling
curl https://chat.idling.app/health

# Mods API
curl https://mods-api.idling.app/health

# Mods Hub (Frontend)
curl https://mods.idling.app

# Storybook (Frontend)
curl https://design.idling.app
```

## [CONFIG] Configuration Files Updated

The following files have been updated with custom domain configuration:

### Workers
- [SUCCESS] `serverless/twitch-api/wrangler.toml` - Main API worker (Twitch API proxy)
- [SUCCESS] `serverless/otp-auth-service/wrangler.toml` - Auth service
- [SUCCESS] `serverless/url-shortener/wrangler.toml` - URL shortener
- [SUCCESS] `serverless/chat-signaling/wrangler.toml` - Chat signaling
- [SUCCESS] `serverless/mods-api/wrangler.toml` - Mods API worker

### Pages (Frontend)
- [SUCCESS] `mods-hub/` - Mods Hub React frontend (deployed via GitHub Actions)
- [SUCCESS] `shared-components/` - Storybook component library

### Frontend Configuration
- [SUCCESS] `config.js` - Frontend configuration (hardcoded fallbacks)

## [NOTE] Frontend Configuration

The frontend `config.js` has been updated with custom domain fallbacks:

- Main API: `https://api.idling.app`
- URL Shortener: `https://s.idling.app`

The frontend will automatically use these URLs if no other configuration is provided.

## [DEPLOY] Production Deployment

For production, you can:

1. **Use Dashboard Routes (Recommended)**: Configure routes in Cloudflare Dashboard for easier management
2. **Use wrangler.toml Routes**: Routes are already configured in `wrangler.toml` files
3. **Environment Variables**: Set `WORKER_API_URL` and `URL_SHORTENER_API_URL` in your deployment pipeline

## [WARNING] Important Notes

- **DNS Propagation**: DNS changes may take a few minutes to propagate
- **SSL Certificates**: Cloudflare automatically provisions SSL certificates for custom domains
- **Route Precedence**: Routes configured in the dashboard take precedence over `wrangler.toml`
- **Workers.dev URLs**: The original `*.workers.dev` URLs will continue to work as fallbacks

## [SEARCH] Troubleshooting

### Routes Not Working

1. Check DNS records exist in Cloudflare Dashboard
2. Verify routes are active in Worker settings
3. Check worker deployment logs: `wrangler tail`
4. Test with `curl` to see actual error messages

### CORS Errors

1. Ensure `ALLOWED_ORIGINS` secret includes your frontend domain
2. Check that CORS headers are being returned: `curl -I https://api.idling.app/health`
3. Verify origin is being sent correctly in browser DevTools

### SSL Certificate Issues

1. Cloudflare automatically provisions SSL - wait a few minutes
2. Check SSL/TLS settings in Cloudflare Dashboard
3. Ensure domain is fully proxied (orange cloud) in DNS settings

## [DOCS] Additional Resources

- [Cloudflare Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Wrangler Routes Documentation](https://developers.cloudflare.com/workers/wrangler/configuration/#routes)

