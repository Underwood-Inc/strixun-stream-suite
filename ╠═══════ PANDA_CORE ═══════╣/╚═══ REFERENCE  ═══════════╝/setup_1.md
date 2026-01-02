# Mods API Setup Guide

## Prerequisites

1. **Enable R2 in Cloudflare Dashboard**
   - Go to https://dash.cloudflare.com/
   - Navigate to **R2** in the sidebar
   - If you see a prompt to enable R2, click **Enable R2**
   - You may need to add a payment method (R2 has a free tier with generous limits)

2. **Install Wrangler CLI** (if not already installed)
   ```bash
   npm install -g wrangler
   # or
   pnpm add -g wrangler
   ```

3. **Login to Wrangler**
   ```bash
   wrangler login
   ```

## Setup Steps

### 1. Create KV Namespace

```bash
cd serverless/mods-api
wrangler kv namespace create "MODS_KV"
```

**Important:** Copy the `id` from the output. You'll need it for step 3.

Example output:
```
  Creating namespace with title "MODS_KV"
[FEATURE]  Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "MODS_KV", id = "abc123def456..." }
```

### 2. Create R2 Bucket

**First, ensure R2 is enabled** (see Prerequisites above), then:

```bash
wrangler r2 bucket create "mods-storage"
```

### 3. Update wrangler.toml

Open `serverless/mods-api/wrangler.toml` and update the KV namespace ID:

```toml
[[kv_namespaces]]
binding = "MODS_KV"
id = "YOUR_KV_NAMESPACE_ID_HERE"  # Paste the ID from step 1
```

### 4. Set Secrets

```bash
# Required: JWT secret (must match your OTP auth service)
wrangler secret put JWT_SECRET

# Optional: CORS origins (comma-separated)
wrangler secret put ALLOWED_ORIGINS
# Example: https://mods.idling.app,https://app.idling.app

# Optional: Custom R2 public URL (if using custom domain)
wrangler secret put MODS_PUBLIC_URL
# Example: https://cdn.idling.app
```

### 5. Deploy

```bash
pnpm deploy
# or
wrangler deploy
```

### 6. Configure Custom Domain (Optional)

1. Go to Cloudflare Dashboard  Workers & Pages  strixun-mods-api
2. Go to Settings  Triggers  Routes
3. Add custom domain route: `mods.idling.app/*`
4. DNS records are automatically managed by Cloudflare

## Verification

Test the API:

```bash
# Health check
curl https://mods-api.idling.app/health

# Should return:
# {"status":"ok","message":"Mods API is running",...}
```

## Troubleshooting

### R2 Not Enabled Error

If you get `Please enable R2 through the Cloudflare Dashboard`:

1. Go to https://dash.cloudflare.com/
2. Click **R2** in the sidebar
3. Click **Enable R2** or **Get Started**
4. You may need to add a payment method (free tier available)
5. Wait a few minutes for R2 to be fully enabled
6. Try creating the bucket again

### KV Namespace Not Found

- Make sure you created the namespace in the correct account
- Verify the namespace ID in `wrangler.toml` matches the one from `wrangler kv namespace list`

### JWT Secret Mismatch

- The `JWT_SECRET` must match the one used in your OTP auth service
- Check your OTP auth service's `wrangler.toml` or secrets to ensure they match

## Development

For local development:

```bash
pnpm dev
```

This will start a local development server with hot reloading.

## Production Deployment

```bash
pnpm deploy:prod
# or
wrangler deploy --env production
```

Make sure to set all secrets for production as well:

```bash
wrangler secret put JWT_SECRET --env production
wrangler secret put ALLOWED_ORIGINS --env production
```

