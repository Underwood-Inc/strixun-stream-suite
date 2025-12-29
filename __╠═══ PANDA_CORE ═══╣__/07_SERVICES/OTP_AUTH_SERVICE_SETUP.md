# Local Development Setup - OTP Auth Service

**Last Updated:** 2025-12-29

## Quick Setup (5 minutes)

The auth service requires **3 secrets** to work in local development. Follow these steps:

### Step 1: Create `.dev.vars` file

Navigate to the `serverless/otp-auth-service` directory and create a `.dev.vars` file:

```bash
cd serverless/otp-auth-service
cp .dev.vars.example .dev.vars
```

### Step 2: Generate JWT Secret

Generate a secure JWT secret (must match `mods-api` if you have one):

**On Windows (PowerShell):**
```powershell
# Generate a random 64-character hex string
-join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

**On Mac/Linux:**
```bash
openssl rand -hex 32
```

**Or use an online generator:** https://www.random.org/strings/

### Step 3: Get Resend API Key

1. Go to https://resend.com/api-keys
2. Sign up or log in
3. Create a new API key
4. Copy the key (starts with `re_`)

### Step 4: Verify Email in Resend

1. Go to https://resend.com/emails
2. Add and verify your email address (or use a test email)
3. This will be your `RESEND_FROM_EMAIL`

### Step 5: Get Encryption Key

The encryption key must match what your frontend uses. Check your frontend `.env` file for `VITE_SERVICE_ENCRYPTION_KEY`.

**If you don't have one, generate it:**
```powershell
# Windows PowerShell
-join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

**Important:** Use the **same** key in both frontend and backend!

### Step 6: Edit `.dev.vars`

Open `serverless/otp-auth-service/.dev.vars` and fill in the values:

```bash
# JWT Secret (REQUIRED - must match mods-api JWT_SECRET)
JWT_SECRET=your_generated_jwt_secret_here_64_chars

# Email Service (REQUIRED)
RESEND_API_KEY=re_your_resend_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Encryption Key (REQUIRED - must match frontend VITE_SERVICE_ENCRYPTION_KEY)
VITE_SERVICE_ENCRYPTION_KEY=your_encryption_key_here_64_chars

# Optional
ENVIRONMENT=development
```

### Step 7: Verify mods-api has matching JWT_SECRET

If `mods-api` is already running, make sure it has the **same** `JWT_SECRET`:

1. Check if `serverless/mods-api/.dev.vars` exists
2. If not, create it with the same `JWT_SECRET`:
   ```bash
   cd ../mods-api
   echo "JWT_SECRET=your_generated_jwt_secret_here_64_chars" > .dev.vars
   ```

### Step 8: Restart Services

Stop all running services (Ctrl+C) and restart:

```bash
cd mods-hub
pnpm dev:all
```

## Troubleshooting

### Error: "JWT_SECRET is required"
- Make sure `.dev.vars` exists in `serverless/otp-auth-service/`
- Check that `JWT_SECRET=` line is not commented out
- Restart the wrangler dev server

### Error: "VITE_SERVICE_ENCRYPTION_KEY is required"
- Add `VITE_SERVICE_ENCRYPTION_KEY` to `.dev.vars`
- Make sure it matches the frontend `.env` file

### Error: "Failed to send email" or 500 on OTP request
- Verify `RESEND_API_KEY` is correct
- Verify `RESEND_FROM_EMAIL` is verified in Resend dashboard
- Check Resend API key has proper permissions

### Authentication fails between services
- Ensure `JWT_SECRET` is **identical** in both:
  - `serverless/otp-auth-service/.dev.vars`
  - `serverless/mods-api/.dev.vars`
- Restart both services after changing secrets

## File Locations

```
serverless/
├── otp-auth-service/
│   ├── .dev.vars          [INFO] Create this file
│   └── .dev.vars.example  [INFO] Template
└── mods-api/
    └── .dev.vars          [INFO] Should also have JWT_SECRET
```

## Next Steps

Once `.dev.vars` is configured:
1. Run `pnpm dev:all` from `mods-hub/`
2. Try logging in at http://localhost:3001
3. Check console logs for any remaining errors
