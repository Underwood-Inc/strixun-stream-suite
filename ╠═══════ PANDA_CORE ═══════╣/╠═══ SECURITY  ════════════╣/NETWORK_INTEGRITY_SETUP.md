# Network Integrity Keyphrase Setup

**Last Updated:** 2025-12-29

## What is NETWORK_INTEGRITY_KEYPHRASE?

`NETWORK_INTEGRITY_KEYPHRASE` is a **security feature** that provides cryptographic integrity verification for all network requests and responses between services. It uses HMAC-SHA256 signatures to:

- ✓ Detect tampering with request/response data
- ✓ Prevent MITM (Man-in-the-Middle) attacks
- ✓ Verify data integrity across service boundaries
- ✓ Automatically validate all API calls

**The warnings you're seeing are normal in development** - the system falls back to a dev keyphrase. In production, you **must** set a proper keyphrase.

## Which Services Need This?

All services that use `ServiceClient` need this keyphrase:

- ✓ `otp-auth-service` (when calling customer-api)
- ✓ `customer-api` (when receiving requests from otp-auth-service)
- ✓ `mods-api` (if it uses ServiceClient)
- ✓ `game-api` (if it uses ServiceClient)
- ✓ Any other service using the shared ServiceClient

**Important**: All services that communicate with each other **must use the same keyphrase**.

## Setup Steps

### Step 1: Generate a Keyphrase

Generate a strong, unique keyphrase (32+ characters recommended):

```bash
# Option 1: Using openssl
openssl rand -hex 32

# Option 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 3: Use a password generator
# Generate a 32+ character random string
```

**Save this keyphrase securely** - you'll need it for all services.

### Step 2: Set in Cloudflare Workers (Production)

Set the same keyphrase in **all services** that communicate with each other:

```bash
# otp-auth-service
cd serverless/otp-auth-service
wrangler secret put NETWORK_INTEGRITY_KEYPHRASE
# Paste your keyphrase when prompted

# customer-api
cd ../customer-api
wrangler secret put NETWORK_INTEGRITY_KEYPHRASE
# Paste the SAME keyphrase

# mods-api (if it uses ServiceClient)
cd ../mods-api
wrangler secret put NETWORK_INTEGRITY_KEYPHRASE
# Paste the SAME keyphrase

# Repeat for any other services using ServiceClient
```

**⚠ CRITICAL**: All services must use the **same keyphrase** or integrity checks will fail!

### Step 3: Set in GitHub Secrets (For CI/CD)

If you're using GitHub Actions for deployment, add the keyphrase as a repository secret:

1. Go to your GitHub repository
2. Settings -> Secrets and variables -> Actions
3. Click "New repository secret"
4. Name: `NETWORK_INTEGRITY_KEYPHRASE`
5. Value: Your keyphrase (same one used in Cloudflare Workers)

### Step 4: Update GitHub Workflows (If Needed)

If your GitHub workflows deploy services, they should automatically use the secret. Verify your workflows reference it:

```yaml
# Example workflow step
- name: Deploy to Cloudflare
  run: wrangler deploy
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
    # NETWORK_INTEGRITY_KEYPHRASE is set via wrangler secret put
    # GitHub Actions can't set wrangler secrets directly
```

**Note**: GitHub Actions can't set wrangler secrets directly. You need to:
1. Set secrets manually via `wrangler secret put` (one-time setup)
2. Or use Cloudflare API to set secrets programmatically

### Step 5: Local Development (Optional)

For local development, you can set it in your environment:

**Windows (PowerShell):**
```powershell
$env:NETWORK_INTEGRITY_KEYPHRASE = "your-keyphrase-here"
```

**Linux/Mac (Bash):**
```bash
export NETWORK_INTEGRITY_KEYPHRASE="your-keyphrase-here"
```

Or create a `.dev.vars` file in each service directory (not committed to git):

```bash
# serverless/otp-auth-service/.dev.vars
NETWORK_INTEGRITY_KEYPHRASE=your-keyphrase-here
```

**Note**: `.dev.vars` is automatically loaded by `wrangler dev` but is gitignored.

## Verify Setup

### Check Secrets in Cloudflare Workers

```bash
# Check if secret is set
cd serverless/otp-auth-service
wrangler secret list
# Should show NETWORK_INTEGRITY_KEYPHRASE

# Repeat for other services
cd ../customer-api
wrangler secret list
```

### Test Integrity Checks

After setting the keyphrase, the warnings should disappear. You can verify by:

1. **Check logs**: The warnings should stop appearing
2. **Test API calls**: Make a request between services - it should work without warnings
3. **Verify headers**: Check that `X-Strixun-Request-Integrity` headers are present

## Troubleshooting

### Warnings Still Appear

If warnings still appear after setting the secret:

1. **Verify secret is set**: `wrangler secret list`
2. **Redeploy the worker**: `wrangler deploy`
3. **Check service communication**: Ensure both services have the same keyphrase
4. **Check environment**: Make sure you're testing against the correct environment (dev vs production)

### Integrity Checks Fail

If integrity checks fail (requests are rejected):

1. **Verify same keyphrase**: All services must use the **exact same keyphrase**
2. **Check service communication**: Ensure services can reach each other
3. **Verify headers**: Check that integrity headers are being sent/received
4. **Check logs**: Look for specific integrity error messages

### GitHub Actions Deployment

If deploying via GitHub Actions:

1. **Secrets are set manually**: GitHub Actions can't set wrangler secrets automatically
2. **One-time setup**: Run `wrangler secret put NETWORK_INTEGRITY_KEYPHRASE` manually for each service
3. **Secrets persist**: Once set, secrets persist across deployments
4. **Environment-specific**: Set secrets for each environment (production, staging, etc.)

## Security Best Practices

1. ✓ **Use a strong keyphrase**: 32+ characters, random
2. ✓ **Same keyphrase across services**: All communicating services must match
3. ✓ **Store securely**: Use a password manager or secure vault
4. ✓ **Rotate periodically**: Change the keyphrase periodically (requires updating all services)
5. ✓ **Never commit to git**: Keep keyphrases out of version control
6. ✓ **Use different keyphrases per environment**: Dev, staging, production should have different keyphrases

## Quick Reference

```bash
# Generate keyphrase
openssl rand -hex 32

# Set in service (interactive)
cd serverless/otp-auth-service
wrangler secret put NETWORK_INTEGRITY_KEYPHRASE

# Set in service (non-interactive)
echo "your-keyphrase-here" | wrangler secret put NETWORK_INTEGRITY_KEYPHRASE

# Verify secret is set
wrangler secret list

# Set in GitHub Secrets
# Go to: Repository -> Settings -> Secrets and variables -> Actions
# Add: NETWORK_INTEGRITY_KEYPHRASE = your-keyphrase-here
```

## Summary

**For Production:**
1. ✓ Generate a strong keyphrase (32+ chars)
2. ✓ Set via `wrangler secret put NETWORK_INTEGRITY_KEYPHRASE` in all services
3. ✓ Use the **same keyphrase** across all communicating services
4. ✓ Add to GitHub Secrets for CI/CD (if using GitHub Actions)

**For Development:**
- Warnings are normal - the system uses a dev fallback
- You can set `.dev.vars` files for local development
- Or ignore warnings in dev (they won't affect functionality)

The warnings you're seeing are **expected in development** and won't affect functionality. For production, just set the secret in all services and the warnings will disappear.
