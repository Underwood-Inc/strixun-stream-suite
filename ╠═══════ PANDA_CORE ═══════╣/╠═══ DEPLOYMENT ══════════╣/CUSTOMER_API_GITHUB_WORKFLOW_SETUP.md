# GitHub Workflow Setup for Customer API

> **Complete guide for GitHub Actions automated deployment**

**Date:** 2025-12-29

---

## Overview

The Customer API has an automated GitHub Actions workflow that handles deployment, KV namespace creation, and secret management.

---

## ✓ What the Workflow Does

### Automatic Steps

1. **Creates KV Namespace** (if it doesn't exist)
   - Automatically runs `wrangler kv namespace create "CUSTOMER_API_KV"`
   - Fails gracefully if namespace already exists
   - Similar pattern to storybook workflow

2. **Deploys Worker**
   - Runs `wrangler deploy` to deploy the worker
   - Worker is automatically created on first deploy

3. **Sets Secrets** (if configured in GitHub)
   - `JWT_SECRET` - From `secrets.JWT_SECRET`
   - `ALLOWED_ORIGINS` - From `secrets.ALLOWED_ORIGINS`
   - Only sets secrets if they exist in GitHub repository secrets

4. **Deployment Summary**
   - Shows service URL and endpoints
   - Displays KV namespace ID (if found in wrangler.toml)
   - Warns if namespace ID needs to be updated

---

## ★ Required GitHub Secrets

The workflow requires these secrets to be set in your GitHub repository:

### Required Secrets

1. **`CF_API_TOKEN`** ✓ (Required)
   - Cloudflare API token with Workers edit permissions
   - Get from: Cloudflare Dashboard ★ My Profile ★ API Tokens

2. **`CF_ACCOUNT_ID`** ✓ (Required)
   - Your Cloudflare account ID
   - Get from: Cloudflare Dashboard ★ Right sidebar ★ Account ID

### Optional Secrets (Recommended)

3. **`JWT_SECRET`** (Optional but Recommended)
   - JWT signing secret (must match OTP auth service)
   - Will be automatically set on worker if present

4. **`ALLOWED_ORIGINS`** (Optional but Recommended)
   - Comma-separated CORS origins
   - See [CORS Origins Audit](../09_AUDITS_AND_REPORTS/CUSTOMER_API_CORS_ORIGINS_AUDIT.md) for complete list
   - Will be automatically set on worker if present

---

## ★ Setup Steps

### Step 1: Set Required GitHub Secrets

Go to your GitHub repository ★ Settings ★ Secrets and variables ★ Actions ★ New repository secret

**Set these secrets:**

1. **`CF_API_TOKEN`**
   - Value: Your Cloudflare API token
   - Get from: Cloudflare Dashboard ★ My Profile ★ API Tokens ★ Create Token
   - Permissions needed: Account ★ Workers Scripts ★ Edit

2. **`CF_ACCOUNT_ID`**
   - Value: Your Cloudflare account ID
   - Get from: Cloudflare Dashboard ★ Right sidebar

### Step 2: Set Optional Secrets (Recommended)

3. **`JWT_SECRET`**
   - Value: Your JWT secret (must match OTP auth service)
   - Get from: OTP auth service secrets or generate new one

4. **`ALLOWED_ORIGINS`**
   - Value: Comma-separated origins (see [CORS Origins Audit](../09_AUDITS_AND_REPORTS/CUSTOMER_API_CORS_ORIGINS_AUDIT.md))
   - Example: `https://auth.idling.app,https://api.idling.app,https://customer.idling.app,...`

### Step 3: Update wrangler.toml (First Time Only)

**Important:** The workflow will create the KV namespace, but you need to update `wrangler.toml` with the namespace ID after the first deployment.

1. **Deploy via workflow** (push to main or manual trigger)
2. **Check workflow output** for namespace creation
3. **Get namespace ID:**
   ```bash
   cd serverless/customer-api
   wrangler kv namespace list
   ```
4. **Update `wrangler.toml`** with the actual namespace ID (replace `PLACEHOLDER_ID`)

---

## ★ Workflow Triggers

The workflow automatically runs when:

1. **Push to main/master** with changes to `serverless/customer-api/**`
2. **Manual trigger** via GitHub Actions UI (workflow_dispatch)

### Manual Trigger

1. Go to GitHub repository ★ Actions tab
2. Select "Deploy Customer API" workflow
3. Click "Run workflow" ★ Select branch ★ Run

---

## ★ Workflow Steps Breakdown

```yaml
1. Checkout code
2. Setup pnpm (v9.15.1)
3. Setup Node.js (v20)
4. Install root dependencies
5. Install customer-api dependencies
6. Create KV namespace (if needed) ★ AUTOMATIC
7. Deploy worker ★ AUTOMATIC
8. Set secrets (if configured) ★ AUTOMATIC
9. Get KV namespace ID (for summary)
10. Deployment summary
```

---

## ⚠ Important Notes

### KV Namespace ID

- **First Deployment:** Workflow creates namespace, but you must manually update `wrangler.toml` with the ID
- **Subsequent Deployments:** Workflow uses existing namespace ID from `wrangler.toml`
- **How to Get ID:** Run `wrangler kv namespace list` after first deployment

### Worker Creation

- **Automatic:** Worker is created automatically on first `wrangler deploy`
- **No Manual Step:** You don't need to create the worker manually
- **Name:** `strixun-customer-api` (from wrangler.toml)

### Secrets Management

- **GitHub Secrets:** Set in repository settings
- **Worker Secrets:** Automatically synced from GitHub secrets
- **Manual Override:** You can still set secrets manually via `wrangler secret put`

---

## ★ Verification

After deployment, verify:

1. **Check workflow run:**
   - Go to GitHub ★ Actions ★ Latest "Deploy Customer API" run
   - Should show ✓ green checkmarks for all steps

2. **Test health endpoint:**
   ```bash
   curl https://customer.idling.app/health
   # Or
   curl https://strixun-customer-api.YOUR_SUBDOMAIN.workers.dev/health
   ```

3. **Verify secrets:**
   ```bash
   cd serverless/customer-api
   wrangler secret list
   ```

4. **Check KV namespace:**
   ```bash
   wrangler kv namespace list
   # Should show CUSTOMER_API_KV
   ```

---

## ★ Troubleshooting

### Workflow Fails: "KV namespace not found"

**Solution:** 
1. Check that `CF_API_TOKEN` has correct permissions
2. Manually create namespace: `wrangler kv namespace create "CUSTOMER_API_KV"`
3. Update `wrangler.toml` with namespace ID
4. Re-run workflow

### Workflow Fails: "Worker deployment failed"

**Solution:**
1. Check `CF_API_TOKEN` and `CF_ACCOUNT_ID` secrets are set
2. Verify token has Workers edit permissions
3. Check workflow logs for specific error

### Secrets Not Set

**Solution:**
1. Verify secrets exist in GitHub repository settings
2. Check secret names match exactly: `JWT_SECRET`, `ALLOWED_ORIGINS`
3. Re-run workflow after adding secrets

### Namespace ID Not Updated

**Solution:**
1. After first deployment, get namespace ID: `wrangler kv namespace list`
2. Update `wrangler.toml` with actual ID
3. Commit and push (workflow will use correct ID on next deploy)

---

## ★ Workflow File Location

`.github/workflows/deploy-customer-api.yml`

---

## ★ Comparison with Other Workflows

This workflow follows the same pattern as:
- `deploy-game-api.yml`
- `deploy-mods-api.yml`
- `deploy-otp-auth.yml`

**Key Differences:**
- ✓ Automatically creates KV namespace (like storybook creates Pages project)
- ✓ Extracts and displays KV namespace ID in summary
- ✓ Handles customer-api specific dependencies

---

**Status:** ✓ **WORKFLOW CREATED**  
**Auto-Deploys:** ✓ Yes (on push to main/master)  
**Auto-Creates:** ✓ KV namespace (if missing)  
**Auto-Sets Secrets:** ✓ Yes (if configured in GitHub)

---

**Last Updated**: 2025-12-29

