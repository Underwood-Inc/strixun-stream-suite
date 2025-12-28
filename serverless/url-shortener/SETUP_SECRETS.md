# URL Shortener - Secret Setup Guide

## Required Secret: JWT_SECRET

The URL shortener requires the `JWT_SECRET` environment variable to verify JWT tokens from the OTP auth service.

**CRITICAL**: This must be the **SAME** secret as your OTP auth service uses, otherwise authentication will fail.

## Setup Instructions

### Option 1: Using Wrangler CLI (Recommended)

1. Navigate to the URL shortener directory:
   ```bash
   cd serverless/url-shortener
   ```

2. Set the JWT_SECRET secret (use the SAME value as your OTP auth service):
   ```bash
   wrangler secret put JWT_SECRET
   ```
   
   When prompted, enter the same JWT secret that your OTP auth service uses.

3. For production environment:
   ```bash
   wrangler secret put JWT_SECRET --env production
   ```

### Option 2: Using Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** [EMOJI] **strixun-url-shortener**
3. Go to **Settings** [EMOJI] **Variables and Secrets**
4. Under **Secrets**, click **Add secret**
5. Name: `JWT_SECRET`
6. Value: Enter the same JWT secret as your OTP auth service
7. Click **Save**

## Finding Your OTP Auth Service JWT Secret

If you don't know what JWT secret your OTP auth service is using:

1. Check your OTP auth service secrets:
   ```bash
   cd serverless/otp-auth-service
   wrangler secret list
   ```

2. Or check the Cloudflare Dashboard for the `otp-auth-service` worker's secrets

## Verification

After setting the secret, test authentication:

1. Deploy the URL shortener:
   ```bash
   cd serverless/url-shortener
   wrangler deploy --env production
   ```

2. Try creating a short URL with a JWT token from the OTP auth service
3. Check the logs:
   ```bash
   wrangler tail --env production
   ```

If authentication still fails, verify:
- The JWT_SECRET is set correctly
- The secret matches the OTP auth service exactly
- The JWT token is valid and not expired

## Troubleshooting

### Error: "JWT_SECRET environment variable is required"

This means the secret is not set. Follow the setup instructions above.

### Error: "Invalid or expired token"

This could mean:
1. The JWT_SECRET doesn't match the OTP auth service
2. The token is expired
3. The token format is incorrect

Verify the JWT_SECRET matches exactly between both services.

