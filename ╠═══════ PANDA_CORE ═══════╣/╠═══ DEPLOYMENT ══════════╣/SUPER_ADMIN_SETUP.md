# Super Admin Setup Guide

**Last Updated:** 2025-12-29

## Overview

The OTP Auth Service requires super-admin authentication for all admin endpoints. Super admins can be configured via:

1. **API Key Authentication**: Using `SUPER_ADMIN_API_KEY` environment variable
2. **Email-Based Authentication**: Using `SUPER_ADMIN_EMAILS` environment variable (comma-separated list)

## Step 1: Configure Super Admin in Cloudflare

### Option A: Using Cloudflare Dashboard (Recommended)

1. **Navigate to Workers & Pages**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Select your account
   - Go to **Workers & Pages** -> **otp-auth-service**

2. **Set Environment Variables**
   - Click on **Settings** -> **Variables and Secrets**
   - Scroll to **Environment Variables** section

3. **Add Super Admin Configuration**

   **For API Key Authentication:**
   - Click **Add variable**
   - Name: `SUPER_ADMIN_API_KEY`
   - Value: Generate a secure random string (see below)
   - Click **Save**

   **For Email-Based Authentication (Recommended for Dashboard):**
   - Click **Add variable**
   - Name: `SUPER_ADMIN_EMAILS`
   - Value: Comma-separated list of email addresses (e.g., `admin@example.com,superadmin@example.com`)
   - Click **Save**

### Option B: Using Wrangler CLI

```bash
cd serverless/otp-auth-service

# Set super admin API key
wrangler secret put SUPER_ADMIN_API_KEY
# When prompted, enter your secure API key

# Set super admin emails (comma-separated)
wrangler secret put SUPER_ADMIN_EMAILS
# When prompted, enter: admin@example.com,superadmin@example.com
```

## Step 2: Generate Secure API Key (if using API key auth)

Generate a secure random string for the super admin API key:

```bash
# Using OpenSSL
openssl rand -hex 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**Example output:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

## Step 3: Verify Super Admin Access

### Test API Key Authentication

```bash
# Replace YOUR_SUPER_ADMIN_KEY with your actual key
curl -H "Authorization: Bearer YOUR_SUPER_ADMIN_KEY" \
  https://auth.idling.app/admin/analytics
```

### Test Email-Based Authentication (Dashboard)

1. **Sign up/Login to Dashboard**
   - Go to `https://auth.idling.app/dashboard`
   - Sign up or log in with an email that's in your `SUPER_ADMIN_EMAILS` list

2. **Access Admin Panel**
   - Once logged in, you should have access to all admin endpoints
   - Navigate to Analytics to view email tracking data

## Step 4: Access Email Tracking Analytics

### Via Dashboard (Recommended)

1. Log in to the dashboard at `https://auth.idling.app/dashboard`
2. Navigate to the **Analytics** tab
3. Scroll down to see **Email Tracking Analytics** section
4. View:
   - Total email opens
   - Unique countries
   - Average opens per day
   - Opens by country breakdown

### Via API

```bash
# Using API key
curl -H "Authorization: Bearer YOUR_SUPER_ADMIN_KEY" \
  https://auth.idling.app/admin/analytics/email

# Using email-based auth (JWT token from dashboard login)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://auth.idling.app/admin/analytics/email?startDate=2024-12-01&endDate=2024-12-31
```

## Security Best Practices

1. **Use Email-Based Auth for Dashboard**
   - More secure for interactive use
   - Easier to manage multiple admins
   - Supports JWT token rotation

2. **Use API Key for Automation**
   - Better for scripts and CI/CD
   - Store securely in secrets management
   - Rotate regularly

3. **Limit Super Admin Emails**
   - Only add trusted email addresses
   - Remove access immediately when needed
   - Use separate emails for different admins

4. **Monitor Access**
   - Check audit logs regularly
   - Review email tracking analytics for suspicious activity
   - Set up alerts for unusual patterns

## Troubleshooting

### "Super-admin authentication required" Error

**Possible causes:**
1. `SUPER_ADMIN_API_KEY` or `SUPER_ADMIN_EMAILS` not set
2. API key doesn't match
3. Email not in `SUPER_ADMIN_EMAILS` list
4. JWT token expired or invalid

**Solutions:**
1. Verify environment variables are set in Cloudflare Dashboard
2. Check that your email is in the comma-separated list (case-insensitive)
3. Try logging out and back in to refresh JWT token
4. Verify API key matches exactly (no extra spaces)

### Cannot Access Dashboard

**Possible causes:**
1. Email not in super admin list
2. JWT token expired
3. Customer account doesn't exist

**Solutions:**
1. Add your email to `SUPER_ADMIN_EMAILS`
2. Log out and log back in
3. Sign up at `/signup` first, then add email to super admin list

### Email Analytics Not Showing

**Possible causes:**
1. No emails have been sent yet
2. Email tracking pixel not loading
3. Data hasn't been collected

**Solutions:**
1. Send a test OTP email
2. Open the email to trigger tracking
3. Wait a few minutes for data to appear
4. Check that tracking endpoint is accessible: `https://auth.idling.app/track/email-open`

## Additional Configuration

### Using KV for Super Admin List (Alternative)

If you prefer to store super admin emails in KV instead of environment variables:

```bash
# Set super admin emails in KV
wrangler kv:key put "super_admin_emails" "admin@example.com,superadmin@example.com" \
  --namespace-id=680c9dbe86854c369dd23e278abb41f9
```

**Note:** Environment variables take precedence over KV storage.

## Support

For issues or questions:
1. Check Cloudflare Worker logs
2. Review error responses from API endpoints
3. Verify all environment variables are set correctly
4. Ensure your email/API key is in the super admin list
