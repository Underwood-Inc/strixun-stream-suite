# Cloudflare Pages Setup for Storybook - design.idling.app

This guide covers setting up Cloudflare Pages to serve Storybook at `design.idling.app`.

## [EMOJI] Prerequisites

1. **Cloudflare Account** with `idling.app` domain added
2. **GitHub Secrets** configured:
   - `CF_API_TOKEN` - Cloudflare API token with Pages write permissions
   - `CF_ACCOUNT_ID` - Your Cloudflare Account ID

## [EMOJI] Setup Steps

### Step 1: Create Cloudflare API Token

1. Go to **Cloudflare Dashboard**  **My Profile**  **API Tokens**
2. Click **Create Token**
3. Use **Edit Cloudflare Workers** template OR create custom token with:
   - **Permissions:**
     - `Account`  `Cloudflare Pages`  `Edit`
     - `Zone`  `Zone`  `Read` (for DNS management)
   - **Account Resources:** Select your account
   - **Zone Resources:** Include `idling.app`
4. Copy the token and add to GitHub Secrets as `CF_API_TOKEN`

### Step 2: Get Your Account ID

1. Go to **Cloudflare Dashboard**  Right sidebar
2. Copy your **Account ID**
3. Add to GitHub Secrets as `CF_ACCOUNT_ID`

### Step 3: Initial Deployment (Creates Pages Project)

The first time the workflow runs, it will automatically create a Cloudflare Pages project named `storybook`. 

**OR** you can create it manually:

1. Go to **Cloudflare Dashboard**  **Workers & Pages**  **Pages**
2. Click **Create a project**
3. Choose **Direct Upload**
4. Project name: `storybook`
5. Click **Create project**

### Step 4: Configure Custom Domain

After the first deployment:

1. Go to **Cloudflare Dashboard**  **Workers & Pages**  **Pages**  **storybook**
2. Go to **Custom domains** tab
3. Click **Set up a custom domain**
4. Enter: `design.idling.app`
5. Click **Continue**
6. Cloudflare will automatically:
   - Create DNS CNAME record: `design`  `storybook.pages.dev`
   - Configure SSL certificate
   - Set up routing

### Step 5: Verify DNS Configuration

1. Go to **Cloudflare Dashboard**  **DNS**  **Records**
2. Verify there's a CNAME record:
   - **Name:** `design`
   - **Target:** `storybook.pages.dev` (or similar Cloudflare Pages hostname)
   - **Proxy status:** Proxied (orange cloud) [OK]

**Note:** Cloudflare automatically manages this DNS record. You don't need to create it manually.

### Step 6: SSL/TLS Settings

1. Go to **Cloudflare Dashboard**  **SSL/TLS**
2. Ensure **SSL/TLS encryption mode** is set to **Full** or **Full (strict)**
3. Cloudflare Pages automatically provisions SSL certificates - no manual action needed

## [EMOJI] Automatic Deployments

After initial setup, the GitHub Actions workflow will automatically:

1. Build Storybook from `shared-components/`
2. Deploy to Cloudflare Pages project `storybook`
3. Update `design.idling.app` with the latest build

**No manual steps required** after initial configuration.

## [EMOJI] Testing the Setup

After first deployment:

1. Wait 2-5 minutes for DNS propagation
2. Visit: `https://design.idling.app`
3. You should see your Storybook interface

## [EMOJI] Troubleshooting

### Domain Not Resolving

1. Check DNS records in Cloudflare Dashboard
2. Verify CNAME record exists for `design.idling.app`
3. Wait up to 24 hours for DNS propagation (usually < 5 minutes)

### SSL Certificate Issues

1. Go to **SSL/TLS**  **Edge Certificates**
2. Check certificate status for `design.idling.app`
3. If pending, wait 5-10 minutes for auto-provisioning

### Deployment Fails

1. Check GitHub Actions logs for errors
2. Verify `CF_API_TOKEN` has correct permissions
3. Verify `CF_ACCOUNT_ID` is correct
4. Check that Pages project `storybook` exists

### 404 Errors

1. Verify the build output directory is `storybook-static`
2. Check that `index.html` exists in build output
3. Ensure base path in Storybook config is `/` (not a subdirectory)

## [EMOJI] Manual Deployment (Testing)

If you need to test deployment manually:

```bash
cd shared-components
pnpm install
pnpm build-storybook
pnpm exec wrangler pages deploy storybook-static --project-name=storybook --branch=main
```

## [EMOJI] Summary

**What Cloudflare Does Automatically:**
- [OK] Creates DNS CNAME record
- [OK] Provisions SSL certificate
- [OK] Routes traffic from `design.idling.app` to Pages
- [OK] Handles CDN caching and optimization

**What You Need to Do:**
- [OK] Create Cloudflare API token
- [OK] Add secrets to GitHub
- [OK] Configure custom domain in Pages dashboard (first time only)
- [OK] Push code to trigger deployment

That's it! 

