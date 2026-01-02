# URL Shortener Setup Guide

**Last Updated:** 2025-12-29

## Quick Setup

Since you're already logged into Wrangler CLI, follow these steps:

### 1. Create KV Namespaces

```bash
cd serverless/url-shortener

# Create main URL storage namespace
wrangler kv namespace create "URL_SHORTENER_KV"

# Create analytics namespace
wrangler kv namespace create "URL_SHORTENER_ANALYTICS"
```

**Important:** Copy the namespace IDs from the output. You'll need them in step 2.

### 2. Update wrangler.toml

Open `serverless/url-shortener/wrangler.toml` and update the KV namespace IDs:

```toml
[[kv_namespaces]]
binding = "URL_KV"
id = "YOUR_URL_SHORTENER_KV_ID_HERE"  # Replace with actual ID
preview_id = "YOUR_URL_SHORTENER_KV_PREVIEW_ID_HERE"  # Replace with actual ID

[[kv_namespaces]]
binding = "ANALYTICS_KV"
id = "YOUR_ANALYTICS_KV_ID_HERE"  # Replace with actual ID
preview_id = "YOUR_ANALYTICS_KV_PREVIEW_ID_HERE"  # Replace with actual ID
```

### 3. Set JWT_SECRET

**IMPORTANT:** Use the SAME JWT_SECRET as your OTP auth service for compatibility.

```bash
# Set the JWT secret (use your actual secret)
echo "4kImx5pe5LdZ76BCgHIQMdFoNP0hkbxqBCi7YBlm4e0=" | wrangler secret put JWT_SECRET
```

Or interactively:
```bash
wrangler secret put JWT_SECRET
# When prompted, paste: 4kImx5pe5LdZ76BCgHIQMdFoNP0hkbxqBCi7YBlm4e0=
```

### 4. Install Dependencies (using pnpm)

```bash
pnpm install
```

### 5. Deploy

```bash
pnpm run deploy
```

Or:
```bash
wrangler deploy
```

### 6. Configure Custom Domain (Optional)

1. Go to Cloudflare Dashboard -> Workers & Pages -> strixun-url-shortener
2. Go to Settings -> Triggers -> Routes
3. Add custom domain route (e.g., `s.yourdomain.com/*` or `short.yourdomain.com/*`)
4. Update DNS records as instructed by Cloudflare

### 7. Update Frontend Configuration

In your Svelte app, you need to configure the URL shortener API URL. Add this to your config or window object:

```javascript
// In your config or HTML
window.getUrlShortenerApiUrl = function() {
  // Replace with your actual URL shortener worker URL
  return 'https://strixun-url-shortener.YOUR_SUBDOMAIN.workers.dev';
  // Or if using custom domain:
  // return 'https://s.yourdomain.com';
};
```

## Verification

After deployment, test the service:

```bash
# Health check
curl https://strixun-url-shortener.YOUR_SUBDOMAIN.workers.dev/health

# Should return:
# {"status":"ok","service":"url-shortener","timestamp":"..."}
```

## Troubleshooting

### "JWT_SECRET environment variable is required"
- Make sure you've set the secret: `wrangler secret put JWT_SECRET`
- Ensure it matches your OTP auth service's JWT_SECRET

### KV namespace errors
- Verify the namespace IDs in `wrangler.toml` are correct
- Make sure you created both namespaces

### CORS errors
- Set `ALLOWED_ORIGINS` secret if needed: `wrangler secret put ALLOWED_ORIGINS`
- Include your frontend domain in the comma-separated list

## Next Steps

1. The URL shortener is now integrated into your Svelte app
2. Users can access it from the navigation (tab X - "URL Shortener")
3. It requires authentication via your OTP auth system
4. Users can create, view, and delete short URLs
