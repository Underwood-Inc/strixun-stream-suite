# Setting SERVICE_ENCRYPTION_KEY [SECURITY]

## Quick Setup

### Option 1: Use the Script (Recommended)

**Windows (PowerShell):**
```powershell
cd serverless
.\set-service-encryption-key.ps1
```

**Linux/Mac (Bash):**
```bash
cd serverless
chmod +x set-service-encryption-key.sh
./set-service-encryption-key.sh
```

The script will:
1. Prompt you for the key (input is hidden)
2. Set the same key in all 7 workers automatically
3. Show success/failure for each worker

### Option 2: Manual Setup

**Step 1: Generate a key**
```bash
openssl rand -hex 32
```

**Step 2: Set in each worker**
```bash
# otp-auth-service
cd serverless/otp-auth-service
echo "YOUR_KEY_HERE" | wrangler secret put SERVICE_ENCRYPTION_KEY

# customer-api
cd ../customer-api
echo "YOUR_KEY_HERE" | wrangler secret put SERVICE_ENCRYPTION_KEY

# game-api
cd ../game-api
echo "YOUR_KEY_HERE" | wrangler secret put SERVICE_ENCRYPTION_KEY

# chat-signaling
cd ../chat-signaling
echo "YOUR_KEY_HERE" | wrangler secret put SERVICE_ENCRYPTION_KEY

# mods-api
cd ../mods-api
echo "YOUR_KEY_HERE" | wrangler secret put SERVICE_ENCRYPTION_KEY

# url-shortener
cd ../url-shortener
echo "YOUR_KEY_HERE" | wrangler secret put SERVICE_ENCRYPTION_KEY

# twitch-api
cd ../twitch-api
echo "YOUR_KEY_HERE" | wrangler secret put SERVICE_ENCRYPTION_KEY
```

### Option 3: Interactive (Safest)

```bash
# For each worker, run:
cd serverless/otp-auth-service
wrangler secret put SERVICE_ENCRYPTION_KEY
# Paste the key when prompted (input is hidden)

# Repeat for each worker...
```

## Verify

Check that the secret is set in each worker:

```bash
cd serverless/otp-auth-service
wrangler secret list
# Should show SERVICE_ENCRYPTION_KEY

# Repeat for other workers...
```

## Security Notes

- [SUCCESS] **Never commit the key to version control**
- [SUCCESS] **Use the same key across all services** (recommended)
- [SUCCESS] **Store the key securely** (password manager, etc.)
- [SUCCESS] **Rotate periodically** (requires updating all services)

## Troubleshooting

**Error: "Secret not found"**
- Make sure you're in the correct worker directory
- Check that wrangler is authenticated: `wrangler whoami`

**Error: "Key too short"**
- Key must be at least 32 characters
- Generate with: `openssl rand -hex 32` (produces 64-char hex string)

**Error: "Permission denied"**
- Make sure you have access to the Cloudflare account
- Check: `wrangler whoami`

