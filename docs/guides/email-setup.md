# Resend Setup Guide - Email OTP Authentication

> **Step-by-step guide to setting up Resend for email OTP authentication**

---

## [EMOJI] Overview

Resend is an email API service that we'll use to send OTP (One-Time Password) codes to users. It has a generous free tier (3,000 emails/month) and is perfect for Cloudflare Workers.

---

## [EMOJI] Step 1: Create Resend Account

### 1.1 Go to Resend Website
1. Open your browser and navigate to: **https://resend.com**
2. Click the **"Sign Up"** button (top right)

### 1.2 Sign Up Options
You can sign up with:
- **GitHub** (recommended - fastest)
- **Google** (also fast)
- **Email** (traditional signup)

**Recommendation**: Use GitHub if you have an account - it's the quickest method.

### 1.3 Complete Registration
- Enter your email address
- Create a password (if using email signup)
- Verify your email if required
- Accept terms of service

---

## [EMOJI] Step 2: Get Your API Key

### 2.1 Navigate to API Keys
1. Once logged in, you'll be on the **Dashboard**
2. Click on **"API Keys"** in the left sidebar
   - Or go directly to: **https://resend.com/api-keys**

### 2.2 Create New API Key
1. Click the **"Create API Key"** button
2. Give it a name (e.g., "Strixun Stream Suite - Production")
3. **IMPORTANT**: Copy the API key immediately - you won't be able to see it again!
   - It will look like: `re_123456789abcdefghijklmnopqrstuvwxyz`
4. Store it securely (we'll add it to Cloudflare Workers secrets next)

### 2.3 API Key Permissions
- **Sending access** is enabled by default (this is what we need)
- You can restrict it to specific domains later if needed

---

## [EMOJI] Step 3: Verify Your Domain (Optional but Recommended)

### 3.1 Why Verify Domain?
- **Better deliverability**: Emails from verified domains are less likely to be marked as spam
- **Professional appearance**: Emails come from `noreply@yourdomain.com` instead of `onboarding@resend.dev`
- **Free tier**: Domain verification is free

### 3.2 Add Domain
1. Go to **"Domains"** in the left sidebar
   - Or: **https://resend.com/domains**
2. Click **"Add Domain"**
3. Enter your domain (e.g., `yourdomain.com`)
4. Click **"Add"**

### 3.3 Add DNS Records
Resend will provide DNS records to add to your domain:

**Example DNS Records:**
```
Type: TXT
Name: @
Value: resend._domainkey.yourdomain.com (provided by Resend)

Type: CNAME
Name: resend
Value: (provided by Resend)
```

**Steps:**
1. Log into your domain registrar (Cloudflare, GoDaddy, etc.)
2. Go to DNS settings
3. Add the provided DNS records
4. Wait for DNS propagation (usually 5-60 minutes)
5. Click **"Verify"** in Resend dashboard

**Note**: If you don't have a domain, you can skip this step and use Resend's default domain (`onboarding@resend.dev`) for testing.

---

##  Step 4: Add API Key to Cloudflare Workers

### 4.1 Install Wrangler CLI (If Not Already Installed)

```bash
# Check if wrangler is installed
wrangler --version

# If not installed, install it globally
npm install -g wrangler

# Or install locally in your project
cd serverless
npm install --save-dev wrangler
```

### 4.2 Login to Cloudflare

```bash
# Navigate to your serverless directory
cd serverless

# Login to Cloudflare (opens browser)
wrangler login
```

### 4.3 Add Resend API Key as Secret

```bash
# Set the secret (replace with your actual API key)
wrangler secret put RESEND_API_KEY

# When prompted, paste your Resend API key
# It will look like: re_123456789abcdefghijklmnopqrstuvwxyz
```

**What this does:**
- Stores the API key securely in Cloudflare Workers
- Makes it available as `env.RESEND_API_KEY` in your worker code
- Never commit secrets to git (they're stored in Cloudflare)

### 4.4 Verify Secret Was Added

```bash
# List all secrets (won't show values, just names)
wrangler secret list
```

You should see `RESEND_API_KEY` in the list.

---

## [EMOJI] Step 5: Test Email Sending

### 5.1 Update Worker Code

Add this test endpoint to your `serverless/worker.js`:

```javascript
/**
 * Test email sending endpoint
 * GET /test/email?to=your@email.com
 */
async function handleTestEmail(request, env) {
    try {
        const url = new URL(request.url);
        const to = url.searchParams.get('to');
        
        if (!to) {
            return new Response(JSON.stringify({ error: 'to parameter required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        // Send test email via Resend
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: 'onboarding@resend.dev', // Use your verified domain if you have one
                to: to,
                subject: 'Test Email from Strixun Stream Suite',
                html: `
                    <h1>Test Email</h1>
                    <p>If you're reading this, Resend is working correctly!</p>
                    <p>This is a test email from your Cloudflare Worker.</p>
                `,
            }),
        });
        
        if (!response.ok) {
            const error = await response.text();
            return new Response(JSON.stringify({ 
                error: 'Failed to send email',
                details: error 
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        
        const data = await response.json();
        
        return new Response(JSON.stringify({ 
            success: true,
            message: 'Test email sent!',
            emailId: data.id 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: 'Failed to send email',
            message: error.message 
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
}
```

Add to your route handler:
```javascript
// In the main fetch handler
if (path === '/test/email' && request.method === 'GET') {
    return handleTestEmail(request, env);
}
```

### 5.2 Deploy Worker

```bash
# Deploy to Cloudflare
cd serverless
wrangler deploy
```

### 5.3 Test Email Sending

```bash
# Replace with your worker URL and email
curl "https://your-worker.your-subdomain.workers.dev/test/email?to=your@email.com"
```

Or open in browser:
```
https://your-worker.your-subdomain.workers.dev/test/email?to=your@email.com
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Test email sent!",
  "emailId": "abc123..."
}
```

**Check Your Email:**
- Check your inbox (and spam folder)
- You should receive the test email within a few seconds

---

## [EMOJI] Step 6: Monitor Usage

### 6.1 Check Resend Dashboard
1. Go to **https://resend.com/dashboard**
2. View **"Activity"** to see sent emails
3. Check **"Usage"** to monitor your free tier usage

### 6.2 Free Tier Limits
- **3,000 emails/month** (100/day average)
- **No credit card required**
- **Automatic upgrade** if you exceed (you'll be notified)

### 6.3 Set Up Alerts (Optional)
1. Go to **"Settings"**  **"Notifications"**
2. Enable email alerts for:
   - Usage approaching limits
   - Failed deliveries
   - Domain verification status

---

## [EMOJI] Step 7: Configure Email Templates (Optional)

### 7.1 Create OTP Email Template

You can create a reusable template for OTP emails:

```javascript
/**
 * Generate OTP email HTML
 */
function generateOTPEmailHTML(otp) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .otp-code { 
                    font-size: 32px; 
                    font-weight: bold; 
                    letter-spacing: 8px; 
                    text-align: center;
                    background: #f4f4f4;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 20px 0;
                }
                .footer { 
                    margin-top: 30px; 
                    font-size: 12px; 
                    color: #666; 
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Your Verification Code</h1>
                <p>Use this code to verify your email address:</p>
                <div class="otp-code">${otp}</div>
                <p>This code will expire in <strong>10 minutes</strong>.</p>
                <p>If you didn't request this code, please ignore this email.</p>
                <div class="footer">
                    <p>Strixun Stream Suite</p>
                    <p>This is an automated message, please do not reply.</p>
                </div>
            </div>
        </body>
        </html>
    `;
}
```

---

## [OK] Step 8: Verify Everything Works

### 8.1 Checklist

- [ ] Resend account created
- [ ] API key generated and copied
- [ ] API key added to Cloudflare Workers secrets
- [ ] Test email endpoint added to worker
- [ ] Worker deployed
- [ ] Test email received successfully
- [ ] Domain verified (optional but recommended)

### 8.2 Common Issues

**Issue: "Invalid API key"**
- **Solution**: Make sure you copied the full API key (starts with `re_`)
- **Solution**: Verify the secret was added correctly: `wrangler secret list`

**Issue: "Email not received"**
- **Solution**: Check spam folder
- **Solution**: Verify email address is correct
- **Solution**: Check Resend dashboard for delivery status

**Issue: "Domain not verified"**
- **Solution**: This is optional - you can use `onboarding@resend.dev` for testing
- **Solution**: For production, verify your domain (see Step 3)

**Issue: "Rate limit exceeded"**
- **Solution**: Free tier is 100 emails/day - wait or upgrade
- **Solution**: Check Resend dashboard for usage stats

---

## [EMOJI] Next Steps

Once Resend is set up:

1. **Implement OTP Generation**: Add OTP generation logic to your worker
2. **Implement Email Sending**: Use Resend API to send OTP codes
3. **Implement OTP Verification**: Verify OTP codes and issue JWT tokens
4. **Update Client**: Add login UI to your Svelte app
5. **Test End-to-End**: Test the complete authentication flow

See [`SECURITY_ANALYSIS.md`](./SECURITY_ANALYSIS.md) for the complete implementation details.

---

## [EMOJI] Additional Resources

- **Resend Documentation**: https://resend.com/docs
- **Resend API Reference**: https://resend.com/docs/api-reference
- **Cloudflare Workers Secrets**: https://developers.cloudflare.com/workers/configuration/secrets/

---

## [EMOJI] Pro Tips

1. **Use Environment Variables**: Store your Resend API key as a Cloudflare secret (never commit to git)
2. **Monitor Usage**: Check Resend dashboard regularly to stay within free tier
3. **Verify Domain**: For production, verify your domain for better deliverability
4. **Test First**: Always test email sending before implementing in production
5. **Handle Errors**: Implement proper error handling for email failures

---

**Last Updated**: 2025-01-01  
**Status**: Ready to Use [OK]

