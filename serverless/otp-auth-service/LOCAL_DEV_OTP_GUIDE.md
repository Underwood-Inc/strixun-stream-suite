# Local Development OTP Guide

**Last Updated:** 2025-01-02

## Quick Answer: How to Get Your OTP Code

When running `pnpm dev:all` in local development, OTP codes are **intercepted** and **not sent via email**. Here's how to get your code:

### Method 1: Check Console Output (Easiest)

When you request an OTP code, check the **wrangler dev** console output. You'll see:

```
[DEV] Generated OTP for user@example.com: 123456789
[DEV] Retrieve OTP via: GET http://localhost:8787/dev/otp?email=user@example.com
[E2E] OTP intercepted and stored in local KV: e2e_otp_abc123...
[DEV] OTP Code for user@example.com: 123456789
```

**The OTP code is printed directly in the console!**

### Method 2: Use Dev Endpoint (API)

After requesting an OTP, you can retrieve it via the dev endpoint:

```bash
# Get OTP for your email
curl "http://localhost:8787/dev/otp?email=your-email@example.com"
```

Response:
```json
{
  "email": "your-email@example.com",
  "otp": "123456789",
  "expiresIn": "10 minutes",
  "note": "This endpoint is only available in test/development mode"
}
```

### Method 3: Use Static Test Code

If you've run `pnpm setup:test-secrets` in `serverless/otp-auth-service`, you can use the static test code:

1. Check `.dev.vars` for `E2E_TEST_OTP_CODE`
2. Use that code for any email (only works when `ENVIRONMENT=test`)

## How It Works

### Test Mode Email Interception

When running locally with test mode enabled:

1. **Email is NOT sent** - OTP codes are intercepted before sending
2. **OTP is stored in local KV** - Stored with key `e2e_otp_{emailHash}`
3. **OTP is logged to console** - Printed for easy access
4. **Dev endpoint available** - `/dev/otp?email=...` retrieves the code

### Requirements for Test Mode

Test mode is enabled when **ALL** of these are true:

1. `ENVIRONMENT=test` in `.dev.vars`
2. `RESEND_API_KEY` starts with `re_test_` (test key)
3. Running locally with `wrangler dev --port 8787`

### Setup Test Mode

Run the setup script to enable test mode:

```bash
cd serverless/otp-auth-service
pnpm setup:test-secrets
```

This will:
- Set `ENVIRONMENT=test`
- Set `RESEND_API_KEY=re_test_key_for_local_development`
- Generate `E2E_TEST_OTP_CODE` (static code for testing)
- Set up all required test secrets

## Production Safety

**These dev features are NEVER available in production:**

- `ENVIRONMENT` is never `'test'` in production
- `RESEND_API_KEY` never starts with `'re_test_'` in production
- Dev endpoints return 403 in production
- OTP codes are always sent via email in production

## Troubleshooting

### OTP Not Found Error

If you get `OTP not found` from the dev endpoint:

1. **Request an OTP first** - The endpoint only returns codes that have been requested
2. **Check test mode** - Ensure `ENVIRONMENT=test` in `.dev.vars`
3. **Check email format** - Use the exact email you used to request the OTP

### Console Not Showing OTP

If you don't see OTP in console:

1. **Check test mode** - Ensure `ENVIRONMENT=test` or `ENVIRONMENT=development`
2. **Check RESEND_API_KEY** - Should start with `re_test_` for interception
3. **Check wrangler output** - Look for `[DEV]` or `[E2E]` log messages

### Still Getting Real Emails

If emails are still being sent:

1. **Check RESEND_API_KEY** - Must start with `re_test_` for interception
2. **Check ENVIRONMENT** - Must be `test` or `development`
3. **Restart wrangler** - Changes to `.dev.vars` require restart

## Example Workflow

```bash
# 1. Start dev servers
cd mods-hub
pnpm dev:all

# 2. In browser, go to http://localhost:3001/login
# 3. Enter your email and click "Request Code"
# 4. Check wrangler console for OTP code:
#    [DEV] Generated OTP for user@example.com: 123456789

# 5. Enter the OTP code in the login form
# 6. You're logged in!
```

## Alternative: Use Static Test Code

If you prefer a consistent code for testing:

1. Run `pnpm setup:test-secrets` in `serverless/otp-auth-service`
2. Check `.dev.vars` for `E2E_TEST_OTP_CODE`
3. Use that code for any email (works when `ENVIRONMENT=test`)

Example:
```bash
# In .dev.vars
E2E_TEST_OTP_CODE=123456789

# Use "123456789" for any email in test mode
```

