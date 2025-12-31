# Cloudflare Pages Setup for Mods Hub

This guide covers setting up Cloudflare Pages to serve the Mods Hub React frontend at your custom subdomain.

## [EMOJI] Prerequisites

1. **Cloudflare Account** with `idling.app` domain added
2. **GitHub Secrets** configured:
   - `CF_API_TOKEN` - Cloudflare API token with Pages write permissions
   - `CF_ACCOUNT_ID` - Your Cloudflare Account ID
   - `VITE_MODS_API_URL` (optional) - Defaults to `https://mods-api.idling.app`
   - `VITE_AUTH_API_URL` (optional) - Defaults to `https://auth.idling.app`

## [EMOJI] Setup Steps

### Step 1: Create Cloudflare API Token

1. Go to **Cloudflare Dashboard** → **My Profile** → **API Tokens**
2. Click **Create Token**
3. Use **Edit Cloudflare Workers** template OR create custom token with:
   - **Permissions:**
     - `Account` → `Cloudflare Pages` → `Edit`
     - `Zone` → `Zone` → `Read` (for DNS management)
   - **Account Resources:** Select your account
   - **Zone Resources:** Include `idling.app`
4. Copy the token and add to GitHub Secrets as `CF_API_TOKEN`

### Step 2: Get Your Account ID

1. Go to **Cloudflare Dashboard** → Right sidebar
2. Copy your **Account ID**
3. Add to GitHub Secrets as `CF_ACCOUNT_ID`

### Step 3: Configure Custom Domain in Cloudflare Dashboard

1. Go to **Cloudflare Dashboard** → **Workers & Pages** → **Pages**
2. Click **Create a project** (if project doesn't exist)
3. Choose **Direct Upload**
4. Project name: `mods-hub`
5. Click **Create project**

**OR** if the project already exists from the first deployment:

1. Go to **Cloudflare Dashboard** → **Workers & Pages** → **Pages** → **mods-hub**
2. Go to **Custom domains** tab
3. Click **Set up a custom domain**
4. Enter your custom subdomain: `mods.idling.app`
5. Click **Continue**
6. Cloudflare will automatically:
   - Create DNS CNAME record
   - Configure SSL certificate
   - Set up routing

### Step 4: Verify DNS Configuration

1. Go to **Cloudflare Dashboard** → **DNS** → **Records**
2. Verify there's a CNAME record for your custom subdomain:
   - **Name:** `mods`
   - **Target:** `mods-hub.pages.dev` (or similar Cloudflare Pages hostname)
   - **Proxy status:** Proxied (orange cloud) [OK]

**Note:** Cloudflare automatically manages this DNS record when you configure the custom domain in Pages.

### Step 5: SSL/TLS Settings

1. Go to **Cloudflare Dashboard** → **SSL/TLS**
2. Ensure **SSL/TLS encryption mode** is set to **Full** or **Full (strict)**
3. Cloudflare Pages automatically provisions SSL certificates - no manual action needed

## [EMOJI] Automatic Deployments

After initial setup, the GitHub Actions workflow will automatically:

1. Build the React app from `mods-hub/`
2. Deploy to Cloudflare Pages project `mods-hub`
3. Update your custom domain with the latest build

**No manual steps required** after initial configuration.

## [EMOJI] Testing the Setup

After first deployment:

1. Wait 2-5 minutes for DNS propagation
2. Visit your custom domain: `https://mods.idling.app`
3. You should see the Mods Hub interface

## [EMOJI] Environment Variables

The Mods Hub uses the following environment variables (set at build time):

- `VITE_MODS_API_URL` - Backend API URL (defaults to `https://mods-api.idling.app`)
- `VITE_AUTH_API_URL` - Authentication API URL (defaults to `https://auth.idling.app`)

These can be configured in:
1. **GitHub Secrets** (for CI/CD builds)
2. **Cloudflare Pages Environment Variables** (for direct deployments)

## Routing Configuration

The `mods.idling.app` domain uses path-based routing:

- **API Routes** (handled by Worker):
  - `/mods/*` - All mod API endpoints
  - `/health` - Health check endpoint
  - `/api/*` - Future API endpoints (optional)

- **Frontend Routes** (handled by Pages):
  - `/` - Home page (mod list)
  - `/login` - Login page
  - `/mods/:modId` - Mod detail page
  - `/upload` - Upload page
  - `/manage/:modId` - Mod management page
  - All other routes - Handled by React Router

The Worker routes are configured in `serverless/mods-api/wrangler.toml` to only catch API paths, allowing Pages to serve the React frontend for all other routes.

## [EMOJI] Troubleshooting

### Domain Not Resolving

1. Check DNS records in Cloudflare Dashboard
2. Verify CNAME record exists for your custom subdomain
3. Wait up to 24 hours for DNS propagation (usually < 5 minutes)

### SSL Certificate Issues

1. Go to **SSL/TLS** → **Edge Certificates**
2. Check certificate status for your custom domain
3. If pending, wait 5-10 minutes for auto-provisioning

### Deployment Fails

1. Check GitHub Actions logs for errors
2. Verify `CF_API_TOKEN` has correct permissions
3. Verify `CF_ACCOUNT_ID` is correct
4. Check that Pages project `mods-hub` exists

### 404 Errors on Routes

1. Verify the build output directory is `dist`
2. Check that `index.html` exists in build output
3. Ensure React Router is configured correctly (client-side routing)
4. Cloudflare Pages should handle SPA routing automatically, but verify in Pages settings

### API Connection Issues

1. Verify `VITE_MODS_API_URL` and `VITE_AUTH_API_URL` are set correctly
2. Check browser console for CORS errors
3. Verify backend APIs are accessible and CORS is configured

## [EMOJI] Manual Deployment (Testing)

If you need to test deployment manually:

```bash
cd mods-hub
pnpm install
VITE_MODS_API_URL=https://mods-api.idling.app VITE_AUTH_API_URL=https://auth.idling.app pnpm build
pnpm exec wrangler pages deploy dist --project-name=mods-hub --branch=main
```

## [EMOJI] Summary

**What Cloudflare Does Automatically:**
- [OK] Creates DNS CNAME record
- [OK] Provisions SSL certificate
- [OK] Routes traffic from your custom domain to Pages
- [OK] Handles CDN caching and optimization
- [OK] Handles SPA routing for React Router

**What You Need to Do:**
- [OK] Create Cloudflare API token
- [OK] Add secrets to GitHub
- [OK] Configure custom domain in Pages dashboard (first time only)
- [OK] Push code to trigger deployment

That's it! 
